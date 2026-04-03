import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { socketService } from '../services/socketService';
import { useGameStore } from '../store/gameStore';
import styles from './RoomPage.module.css';

/**
 * RoomPage — pre-game lobby.
 * Handles name entry, socket connection, and waiting for the host to start.
 */
export function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [joined, setJoined] = useState(false);
  const [roomMeta, setRoomMeta] = useState<{ canJoin: boolean; isFull: boolean } | null>(null);
  const [checking, setChecking] = useState(true);

  const { players, isHost, phase, myUserId } = useGameStore();

  // Validate room exists before asking for name
  useEffect(() => {
    if (!roomId) return;
    fetch(`/api/rooms/${roomId}`)
      .then((r) => r.json())
      .then((data) => {
        setRoomMeta(data);
        setChecking(false);
      })
      .catch(() => {
        setRoomMeta(null);
        setChecking(false);
      });
  }, [roomId]);

  // Redirect to game page once game starts
  useEffect(() => {
    if (phase !== 'LOBBY' && joined) {
      navigate('/game', { replace: true });
    }
  }, [phase, joined, navigate]);

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName || !roomId) return;

    socketService.connect();
    socketService.joinRoom(roomId, cleanName);
    setJoined(true);
  }

  function handleStartGame() {
    socketService.startGame();
  }

  function copyInviteLink() {
    navigator.clipboard.writeText(window.location.href);
  }

  if (checking) {
    return <div className={styles.center}><p>Checking room...</p></div>;
  }

  if (!roomMeta) {
    return (
      <div className={styles.center}>
        <p className={styles.error}>Room not found.</p>
        <a href="/" className={styles.link}>← Go Home</a>
      </div>
    );
  }

  if (roomMeta.isFull && !joined) {
    return (
      <div className={styles.center}>
        <p className={styles.error}>This room is full (5/5 players).</p>
        <a href="/" className={styles.link}>← Go Home</a>
      </div>
    );
  }

  if (!joined) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <h2 className={styles.heading}>Join Room <span className={styles.code}>{roomId}</span></h2>
          <form onSubmit={handleJoin} className={styles.form}>
            <input
              className={styles.input}
              type="text"
              placeholder="Your display name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={20}
              autoFocus
              autoComplete="off"
            />
            <button className={styles.btn} type="submit" disabled={!name.trim()}>
              Enter Room →
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.roomHeader}>
          <div>
            <h2 className={styles.heading}>Lobby</h2>
            <p className={styles.roomCode}>Room: <span className={styles.code}>{roomId}</span></p>
          </div>
          <button className={styles.copyBtn} onClick={copyInviteLink}>
            📋 Copy Invite
          </button>
        </div>

        <div className={styles.playerList}>
          <p className={styles.label}>Players ({players.length}/5)</p>
          {players.map((p) => (
            <div key={p.userId} className={styles.playerRow}>
              <span className={styles.playerName}>
                {p.displayName}
                {p.userId === myUserId && <span className={styles.you}> (you)</span>}
              </span>
              <div className={styles.badges}>
                {p.isHost && <span className={styles.badge}>Host</span>}
                {!p.isConnected && <span className={styles.badgeGrey}>Offline</span>}
              </div>
            </div>
          ))}
        </div>

        {isHost ? (
          <button
            className={styles.startBtn}
            onClick={handleStartGame}
            disabled={players.filter((p) => p.isConnected).length < 2}
          >
            Start Game ({players.filter(p => p.isConnected).length}/5)
          </button>
        ) : (
          <p className={styles.waiting}>Waiting for host to start...</p>
        )}
      </div>
    </div>
  );
}
