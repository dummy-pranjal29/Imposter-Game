import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import { webRTCService } from '../services/webRTCService';
import { VideoGrid } from '../components/Video/VideoGrid';
import { ChatPanel } from '../components/Chat/ChatPanel';
import { WordRevealScreen } from '../components/Game/WordRevealScreen';
import { DescriptionScreen } from '../components/Game/DescriptionScreen';
import { DiscussionPanel } from '../components/Game/DiscussionPanel';
import { VotingScreen } from '../components/Game/VotingScreen';
import { ResultScreen } from '../components/Game/ResultScreen';
import { PhaseTimer } from '../components/UI/PhaseTimer';
import styles from './GamePage.module.css';

export function GamePage() {
  const navigate = useNavigate();
  const { phase, roomId } = useGameStore();

  useEffect(() => {
    if (!roomId) navigate('/', { replace: true });
  }, [roomId, navigate]);

  useEffect(() => {
    return () => { webRTCService.closeAll(); };
  }, []);

  return (
    <div className={styles.layout}>
      {/* Left — video + chat */}
      <div className={styles.leftPanel}>
        <VideoGrid />
        <ChatPanel />
      </div>

      {/* Right — phase screen */}
      <div className={styles.rightPanel}>
        <PhaseTimer />

        {phase === 'LOBBY'       && <LobbyStandby />}
        {phase === 'WORD_REVEAL' && <WordRevealScreen />}
        {phase === 'DESCRIPTION' && <DescriptionScreen />}
        {phase === 'DISCUSSION'  && <DiscussionPanel />}
        {phase === 'VOTING'      && <VotingScreen />}
        {phase === 'RESULT'      && <ResultScreen />}
      </div>
    </div>
  );
}

function LobbyStandby() {
  return (
    <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '2rem' }}>
      Waiting for host to start the game…
    </div>
  );
}
