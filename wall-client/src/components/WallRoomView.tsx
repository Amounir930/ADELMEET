import React, { useEffect, useState, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Room, RoomEvent, RemoteParticipant, Track, RemoteTrackPublication } from 'livekit-client';
import { VideoTrack } from './VideoTrack';
import { Wifi, WifiOff, Monitor, Users, Loader2, Maximize, Minimize } from 'lucide-react';
import { useSocket } from '../contexts/SocketContext';

const API_BASE = import.meta.env.VITE_API_URL_BASE || 'http://localhost:5000/api';

/**
 * WALL ROOM VIEW — Public, no auth required.
 * Subscribe-only spectator view for wall display screens.
 * URL: wall.60sec.shop/wall-view/:roomName?group=hall-101
 */
export const WallRoomView: React.FC = () => {
  const { roomName } = useParams<{ roomName: string }>();
  const [searchParams] = useSearchParams();
  const group = searchParams.get('group') || 'wall';
  const navigate = useNavigate();

  const [status, setStatus] = useState<'loading' | 'connected' | 'error' | 'ended'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [participants, setParticipants] = useState<RemoteParticipant[]>([]);
  const [teacherParticipant, setTeacherParticipant] = useState<RemoteParticipant | null>(null);
  const [assignedStudents, setAssignedStudents] = useState<string[] | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const roomRef = useRef<Room | null>(null);
  const { socket } = useSocket();
  const screenIndex = searchParams.get('screen');

  useEffect(() => {
    if (!roomName) return;
    let cancelled = false;

    const connect = async () => {
      try {
        setStatus('loading');

        // Fetch spectator token — NO auth header needed
        const res = await fetch(`${API_BASE}/wall/token/${roomName}?group=${group}`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          if (res.status === 404) {
            setStatus('ended');
            return;
          }
          throw new Error(data.error || `HTTP ${res.status}`);
        }

        const { token, serverUrl } = await res.json();
        if (cancelled) return;

        const room = new Room({
          adaptiveStream: true,
          dynacast: true,
        });
        roomRef.current = room;

        // Participant tracking
        const updateParticipants = () => {
          const remotes = Array.from(room.remoteParticipants.values());
          setParticipants(remotes);
          const teacher = remotes.find(p => p.identity.includes('teacher') || p.metadata?.includes('teacher'));
          setTeacherParticipant(teacher || null);
        };

        room
          .on(RoomEvent.ParticipantConnected, updateParticipants)
          .on(RoomEvent.ParticipantDisconnected, updateParticipants)
          .on(RoomEvent.TrackSubscribed, updateParticipants)
          .on(RoomEvent.TrackUnsubscribed, updateParticipants)
          .on(RoomEvent.Disconnected, (reason) => {
            if (!cancelled) {
              if (reason === 5) { // ROOM_DELETED
                setStatus('ended');
              } else {
                setStatus('error');
                setErrorMsg('Connection lost. Reconnecting...');
                // Auto-retry after 5s
                setTimeout(() => { if (!cancelled) connect(); }, 5000);
              }
            }
          });

        await room.connect(serverUrl, token);
        if (cancelled) { room.disconnect(); return; }

        updateParticipants();
        setStatus('connected');
      } catch (err: any) {
        if (!cancelled) {
          setStatus('error');
          setErrorMsg(err.message || 'Connection failed');
        }
      }
    };

    connect();

    return () => {
      cancelled = true;
      roomRef.current?.disconnect();
      roomRef.current = null;
    };
  }, [roomName, group]);

  // ── SCREEN HUB SYNC ───────────────────────────────────────────────────
  useEffect(() => {
    if (!socket || !roomName || screenIndex === null) return;

    const screenIdxInt = parseInt(screenIndex);
    const channel = `${roomName}:screen:${screenIdxInt}`;
    
    console.log(`[WALL-VIEW] Registering for targeted monitor: ${channel}`);
    socket.emit('screen:register', { roomName, screenIndex: screenIdxInt });
    
    socket.on('display:rebalance', (data: { students: string[] }) => {
      console.log(`[WALL-VIEW] Received targeted students for screen ${screenIndex}:`, data.students);
      setAssignedStudents(data.students);
    });
    
    return () => {
      socket.off('display:rebalance');
    };
  }, [socket, roomName, screenIndex]);

  // MISSION 12: GLOBAL ORCHESTRATION LISTENERS
  // Allows the screen to switch rooms or return to idle while already inside a room.
  useEffect(() => {
    if (!socket || !group) return;

    const handleGlobalNavigate = ({ roomName: newRoom }: { roomName: string }) => {
      if (newRoom !== roomName) {
        console.log(`[WALL-VIEW] Global Command: Switching to ${newRoom}`);
        navigate(`/wall-view/${newRoom}?group=${group}${screenIndex ? `&screen=${screenIndex}` : ''}`);
        window.location.reload(); 
      }
    };

    const handleGlobalIdle = () => {
      console.log(`[WALL-VIEW] Global Command: Returning to standby`);
      navigate(`/display?group=${group}`);
    };

    socket.on('wall:navigate', handleGlobalNavigate);
    socket.on('wall:idle', handleGlobalIdle);

    return () => {
      socket.off('wall:navigate', handleGlobalNavigate);
      socket.off('wall:idle', handleGlobalIdle);
    };
  }, [socket, group, roomName, navigate, screenIndex]);

  // MISSION 12: AUTO-DISCOVERY HANDSHAKE
  const [autoIndex, setAutoIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!socket || !roomName || screenIndex !== null) return;
    
    // MISSION 12: ORCHESTRATION - Session-based Hardware ID
    // We use sessionStorage to allow testing multiple screens in the same browser.
    // In a real environment (different PCs), each will naturally have its own session.
    let hardwareId = sessionStorage.getItem('wall_hardware_id');
    if (!hardwareId) {
      hardwareId = `wall_${Math.random().toString(36).substring(2, 10)}`;
      sessionStorage.setItem('wall_hardware_id', hardwareId);
    }


    console.log(`[WALL-VIEW] Requesting auto-assignment for room: ${roomName} (HW: ${hardwareId})`);
    socket.emit('screen:auto_register', { roomName, hardwareId });
    
    socket.on('display:rebalance', (data: { students: string[], screenIndex: number }) => {
      console.log(`[WALL-VIEW] Auto-assigned to screen ${data.screenIndex}`);
      setAutoIndex(data.screenIndex);
      setAssignedStudents(data.students);
    });

    return () => {
      socket.off('display:rebalance');
    };
  }, [socket, roomName, screenIndex]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // ── LOADING ────────────────────────────────────────────────────────────
  if (status === 'loading') {
    return (
      <div style={s.full}>
        <div style={s.center}>
          <div style={s.spinner} />
          <p style={s.label}>Connecting to lecture...</p>
          <p style={s.sub}>{roomName}</p>
        </div>
        <style>{spinCss}</style>
      </div>
    );
  }

  // ── ENDED ──────────────────────────────────────────────────────────────
  if (status === 'ended') {
    return (
      <div style={s.full}>
        <div style={s.center}>
          <Monitor size={72} color="#334155" />
          <p style={s.sub}>Returning to standby...</p>
        </div>
      </div>
    );
  }

  // ── ERROR ──────────────────────────────────────────────────────────────
  if (status === 'error') {
    return (
      <div style={s.full}>
        <div style={s.center}>
          <WifiOff size={56} color="#ef4444" />
          <p style={{ color: '#ef4444', margin: 0 }}>{errorMsg}</p>
        </div>
      </div>
    );
  }

  // ── CONNECTED — show video grid ────────────────────────────────────────
  const teacher = teacherParticipant || participants.find(p => p.identity.includes('teacher')) || null;
  
  // Filter: 1. Not teacher, 2. Not another wall display, 3. Follow assignment if active
  const activeIndex = screenIndex !== null ? parseInt(screenIndex) : autoIndex;

  // MISSION 12: ORCHESTRATION - Filter students based on server-side assignment
  const students = participants.filter(p => {
    const isTeacher = p === teacher || p.identity.includes('teacher');
    const isWall = p.identity.startsWith('wall_') || p.identity === 'wall';
    const isAssigned = assignedStudents.length > 0 ? assignedStudents.includes(p.identity) : false;
    return !isTeacher && !isWall && isAssigned;
  });

  // MISSION 12: ADAPTIVE GRID CALCULATOR
  const getGridConfig = () => {
    const count = students.length;
    if (count === 0) return { columns: '1fr', rows: '1fr' };
    if (count === 1) return { columns: '1fr', rows: '1fr' };
    if (count === 2) return { columns: 'repeat(2, 1fr)', rows: '1fr' };
    if (count <= 4) return { columns: 'repeat(2, 1fr)', rows: 'repeat(2, 1fr)' };
    if (count <= 6) return { columns: 'repeat(3, 1fr)', rows: 'repeat(2, 1fr)' };
    if (count <= 9) return { columns: 'repeat(3, 1fr)', rows: 'repeat(3, 1fr)' };
    return { columns: 'repeat(4, 1fr)', rows: 'auto' };
  };

  const { columns, rows } = getGridConfig();

  return (
    <div style={s.room}>
      {/* HUD: Floating Minimal Metadata Overlay */}
      <div style={s.hudOverlay}>
        <div style={s.hudItem}>
          <div style={s.liveDot} />
          <span style={s.hudText}>room-{roomName}</span>
        </div>
        <div style={s.hudDivider} />
        <div style={s.hudItem}>
          <Users size={14} color="#94a3b8" />
          <span style={s.hudText}>{students.length} STUDENTS</span>
        </div>

        <div style={s.hudDivider} />
        <div style={s.hudItem}>
          <span style={{...s.hudText, color: '#38bdf8'}}>SCREEN {activeIndex}</span>
        </div>
      </div>

      <div style={s.bgGlow} />

      <div style={s.mainContainer}>

        <div style={{
          ...s.studentGridMain,
          gridTemplateColumns: columns,
          gridTemplateRows: rows
        }}>

          {students.map(p => {
            // MISSION 12 FIX: Display real name from metadata or name field
            let displayName = p.name || p.identity.split('_')[0];
            try {
               if (p.metadata) {
                 const meta = JSON.parse(p.metadata);
                 if (meta.name) displayName = meta.name;
               }
            } catch(e) {}

            return (
              <div key={p.identity} style={s.studentCardLarge}>
                {Array.from(p.trackPublications.values())
                  .filter(pub => pub.track && pub.kind === Track.Kind.Video && pub.isSubscribed)
                  .slice(0, 1)
                  .map(pub => (
                    <VideoTrack
                      key={pub.trackSid}
                      track={pub.track}
                      participant={p}
                      room={roomRef.current!}
                      mode="grid"
                    />
                  ))}
                <div style={s.studentNameOverlay}>{displayName.toUpperCase()}</div>
              </div>
            );
          })}

          {students.length === 0 && (
            <div style={s.waitingCard}>
              <Loader2 size={48} className="animate-spin" color="rgba(99,102,241,0.4)" />
              <p>Awaiting Student Feeds...</p>
            </div>
          )}
        </div>
      </div>

      {/* Floating Fullscreen Toggle */}
      <button onClick={toggleFullscreen} style={s.fullscreenBtn}>
        {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
      </button>

      <style>{`
        @keyframes wall-spin { to { transform: rotate(360deg); } }
        @keyframes pulse-live { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(1.2); } }
        .animate-spin { animation: wall-spin 1.5s linear infinite; }
      `}</style>
    </div>
  );
};

