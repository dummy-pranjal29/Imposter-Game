import { useEffect, useRef, useState } from 'react';
import { webRTCService } from '../../services/webRTCService';
import { useGameStore } from '../../store/gameStore';
import { UserId } from '../../types';
import { VideoTile } from './VideoTile';
import styles from './VideoGrid.module.css';

export function VideoGrid() {
  const { players, myUserId } = useGameStore();
  const [streams, setStreams]         = useState<Map<string, MediaStream>>(new Map());
  const [connStates, setConnStates]   = useState<Map<string, RTCPeerConnectionState>>(new Map());

  const streamCbRef = useRef((userId: UserId, stream: MediaStream | null) => {
    setStreams((prev) => {
      const next = new Map(prev);
      if (stream) next.set(userId, stream);
      else next.delete(userId);
      return next;
    });
  });

  const stateCbRef = useRef((userId: UserId, state: RTCPeerConnectionState) => {
    setConnStates((prev) => {
      const next = new Map(prev);
      next.set(userId, state);
      return next;
    });
  });

  useEffect(() => {
    webRTCService.setStreamCallback(streamCbRef.current);
    webRTCService.setConnectionStateCallback(stateCbRef.current);

    webRTCService.getLocalStream().then((stream) => {
      setStreams((prev) => {
        const next = new Map(prev);
        next.set('local', stream);
        return next;
      });
    }).catch(() => { /* permission denied */ });
  }, []);

  return (
    <div className={styles.grid} data-count={players.length}>
      {myUserId && (
        <VideoTile
          key="local"
          userId={myUserId}
          displayName={players.find((p) => p.userId === myUserId)?.displayName ?? 'You'}
          stream={streams.get('local') ?? null}
          isLocal={true}
          isConnected={true}
          connState={null}
        />
      )}

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
            connState={connStates.get(player.userId) ?? null}
          />
        ))}
    </div>
  );
}
