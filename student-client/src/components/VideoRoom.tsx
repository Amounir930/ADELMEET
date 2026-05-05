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
  const { room, connect, disconnect, socket, isConnecting, error: lkError } = useLiveKit();
  const { token } = useAuth();
  const [lecture, setLecture] = useState<any>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [hasInteracted] = useState(true);

  const isInitializing = React.useRef(false);

  useEffect(() => {
    setLocalError(null);

    const initRoom = async () => {
      if (!lectureId || !token || room || !hasInteracted || isInitializing.current) return;
      
      try {
        isInitializing.current = true;
        setLocalError(null);
        console.log(`[STUDENT-VIDEO-ROOM] Initializing Session for ID: ${lectureId}`);
        const res = await axios.post(`${API_BASE}/lectures/${lectureId}/join`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        setLecture(res.data.lecture);
        await connect(res.data.serverUrl, res.data.token);
      } catch (err: any) {
        setLocalError(err.response?.data?.message || 'Failed to join classroom');
      }
    };

    initRoom();

    return () => {
      isInitializing.current = false;
      // SOVEREIGN SECURITY: Only disconnect if truly unmounting
      console.warn('[STUDENT-SECURITY] Component unmounting, tearing down session...');
      disconnect();
      setLecture(null);
      setLocalError(null);
    };
  }, [lectureId, token, connect, hasInteracted]); 

  // MISSION 18: INDEPENDENT SECURITY SENSOR
  useEffect(() => {
    if (!socket || !room) return;

    const onKick = ({ studentId: kickedId }: { studentId: string }) => {
      const myUserId = room.localParticipant?.identity?.split('_')[0];
      if (myUserId && kickedId === myUserId) {
        console.error('[STUDENT-SECURITY] You have been banned by the teacher.');
        setLocalError('You have been permanently banned from this session by the teacher.');
        disconnect();
      }
    };

    socket.on('kick_participant', onKick);
    return () => {
      socket.off('kick_participant', onKick);
    };
  }, [socket, room, disconnect]);

  if (localError || lkError) {
    return (
      <div style={{ height: '100vh', background: '#0f172a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff', textAlign: 'center', padding: '20px' }}>
        <AlertCircle size={50} color="#ef4444" style={{ marginBottom: '20px' }} />
        <h2 style={{ fontSize: '24px', fontWeight: '800', marginBottom: '10px' }}>Access Revoked</h2>
        <p style={{ opacity: 0.6, maxWidth: '400px', marginBottom: '30px' }}>{localError || lkError}</p>
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
