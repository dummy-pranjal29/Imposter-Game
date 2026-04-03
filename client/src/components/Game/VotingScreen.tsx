import { socketService } from '../../services/socketService';
import { useGameStore } from '../../store/gameStore';
import { UserId } from '../../types';
import styles from './VotingScreen.module.css';

/**
 * VotingScreen — players cast one vote for who they think is the imposter.
 *
 * Each player tile shows:
 *   • Display name
 *   • Their description (revealed at the start of this phase)
 *   • Whether they have voted yet (not whom they voted for)
 *
 * Vote is final — no changing after submission.
 */
export function VotingScreen() {
  const { players, myUserId, myVoteTarget, votedUserIds, descriptions } = useGameStore();

  function handleVote(targetId: UserId) {
    if (myVoteTarget) return;
    useGameStore.getState().setMyVoteTarget(targetId);
    socketService.castVote(targetId);
  }

  const otherPlayers    = players.filter((p) => p.userId !== myUserId && p.isConnected);
  const totalConnected  = players.filter((p) => p.isConnected).length;
  const votedCount      = votedUserIds.length;

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>🗳️ Vote</h2>
      <p className={styles.sub}>
        Who do you think is the imposter? Read each description carefully.
      </p>

      {/* Progress */}
      <div className={styles.progress}>
        <div className={styles.progressHeader}>
          <span>Votes cast</span>
          <span>{votedCount} / {totalConnected}</span>
        </div>
        <div className={styles.progressBar}>
          <div
            className={styles.progressFill}
            style={{ width: `${(votedCount / Math.max(totalConnected, 1)) * 100}%` }}
          />
        </div>
      </div>

      {/* Player tiles */}
      <div className={styles.playerList}>
        {otherPlayers.map((player) => {
          const hasVoted   = votedUserIds.includes(player.userId);
          const isMyTarget = myVoteTarget === player.userId;
          const iVoted     = myVoteTarget !== null;
          const desc       = descriptions.find((d) => d.userId === player.userId);

          return (
            <button
              key={player.userId}
              className={`${styles.playerCard}
                ${isMyTarget ? styles.selected : ''}
                ${iVoted && !isMyTarget ? styles.dimmed : ''}`}
              onClick={() => handleVote(player.userId)}
              disabled={iVoted}
            >
              <div className={styles.cardTop}>
                <span className={styles.playerName}>{player.displayName}</span>
                <div className={styles.badges}>
                  {hasVoted && (
                    <span className={styles.votedBadge}>voted</span>
                  )}
                  {isMyTarget && (
                    <span className={styles.myVoteBadge}>✓ your vote</span>
                  )}
                </div>
              </div>

              <div className={styles.descriptionBox}>
                {desc ? (
                  <>
                    <span className={styles.descLabel}>described as:</span>
                    <span className={styles.descText}>"{desc.description}"</span>
                  </>
                ) : (
                  <span className={styles.noDesc}>No description submitted</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* My own description (read-only reminder) */}
      {(() => {
        const myDesc = descriptions.find((d) => d.userId === myUserId);
        return myDesc ? (
          <div className={styles.myDescReminder}>
            <span className={styles.descLabel}>Your description:</span>
            <span className={styles.descText}>"{myDesc.description}"</span>
          </div>
        ) : null;
      })()}

      {!myVoteTarget ? (
        <p className={styles.hint}>Tap a player to vote. Your vote is final.</p>
      ) : (
        <p className={styles.confirm}>
          ✓ You voted for <strong>{players.find((p) => p.userId === myVoteTarget)?.displayName}</strong>
        </p>
      )}
    </div>
  );
}
