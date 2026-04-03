import { useEffect, useRef } from 'react';
import { UserId } from '../../types';
import styles from './VideoTile.module.css';

interface Props {
  userId: UserId;
  displayName: string;
  stream: MediaStream | null;
  isLocal: boolean;
  isConnected: boolean;
  connState: RTCPeerConnectionState | null;
}

export function VideoTile({ displayName, stream, isLocal, isConnected, connState }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);

  const hasVideo = !!stream && stream.getVideoTracks().length > 0;

  // Always keep the video element in the DOM so videoRef.current is never null.
  // If we conditionally render <video>, it unmounts when hasVideo is false and
  // the ref is null — then when hasVideo becomes true the element remounts but
  // useEffect([stream]) doesn't re-run (stream didn't change), so srcObject is
  // never set and the video stays black.
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (hasVideo && stream) {
      el.srcObject = stream;
      el.play().catch(() => {});
    } else {
      el.srcObject = null;
    }
  }, [stream, hasVideo]);

  const initials = displayName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const connecting = !isLocal && !hasVideo && connState !== 'failed' && connState !== 'closed';
  const failed     = !isLocal && !hasVideo && (connState === 'failed' || connState === 'closed');

  return (
    <div className={`${styles.tile} ${!isConnected ? styles.offline : ''}`}>
      {/* Always in DOM — hidden until stream has a video track */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className={`${styles.video} ${isLocal ? styles.mirrored : ''}`}
        style={{ display: hasVideo ? 'block' : 'none' }}
      />

      {/* Avatar shown when no video track yet */}
      {!hasVideo && (
        <div className={styles.avatar}>
          {initials}
          {connecting && <div className={styles.connLabel}>connecting…</div>}
          {failed     && <div className={styles.connLabel}>no video</div>}
        </div>
      )}

      <div className={styles.nameTag}>
        {displayName}
        {isLocal     && <span className={styles.youLabel}> (you)</span>}
        {!isConnected && <span className={styles.offlineLabel}> • offline</span>}
      </div>
    </div>
  );
}
