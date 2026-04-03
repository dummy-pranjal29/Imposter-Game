import { Server } from 'socket.io';
import { config } from '../config';
import { logger } from '../utils/logger';
import { roomManager } from '../managers/RoomManager';
import { pickRandomPair } from './words';
import {
  Room,
  UserId,
  RoundResult,
  PlayerDescription,
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
} from '../types';

type AppServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

// ─────────────────────────────────────────────────────────────────────────────
// GameEngine — server-authoritative state machine.
//
// Phase flow:
//   LOBBY → WORD_REVEAL (15s) → DESCRIPTION (120s) → DISCUSSION (180s)
//         → VOTING (60s) → RESULT → LOBBY
//
// Anti-cheat:
//   • civilianWord / imposterWord never appear in any broadcast event.
//   • Each player receives `your-word` via a private targeted emit only.
//   • Descriptions are collected silently; revealed all-at-once at DISCUSSION.
//
// Paired words:
//   • Civilians all receive the same civilian word.
//   • The imposter receives a DIFFERENT but related word from the same category.
//   • This makes the imposter's bluffing harder — they must describe a real word.
// ─────────────────────────────────────────────────────────────────────────────

class GameEngine {
  private io!: AppServer;

  init(io: AppServer) {
    this.io = io;
  }

  // ── LOBBY → WORD_REVEAL ───────────────────────────────────────────────────

  startGame(room: Room): { error: string } | void {
    if (room.game.phase !== 'LOBBY') return { error: 'GAME_ALREADY_STARTED' };

    const connected = roomManager.getConnectedPlayers(room);
    if (connected.length < 2) return { error: 'NOT_ENOUGH_PLAYERS' };

    // Pick word pair and random imposter
    const pair = pickRandomPair();
    const imposterIdx = Math.floor(Math.random() * connected.length);
    const imposter = connected[imposterIdx];

    room.game = {
      phase: 'WORD_REVEAL',
      round: room.game.round + 1,
      imposterId: imposter.userId,
      civilianWord: pair.civilian,
      imposterWord: pair.imposter,
      category: pair.category,
      descriptions: new Map(),
      votes: [],
      phaseStartedAt: Date.now(),
      phaseEndsAt: Date.now() + config.game.wordRevealDurationMs,
      result: null,
    };

    logger.info('Game started', {
      roomId: room.roomId,
      round: room.game.round,
      imposterId: imposter.userId,
      pair, // server-log only — never sent to clients
    });

    this.broadcastPhaseChange(room);
    this.distributeWords(room);

    this.schedulePhase(room, config.game.wordRevealDurationMs, () =>
      this.startDescription(room)
    );
  }

  // ── WORD_REVEAL → DESCRIPTION ────────────────────────────────────────────

  private startDescription(room: Room): void {
    if (room.game.phase !== 'WORD_REVEAL') return;

    room.game.phase = 'DESCRIPTION';
    room.game.phaseStartedAt = Date.now();
    room.game.phaseEndsAt = Date.now() + config.game.descriptionDurationMs;

    logger.info('Description phase started', { roomId: room.roomId });
    this.broadcastPhaseChange(room);

    this.schedulePhase(room, config.game.descriptionDurationMs, () =>
      this.startDiscussion(room)
    );
  }

  // ── Submit description (called from socket handler) ───────────────────────

  submitDescription(
    room: Room,
    userId: UserId,
    rawText: string
  ): { error: string } | void {
    if (room.game.phase !== 'DESCRIPTION') return { error: 'NOT_DESCRIPTION_PHASE' };
    if (room.game.descriptions.has(userId)) return { error: 'ALREADY_SUBMITTED' };

    // Enforce max 3 words
    const words = rawText.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return { error: 'EMPTY_DESCRIPTION' };
    const clipped = words.slice(0, 3).join(' ');

    const player = room.players.get(userId);
    if (!player) return { error: 'PLAYER_NOT_FOUND' };

    const desc: PlayerDescription = {
      userId,
      displayName: player.displayName,
      description: clipped,
      submittedAt: Date.now(),
    };

    room.game.descriptions.set(userId, desc);

    // Tell everyone this player has submitted (not what they wrote)
    this.io.to(room.roomId).emit('description-submitted', {
      userId,
      displayName: player.displayName,
    });

    // Auto-advance if every connected player has submitted
    const connectedCount = roomManager.getConnectedPlayers(room).length;
    if (room.game.descriptions.size >= connectedCount) {
      this.startDiscussion(room);
    }
  }

  // ── DESCRIPTION → DISCUSSION ──────────────────────────────────────────────

  private startDiscussion(room: Room): void {
    if (room.game.phase !== 'DESCRIPTION') return;
    this.clearPhaseTimer(room);

    room.game.phase = 'DISCUSSION';
    room.game.phaseStartedAt = Date.now();
    room.game.phaseEndsAt = Date.now() + config.game.discussionDurationMs;

    // Reveal all descriptions at once now that the writing phase is over
    const descriptions = Array.from(room.game.descriptions.values());
    this.io.to(room.roomId).emit('all-descriptions', { descriptions });

    logger.info('Discussion started', {
      roomId: room.roomId,
      descriptionsCollected: descriptions.length,
    });

    this.broadcastPhaseChange(room);

    this.schedulePhase(room, config.game.discussionDurationMs, () =>
      this.startVoting(room)
    );
  }

