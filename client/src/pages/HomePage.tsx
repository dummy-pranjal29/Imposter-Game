import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './HomePage.module.css';

export function HomePage() {
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');

  async function handleCreate() {
    setCreating(true);
    setError('');
    try {
      const res = await fetch(`${import.meta.env.VITE_SERVER_URL ?? ''}/api/rooms`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to create room');
      const { roomId } = await res.json();
      navigate(`/room/${roomId}`);
    } catch {
      setError('Could not create room. Is the server running?');
    } finally {
      setCreating(false);
    }
  }

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (!code || code.length !== 6) {
      setError('Enter a valid 6-character room code.');
      return;
    }
    navigate(`/room/${code}`);
  }

  return (
    <div className={styles.container}>
      <div className={styles.hero}>
        <h1 className={styles.title}>
          <span className={styles.accent}>Imposter</span> Game
        </h1>
        <p className={styles.subtitle}>
          Real-time social deception for up to 5 players.
          <br />Find the imposter — or be one.
        </p>
      </div>

      <div className={styles.card}>
        <button
          className={styles.createBtn}
          onClick={handleCreate}
          disabled={creating}
        >
          {creating ? 'Creating...' : '+ Create New Room'}
        </button>

        <div className={styles.divider}><span>or join with a code</span></div>

        <form onSubmit={handleJoin} className={styles.joinForm}>
          <input
            className={styles.input}
            type="text"
            placeholder="Enter room code (e.g. AB12CD)"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            maxLength={6}
            autoComplete="off"
          />
          <button className={styles.joinBtn} type="submit">
            Join Room →
          </button>
        </form>

        {error && <p className={styles.error}>{error}</p>}
      </div>
    </div>
  );
}
