export type GamePhase =
  | 'LOBBY'
  | 'WORD_REVEAL'
  | 'DESCRIPTION'
  | 'DISCUSSION'
  | 'VOTING'
  | 'RESULT';

export type UserId = `user${1 | 2 | 3 | 4 | 5}`;

export interface PublicPlayer {
  userId: UserId;
  displayName: string;
  isHost: boolean;
  isConnected: boolean;
}

export interface ChatMessage {
  messageId: string;
  userId: UserId;
  displayName: string;
  text: string;
  timestamp: number;
}

export interface PlayerDescription {
  userId: UserId;
  displayName: string;
  description: string;
  submittedAt: number;
}

export interface Vote {
  voterId: UserId;
  targetId: UserId;
  timestamp: number;
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

// ── Socket event payload shapes ───────────────────────────────────────────────

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

export interface GamePhaseChangedPayload {
  phase: GamePhase;
  phaseEndsAt: number | null;
  round: number;
}

export interface YourWordPayload {
  word: string;
  isImposter: boolean;
  category: string;
}

export interface PlayerJoinedPayload {
  player: PublicPlayer;
}

export interface PlayerLeftPayload {
  userId: UserId;
  newHostId: UserId | null;
}

export interface DescriptionSubmittedPayload {
  userId: UserId;
  displayName: string;
}

export interface AllDescriptionsPayload {
  descriptions: PlayerDescription[];
}

export interface VotingUpdatePayload {
  votedUserIds: UserId[];
}

export interface ErrorPayload {
  code: string;
  message: string;
}

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