  // ── DISCUSSION → VOTING ───────────────────────────────────────────────────

  startVoting(room: Room): void {
    if (room.game.phase !== 'DISCUSSION') return;
    this.clearPhaseTimer(room);

    room.game.phase = 'VOTING';
    room.game.votes = [];
    room.game.phaseStartedAt = Date.now();
    room.game.phaseEndsAt = Date.now() + config.game.votingDurationMs;

    logger.info('Voting started', { roomId: room.roomId });
    this.broadcastPhaseChange(room);

    this.schedulePhase(room, config.game.votingDurationMs, () =>
      this.resolveVoting(room)
    );
  }

  // ── Vote handling ─────────────────────────────────────────────────────────

  castVote(room: Room, voterId: UserId, targetId: UserId): { error: string } | void {
    if (room.game.phase !== 'VOTING') return { error: 'NOT_VOTING_PHASE' };
    if (voterId === targetId) return { error: 'CANNOT_VOTE_SELF' };
    if (!room.players.has(targetId)) return { error: 'INVALID_TARGET' };
    if (room.game.votes.some((v) => v.voterId === voterId)) return { error: 'ALREADY_VOTED' };

    room.game.votes.push({ voterId, targetId, timestamp: Date.now() });

    this.io.to(room.roomId).emit('voting-update', {
      votedUserIds: room.game.votes.map((v) => v.voterId),
    });

    const connectedCount = roomManager.getConnectedPlayers(room).length;
    if (room.game.votes.length >= connectedCount) {
      this.resolveVoting(room);
    }
  }

  // ── VOTING → RESULT ───────────────────────────────────────────────────────

  private resolveVoting(room: Room): void {
    if (room.game.phase !== 'VOTING') return;
    this.clearPhaseTimer(room);

    const { votes, imposterId, civilianWord, imposterWord, category } = room.game;

    // Tally votes
    const tally = new Map<UserId, number>();
    for (const v of votes) {
      tally.set(v.targetId, (tally.get(v.targetId) ?? 0) + 1);
    }

    let eliminatedId: UserId | null = null;
    let maxVotes = 0;
    let tied = false;

    for (const [userId, count] of tally) {
      if (count > maxVotes) { maxVotes = count; eliminatedId = userId; tied = false; }
      else if (count === maxVotes) { tied = true; }
    }
    if (tied) eliminatedId = null;

    const imposterPlayer = room.players.get(imposterId!);
    const result: RoundResult = {
      imposterId: imposterId!,
      imposterName: imposterPlayer?.displayName ?? 'Unknown',
      civilianWord: civilianWord!,
      imposterWord: imposterWord!,
      category: category!,
      votes,
      eliminatedId,
      imposterCaught: eliminatedId === imposterId,
      descriptions: Array.from(room.game.descriptions.values()),
    };

    room.game.phase = 'RESULT';
    room.game.result = result;
    room.game.phaseEndsAt = null;

    logger.info('Game result', {
      roomId: room.roomId,
      imposterCaught: result.imposterCaught,
      eliminatedId,
    });

    this.io.to(room.roomId).emit('game-result', result);
    this.broadcastPhaseChange(room);
  }

  // ── RESULT → LOBBY ────────────────────────────────────────────────────────

  resetToLobby(room: Room): void {
    this.clearPhaseTimer(room);
    room.game = {
      phase: 'LOBBY',
      round: room.game.round,
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
    logger.info('Room reset to lobby', { roomId: room.roomId });
    this.broadcastPhaseChange(room);
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  /**
   * Distribute words privately.
   * Civilians get `civilianWord`, imposter gets `imposterWord`.
   * Both know the category — the difference is subtle enough to need description.
   */
  private distributeWords(room: Room): void {
    const { imposterId, civilianWord, imposterWord, category } = room.game;

    for (const [userId, player] of room.players) {
      if (!player.isConnected) continue;
      const isImposter = userId === imposterId;
      this.io.to(player.socketId).emit('your-word', {
        word: isImposter ? imposterWord! : civilianWord!,
        isImposter,
        category: category!,
      });
    }
  }

  private broadcastPhaseChange(room: Room): void {
    this.io.to(room.roomId).emit('game-phase-changed', {
      phase: room.game.phase,
      phaseEndsAt: room.game.phaseEndsAt,
      round: room.game.round,
    });
  }

  private schedulePhase(room: Room, durationMs: number, callback: () => void): void {
    this.clearPhaseTimer(room);
    room.phaseTimer = setTimeout(callback, durationMs);
  }

  private clearPhaseTimer(room: Room): void {
    if (room.phaseTimer) { clearTimeout(room.phaseTimer); room.phaseTimer = null; }
  }
}

export const gameEngine = new GameEngine();
