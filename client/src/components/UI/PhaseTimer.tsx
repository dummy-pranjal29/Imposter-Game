import { useEffect, useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import styles from './PhaseTimer.module.css';

const PHASE_LABELS: Record<string, string> = {
  LOBBY: 'Lobby',
  WORD_REVEAL: 'Word Reveal',
  DISCUSSION: 'Discussion',
  VOTING: 'Voting',
  RESULT: 'Results',
};

export function PhaseTimer() {
  const { phase, phaseEndsAt, round } = useGameStore();
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!phaseEndsAt) { setSecondsLeft(null); return; }

    const tick = () => {
      const s = Math.max(0, Math.ceil((phaseEndsAt - Date.now()) / 1000));
      setSecondsLeft(s);
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [phaseEndsAt]);

  const isUrgent = secondsLeft !== null && secondsLeft <= 10;

  return (
    <div className={styles.bar}>
      <div className={styles.left}>
        <span className={styles.phase}>{PHASE_LABELS[phase] ?? phase}</span>
        {round > 0 && <span className={styles.round}>Round {round}</span>}
      </div>
      {secondsLeft !== null && (
        <span className={`${styles.timer} ${isUrgent ? styles.urgent : ''}`}>
          {secondsLeft}s
        </span>
      )}
    </div>
  );
}
