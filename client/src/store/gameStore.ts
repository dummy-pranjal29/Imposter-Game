import { create } from 'zustand';
import {
  GamePhase,
  UserId,
  PublicPlayer,
  ChatMessage,
  PlayerDescription,
  RoundResult,
  YourWordPayload,
} from '../types';

interface GameState {
  // Identity
  roomId:      string | null;
  myUserId:    UserId | null;
  isHost:      boolean;
  isConnected: boolean;

  // Players
  players: PublicPlayer[];

  // Game phase
  phase:       GamePhase;
  round:       number;
  phaseEndsAt: number | null;

  // My private word (only populated via targeted 'your-word' emit)
  myWord:      string | null;
  isImposter:  boolean | null;
  category:    string | null;

  // Description phase
  submittedDescription:  boolean;           // did I submit yet?
  submittedUserIds:      UserId[];          // who submitted (not what)
  descriptions:          PlayerDescription[]; // revealed at DISCUSSION start

  // Voting
  votedUserIds:  UserId[];
  myVoteTarget:  UserId | null;

  // Result
  result: RoundResult | null;

  // Chat
  chat: ChatMessage[];

  // Error
  lastError: { code: string; message: string } | null;
}

interface GameActions {
  setRoomId:             (roomId: string) => void;
  setMyUserId:           (userId: UserId) => void;
  setIsHost:             (v: boolean) => void;
  setIsConnected:        (v: boolean) => void;
  setPlayers:            (players: PublicPlayer[]) => void;
  addPlayer:             (player: PublicPlayer) => void;
  removePlayer:          (userId: UserId, newHostId: UserId | null) => void;
  setPlayerConnected:    (userId: UserId, connected: boolean) => void;
  setPhase:              (phase: GamePhase, phaseEndsAt: number | null, round: number) => void;
  setMyWord:             (payload: YourWordPayload) => void;
  markDescriptionSubmitted: () => void;
  addSubmittedUser:      (userId: UserId) => void;
  setDescriptions:       (descriptions: PlayerDescription[]) => void;
  setVotingUpdate:       (votedUserIds: UserId[]) => void;
  setMyVoteTarget:       (userId: UserId) => void;
  setResult:             (result: RoundResult) => void;
  addChatMessage:        (msg: ChatMessage) => void;
  setChat:               (chat: ChatMessage[]) => void;
  setError:              (error: { code: string; message: string } | null) => void;
  reset:                 () => void;
}

const initialState: GameState = {
  roomId:               null,
  myUserId:             null,
  isHost:               false,
  isConnected:          false,
  players:              [],
  phase:                'LOBBY',
  round:                0,
  phaseEndsAt:          null,
  myWord:               null,
  isImposter:           null,
  category:             null,
  submittedDescription: false,
  submittedUserIds:     [],
  descriptions:         [],
  votedUserIds:         [],
  myVoteTarget:         null,
  result:               null,
  chat:                 [],
  lastError:            null,
};

export const useGameStore = create<GameState & GameActions>((set) => ({
  ...initialState,

  setRoomId:      (roomId)      => set({ roomId }),
  setMyUserId:    (myUserId)    => set({ myUserId }),
  setIsHost:      (isHost)      => set({ isHost }),
  setIsConnected: (isConnected) => set({ isConnected }),

  setPlayers: (players) => set({ players }),

  addPlayer: (player) =>
    set((s) => {
      if (s.players.find((p) => p.userId === player.userId)) return s;
      return { players: [...s.players, player] };
    }),

  removePlayer: (userId, newHostId) =>
    set((s) => ({
      players: s.players
        .filter((p) => p.userId !== userId)
        .map((p) => (p.userId === newHostId ? { ...p, isHost: true } : p)),
    })),

  setPlayerConnected: (userId, connected) =>
    set((s) => ({
      players: s.players.map((p) =>
        p.userId === userId ? { ...p, isConnected: connected } : p
      ),
    })),

  setPhase: (phase, phaseEndsAt, round) => set(() => ({
    phase,
    phaseEndsAt,
    round,
    // Reset per-phase state when entering a new phase
    ...(phase === 'DESCRIPTION' && {
      submittedDescription: false,
      submittedUserIds: [],
    }),
    ...(phase === 'VOTING' && {
      votedUserIds: [],
      myVoteTarget: null,
    }),
    ...(phase === 'LOBBY' && {
      myWord: null,
      isImposter: null,
      category: null,
      submittedDescription: false,
      submittedUserIds: [],
      descriptions: [],
      votedUserIds: [],
      myVoteTarget: null,
      result: null,
    }),
  })),

  setMyWord: ({ word, isImposter, category }) =>
    set({ myWord: word, isImposter, category }),

  markDescriptionSubmitted: () => set({ submittedDescription: true }),

  addSubmittedUser: (userId) =>
    set((s) => ({
      submittedUserIds: s.submittedUserIds.includes(userId)
        ? s.submittedUserIds
        : [...s.submittedUserIds, userId],
    })),

  setDescriptions: (descriptions) => set({ descriptions }),

  setVotingUpdate: (votedUserIds) => set({ votedUserIds }),

  setMyVoteTarget: (myVoteTarget) => set({ myVoteTarget }),

  setResult: (result) => set({ result }),

  addChatMessage: (msg) =>
    set((s) => ({ chat: [...s.chat, msg].slice(-200) })),

  setChat: (chat) => set({ chat }),

  setError: (lastError) => set({ lastError }),

  reset: () => set(initialState),
}));
