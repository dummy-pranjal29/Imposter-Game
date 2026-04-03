import { socketService } from './socketService';
import { UserId, PublicPlayer } from '../types';

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  // Metered relay — more reliable than openrelay
  {
    urls: 'turn:a.relay.metered.ca:80',
    username: 'e499f89f50c5e6a6c3ef8ca7',
    credential: 'uMQbqMrUHudFXvO7',
  },
  {
    urls: 'turn:a.relay.metered.ca:80?transport=tcp',
    username: 'e499f89f50c5e6a6c3ef8ca7',
    credential: 'uMQbqMrUHudFXvO7',
  },
  {
    urls: 'turn:a.relay.metered.ca:443',
    username: 'e499f89f50c5e6a6c3ef8ca7',
    credential: 'uMQbqMrUHudFXvO7',
  },
  {
    urls: 'turn:a.relay.metered.ca:443?transport=tcp',
    username: 'e499f89f50c5e6a6c3ef8ca7',
    credential: 'uMQbqMrUHudFXvO7',
  },
];

const USER_ORDER: UserId[] = ['user1', 'user2', 'user3', 'user4', 'user5'];

type StreamCallback = (userId: UserId, stream: MediaStream | null) => void;
type StateCallback  = (userId: UserId, state: RTCPeerConnectionState) => void;

class WebRTCService {
  private peers                = new Map<UserId, RTCPeerConnection>();
  private localStream:           MediaStream | null = null;
  private localStreamPromise:    Promise<MediaStream> | null = null;
  private onRemoteStream:        StreamCallback | null = null;
  private onConnectionState:     StateCallback | null = null;

  // Tracks that arrived before the UI callback was registered
  private pendingStreams        = new Map<UserId, MediaStream>();

  // ICE candidates queued before remote description is set
  private iceCandidateQueue    = new Map<UserId, RTCIceCandidateInit[]>();

  // ── Public API ────────────────────────────────────────────────────────────

  setStreamCallback(cb: StreamCallback): void {
    this.onRemoteStream = cb;
    for (const [userId, stream] of this.pendingStreams) {
      cb(userId, stream);
    }
    this.pendingStreams.clear();
  }

  setConnectionStateCallback(cb: StateCallback): void {
    this.onConnectionState = cb;
  }

  getLocalStream(): Promise<MediaStream> {
    if (this.localStream) return Promise.resolve(this.localStream);
    if (this.localStreamPromise) return this.localStreamPromise;

    this.localStreamPromise = (async () => {
      try {
        this.localStream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24 }, facingMode: 'user' },
          audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 44100 },
        });
      } catch {
        try {
          this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch {
          this.localStream = new MediaStream();
        }
      }
      this.localStreamPromise = null;
      return this.localStream!;
    })();

    return this.localStreamPromise;
  }

  async initMesh(players: PublicPlayer[], myUserId: UserId): Promise<void> {
    await this.getLocalStream();
    const myIndex = USER_ORDER.indexOf(myUserId);

    for (const player of players) {
      if (player.userId === myUserId) continue;
      if (!player.isConnected) continue;

      const theirIndex = USER_ORDER.indexOf(player.userId);
      if (myIndex < theirIndex) {
        await this.createOffer(player.userId);
      }
    }
  }

  async handleOffer(fromUserId: UserId, offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit | null> {
    await this.getLocalStream();
    const pc = this.getOrCreatePeer(fromUserId);
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    await this.flushIceCandidates(fromUserId, pc);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    return answer;
  }

  async handleAnswer(fromUserId: UserId, answer: RTCSessionDescriptionInit): Promise<void> {
    const pc = this.peers.get(fromUserId);
    if (!pc) return;
    if (pc.signalingState === 'have-local-offer') {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
      await this.flushIceCandidates(fromUserId, pc);
    }
  }

  async handleIceCandidate(fromUserId: UserId, candidate: RTCIceCandidateInit): Promise<void> {
    const pc = this.peers.get(fromUserId);
    if (!pc || !pc.remoteDescription) {
      const q = this.iceCandidateQueue.get(fromUserId) ?? [];
      q.push(candidate);
      this.iceCandidateQueue.set(fromUserId, q);
      return;
    }
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch { /* stale candidate */ }
  }

  closePeer(userId: UserId): void {
    this.peers.get(userId)?.close();
    this.peers.delete(userId);
    this.iceCandidateQueue.delete(userId);
    this.pendingStreams.delete(userId);
    this.onRemoteStream?.(userId, null);
  }

  closeAll(): void {
    for (const [userId, pc] of this.peers) {
      pc.close();
      this.onRemoteStream?.(userId, null);
    }
    this.peers.clear();
    this.iceCandidateQueue.clear();
    this.pendingStreams.clear();
    this.localStream?.getTracks().forEach((t) => t.stop());
    this.localStream = null;
    this.localStreamPromise = null;
    this.onRemoteStream = null;
    this.onConnectionState = null;
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private async createOffer(targetUserId: UserId): Promise<void> {
    const pc = this.getOrCreatePeer(targetUserId);
    const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
    await pc.setLocalDescription(offer);
    socketService.sendOffer(targetUserId, offer);
  }

  private getOrCreatePeer(userId: UserId): RTCPeerConnection {
    if (this.peers.has(userId)) return this.peers.get(userId)!;

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS, iceCandidatePoolSize: 10 });

    // Add local tracks
    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        pc.addTrack(track, this.localStream);
      }
    }

    // ICE candidate relay
    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        const json = candidate.toJSON();
        if (json.candidate) {
          socketService.sendIceCandidate(userId, {
            candidate: json.candidate,
            sdpMid: json.sdpMid,
            sdpMLineIndex: json.sdpMLineIndex,
          });
        }
      }
    };

    // Remote track received — build a stream from the track if streams[] is empty
    pc.ontrack = ({ track, streams }) => {
      const stream = streams[0] ?? new MediaStream([track]);

      if (this.onRemoteStream) {
        this.onRemoteStream(userId, stream);
      } else {
        this.pendingStreams.set(userId, stream);
      }
    };

    // Connection state — notify UI + auto-restart on failure
    pc.onconnectionstatechange = () => {
      this.onConnectionState?.(userId, pc.connectionState);

      if (pc.connectionState === 'failed') {
        pc.restartIce();
      }
      if (pc.connectionState === 'disconnected') {
        setTimeout(() => {
          if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
            pc.restartIce();
          }
        }, 3000);
      }
      if (pc.connectionState === 'closed') {
        this.peers.delete(userId);
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed') pc.restartIce();
    };

    this.peers.set(userId, pc);
    return pc;
  }

  private async flushIceCandidates(userId: UserId, pc: RTCPeerConnection): Promise<void> {
    const queued = this.iceCandidateQueue.get(userId) ?? [];
    for (const candidate of queued) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch { /* stale */ }
    }
    this.iceCandidateQueue.delete(userId);
  }
}

export const webRTCService = new WebRTCService();
