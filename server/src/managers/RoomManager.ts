import { config } from '../config';
import { logger } from '../utils/logger';
import {
  Room,
  Player,
  UserId,
  GameState,
  PublicPlayer,
} from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// RoomManager — single source of truth for all room state.
//
// Design decisions:
//   • In-memory Map for sub-millisecond access on a single node.
//   • All mutation goes through this class — no external writes to Room objects.
//   • Redis adapter handles cross-node sync (Socket.IO events only; game state
//     would need a Redis-backed store for true horizontal scaling — see STEP 8).
// ─────────────────────────────────────────────────────────────────────────────

const USER_IDS: UserId[] = ['user1', 'user2', 'user3', 'user4', 'user5'];

class RoomManager {
  private rooms = new Map<string, Room>();

  // ── Room lifecycle ──────────────────────────────────────────────────────────

  createRoom(): Room {
    const roomId = this.generateRoomId();
    const room: Room = {
      roomId,
      players: new Map(),
      socketToUser: new Map(),
      game: this.initialGameState(),
      chat: [],
      createdAt: Date.now(),
      phaseTimer: null,
    };
    this.rooms.set(roomId, room);
    logger.info('Room created', { roomId });
    return room;
  }

  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  getRoomBySocket(socketId: string): Room | undefined {
    for (const room of this.rooms.values()) {
      if (room.socketToUser.has(socketId)) return room;
    }
    return undefined;
  }

  deleteRoom(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    if (room.phaseTimer) {
      clearTimeout(room.phaseTimer);
    }
    this.rooms.delete(roomId);
    logger.info('Room deleted', { roomId });
  }

  // ── Player management ───────────────────────────────────────────────────────

  /**
   * Add a new player to the room.
   * Returns the assigned userId, or null if the room is full or the
   * display name is already taken.
   */
  addPlayer(
    room: Room,
    socketId: string,
    displayName: string
  ): { player: Player; alreadyExisted: boolean } | { error: string } {
    // Check for reconnect (same display name, disconnected player)
    for (const [, player] of room.players) {
      if (
        player.displayName === displayName &&
        !player.isConnected
      ) {
        // Reconnect path — update socket, mark connected
        player.socketId = socketId;
        player.isConnected = true;
        room.socketToUser.set(socketId, player.userId);
        logger.info('Player reconnected', { roomId: room.roomId, userId: player.userId });
        return { player, alreadyExisted: true };
      }
    }

    // Reject if room is full
    const connectedCount = this.getConnectedPlayers(room).length;
    if (connectedCount >= config.game.maxPlayersPerRoom) {
      return { error: 'ROOM_FULL' };
    }

    // Reject if game already in progress
    if (room.game.phase !== 'LOBBY') {
      return { error: 'GAME_IN_PROGRESS' };
    }

    // Assign next available userId
    const usedIds = new Set(Array.from(room.players.keys()));
    const userId = USER_IDS.find((id) => !usedIds.has(id));
    if (!userId) return { error: 'ROOM_FULL' };

    const isHost = room.players.size === 0;
    const player: Player = {
      userId,
      socketId,
      displayName,
      isHost,
      isConnected: true,
      joinedAt: Date.now(),
    };

    room.players.set(userId, player);
    room.socketToUser.set(socketId, userId);
    logger.info('Player added', { roomId: room.roomId, userId, displayName });
    return { player, alreadyExisted: false };
  }

  /**
   * Mark player as disconnected (don't remove — allow reconnect window).
   * Returns the room if found, undefined otherwise.
   */
  markDisconnected(socketId: string): { room: Room; userId: UserId } | undefined {
    const room = this.getRoomBySocket(socketId);
    if (!room) return undefined;

    const userId = room.socketToUser.get(socketId);
    if (!userId) return undefined;

    const player = room.players.get(userId);
    if (!player) return undefined;

    player.isConnected = false;
    room.socketToUser.delete(socketId);
    logger.info('Player disconnected', { roomId: room.roomId, userId });

    return { room, userId };
  }

  /**
   * Permanently remove a player (explicit leave or cleanup after timeout).
   * Re-assigns host if needed.
   * Returns the new host's userId, or null.
   */
  removePlayer(room: Room, userId: UserId): UserId | null {
    const player = room.players.get(userId);
    if (!player) return null;

    room.socketToUser.delete(player.socketId);
    room.players.delete(userId);

    // Re-assign host to earliest-joined connected player
    let newHostId: UserId | null = null;
    if (player.isHost) {
      const next = this.getConnectedPlayers(room)
        .sort((a, b) => a.joinedAt - b.joinedAt)[0];
      if (next) {
        next.isHost = true;
        newHostId = next.userId;
      }
    }

    logger.info('Player removed', { roomId: room.roomId, userId, newHostId });

    // Clean up empty rooms
    if (room.players.size === 0) {
      this.deleteRoom(room.roomId);
    }

    return newHostId;
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  getConnectedPlayers(room: Room): Player[] {
    return Array.from(room.players.values()).filter((p) => p.isConnected);
  }

  toPublicPlayer(player: Player): PublicPlayer {
    return {
      userId: player.userId,
      displayName: player.displayName,
      isHost: player.isHost,
      isConnected: player.isConnected,
    };
  }

  getPublicPlayers(room: Room): PublicPlayer[] {
    return Array.from(room.players.values()).map((p) => this.toPublicPlayer(p));
  }

  getRoomCount(): number {
    return this.rooms.size;
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private generateRoomId(): string {
    // 6-char alphanumeric, uppercase — human-friendly
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  private initialGameState(): GameState {
    return {
      phase: 'LOBBY',
      round: 0,
      imposterId: null,
      civilianWord: null,
      imposterWord: null,
      category: null,
      descriptions: new Map(),
      votes: [],
      phaseStartedAt: Date.now(),
      phaseEndsAt: null,
      result: null,
    };
  }
}

// Singleton — one instance per Node.js process
export const roomManager = new RoomManager();
