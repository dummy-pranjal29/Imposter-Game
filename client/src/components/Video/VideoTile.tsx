import { useEffect, useRef } from 'react';
import { UserId } from '../../types';
import styles from './VideoTile.module.css';

interface Props {
  userId: UserId;
  displayName: string;
  stream: MediaStream | null;
  isLocal: boolean;
  isConnected: boolean;
}

export function VideoTile({ displayName, stream, isLocal, isConnected }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    if (stream) {
      // Only update srcObject if it actually changed — avoids flicker
      if (el.srcObject !== stream) {
        el.srcObject = stream;
        // Some browsers need an explicit play() after srcObject is set
        el.play().catch(() => {
          // Autoplay blocked — user gesture required; browser will handle
        });
      }
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

  return (
    <div className={`${styles.tile} ${!isConnected ? styles.offline : ''}`}>
      {stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}           // mute only local to prevent echo
          className={`${styles.video} ${isLocal ? styles.mirrored : ''}`}
        />
      ) : (
        <div className={styles.avatar}>{initials}</div>
      )}

      <div className={styles.nameTag}>
        {displayName}
        {isLocal  && <span className={styles.youLabel}> (you)</span>}
        {!isConnected && <span className={styles.offlineLabel}> • offline</span>}
      </div>
    </div>
  );
}
