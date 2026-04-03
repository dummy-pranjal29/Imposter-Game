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

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (stream) {
      el.srcObject = stream;
      el.play().catch(() => {});
    } else {
      el.srcObject = null;
    }
  }, [stream]);

  const initials = displayName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const connecting = !isLocal && !stream && connState !== 'failed' && connState !== 'closed';
  const failed     = !isLocal && !stream && (connState === 'failed' || connState === 'closed');

  return (
    <div className={`${styles.tile} ${!isConnected ? styles.offline : ''}`}>
      {stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className={`${styles.video} ${isLocal ? styles.mirrored : ''}`}
        />
      ) : (
        <div className={styles.avatar}>
          {initials}
          {connecting && <div className={styles.connLabel}>connecting…</div>}
          {failed     && <div className={styles.connLabel}>no video</div>}
        </div>
      )}

      <div className={styles.nameTag}>
        {displayName}
        {isLocal   && <span className={styles.youLabel}> (you)</span>}
        {!isConnected && <span className={styles.offlineLabel}> • offline</span>}
      </div>
    </div>
  );
}
