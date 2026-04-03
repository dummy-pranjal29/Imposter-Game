import { socketService } from './socketService';
import { UserId, PublicPlayer } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// WebRTCService — full-mesh P2P video/audio.
//
// Key fix: streams that arrive before VideoGrid mounts are buffered in
// `pendingStreams`. When the UI callback is registered via setStreamCallback,
// pending streams are flushed immediately so no frame is ever lost.
// ─────────────────────────────────────────────────────────────────────────────

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
];

const USER_ORDER: UserId[] = ['user1', 'user2', 'user3', 'user4', 'user5'];

type StreamCallback = (userId: UserId, stream: MediaStream | null) => void;

class WebRTCService {
  private peers           = new Map<UserId, RTCPeerConnection>();
  private localStream:  MediaStream | null = null;
  private onRemoteStream: StreamCallback | null = null;

  // Streams that arrived before the UI callback was registered
  private pendingStreams = new Map<UserId, MediaStream>();

  // ICE candidates queued before remote description is set
  private iceCandidateQueue = new Map<UserId, RTCIceCandidateInit[]>();

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Register the UI callback. Immediately flushes any streams that arrived
   * before the VideoGrid mounted.
   */
  setStreamCallback(cb: StreamCallback): void {
    this.onRemoteStream = cb;

    // Flush buffered streams
    for (const [userId, stream] of this.pendingStreams) {
      cb(userId, stream);
    }
    this.pendingStreams.clear();
  }

  async getLocalStream(): Promise<MediaStream> {
    if (this.localStream) return this.localStream;

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width:     { ideal: 640 },
          height:    { ideal: 480 },
          frameRate: { ideal: 24 },
          facingMode: 'user',
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        },
      });
    } catch {
      // Camera denied — try audio only
      try {
        this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        // No media at all — return a silent/blank stream so the app still works
        this.localStream = new MediaStream();
      }
    }

    return this.localStream;
  }

  /**
   * initMesh — called when WORD_REVEAL phase starts.
   * Lower-indexed player initiates the offer to avoid simultaneous offer collisions.
   */
  async initMesh(players: PublicPlayer[], myUserId: UserId): Promise<void> {
    await this.getLocalStream();
    const myIndex = USER_ORDER.indexOf(myUserId);

    for (const player of players) {
      if (player.userId === myUserId) continue;
      if (!player.isConnected) continue;

      const theirIndex = USER_ORDER.indexOf(player.userId);

      if (myIndex < theirIndex) {
        // I am the offerer
        await this.createOffer(player.userId);
      }
      // If my index is higher, I wait for their offer (handleOffer will fire via socket)
    }
  }

  async handleOffer(
    fromUserId: UserId,
    offer: RTCSessionDescriptionInit
  ): Promise<RTCSessionDescriptionInit | null> {
    // Ensure local stream is ready before creating the peer so our tracks are
    // included. Without this, offers that arrive before initMesh completes
    // create a peer with no local tracks — the remote side never sees our video.
    await this.getLocalStream();
    const pc = this.getOrCreatePeer(fromUserId);

    // Avoid setting remote description if already set (e.g. reconnect race)
    if (pc.signalingState !== 'stable' && pc.signalingState !== 'have-local-offer') {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
    } else {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
    }

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
      // Queue until remote description is set
      const q = this.iceCandidateQueue.get(fromUserId) ?? [];
      q.push(candidate);
      this.iceCandidateQueue.set(fromUserId, q);
      return;
    }
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch {
      // Stale candidate — safe to ignore
    }
  }

  closePeer(userId: UserId): void {
    const pc = this.peers.get(userId);
    if (pc) {
      pc.close();
      this.peers.delete(userId);
    }
    this.iceCandidateQueue.delete(userId);
    this.pendingStreams.delete(userId);
    this.onRemoteStream?.(userId, null);
  }

  closeAll(): void {
    for (const [userId] of this.peers) {
      this.peers.get(userId)?.close();
      this.onRemoteStream?.(userId, null);
    }
    this.peers.clear();
    this.iceCandidateQueue.clear();
    this.pendingStreams.clear();
    this.localStream?.getTracks().forEach((t) => t.stop());
    this.localStream = null;
    this.onRemoteStream = null;
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private async createOffer(targetUserId: UserId): Promise<void> {
    const pc = this.getOrCreatePeer(targetUserId);
    const offer = await pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    });
    await pc.setLocalDescription(offer);
    socketService.sendOffer(targetUserId, offer);
  }

  private getOrCreatePeer(userId: UserId): RTCPeerConnection {
    if (this.peers.has(userId)) return this.peers.get(userId)!;

    const pc = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
      iceCandidatePoolSize: 10,
    });

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
            candidate:     json.candidate,
            sdpMid:        json.sdpMid,
            sdpMLineIndex: json.sdpMLineIndex,
          });
        }
      }
    };

    // Remote stream received
    pc.ontrack = ({ streams }) => {
      const stream = streams[0];
      if (!stream) return;

      if (this.onRemoteStream) {
        // Callback already registered — deliver immediately
        this.onRemoteStream(userId, stream);
      } else {
        // VideoGrid not mounted yet — buffer it
        this.pendingStreams.set(userId, stream);
      }
    };

    // Connection state monitoring
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') {
        // ICE restart
        pc.restartIce();
      }
      if (pc.connectionState === 'disconnected') {
        // Brief disconnection — try ICE restart before giving up
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

    // ICE connection state for diagnostics
    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed') {
        pc.restartIce();
      }
    };

    this.peers.set(userId, pc);
    return pc;
  }

  private async flushIceCandidates(userId: UserId, pc: RTCPeerConnection): Promise<void> {
    const queued = this.iceCandidateQueue.get(userId) ?? [];
    for (const candidate of queued) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {
        // Ignore stale
      }
    }
    this.iceCandidateQueue.delete(userId);
  }
}

export const webRTCService = new WebRTCService();
