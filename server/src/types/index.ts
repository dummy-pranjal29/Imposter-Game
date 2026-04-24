// ─────────────────────────────────────────────────────────────────────────────
// Core domain types — single source of truth for the entire server
// ─────────────────────────────────────────────────────────────────────────────

export type GamePhase =
  | 'LOBBY'
  | 'WORD_REVEAL'
  | 'DESCRIPTION'   // 2 min: each player writes ≤3 words describing their word
  | 'DISCUSSION'    // 3 min: video + chat, all descriptions visible
  | 'VOTING'        // 1 min: vote for the imposter
  | 'RESULT';

export type UserId = `user${1 | 2 | 3 | 4 | 5}`;

export interface Player {
  userId: UserId;
  socketId: string;
  displayName: string;
  deviceId: string;
  isHost: boolean;
  isConnected: boolean;
  joinedAt: number;
}

export interface Vote {
  voterId: UserId;
  targetId: UserId;
  timestamp: number;
}

export interface ChatMessage {
  messageId: string;
  userId: UserId;
  displayName: string;
  text: string;
  timestamp: number;
}

/** A player's submitted 1-3 word description of their word */
export interface PlayerDescription {
  userId: UserId;
  displayName: string;
  description: string; // max 3 words, server-validated
  submittedAt: number;
}

export interface RoundResult {
  imposterId: UserId;
  imposterName: string;
  civilianWord: string;
  imposterWord: string;
  category: string;
  votes: Vote[];
  eliminatedId: UserId | null;
  imposterCaught: boolean;
  descriptions: PlayerDescription[];
}

export interface GameState {
  phase: GamePhase;
  round: number;
  imposterId: UserId | null;
  civilianWord: string | null;
  imposterWord: string | null;
  category: string | null;
  descriptions: Map<UserId, PlayerDescription>;
  votes: Vote[];
  phaseStartedAt: number;
  phaseEndsAt: number | null;
  result: RoundResult | null;
}

export interface Room {
  roomId: string;
  players: Map<UserId, Player>;
  socketToUser: Map<string, UserId>;
  deviceToUser: Map<string, UserId>;
  game: GameState;
  chat: ChatMessage[];
  createdAt: number;
  phaseTimer: ReturnType<typeof setTimeout> | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Socket event payload shapes
// ─────────────────────────────────────────────────────────────────────────────

export interface ClientToServerEvents {
  'join-room': (payload: JoinRoomPayload) => void;
  'leave-room': () => void;
  'start-game': () => void;
  'submit-description': (payload: SubmitDescriptionPayload) => void;
  'chat-message': (payload: ChatMessagePayload) => void;
  'cast-vote': (payload: CastVotePayload) => void;
  'play-again': () => void;

  // WebRTC signaling
  'webrtc-offer': (payload: WebRTCOfferPayload) => void;
  'webrtc-answer': (payload: WebRTCAnswerPayload) => void;
  'webrtc-ice-candidate': (payload: WebRTCIceCandidatePayload) => void;
}

export interface ServerToClientEvents {
  'room-joined': (payload: RoomJoinedPayload) => void;
  'room-state': (payload: RoomStatePayload) => void;
  'player-joined': (payload: PlayerJoinedPayload) => void;
  'player-left': (payload: PlayerLeftPayload) => void;
  'player-reconnected': (payload: PlayerReconnectedPayload) => void;
  'game-phase-changed': (payload: GamePhaseChangedPayload) => void;
  'your-word': (payload: YourWordPayload) => void;
  'description-submitted': (payload: DescriptionSubmittedPayload) => void;
  'all-descriptions': (payload: AllDescriptionsPayload) => void;
  'chat-message': (payload: ChatMessage) => void;
  'vote-cast': (payload: VoteCastAckPayload) => void;
  'voting-update': (payload: VotingUpdatePayload) => void;
  'game-result': (payload: RoundResult) => void;
  'error': (payload: ErrorPayload) => void;

  // WebRTC signaling relays
  'webrtc-offer': (payload: WebRTCOfferPayload) => void;
  'webrtc-answer': (payload: WebRTCAnswerPayload) => void;
  'webrtc-ice-candidate': (payload: WebRTCIceCandidatePayload) => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  userId: UserId;
  roomId: string;
  displayName: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Payload shapes
// ─────────────────────────────────────────────────────────────────────────────

export interface JoinRoomPayload {
  roomId: string;
  displayName: string;
  deviceId: string;
}

export interface SubmitDescriptionPayload {
  description: string;
}

export interface ChatMessagePayload {
  text: string;
}

export interface CastVotePayload {
  targetUserId: UserId;
}

// RTCSessionDescriptionInit / RTCIceCandidateInit are browser-only types.
// The server never inspects SDP/ICE content — it relays them as opaque objects.
export type SdpPayload = { type: string; sdp?: string };
export type IceCandidatePayload = { candidate: string; sdpMid?: string | null; sdpMLineIndex?: number | null };

export interface WebRTCOfferPayload {
  targetUserId: UserId;
  offer: SdpPayload;
}

export interface WebRTCAnswerPayload {
  targetUserId: UserId;
  answer: SdpPayload;
}

export interface WebRTCIceCandidatePayload {
  targetUserId: UserId;
  candidate: IceCandidatePayload;
}

// ─────────────────────────────────────────────────────────────────────────────
// Server → Client payload shapes
// ─────────────────────────────────────────────────────────────────────────────

export interface RoomJoinedPayload {
  userId: UserId;
  roomId: string;
  players: PublicPlayer[];
  isHost: boolean;
}

export interface RoomStatePayload {
  players: PublicPlayer[];
  phase: GamePhase;
  round: number;
  chat: ChatMessage[];
}

export interface PlayerJoinedPayload {
  player: PublicPlayer;
}

export interface PlayerLeftPayload {
  userId: UserId;
  newHostId: UserId | null;
}

export interface PlayerReconnectedPayload {
  userId: UserId;
}

export interface GamePhaseChangedPayload {
  phase: GamePhase;
  phaseEndsAt: number | null;
  round: number;
}

/** Sent privately — NEVER broadcast */
export interface YourWordPayload {
  word: string;
  isImposter: boolean;
  category: string;
}

/** Broadcast when someone submits: only reveals that they submitted, not their text */
export interface DescriptionSubmittedPayload {
  userId: UserId;
  displayName: string;
}

/** Broadcast at start of DISCUSSION — reveals all descriptions at once */
export interface AllDescriptionsPayload {
  descriptions: PlayerDescription[];
}

export interface VoteCastAckPayload {
  voterId: UserId;
}

export interface VotingUpdatePayload {
  votedUserIds: UserId[];
}

export interface ErrorPayload {
  code: string;
  message: string;
}

export interface PublicPlayer {
  userId: UserId;
  displayName: string;
  isHost: boolean;
  isConnected: boolean;
}
