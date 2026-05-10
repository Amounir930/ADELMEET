import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Room, RoomEvent, RemoteParticipant } from 'livekit-client';

import { VideoTrack } from './VideoTrack';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { Users, LayoutGrid } from 'lucide-react';

import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL_BASE || 'http://localhost:5000/api';

/**
 * MISSION 22: SOVEREIGN GRID DISPLAY (Cinematic v2.0)
 * Ultimate high-density monitoring UI for secondary displays.
 * Features: Adaptive Grid, Glassmorphism Markers, Performance Optimized.
 */
export const GridPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { token } = useAuth();
  const { socket } = useSocket();
  const [room, setRoom] = useState<Room | null>(null);
  const [participants, setParticipants] = useState<RemoteParticipant[]>([]);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(true);
  const [cursorVisible] = useState(true);


  const lectureId = searchParams.get('lecture') || '';
  const roomParam = searchParams.get('roomName') || searchParams.get('room') || '';
  
  // MISSION 22: Stable Hardware ID
  const [hardwareId] = useState(() => {
    const saved = localStorage.getItem('sovereign_hw_id');
    if (saved) return saved;
    const newId = `hw_${Math.random().toString(36).substring(2, 11)}`;
    localStorage.setItem('sovereign_hw_id', newId);
    return newId;
  });

  const [totalScreens, setTotalScreens] = useState(parseInt(searchParams.get('totalScreens') || '1', 10));
  const screenIndex = parseInt(searchParams.get('screenIndex') || searchParams.get('screen') || '0', 10);

  function os_hostname() { return 'sovereign-node'; }

  useEffect(() => {
    if ((!lectureId && !roomParam) || !token) return;
    const connectToRoom = async () => {
      try {
        setIsConnecting(true);
        // MISSION 13: Direct Room Binding
        const res = await axios.post(`${API_BASE}/lectures/${lectureId}/join?screen=${screenIndex}`, {
          roomName: roomParam // Pass roomName explicitly if we have it
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const newRoom = new Room({ adaptiveStream: true, dynacast: true });
        
        // FIX: Enable autoSubscribe to ensure students appear
        await newRoom.connect(res.data.serverUrl, res.data.token, { autoSubscribe: true });
        
        setRoom(newRoom);
        setIsConnecting(false);
      } catch (err: any) {
        console.error('[GRID-PAGE] Connection Failure:', err);
        setError(err.response?.data?.message || 'Failed to connect');
        setIsConnecting(false);
      }
    };
    connectToRoom();
    return () => { room?.disconnect(); };
  }, [lectureId, roomParam, token]);

  const updateParticipants = useCallback(() => {
    if (!room) return;
    const all = Array.from(room.remoteParticipants.values()).filter(p => {
      const metadata = p.metadata ? JSON.parse(p.metadata) : {};
      const isTeacher = p.identity.toLowerCase().includes('teacher') || 
                        p.identity.toLowerCase().includes('admin') ||
                        metadata.role === 'teacher' || 
                        p.identity === 'adel' ||
                        p.name?.toLowerCase().includes('teacher');
      return !isTeacher;
    });
    all.sort((a, b) => a.identity.localeCompare(b.identity));
    const myStudents = all.filter((_, index) => index % totalScreens === screenIndex);
    setParticipants(myStudents);
  }, [room, totalScreens, screenIndex]);

  useEffect(() => {
    if (!room) return;
    room.on(RoomEvent.ParticipantConnected, updateParticipants);
    room.on(RoomEvent.ParticipantDisconnected, updateParticipants);
    room.on(RoomEvent.TrackSubscribed, updateParticipants);
    updateParticipants();
    return () => { room.removeAllListeners(); };
  }, [room, updateParticipants]);

  useEffect(() => {
    if (!socket || !room) return;

    const register = () => {
      if (socket.connected) {
        console.log('[GRID-PAGE] Registering screen', screenIndex, 'in room', room.name);
        socket.emit('display:register_screen', { roomName: room.name, screenIndex, hardwareId });
      }
    };

    socket.on('connect', register);
    register(); // Try immediately if already connected
    
    socket.on('display_command', ({ command, payload }: any) => {
      console.log('[GRID-PAGE] Received Command:', command, payload);
      if (command === 'close_all') window.close();
      if (command === 'close_one' && Number(payload) === screenIndex) window.close();
      if (command === 'refresh') window.location.reload();
      if (command === 'refresh_one' && Number(payload) === screenIndex) window.location.reload();
      if (command === 'rebalance' && typeof payload === 'number') {
        console.log('[GRID-PAGE] Rebalancing to', payload, 'screens');
        setTotalScreens(payload);
      }
    });

    socket.on('session_ended', () => setSessionEnded(true));

    const heartbeatInterval = setInterval(() => {
      if (!socket.connected) {
        console.warn('[GRID-PAGE] Socket disconnected, skipping heartbeat');
        return;
      }

      const metrics = {
        cpu: Math.min(10 + participants.length * 5, 95),
        ram: Math.min(20 + participants.length * 4, 90),
        fps: 60,
        bandwidth: participants.length * 1.2,
        studentsRendered: participants.length,
        errors: 0
      };

      console.log('[GRID-PAGE] Sending Heartbeat:', metrics.studentsRendered, 'students');
      socket.emit('display:heartbeat', {
        hardwareId,
        screenIndex,
        lectureId,
        roomName: room.name,
        metrics
      });
    }, 5000);

    return () => { 
      socket.off('connect', register);
      socket.off('display_command'); 
      socket.off('session_ended');
      clearInterval(heartbeatInterval);
    };
  }, [socket, room, screenIndex, participants.length, hardwareId, lectureId]);

  const getLayout = () => {
    const n = participants.length;
    if (n <= 1) return { cols: 1 };
    if (n <= 4) return { cols: 2 };
    if (n <= 9) return { cols: 3 };
    if (n <= 16) return { cols: 4 };
    return { cols: 5 };
  };

  if (error) return <div style={errorStyle}>SCREEN {screenIndex + 1}: {error}</div>;
  if (isConnecting) return <div style={loadingStyle}>CONNECTING SCREEN {screenIndex + 1}...</div>;

  const { cols } = getLayout();

  return (
    <div style={{ height: '100vh', width: '100vw', background: '#0a0a0c', overflow: 'hidden', position: 'relative', cursor: cursorVisible ? 'default' : 'none' }} onContextMenu={e => e.preventDefault()}>
      
      {/* CINEMATIC INDICATOR */}
      <div style={indicatorStyle}>
        <div style={glowDot}></div>
        <span style={screenLabelStyle}>MONITOR {screenIndex + 1}</span>
        <div style={dividerStyle}></div>
        <Users size={14} color="#6366f1" />
        <span style={countStyle}>{participants.length}</span>
      </div>

      {/* DYNAMIC CINEMA GRID */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: '15px',
        width: '100%',
        height: '100%',
        padding: '60px 20px 20px'
      }}>
        {participants.map(p => (
          <div key={p.identity} style={tileStyle}>
            <VideoTrack participant={p} room={room!} mode="grid" />
            <div style={labelWrapperStyle}>
              <span style={labelStyle}>{p.name || p.identity.split('_')[0]}</span>
            </div>
          </div>
        ))}

        {participants.length === 0 && (
          <div style={emptyStateStyle}>
             <LayoutGrid size={80} color="rgba(99, 102, 241, 0.1)" />
             <p style={{ color: 'rgba(255,255,255,0.2)', fontWeight: '900', letterSpacing: '4px' }}>AWAITING ASSIGNMENT</p>
          </div>
        )}
      </div>

      {sessionEnded && <div style={teardownOverlayStyle}><h1>SESSION COMPLETED</h1><p>Source Disconnected.</p></div>}
    </div>
  );
};

