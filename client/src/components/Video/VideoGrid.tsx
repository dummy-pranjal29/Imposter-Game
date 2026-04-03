import { useEffect, useRef, useState } from 'react';
import { webRTCService } from '../../services/webRTCService';
import { useGameStore } from '../../store/gameStore';
import { UserId } from '../../types';
import { VideoTile } from './VideoTile';
import styles from './VideoGrid.module.css';

/**
 * VideoGrid — renders local + remote video tiles.
 *
 * Critical ordering:
 *   1. Register the stream callback with webRTCService FIRST (on mount),
 *      before any async work, so no remote stream is ever missed.
 *   2. Get local stream after callback is registered.
 *   3. The callback is stored in a ref so its identity never changes,
 *      preventing stale-closure bugs across re-renders.
 */
export function VideoGrid() {
  const { players, myUserId } = useGameStore();
  const [streams, setStreams] = useState<Map<string, MediaStream>>(new Map());

  // Stable ref — identity never changes, so no re-registration needed
  const handleRemoteStreamRef = useRef((userId: UserId, stream: MediaStream | null) => {
    setStreams((prev) => {
      const next = new Map(prev);
      if (stream) {
        next.set(userId, stream);
      } else {
        next.delete(userId);
      }
      return next;
    });
  });

  useEffect(() => {
    // Step 1: register callback IMMEDIATELY — before any awaits
    webRTCService.setStreamCallback(handleRemoteStreamRef.current);

    // Step 2: get local stream and put it in state
    webRTCService.getLocalStream().then((stream) => {
      setStreams((prev) => {
        const next = new Map(prev);
        next.set('local', stream);
        return next;
      });
    }).catch(() => {
      // Permission denied — continue without video
    });

    // No cleanup needed: webRTCService lifetime > component lifetime
  }, []); // run once on mount only

  return (
    <div className={styles.grid} data-count={players.length}>
      {/* Local tile */}
      {myUserId && (
        <VideoTile
          key="local"
          userId={myUserId}
          displayName={players.find((p) => p.userId === myUserId)?.displayName ?? 'You'}
          stream={streams.get('local') ?? null}
          isLocal={true}
          isConnected={true}
        />
      )}

      {/* Remote tiles */}
      {players
        .filter((p) => p.userId !== myUserId)
        .map((player) => (
          <VideoTile
            key={player.userId}
            userId={player.userId}
            displayName={player.displayName}
            stream={streams.get(player.userId) ?? null}
            isLocal={false}
            isConnected={player.isConnected}
          />
        ))}
    </div>
  );
}
