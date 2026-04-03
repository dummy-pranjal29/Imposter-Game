import { socketService } from '../../services/socketService';
import { useGameStore } from '../../store/gameStore';
import styles from './ResultScreen.module.css';

/**
 * ResultScreen — reveals the imposter, both words, all descriptions, and votes.
 * This is the "aha" moment: players can finally see what the imposter wrote.
 */
export function ResultScreen() {
  const { result, players, isHost, myUserId } = useGameStore();
  if (!result) return null;

  const {
    imposterCaught, imposterName, imposterId,
    civilianWord, imposterWord, category,
    eliminatedId, votes, descriptions,
  } = result;

  const iWasImposter = myUserId === imposterId;

  return (
    <div className={styles.container}>

      {/* Verdict banner */}
      <div className={`${styles.verdict} ${imposterCaught ? styles.caught : styles.escaped}`}>
        <span className={styles.emoji}>{imposterCaught ? '🎉' : '🕵️'}</span>
        <h2>{imposterCaught ? 'Imposter Caught!' : 'Imposter Escaped!'}</h2>
        <p>{imposterCaught ? 'The crew wins this round.' : 'The imposter wins this round.'}</p>
        {iWasImposter && (
          <span className={styles.youWereBadge}>
            {imposterCaught ? 'You were caught 😬' : 'You escaped! 😏'}
          </span>
        )}
      </div>

      {/* Word reveal — the core reveal moment */}
      <div className={styles.wordRevealBlock}>
        <p className={styles.sectionLabel}>Category: <strong>{category}</strong></p>
        <div className={styles.wordRow}>
          <div className={styles.wordBox}>
            <span className={styles.wordTag}>Crew word</span>
            <span className={styles.wordValue + ' ' + styles.civilianColor}>{civilianWord}</span>
          </div>
          <div className={styles.wordSep}>vs</div>
          <div className={styles.wordBox}>
            <span className={styles.wordTag}>Imposter word</span>
            <span className={styles.wordValue + ' ' + styles.imposterColor}>{imposterWord}</span>
          </div>
        </div>
        <p className={styles.imposterLine}>
          Imposter: <strong>{imposterName}</strong>
          {iWasImposter && <span className={styles.youLabel}> (you)</span>}
        </p>
      </div>

      {/* All descriptions */}
      {descriptions.length > 0 && (
        <div className={styles.section}>
          <p className={styles.sectionLabel}>What everyone wrote:</p>
          <div className={styles.descList}>
            {descriptions.map((d) => {
              const isImposterDesc = d.userId === imposterId;
              return (
                <div
                  key={d.userId}
                  className={`${styles.descRow} ${isImposterDesc ? styles.imposterDescRow : ''}`}
                >
                  <div className={styles.descMeta}>
                    <span className={styles.descName}>{d.displayName}</span>
                    {isImposterDesc && (
                      <span className={styles.imposterTag}>🕵️ imposter</span>
                    )}
                    {d.userId === myUserId && !isImposterDesc && (
                      <span className={styles.youTag}>you</span>
                    )}
                  </div>
                  <span className={styles.descText}>"{d.description}"</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Vote breakdown */}
      <div className={styles.section}>
        <p className={styles.sectionLabel}>
          Votes {eliminatedId ? `— ${players.find(p => p.userId === eliminatedId)?.displayName ?? eliminatedId} eliminated` : '— tie, no elimination'}
        </p>
        {votes.length > 0 ? (
          <div className={styles.voteList}>
            {votes.map((v) => {
              const voter  = players.find((p) => p.userId === v.voterId);
              const target = players.find((p) => p.userId === v.targetId);
              return (
                <div key={v.voterId} className={styles.voteRow}>
                  <span>{voter?.displayName ?? v.voterId}</span>
                  <span className={styles.arrow}>→</span>
                  <span className={v.targetId === imposterId ? styles.correctVote : ''}>
                    {target?.displayName ?? v.targetId}
                    {v.targetId === imposterId && ' ✓'}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className={styles.noVotes}>No votes were cast.</p>
        )}
      </div>

      {/* Actions */}
      {isHost ? (
        <button className={styles.playAgainBtn} onClick={() => socketService.playAgain()}>
          Play Again →
        </button>
      ) : (
        <p className={styles.waiting}>Waiting for host to start a new round…</p>
      )}
    </div>
  );
}
