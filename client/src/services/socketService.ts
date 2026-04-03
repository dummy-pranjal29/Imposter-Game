import { io, Socket } from 'socket.io-client';
import { useGameStore } from '../store/gameStore';
import { webRTCService } from './webRTCService';
import type {
  RoomJoinedPayload,
  RoomStatePayload,
  PlayerJoinedPayload,
  PlayerLeftPayload,
  GamePhaseChangedPayload,
  YourWordPayload,
  DescriptionSubmittedPayload,
  AllDescriptionsPayload,
  ChatMessage,
  VotingUpdatePayload,
  RoundResult,
  ErrorPayload,
  WebRTCOfferPayload,
  WebRTCAnswerPayload,
  WebRTCIceCandidatePayload,
  UserId,
  SdpPayload,
  IceCandidatePayload,
} from '../types';

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:3001';

class SocketService {
  private socket: Socket | null = null;

  connect(): Socket {
    if (this.socket?.connected) return this.socket;

    this.socket = io(SERVER_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    this.registerListeners();
    return this.socket;
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }

  // ── Outgoing ──────────────────────────────────────────────────────────────

  joinRoom(roomId: string, displayName: string): void {
    this.socket?.emit('join-room', { roomId, displayName });
  }

  leaveRoom(): void {
    this.socket?.emit('leave-room');
  }

  startGame(): void {
    this.socket?.emit('start-game');
  }

  submitDescription(description: string): void {
    this.socket?.emit('submit-description', { description });
  }

  sendChat(text: string): void {
    this.socket?.emit('chat-message', { text });
  }

  castVote(targetUserId: UserId): void {
    this.socket?.emit('cast-vote', { targetUserId });
  }

  playAgain(): void {
    this.socket?.emit('play-again');
  }

  sendOffer(targetUserId: UserId, offer: SdpPayload): void {
    this.socket?.emit('webrtc-offer', { targetUserId, offer });
  }

  sendAnswer(targetUserId: UserId, answer: SdpPayload): void {
    this.socket?.emit('webrtc-answer', { targetUserId, answer });
  }

  sendIceCandidate(targetUserId: UserId, candidate: IceCandidatePayload): void {
    this.socket?.emit('webrtc-ice-candidate', { targetUserId, candidate });
  }

  // ── Incoming listeners ────────────────────────────────────────────────────

  private registerListeners(): void {
    const s = this.socket!;
    const store = () => useGameStore.getState();

    s.on('connect',    () => store().setIsConnected(true));
    s.on('disconnect', () => store().setIsConnected(false));

    // ── Room ──────────────────────────────────────────────────────────────

    s.on('room-joined', (p: RoomJoinedPayload) => {
      store().setRoomId(p.roomId);
      store().setMyUserId(p.userId);
      store().setIsHost(p.isHost);
      store().setPlayers(p.players);
      store().setPhase('LOBBY', null, 0);
    });

    s.on('room-state', (p: RoomStatePayload) => {
      store().setPlayers(p.players);
      store().setPhase(p.phase, null, p.round);
      store().setChat(p.chat);
    });

    s.on('player-joined', ({ player }: PlayerJoinedPayload) => {
      store().addPlayer(player);
    });

    s.on('player-left', ({ userId, newHostId }: PlayerLeftPayload) => {
      store().removePlayer(userId, newHostId);
      webRTCService.closePeer(userId);
    });

    s.on('player-reconnected', ({ userId }) => {
      store().setPlayerConnected(userId, true);
    });

    // ── Game phase ────────────────────────────────────────────────────────

    s.on('game-phase-changed', ({ phase, phaseEndsAt, round }: GamePhaseChangedPayload) => {
      store().setPhase(phase, phaseEndsAt, round);

      // Kick off WebRTC mesh on WORD_REVEAL.
      // Delay by one React render tick (setTimeout 0) so GamePage has time to
      // mount VideoGrid and register the stream callback before offers arrive.
      if (phase === 'WORD_REVEAL') {
        setTimeout(() => {
          const { players, myUserId } = store();
          if (myUserId) webRTCService.initMesh(players, myUserId);
        }, 0);
      }
    });

    // ── Private word — only this socket receives this event ───────────────
    s.on('your-word', (p: YourWordPayload) => {
      store().setMyWord(p);
    });

    // ── Description phase ─────────────────────────────────────────────────

    s.on('description-submitted', ({ userId }: DescriptionSubmittedPayload) => {
      store().addSubmittedUser(userId);
    });

    s.on('all-descriptions', ({ descriptions }: AllDescriptionsPayload) => {
      store().setDescriptions(descriptions);
    });

    // ── Chat ──────────────────────────────────────────────────────────────
    s.on('chat-message', (msg: ChatMessage) => {
      store().addChatMessage(msg);
    });

    // ── Voting ────────────────────────────────────────────────────────────
    s.on('vote-cast', () => {
      // Optimistic update already applied in VotingScreen; no extra action needed
    });

    s.on('voting-update', ({ votedUserIds }: VotingUpdatePayload) => {
      store().setVotingUpdate(votedUserIds);
    });

    s.on('game-result', (result: RoundResult) => {
      store().setResult(result);
    });

    // ── Errors ────────────────────────────────────────────────────────────
    s.on('error', (p: ErrorPayload) => {
      store().setError(p);
      setTimeout(() => store().setError(null), 5000);
    });

    // ── WebRTC signaling ──────────────────────────────────────────────────

    s.on('webrtc-offer', async ({ targetUserId, offer }: WebRTCOfferPayload) => {
      const answer = await webRTCService.handleOffer(targetUserId, offer as RTCSessionDescriptionInit);
      if (answer) this.sendAnswer(targetUserId, answer as SdpPayload);
    });

    s.on('webrtc-answer', async ({ targetUserId, answer }: WebRTCAnswerPayload) => {
      await webRTCService.handleAnswer(targetUserId, answer as RTCSessionDescriptionInit);
    });

    s.on('webrtc-ice-candidate', async ({ targetUserId, candidate }: WebRTCIceCandidatePayload) => {
      await webRTCService.handleIceCandidate(targetUserId, candidate as RTCIceCandidateInit);
    });
  }
}

export const socketService = new SocketService();
