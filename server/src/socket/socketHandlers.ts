import { Server, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { roomManager } from '../managers/RoomManager';
import { gameEngine } from '../engine/GameEngine';
import { logger } from '../utils/logger';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
  ChatMessage,
  JoinRoomPayload,
  SubmitDescriptionPayload,
  ChatMessagePayload,
  CastVotePayload,
  WebRTCOfferPayload,
  WebRTCAnswerPayload,
  WebRTCIceCandidatePayload,
} from '../types';

type AppServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

// ── Per-socket event-level rate limiter ──────────────────────────────────────
function makeRateLimiter(maxPerWindow: number, windowMs: number) {
  const counts = new Map<string, { count: number; resetAt: number }>();
  return (socketId: string): boolean => {
    const now = Date.now();
    const entry = counts.get(socketId);
    if (!entry || now >= entry.resetAt) {
      counts.set(socketId, { count: 1, resetAt: now + windowMs });
      return true;
    }
    if (entry.count >= maxPerWindow) return false;
    entry.count++;
    return true;
  };
}

const chatRateLimit        = makeRateLimiter(10, 5_000);
const voteRateLimit        = makeRateLimiter(1,  60_000);
const descriptionRateLimit = makeRateLimiter(1,  120_000);

// ─────────────────────────────────────────────────────────────────────────────

