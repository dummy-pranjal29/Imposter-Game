import { useGameStore } from '../../store/gameStore';
import styles from './DiscussionPanel.module.css';

/**
 * DiscussionPanel — shown during the DISCUSSION phase.
 * Displays all submitted descriptions so players can compare and debate.
 * Chat is open during this phase (see ChatPanel).
 */
export function DiscussionPanel() {
  const { descriptions, players, myUserId, myWord, isImposter, category } = useGameStore();

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>🗣️ Discussion</h2>
      <p className={styles.sub}>
        Compare descriptions. Decide who the imposter is before voting.
      </p>

      {/* Reminder of the player's own word */}
      <div className={`${styles.myWord} ${isImposter ? styles.imposterWord : styles.civilianWord}`}>
        <span className={styles.myWordLabel}>Your word ({category}):</span>
        <span className={styles.myWordValue}>{myWord}</span>
      </div>

      {/* All descriptions revealed */}
      <div className={styles.section}>
        <p className={styles.sectionLabel}>Everyone's descriptions:</p>
        {descriptions.length === 0 ? (
          <p className={styles.empty}>No descriptions were submitted.</p>
        ) : (
          <div className={styles.descList}>
            {descriptions.map((d) => {
              const isMe = d.userId === myUserId;
              return (
                <div key={d.userId} className={`${styles.descRow} ${isMe ? styles.mine : ''}`}>
                  <div className={styles.descMeta}>
                    <span className={styles.descName}>{d.displayName}</span>
                    {isMe && <span className={styles.youTag}>you</span>}
                  </div>
                  <span className={styles.descText}>"{d.description}"</span>
                </div>
              );
            })}

            {/* Show who didn't submit */}
            {players
              .filter(
                (p) =>
                  p.isConnected &&
                  !descriptions.find((d) => d.userId === p.userId)
              )
              .map((p) => (
                <div key={p.userId} className={`${styles.descRow} ${styles.missing}`}>
                  <div className={styles.descMeta}>
                    <span className={styles.descName}>{p.displayName}</span>
                    {p.userId === myUserId && <span className={styles.youTag}>you</span>}
                  </div>
                  <span className={styles.noDesc}>Did not submit a description</span>
                </div>
              ))}
          </div>
        )}
      </div>

      <p className={styles.hint}>
        Use the chat panel below to discuss. Voting starts when the timer ends.
      </p>
    </div>
  );
}
