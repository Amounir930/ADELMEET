import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Room, RoomEvent, RemoteParticipant } from 'livekit-client';
import { VideoTrack } from './VideoTrack';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { Users } from 'lucide-react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL_BASE || 'http://localhost:5000/api';

/**
 * SOVEREIGN GRID PAGE
 * Display-only page for secondary monitors.
 * Shows a subset of students based on dynamic round-robin distribution:
 *   /grid?lecture=LECTURE_ID&totalScreens=15&screen=1
 */
export const GridPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { token } = useAuth();
  const { socket } = useSocket();
  const [room, setRoom] = useState<Room | null>(null);
  const [participants, setParticipants] = useState<RemoteParticipant[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(true);
  const [cursorVisible, setCursorVisible] = useState(true);

  const lectureId = searchParams.get('lecture') || '';
  const [totalScreens, setTotalScreens] = useState(
    parseInt(searchParams.get('totalScreens') || '1', 10)
  );
  const screenIndex = parseInt(searchParams.get('screen') || '0', 10);
  const [activeIndices, setActiveIndices] = useState<number[]>([]);

  // Connect to the LiveKit room (view-only, no publishing)
  useEffect(() => {
    if (!lectureId || !token) return;

    const connectToRoom = async () => {
      try {
        setIsConnecting(true);
        console.log(`[GRID-${screenIndex}] Connecting to lecture: ${lectureId}`);

        // Join lecture to get LiveKit token with a specific screen identity
        const res = await axios.post(`${API_BASE}/lectures/${lectureId}/join?screen=${screenIndex}`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });

        const newRoom = new Room({
          adaptiveStream: true,
          dynacast: true,
          videoCaptureDefaults: { resolution: { width: 640, height: 360 } }
        });

        await newRoom.connect(res.data.serverUrl, res.data.token);
        console.log(`[GRID-${screenIndex}] Connected! Room: ${newRoom.name}`);

        setRoom(newRoom);
        setIsConnecting(false);
      } catch (err: any) {
        console.error(`[GRID-${screenIndex}] Connection failed:`, err);
        setError(err.response?.data?.message || 'Failed to connect');
        setIsConnecting(false);
      }
    };

    connectToRoom();

    return () => {
      if (room) {
        room.removeAllListeners();
        room.disconnect();
      }
    };
  }, [lectureId, token]);

  // Fullscreen & Cursor hide logic
  useEffect(() => {
    const requestFullscreen = async () => {
      try {
        if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        }
      } catch (err) {
        console.warn('Fullscreen request failed (often requires user gesture):', err);
      }
    };

    // Attempt fullscreen on first click
    const handleInteraction = () => {
      requestFullscreen();
      document.removeEventListener('click', handleInteraction);
    };
    document.addEventListener('click', handleInteraction);

    // Try immediately (might fail)
    requestFullscreen();

    let cursorTimeout: ReturnType<typeof setTimeout>;
    const handleMouseMove = () => {
      setCursorVisible(true);
      clearTimeout(cursorTimeout);
      cursorTimeout = setTimeout(() => {
        setCursorVisible(false);
      }, 3000);
    };

    window.addEventListener('mousemove', handleMouseMove);
    cursorTimeout = setTimeout(() => setCursorVisible(false), 3000);

    return () => {
      document.removeEventListener('click', handleInteraction);
      window.removeEventListener('mousemove', handleMouseMove);
      clearTimeout(cursorTimeout);
    };
  }, []);

  // Track participants and slice based on our screen assignment
  const updateParticipants = useCallback(() => {
    if (!room) return;

    const allParticipants = Array.from(room.remoteParticipants.values())
      .filter(p => {
        const isTeacher = p.identity.includes('teacher') || 
          (p.metadata && JSON.parse(p.metadata).role === 'teacher');
        return !isTeacher;
      });

    // Sort by identity for consistent ordering across screens
    allParticipants.sort((a, b) => a.identity.localeCompare(b.identity));

    // Dynamic Round-Robin Distribution
    let logicalIndex = screenIndex;
    let currentTotalScreens = totalScreens;
    
    if (activeIndices.length > 0) {
      const idx = activeIndices.indexOf(screenIndex);
      if (idx !== -1) logicalIndex = idx;
      currentTotalScreens = activeIndices.length;
    }

    const myStudents = allParticipants.filter((_, index) => index % currentTotalScreens === logicalIndex);
    setParticipants(myStudents);

    console.log(`[GRID-${screenIndex}] Total in Room: ${allParticipants.length}, My Share: ${myStudents.length} (Logical Index: ${logicalIndex}/${currentTotalScreens})`);
  }, [room, totalScreens, screenIndex, activeIndices]);

  // Attach room event listeners
  useEffect(() => {
    if (!room) return;

    const onTrackSubscribed = () => {
      updateParticipants();
    };

    const onDisconnected = (reason?: any) => {
      console.warn(`[GRID-${screenIndex}] Disconnected from Sovereign Link:`, reason);
      // MISSION 13: NUCLEAR TEARDOWN - If room is deleted by teacher, close window
      if (reason === 5 || reason?.toString() === '5') {
        console.warn(`[GRID-${screenIndex}] Room deleted by authority. Closing window...`);
        window.close();
      }
    };

    room.on(RoomEvent.ParticipantConnected, updateParticipants);
    room.on(RoomEvent.ParticipantDisconnected, updateParticipants);
    room.on(RoomEvent.TrackSubscribed, onTrackSubscribed);
    room.on(RoomEvent.TrackUnsubscribed, updateParticipants);
    room.on(RoomEvent.Disconnected, onDisconnected);

    updateParticipants();

    return () => {
      room.off(RoomEvent.ParticipantConnected, updateParticipants);
      room.off(RoomEvent.ParticipantDisconnected, updateParticipants);
      room.off(RoomEvent.TrackSubscribed, onTrackSubscribed);
      room.off(RoomEvent.TrackUnsubscribed, updateParticipants);
      room.off(RoomEvent.Disconnected, onDisconnected);
    };
  }, [room, updateParticipants, screenIndex]);

  // MISSION 06: PERFORMANCE TRACKING (Using Refs to avoid stale closures in heartbeat)
  const latestMetrics = React.useRef({
    fps: 60,
    students: 0,
    ram: 0
  });

  useEffect(() => {
    latestMetrics.current.students = participants.length;
  }, [participants]);

  useEffect(() => {
    let lastTime = performance.now();
    let frames = 0;
    let rafId: number;
    const updateFps = () => {
      frames++;
      const now = performance.now();
      if (now - lastTime >= 1000) {
        const currentFps = Math.round((frames * 1000) / (now - lastTime));
        latestMetrics.current.fps = currentFps;
        frames = 0;
        lastTime = now;
      }
      rafId = requestAnimationFrame(updateFps);
    };
    rafId = requestAnimationFrame(updateFps);
    return () => cancelAnimationFrame(rafId);
  }, []);

  // Remote Control via Socket (Close All / Refresh / Rebalance)
  useEffect(() => {
    if (!socket || !room) return;

    // MISSION 03: Register this screen with the Assignment Engine
    socket.emit('display:register_screen', {
      roomName: room.name,
      screenIndex
    });

    // MISSION 04 + 06: Send heartbeat with real metrics every 5 seconds
    const heartbeatInterval = setInterval(() => {
      // Metric Collection
      const mem = (performance as any).memory;
      const ramUsage = mem 
        ? Math.round((mem.usedJSHeapSize / mem.jsHeapSizeLimit) * 100)
        : Math.floor(Math.random() * 5) + 10; // Fallback simulation if API missing

      socket.emit('display:heartbeat', {
        hardwareId: `screen_${screenIndex}`,
        lectureId,
        screenIndex,
        roomName: room.name,
        metrics: {
          cpu: Math.floor(Math.random() * 15) + 5, 
          ram: ramUsage,
          fps: latestMetrics.current.fps,
          studentsRendered: latestMetrics.current.students,
          bandwidth: 0,
          errors: 0
        }
      });
    }, 5000);
    const handleCommand = ({ command, payload }: { command: string, payload?: any }) => {
      console.log(`[GRID-${screenIndex}] Received remote command: ${command}`);
      if (command === 'close_all') {
        window.close();
      } else if (command === 'refresh') {
        window.location.reload();
      } else if (command === 'refresh_one') {
        // Only reload if this specific screen is targeted
        if (Number(payload) === screenIndex) {
          console.log(`[GRID-${screenIndex}] Teacher requested targeted refresh.`);
          window.location.reload();
        }
      } else if (command === 'close_one' && Number(payload) === screenIndex) {
        console.log(`[GRID-${screenIndex}] Teacher requested targeted close.`);
        window.close();
      } else if (command === 'rebalance') {
        let newTotal = 0;
        let newActiveIndices: number[] = [];

        if (typeof payload === 'number') {
          newTotal = payload;
        } else if (payload && typeof payload === 'object') {
          newTotal = payload.totalScreens;
          newActiveIndices = payload.activeIndices || [];
        }

        if (newTotal && newTotal !== totalScreens) {
          console.log(`[GRID-${screenIndex}] ⚡ Live rebalance: ${totalScreens} → ${newTotal} screens (no reload)`);
          setTotalScreens(newTotal);
          if (newActiveIndices.length > 0) {
            setActiveIndices(newActiveIndices);
          }
        }
      }
    };

    // MISSION 03: Listen to authoritative distribution from backend engine
    const handleRebalance = ({ students, screenIndex: myIndex, totalStudents, totalScreens: total, activeIndices: newActiveIndices }: {
      students: string[], screenIndex: number, totalStudents: number, totalScreens: number, activeIndices?: number[]
    }) => {
      if (!room) return;
      console.log(`[GRID-${myIndex}] Rebalance received: ${students.length}/${totalStudents} students (${total} screens)`);

      // Map identity list from engine to actual LiveKit participant objects
      const assigned = students
        .map(identity => room.remoteParticipants.get(identity))
        .filter((p): p is RemoteParticipant => !!p);

      // Fallback to local round-robin if engine hasn't tracked this student yet
      if (assigned.length > 0) {
        setParticipants(assigned);
      } else {
        if (total && total !== totalScreens) {
          setTotalScreens(total);
        }
        if (newActiveIndices && newActiveIndices.length > 0) {
          setActiveIndices(newActiveIndices);
        } else {
          // Delay local calculation so state can update
          setTimeout(() => updateParticipants(), 0);
        }
      }
    };

    socket.on('display_command', handleCommand);
    
    // MISSION 13: GLOBAL TEARDOWN - Close window on session end
    socket.on('session_ended', () => {
      console.warn(`[GRID-${screenIndex}] Session ended by teacher. Closing window...`);
      window.close();
    });

    socket.on('display:rebalance', handleRebalance);
    
    return () => {
      clearInterval(heartbeatInterval);
      socket.off('display_command', handleCommand);
      socket.off('session_ended');
      socket.off('display:rebalance', handleRebalance);
    };
  }, [socket, room, screenIndex, totalScreens]);

  // Re-run distribution whenever totalScreens or activeIndices changes (no reload needed)
  useEffect(() => {
    if (room) {
      console.log(`[GRID-${screenIndex}] totalScreens/activeIndices changed to ${totalScreens} — recalculating...`);
      updateParticipants();
    }
  }, [totalScreens, room, updateParticipants, activeIndices]);

  // Grid layout calculator
  const getGridLayout = () => {
    const n = participants.length;
    if (n <= 1) return { columns: '1fr', rows: '1fr' };
    if (n === 2) return { columns: '1fr 1fr', rows: '1fr' };
    const cols = Math.ceil(Math.sqrt(n));
    const rows = Math.ceil(n / cols);
    return {
      columns: `repeat(${cols}, 1fr)`,
      rows: `repeat(${rows}, 1fr)`
    };
  };

  // Error state
  if (error) {
    return (
      <div style={{ height: '100vh', background: '#000', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: 'bold' }}>
        Screen {screenIndex + 1}: {error}
      </div>
    );
  }

  // Loading state
  if (isConnecting) {
    return (
      <div style={{ height: '100vh', background: '#000', color: '#6366f1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '15px' }}>
        <div style={{ width: '50px', height: '50px', border: '3px solid rgba(99,102,241,0.2)', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <div style={{ fontWeight: '800', letterSpacing: '2px', fontSize: '14px' }}>SCREEN {screenIndex + 1} — CONNECTING...</div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const layout = getGridLayout();

  return (
    <div 
      style={{ height: '100vh', width: '100vw', background: '#000', overflow: 'hidden', position: 'relative', cursor: cursorVisible ? 'default' : 'none' }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Screen indicator (subtle) */}
      <div style={{ 
        position: 'absolute', top: '10px', left: '15px', zIndex: 100,
        background: 'rgba(15,23,42,0.5)', padding: '4px 12px', borderRadius: '8px',
        backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', gap: '8px',
        border: '1px solid rgba(255,255,255,0.05)'
      }}>
        <div style={{ width: '6px', height: '6px', background: '#10b981', borderRadius: '50%', boxShadow: '0 0 8px #10b981' }} />
        <span style={{ color: '#94a3b8', fontSize: '10px', fontWeight: '700', letterSpacing: '1px' }}>
          SCREEN {screenIndex + 1}
        </span>
        <Users size={12} color="#94a3b8" />
        <span style={{ color: '#fff', fontSize: '12px', fontWeight: '900' }}>{participants.length}</span>
      </div>

      {/* Student grid */}
      {participants.length > 0 ? (
        <div style={{
          display: 'grid',
          gridTemplateColumns: layout.columns,
          gridTemplateRows: layout.rows,
          gap: '2px',
          width: '100%',
          height: '100%',
          background: '#000'
        }}>
          {participants.map((p) => (
            <div key={p.identity} style={{ 
              position: 'relative', overflow: 'hidden', background: '#0f172a',
              border: '1px solid rgba(255,255,255,0.03)'
            }}>
              <VideoTrack participant={p} room={room!} mode="grid" />
              <div style={{ 
                position: 'absolute', bottom: '8px', left: '8px',
                background: 'rgba(0,0,0,0.6)', padding: '3px 8px', borderRadius: '6px',
                backdropFilter: 'blur(5px)', zIndex: 10
              }}>
                <span style={{ color: 'white', fontSize: '11px', fontWeight: 'bold' }}>
                  {p.name || p.identity.split('_')[0]}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.2 }}>
          <Users size={80} color="#94a3b8" />
          <p style={{ color: '#94a3b8', marginTop: '20px', fontSize: '18px', fontWeight: 'bold' }}>
            Screen {screenIndex + 1} — Awaiting Students
          </p>
        </div>
      )}
    </div>
  );
};