export function registerSocketHandlers(io: AppServer, socket: AppSocket): void {

  // ── JOIN ROOM ─────────────────────────────────────────────────────────────
  socket.on('join-room', ({ roomId, displayName }: JoinRoomPayload): void => {
    const cleanName = displayName?.trim().slice(0, 20);
    if (!cleanName) {
      socket.emit('error', { code: 'INVALID_NAME', message: 'Display name is required.' });
      return;
    }

    const room = roomManager.getRoom(roomId);
    if (!room) {
      socket.emit('error', { code: 'ROOM_NOT_FOUND', message: 'Room not found.' });
      return;
    }

    const result = roomManager.addPlayer(room, socket.id, cleanName);
    if ('error' in result) {
      const messages: Record<string, string> = {
        ROOM_FULL: 'This room is full (max 5 players).',
        GAME_IN_PROGRESS: 'A game is already in progress.',
      };
      socket.emit('error', {
        code: result.error,
        message: messages[result.error] ?? 'Could not join room.',
      });
      return;
    }

    // TypeScript now knows result has { player, alreadyExisted }
    const { player, alreadyExisted } = result;
    socket.data.userId      = player.userId;
    socket.data.roomId      = roomId;
    socket.data.displayName = cleanName;
    socket.join(roomId);

    socket.emit('room-joined', {
      userId:  player.userId,
      roomId,
      players: roomManager.getPublicPlayers(room),
      isHost:  player.isHost,
    });

    if (alreadyExisted) {
      socket.to(roomId).emit('player-reconnected', { userId: player.userId });

      const { phase, imposterId, civilianWord, imposterWord, category } = room.game;

      if (
        phase === 'WORD_REVEAL' ||
        phase === 'DESCRIPTION' ||
        phase === 'DISCUSSION' ||
        phase === 'VOTING'
      ) {
        const isImposter = imposterId === player.userId;
        socket.emit('your-word', {
          word:       isImposter ? imposterWord! : civilianWord!,
          isImposter,
          category:   category!,
        });
      }

      if (phase === 'DISCUSSION' || phase === 'VOTING' || phase === 'RESULT') {
        socket.emit('all-descriptions', {
          descriptions: Array.from(room.game.descriptions.values()),
        });
      }

      socket.emit('game-phase-changed', {
        phase:       room.game.phase,
        phaseEndsAt: room.game.phaseEndsAt,
        round:       room.game.round,
      });
    } else {
      socket.to(roomId).emit('player-joined', {
        player: roomManager.toPublicPlayer(player),
      });
    }

    logger.info('join-room handled', { roomId, userId: player.userId, alreadyExisted });
  });

  // ── LEAVE ROOM ────────────────────────────────────────────────────────────
  socket.on('leave-room', (): void => {
    handleLeave(socket, io, 'explicit');
  });

  // ── START GAME ────────────────────────────────────────────────────────────
  socket.on('start-game', (): void => {
    const { roomId, userId } = socket.data;
    if (!roomId || !userId) return;

    const room = roomManager.getRoom(roomId);
    if (!room) return;

    const player = room.players.get(userId);
    if (!player?.isHost) {
      socket.emit('error', { code: 'NOT_HOST', message: 'Only the host can start the game.' });
      return;
    }

    const err = gameEngine.startGame(room);
    if (err) socket.emit('error', { code: err.error, message: err.error });
  });

  // ── SUBMIT DESCRIPTION ────────────────────────────────────────────────────
  socket.on('submit-description', ({ description }: SubmitDescriptionPayload): void => {
    const { roomId, userId } = socket.data;
    if (!roomId || !userId) return;

    if (!descriptionRateLimit(socket.id)) {
      socket.emit('error', { code: 'RATE_LIMITED', message: 'Already submitted a description.' });
      return;
    }

    const room = roomManager.getRoom(roomId);
    if (!room) return;

    const err = gameEngine.submitDescription(room, userId, description ?? '');
    if (err) socket.emit('error', { code: err.error, message: err.error });
  });

  // ── CHAT MESSAGE ──────────────────────────────────────────────────────────
  socket.on('chat-message', ({ text }: ChatMessagePayload): void => {
    const { roomId, userId, displayName } = socket.data;
    if (!roomId || !userId) return;

    if (!chatRateLimit(socket.id)) {
      socket.emit('error', { code: 'RATE_LIMITED', message: 'Slow down!' });
      return;
    }

    const cleanText = text?.trim().slice(0, 300);
    if (!cleanText) return;

    const room = roomManager.getRoom(roomId);
    if (!room) return;

    if (room.game.phase !== 'DISCUSSION') {
      socket.emit('error', { code: 'CHAT_NOT_ALLOWED', message: 'Chat is only available during discussion.' });
      return;
    }

    const message: ChatMessage = {
      messageId: uuidv4(),
      userId,
      displayName,
      text: cleanText,
      timestamp: Date.now(),
    };

    room.chat.push(message);
    if (room.chat.length > 200) room.chat.splice(0, room.chat.length - 200);
    io.to(roomId).emit('chat-message', message);
  });

  // ── CAST VOTE ─────────────────────────────────────────────────────────────
  socket.on('cast-vote', ({ targetUserId }: CastVotePayload): void => {
    const { roomId, userId } = socket.data;
    if (!roomId || !userId) return;

    if (!voteRateLimit(socket.id)) {
      socket.emit('error', { code: 'RATE_LIMITED', message: 'You already voted.' });
      return;
    }

    const room = roomManager.getRoom(roomId);
    if (!room) return;

    const err = gameEngine.castVote(room, userId, targetUserId);
    if (err) {
      socket.emit('error', { code: err.error, message: err.error });
    } else {
      socket.emit('vote-cast', { voterId: userId });
    }
  });

  // ── PLAY AGAIN ────────────────────────────────────────────────────────────
  socket.on('play-again', (): void => {
    const { roomId, userId } = socket.data;
    if (!roomId || !userId) return;

    const room = roomManager.getRoom(roomId);
    if (!room) return;

    const player = room.players.get(userId);
    if (!player?.isHost) {
      socket.emit('error', { code: 'NOT_HOST', message: 'Only the host can restart.' });
      return;
    }

    gameEngine.resetToLobby(room);
    room.chat = [];

    io.to(roomId).emit('room-state', {
      players: roomManager.getPublicPlayers(room),
      phase:   room.game.phase,
      round:   room.game.round,
      chat:    [],
    });
  });

  // ── WEBRTC SIGNALING (pure relay — server never reads SDP/ICE content) ────
  socket.on('webrtc-offer', ({ targetUserId, offer }: WebRTCOfferPayload): void => {
    const { roomId, userId } = socket.data;
    if (!roomId || !userId) return;
    const room = roomManager.getRoom(roomId);
    if (!room) return;
    const target = room.players.get(targetUserId);
    if (!target?.isConnected) return;
    io.to(target.socketId).emit('webrtc-offer', { targetUserId: userId, offer });
  });

  socket.on('webrtc-answer', ({ targetUserId, answer }: WebRTCAnswerPayload): void => {
    const { roomId, userId } = socket.data;
    if (!roomId || !userId) return;
    const room = roomManager.getRoom(roomId);
    if (!room) return;
    const target = room.players.get(targetUserId);
    if (!target?.isConnected) return;
    io.to(target.socketId).emit('webrtc-answer', { targetUserId: userId, answer });
  });

  socket.on('webrtc-ice-candidate', ({ targetUserId, candidate }: WebRTCIceCandidatePayload): void => {
    const { roomId, userId } = socket.data;
    if (!roomId || !userId) return;
    const room = roomManager.getRoom(roomId);
    if (!room) return;
    const target = room.players.get(targetUserId);
    if (!target?.isConnected) return;
    io.to(target.socketId).emit('webrtc-ice-candidate', { targetUserId: userId, candidate });
  });

  // ── DISCONNECT ────────────────────────────────────────────────────────────
  socket.on('disconnect', (reason): void => {
    logger.debug('Socket disconnected', { socketId: socket.id, reason });
    handleLeave(socket, io, 'disconnect');
  });
}

// ─────────────────────────────────────────────────────────────────────────────
function handleLeave(socket: AppSocket, io: AppServer, reason: 'explicit' | 'disconnect'): void {
  const result = roomManager.markDisconnected(socket.id);
  if (!result) return;

  const { room, userId } = result;
  const roomId = room.roomId;

  if (reason === 'explicit') {
    const newHostId = roomManager.removePlayer(room, userId);
    if (roomManager.getRoom(roomId)) {
      io.to(roomId).emit('player-left', { userId, newHostId });
    }
  } else {
    // Temporary — keep slot open 30s for reconnect
    socket.to(roomId).emit('player-left', { userId, newHostId: null });
    setTimeout(() => {
      const currentRoom = roomManager.getRoom(roomId);
      if (!currentRoom) return;
      const player = currentRoom.players.get(userId);
      if (player && !player.isConnected) {
        const newHostId = roomManager.removePlayer(currentRoom, userId);
        if (roomManager.getRoom(roomId)) {
          io.to(roomId).emit('player-left', { userId, newHostId });
        }
      }
    }, 30_000);
  }
}
