import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useLiveKit } from '../contexts/LiveKitContext';
import { useAuth } from '../contexts/AuthContext';
import { StudentCinema } from './StudentCinema';
import { Activity, AlertCircle } from 'lucide-react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL_BASE || 'http://localhost:5000/api';

export const VideoRoom: React.FC<{ onDisconnect: () => void }> = ({ onDisconnect }) => {
  const { lectureId } = useParams<{ lectureId: string }>();
  const { room, connect, disconnect, socket, isConnecting, error: lkError, isAlreadyJoining, markJoining } = useLiveKit();
  const { token } = useAuth();
  const [lecture, setLecture] = useState<any>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [hasInteracted] = useState(true);
  const [isRoomLocked, setIsRoomLocked] = useState(false);
  // Prevent reconnect loop after session is deliberately ended
  const sessionEndedRef = React.useRef(false);

  useEffect(() => {
    let isCancelled = false;
    const controller = new AbortController();
    setLocalError(null);

    const initRoom = async () => {
      if (!lectureId || !token || room || sessionEndedRef.current) return;
      
      // SYNC LOCK: Prevent parallel race conditions from React remounts
      if (isAlreadyJoining(lectureId)) {
        console.log('[STUDENT-SECURITY] Join already in progress, skipping redundant call');
        return;
      }

      try {
        markJoining(lectureId, true);
        setLocalError(null);
        console.log(`[STUDENT-VIDEO-ROOM] Initializing Session for ID: ${lectureId}`);
        const res = await axios.post(`${API_BASE}/lectures/${lectureId}/join`, {}, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
          timeout: 10000
        });
        
        if (isCancelled) {
          markJoining(lectureId, false);
          return;
        }

        console.log(`[STUDENT-VIDEO-ROOM] Join request returned with status: ${res.status}`);
        setLecture(res.data.lecture);
        await connect(res.data.serverUrl, res.data.token);
      } catch (err: any) {
        if (axios.isCancel(err)) return;
        if (!isCancelled) {
          markJoining(lectureId, false);
          // HTTP 423 = Room Locked by teacher
          if (err.response?.status === 423) {
            setIsRoomLocked(true);
          } else {
            setLocalError(err.response?.data?.message || 'Failed to join classroom');
          }
        }
      }
    };

    initRoom();

    return () => {
      isCancelled = true;
      controller.abort();
      markJoining(lectureId || '', false);
      // SOVEREIGN SECURITY: Only disconnect if truly unmounting
      console.warn('[STUDENT-SECURITY] Component unmounting, tearing down session...');
      disconnect();
      setLecture(null);
      setLocalError(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lectureId, token]); // REMOVED connect and hasInteracted to prevent rapid re-mounting

  // MISSION 18: INDEPENDENT SECURITY SENSOR
  useEffect(() => {
    if (!socket) return;

    const onKick = ({ studentId: kickedId }: { studentId: string }) => {
      const myUserId = room?.localParticipant?.identity?.split('_')[0];
      if (myUserId && kickedId === myUserId) {
        console.error('[STUDENT-SECURITY] You have been banned by the teacher.');
        sessionEndedRef.current = true;
        setLocalError('You have been permanently banned from this session by the teacher.');
        disconnect();
      }
    };

    // ROOM LOCK: Works in ANY phase (loading or connected)
    const onRoomLocked = () => {
      console.warn('[STUDENT-SECURITY] Room is locked by teacher.');
      sessionEndedRef.current = true;
      setIsRoomLocked(true);
      disconnect();
    };

    // SESSION END: Set ref immediately to block reconnection, then navigate
    const onSessionEnded = () => {
      console.log('[VIDEO-ROOM] Session ended by teacher — blocking reconnect.');
      sessionEndedRef.current = true;
      disconnect();
      setTimeout(() => onDisconnect(), 2500);
    };

    socket.on('kick_participant', onKick);
    socket.on('room:locked', onRoomLocked);
    socket.on('session_ended', onSessionEnded);

    return () => {
      socket.off('kick_participant', onKick);
      socket.off('room:locked', onRoomLocked);
      socket.off('session_ended', onSessionEnded);
    };
  }, [socket, room, disconnect, onDisconnect]);

  // ROOM LOCKED SCREEN — shown instead of loading or session
  if (isRoomLocked) {
    return (
      <div style={{
        height: '100vh', background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        color: '#fff', textAlign: 'center', padding: '20px'
      }}>
        <div style={{
          fontSize: '64px', marginBottom: '24px',
          filter: 'drop-shadow(0 0 30px rgba(239,68,68,0.5))'
        }}>🔒</div>
        <h2 style={{
          fontSize: '28px', fontWeight: '900', marginBottom: '12px',
          background: 'linear-gradient(135deg, #f87171, #ef4444)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
        }}>المحاضرة مغلقة</h2>
        <p style={{
          opacity: 0.6, maxWidth: '380px', marginBottom: '32px',
          lineHeight: '1.8', fontSize: '15px', direction: 'rtl'
        }}>تم قفل قاعة الدراسة من قِبَل المعلم.<br/>يُرجى التواصل مع المعلم لإعادة فتح الغرفة.</p>
        <button
          onClick={onDisconnect}
          style={{
            background: 'rgba(99,102,241,0.2)', color: '#818cf8',
            border: '1px solid rgba(99,102,241,0.4)', padding: '12px 32px',
            borderRadius: '14px', fontWeight: '800', cursor: 'pointer',
            fontSize: '14px', letterSpacing: '0.5px',
            transition: 'all 0.3s ease'
          }}
        >
          العودة للصفحة الرئيسية
        </button>
      </div>
    );
  }

  if (localError) {
    return (
      <div style={{ height: '100vh', background: '#0f172a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff', textAlign: 'center', padding: '20px' }}>
        <AlertCircle size={50} color="#ef4444" style={{ marginBottom: '20px' }} />
        <h2 style={{ fontSize: '24px', fontWeight: '800', marginBottom: '10px' }}>Access Revoked</h2>
        <p style={{ opacity: 0.6, maxWidth: '400px', marginBottom: '30px' }}>{localError}</p>
        <button onClick={onDisconnect} style={{ background: '#6366f1', color: 'white', border: 'none', padding: '12px 30px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
          Return to Profile
        </button>
      </div>
    );
  }

  if (isConnecting || !room || !lecture) {
    return (
      <div style={{ height: '100vh', background: '#0f172a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white', textAlign: 'center' }}>
        <div style={{ position: 'relative', marginBottom: '30px' }}>
           <div className="loading-spinner" style={{ width: '80px', height: '80px', border: '3px solid rgba(99, 102, 241, 0.1)', borderTopColor: '#6366f1', borderRadius: '50%' }}></div>
           <Activity size={30} className="animate-pulse" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: '#6366f1' }} />
        </div>
        <h2 style={{ fontSize: '24px', fontWeight: '800', marginBottom: '10px' }}>Securing Session...</h2>
        <p style={{ opacity: 0.5, maxWidth: '300px' }}>Establishing an encrypted link to the Sovereign media server.</p>
        <style>{`
          .loading-spinner { animation: spin 1s linear infinite; }
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  return (
    <div onContextMenu={(e) => e.preventDefault()}>
      <StudentCinema 
        room={room} 
        lecture={lecture} 
        onDisconnect={onDisconnect} 
      />
    </div>
  );
};
