import { useState, useEffect, useRef } from 'react';
import { socketService } from '../../services/socketService';
import { useGameStore } from '../../store/gameStore';
import styles from './DescriptionScreen.module.css';

/**
 * DescriptionScreen — 2-minute phase where every player writes
 * a MAX 3-word description of their word.
 *
 * Rules enforced both here (UX) and on the server (security):
 *   • Max 3 words (space-separated)
 *   • Cannot be changed after submission
 *   • Descriptions are NOT revealed to others until DISCUSSION starts
 *
 * The word itself is shown as a reminder (it's private to this player).
 */
export function DescriptionScreen() {
  const {
    myWord,
    isImposter,
    category,
    submittedDescription,
    submittedUserIds,
    players,
    myUserId,
    phaseEndsAt,
    markDescriptionSubmitted,
  } = useGameStore();

  const [input, setInput]       = useState('');
  const [secondsLeft, setSecondsLeft] = useState(120);
  const inputRef = useRef<HTMLInputElement>(null);

  // Countdown timer
  useEffect(() => {
    const tick = () => {
      if (!phaseEndsAt) return;
      setSecondsLeft(Math.max(0, Math.ceil((phaseEndsAt - Date.now()) / 1000)));
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [phaseEndsAt]);

  // Enforce max 3 words in the input
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    // Allow typing but cap at 3 words (don't cut mid-word while user types)
    const words = raw.trimStart().split(/\s+/);
    if (words.length > 3 && raw.endsWith(' ')) return; // block adding a 4th word via space
    setInput(raw);
  }

  const wordCount = input.trim() === '' ? 0 : input.trim().split(/\s+/).length;
  const isOver3   = wordCount > 3;
  const canSubmit = !submittedDescription && wordCount >= 1 && wordCount <= 3;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    socketService.submitDescription(input.trim());
    markDescriptionSubmitted();
  }

  const totalConnected  = players.filter((p) => p.isConnected).length;
  const submittedCount  = submittedUserIds.length;
  const isUrgent        = secondsLeft <= 15;

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');

  return (
    <div className={styles.container}>

      {/* Timer */}
      <div className={`${styles.timerBar} ${isUrgent ? styles.urgent : ''}`}>
        <span>⏱ Time to describe</span>
        <span className={styles.timerNum}>{mm}:{ss}</span>
      </div>

      {/* Your word reminder */}
      <div className={`${styles.wordReminder} ${isImposter ? styles.imposter : styles.normal}`}>
        <span className={styles.wordLabel}>Your word ({category}):</span>
        <span className={styles.wordValue}>{myWord}</span>
      </div>

      {/* Submission form */}
      {!submittedDescription ? (
        <form onSubmit={handleSubmit} className={styles.form}>
          <label className={styles.label} htmlFor="desc-input">
            Describe your word in <strong>3 words or fewer</strong>:
          </label>
          <div className={styles.inputRow}>
            <input
              id="desc-input"
              ref={inputRef}
              className={`${styles.input} ${isOver3 ? styles.inputError : ''}`}
              type="text"
              placeholder="e.g. fast big striped"
              value={input}
              onChange={handleChange}
              maxLength={60}
              autoFocus
              autoComplete="off"
              disabled={submittedDescription}
            />
            <span className={`${styles.wordCount} ${isOver3 ? styles.overLimit : ''}`}>
              {wordCount}/3
            </span>
          </div>
          {isOver3 && (
            <p className={styles.errorMsg}>Maximum 3 words allowed.</p>
          )}
          <button
            className={styles.submitBtn}
            type="submit"
            disabled={!canSubmit}
          >
            Submit Description ↑
          </button>
        </form>
      ) : (
        <div className={styles.submitted}>
          <span className={styles.checkmark}>✓</span>
          <p>Description submitted!</p>
          <p className={styles.muted}>Waiting for others… Descriptions reveal when everyone submits or time runs out.</p>
        </div>
      )}

      {/* Progress: who has submitted */}
      <div className={styles.progress}>
        <div className={styles.progressHeader}>
          <span>Submitted</span>
          <span>{submittedCount} / {totalConnected}</span>
        </div>
        <div className={styles.progressBar}>
          <div
            className={styles.progressFill}
            style={{ width: `${(submittedCount / Math.max(totalConnected, 1)) * 100}%` }}
          />
        </div>
        <div className={styles.playerPips}>
          {players.filter((p) => p.isConnected).map((p) => (
            <div
              key={p.userId}
              className={`${styles.pip} ${submittedUserIds.includes(p.userId) ? styles.pipDone : ''}`}
              title={`${p.displayName}${submittedUserIds.includes(p.userId) ? ' — submitted' : ' — writing…'}`}
            >
              <span className={styles.pipInitial}>
                {p.displayName[0].toUpperCase()}
              </span>
              {p.userId === myUserId && <span className={styles.pipYou}>you</span>}
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
