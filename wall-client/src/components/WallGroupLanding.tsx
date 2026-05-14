import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Monitor, Wifi, WifiOff, Loader2 } from 'lucide-react';
import { useSocket } from '../contexts/SocketContext';

/**
 * WALL GROUP LANDING PAGE
 * 
 * Permanent URL for each physical display: wall.60sec.shop/?group=hall-101
 * 
 * Lifecycle:
 * 1. Reads ?group= from URL
 * 2. Emits wall:register to backend
 * 3. Backend checks Redis → if active lecture: wall:navigate (Late Joiner)
 *    Otherwise: wall:idle (show standby screen)
 * 4. Listens for future wall:navigate commands from teacher
 */
export const WallGroupLanding: React.FC = () => {
  const [searchParams] = useSearchParams();
  const groupName = searchParams.get('group') || '';
  const navigate = useNavigate();
  const { socket } = useSocket();

  const [status, setStatus] = useState<'connecting' | 'idle' | 'navigating'>('connecting');
  const [currentRoom, setCurrentRoom] = useState<string | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);

  useEffect(() => {
    if (!groupName) {
      setStatus('idle');
      return;
    }
    if (!socket) return;

    const handleConnect = () => {
      setSocketConnected(true);
      setStatus('connecting');
      // Register this display with its group
      socket.emit('wall:register', { groupName });
    };

    const handleDisconnect = () => {
      setSocketConnected(false);
      setStatus('connecting');
    };

    // wall:navigate — teacher pushed a lecture (or Late Joiner recovery)
    const handleNavigate = ({ roomName }: { roomName: string }) => {
      console.log(`[WALL-GROUP] Navigating to room: ${roomName}`);
      setCurrentRoom(roomName);
      setStatus('navigating');
      // Navigate to PUBLIC wall view (no auth required)
      setTimeout(() => {
        navigate(`/wall-view/${roomName}?group=${groupName}`);
      }, 800);
    };

    // wall:idle — return to standby
    const handleIdle = () => {
      console.log(`[WALL-GROUP] Returning to idle`);
      setStatus('idle');
      setCurrentRoom(null);
    };

    // Register immediately if socket already connected
    if (socket.connected) {
      handleConnect();
    }

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('wall:navigate', handleNavigate);
    socket.on('wall:idle', handleIdle);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('wall:navigate', handleNavigate);
      socket.off('wall:idle', handleIdle);
    };
  }, [socket, groupName, navigate]);

  // ── UI ──────────────────────────────────────────────────────────────────

  if (!groupName) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <Monitor size={64} color="#ef4444" />
          <h1 style={styles.title}>No Group Assigned</h1>
          <p style={styles.subtitle}>
            Add <code style={styles.code}>?group=hall-101</code> to the URL
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Connection indicator */}
      <div style={styles.connectionBadge}>
        {socketConnected
          ? <><Wifi size={14} color="#22c55e" /> <span style={{ color: '#22c55e' }}>CONNECTED</span></>
          : <><WifiOff size={14} color="#ef4444" /> <span style={{ color: '#ef4444' }}>RECONNECTING...</span></>
        }
      </div>

      <div style={styles.card}>
        {status === 'connecting' && (
          <>
            <Loader2 size={64} color="#6366f1" style={{ animation: 'spin 1.2s linear infinite' }} />
            <h1 style={styles.title}>Initializing Display</h1>
            <p style={styles.subtitle}>Connecting to Sovereign Network...</p>
          </>
        )}

        {status === 'idle' && (
          <>
            <Monitor size={80} color="#6366f1" style={{ opacity: 0.8 }} />
            <h1 style={styles.title}>Display Ready</h1>
            <p style={styles.subtitle}>Awaiting lecture from instructor</p>
            <div style={styles.groupBadge}>{groupName}</div>
          </>
        )}

        {status === 'navigating' && (
          <>
            <Loader2 size={64} color="#22c55e" style={{ animation: 'spin 0.8s linear infinite' }} />
            <h1 style={{ ...styles.title, color: '#22c55e' }}>Launching Lecture</h1>
            <p style={styles.subtitle}>{currentRoom}</p>
          </>
        )}
      </div>

      {/* Group label — bottom center */}
      <div style={styles.groupLabel}>{groupName}</div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:.6} 50%{opacity:1} }
      `}</style>
    </div>
  );
};

// ── Styles ─────────────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  container: {
    width: '100vw',
    height: '100vh',
    background: '#020617',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: "'Outfit', sans-serif",
    overflow: 'hidden',
    position: 'relative',
  },
  connectionBadge: {
    position: 'absolute',
    top: 30,
    right: 30,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: '0.15em',
    background: 'rgba(15, 23, 42, 0.6)',
    backdropFilter: 'blur(10px)',
    padding: '8px 16px',
    borderRadius: 30,
    border: '1px solid rgba(255,255,255,0.05)',
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 30,
    textAlign: 'center',
    zIndex: 1,
  },
  title: {
    color: '#f1f5f9',
    fontSize: 48,
    fontWeight: 900,
    margin: 0,
    letterSpacing: '-0.03em',
  },
  subtitle: {
    color: '#475569',
    fontSize: 18,
    margin: 0,
    fontWeight: 500,
    letterSpacing: '0.02em',
  },
  code: {
    background: 'rgba(99,102,241,0.1)',
    color: '#818cf8',
    padding: '4px 12px',
    borderRadius: 10,
    fontFamily: 'monospace',
    fontSize: 18,
    border: '1px solid rgba(99,102,241,0.2)',
  },
  groupBadge: {
    marginTop: 10,
    background: 'linear-gradient(135deg, rgba(99,102,241,0.1) 0%, rgba(168,85,247,0.1) 100%)',
    border: '1px solid rgba(99,102,241,0.3)',
    color: '#818cf8',
    padding: '12px 32px',
    borderRadius: 40,
    fontSize: 13,
    fontWeight: 900,
    letterSpacing: '0.2em',
    textTransform: 'uppercase' as const,
    boxShadow: '0 10px 30px rgba(99,102,241,0.2)',
  },
  groupLabel: {
    position: 'absolute',
    bottom: 40,
    left: '50%',
    transform: 'translateX(-50%)',
    color: 'rgba(255,255,255,0.05)',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.5em',
    textTransform: 'uppercase' as const,
  },
};