// ── Styles ──────────────────────────────────────────────────────────────
const s: Record<string, React.CSSProperties> = {
  full: {
    width: '100vw', height: '100vh',
    background: '#020617',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: "'Inter', sans-serif",
  },
  center: {
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', gap: 16, textAlign: 'center',
  },
  label: { color: '#64748b', fontSize: 16, margin: 0 },
  sub: { color: '#334155', fontSize: 12, margin: 0, fontFamily: 'monospace' },
  spinner: {
    width: 48, height: 48, borderRadius: '50%',
    border: '3px solid rgba(99,102,241,0.15)',
    borderTopColor: '#6366f1',
    animation: 'wall-spin 0.9s linear infinite',
  },
  room: {
    width: '100vw', height: '100vh', 
    background: '#000', color: '#fff',
    overflow: 'hidden', position: 'relative',
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  hudOverlay: {
    position: 'absolute', top: 20, left: 20,
    display: 'flex', alignItems: 'center', gap: 15,
    background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(10px)',
    padding: '6px 15px', borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.1)',
    zIndex: 100, pointerEvents: 'none',
  },
  hudItem: { display: 'flex', alignItems: 'center', gap: 8 },
  hudText: { fontSize: 11, fontWeight: 800, letterSpacing: '0.05em', color: '#cbd5e1' },
  hudDivider: { width: 1, height: 12, background: 'rgba(255,255,255,0.2)' },
  liveDot: {
    width: 6, height: 6, borderRadius: '50%', background: '#ef4444',
    boxShadow: '0 0 8px #ef4444',
    animation: 'pulse-live 2s infinite',
  },
  bgGlow: {
    position: 'absolute', top: '-10%', left: '-10%', width: '120%', height: '120%',
    background: 'radial-gradient(circle at 50% 50%, rgba(99,102,241,0.08) 0%, transparent 50%)',
    zIndex: 0, pointerEvents: 'none',
  },
  mainContainer: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    display: 'flex', flexDirection: 'column',
  },
  studentGridMain: {
    flex: 1, display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(30%, 1fr))',
    gridAutoRows: '1fr',
    gap: 0,
  },
  studentCardLarge: {
    position: 'relative', overflow: 'hidden',
    background: '#000',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  studentNameOverlay: {
    position: 'absolute', bottom: 10, left: 10,
    background: 'rgba(0,0,0,0.5)', color: '#fff',
    padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 700,
    zIndex: 10, pointerEvents: 'none',
  },
  screenIndexBadge: {
    color: '#38bdf8', fontSize: 13, fontWeight: 900, letterSpacing: '0.1em',
  },
  teacherThumb: {
    position: 'absolute', bottom: 30, right: 30,
    width: 280, aspectRatio: '16/10', borderRadius: 16, overflow: 'hidden',
    border: '2px solid rgba(99,102,241,0.5)',
    boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
    zIndex: 100,
  },
  teacherThumbLabel: {
    position: 'absolute', top: 10, right: 10,
    background: 'rgba(99,102,241,0.8)', padding: '2px 8px', borderRadius: 4,
    color: '#fff', fontSize: 9, fontWeight: 900,
  },
  waitingCard: {
    gridColumn: '1 / -1',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20,
    color: '#475569', fontSize: 18, fontWeight: 600, padding: 100,
  },
  fullscreenBtn: {
    position: 'fixed', bottom: 30, right: 30,
    width: 50, height: 50, borderRadius: '50%',
    background: 'rgba(99,102,241,0.2)', backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', zIndex: 1000, transition: 'all 0.2s',
  },
};

const spinCss = `
  @keyframes wall-spin { to { transform: rotate(360deg); } }
`;