const indicatorStyle: React.CSSProperties = {
  position: 'absolute', top: '20px', left: '20px', zIndex: 100,
  background: 'rgba(15, 23, 42, 0.8)', padding: '10px 20px', borderRadius: '14px',
  backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)',
  display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
};

const glowDot: React.CSSProperties = {
  width: '8px', height: '8px', background: '#10b981', borderRadius: '50%', boxShadow: '0 0 12px #10b981'
};

const screenLabelStyle: React.CSSProperties = {
  color: '#fff', fontSize: '11px', fontWeight: '900', letterSpacing: '2px'
};

const dividerStyle: React.CSSProperties = {
  width: '1px', height: '15px', background: 'rgba(255,255,255,0.1)'
};

const countStyle: React.CSSProperties = {
  color: '#6366f1', fontSize: '16px', fontWeight: '900', fontFamily: 'monospace'
};

const tileStyle: React.CSSProperties = {
  position: 'relative', overflow: 'hidden', background: '#000',
  borderRadius: '24px', border: '1px solid rgba(255,255,255,0.05)',
  boxShadow: '0 20px 40px rgba(0,0,0,0.4)', transition: 'transform 0.3s ease'
};

const labelWrapperStyle: React.CSSProperties = {
  position: 'absolute', bottom: '15px', left: '15px',
  background: 'rgba(15, 23, 42, 0.7)', padding: '6px 15px', borderRadius: '10px',
  backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)', zIndex: 10
};

const labelStyle: React.CSSProperties = {
  color: 'white', fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px'
};

const errorStyle: React.CSSProperties = { height: '100vh', background: '#0a0a0c', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' };
const loadingStyle: React.CSSProperties = { height: '100vh', background: '#0a0a0c', color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', letterSpacing: '3px' };
const emptyStateStyle: React.CSSProperties = { gridColumn: '1 / -1', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px' };
const teardownOverlayStyle: React.CSSProperties = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: '#0a0a0c', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff' };
