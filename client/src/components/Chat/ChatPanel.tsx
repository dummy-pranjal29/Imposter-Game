import { useEffect, useRef, useState } from 'react';
import { socketService } from '../../services/socketService';
import { useGameStore } from '../../store/gameStore';
import styles from './ChatPanel.module.css';

export function ChatPanel() {
  const { chat, phase, myUserId } = useGameStore();
  const [text, setText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const canChat = phase === 'DISCUSSION';

  // Auto-scroll to newest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat.length]);

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || !canChat) return;
    socketService.sendChat(trimmed);
    setText('');
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span>Chat</span>
        {!canChat && <span className={styles.locked}>🔒 Discussion only</span>}
      </div>

      <div className={styles.messages}>
        {chat.length === 0 && (
          <p className={styles.empty}>No messages yet.</p>
        )}
        {chat.map((msg) => {
          const isMe = msg.userId === myUserId;
          return (
            <div
              key={msg.messageId}
              className={`${styles.message} ${isMe ? styles.mine : ''}`}
            >
              {!isMe && (
                <span className={styles.author}>{msg.displayName}</span>
              )}
              <div className={styles.bubble}>{msg.text}</div>
              <span className={styles.time}>
                {new Date(msg.timestamp).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className={styles.inputRow}>
        <input
          className={styles.input}
          type="text"
          placeholder={canChat ? 'Type a message...' : 'Chat locked'}
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={!canChat}
          maxLength={300}
        />
        <button className={styles.sendBtn} type="submit" disabled={!canChat || !text.trim()}>
          ↑
        </button>
      </form>
    </div>
  );
}
