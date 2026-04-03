import { useGameStore } from '../../store/gameStore';
import styles from './ErrorToast.module.css';

export function ErrorToast() {
  const { lastError, setError } = useGameStore();
  if (!lastError) return null;

  return (
    <div className={styles.toast}>
      <span>{lastError.message}</span>
      <button className={styles.close} onClick={() => setError(null)}>✕</button>
    </div>
  );
}
