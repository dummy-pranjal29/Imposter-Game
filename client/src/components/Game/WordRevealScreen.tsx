import { useGameStore } from '../../store/gameStore';
import styles from './WordRevealScreen.module.css';

/**
 * WordRevealScreen — shows each player their private word for 15 seconds.
 *
 * Security: myWord/isImposter arrive via a private targeted socket emit
 * ('your-word') addressed only to this socket. They are never broadcast.
 *
 * Civilians see their word + category.
 * The imposter sees a DIFFERENT but related word from the same category.
 * Neither knows what the other has until DISCUSSION.
 */
export function WordRevealScreen() {
  const { myWord, isImposter, category, phaseEndsAt } = useGameStore();

  const secondsLeft = phaseEndsAt
    ? Math.max(0, Math.ceil((phaseEndsAt - Date.now()) / 1000))
    : 0;

  if (myWord === null) {
    return (
      <div className={styles.container}>
        <p className={styles.loading}>Receiving your word…</p>
      </div>
    );
  }

  return (
    <div className={`${styles.container} ${isImposter ? styles.imposterTheme : styles.normalTheme}`}>

      <div className={styles.roleTag}>
        {isImposter ? '🕵️ IMPOSTER' : '✅ CREW MEMBER'}
      </div>

      <p className={styles.categoryLabel}>Category: <strong>{category}</strong></p>

      <div className={styles.wordCard}>
        <p className={styles.wordHint}>Your word is:</p>
        <h1 className={styles.word}>{myWord}</h1>
      </div>

      <div className={styles.rules}>
        {isImposter ? (
          <>
            <p>⚠️ Civilians have a <strong>different but similar word</strong> in this category.</p>
            <p>Listen to their descriptions. Blend in. Don't get voted out!</p>
          </>
        ) : (
          <>
            <p>One player has a <strong>different but related word</strong> in this category.</p>
            <p>In the next phase, describe your word in <strong>3 words or less</strong>.</p>
          </>
        )}
      </div>

      <div className={styles.timerRow}>
        <span>Description phase starts in</span>
        <span className={styles.timerNum}>{secondsLeft}s</span>
      </div>
    </div>
  );
}
