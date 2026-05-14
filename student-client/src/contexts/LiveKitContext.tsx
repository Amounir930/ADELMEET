import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { Room, VideoPresets } from 'livekit-client';
import { io, Socket } from 'socket.io-client';

/**
 * MISSION 12: SOVEREIGN CINEMA CONTEXT
 * Optimized for Student/Learner role.
 * Focus: High-Scale Consumption, Lean Socket logic, Low-Latency UDP.
 */
interface StudentLiveKitContextType {
  room: Room | null;
  connect: (url: string, token: string) => Promise<void>;
  disconnect: () => void;
  isConnecting: boolean;
  error: string | null;
  dbStatus: { connected: boolean; status: string };
  socket: Socket | null;
  isRecordingAllowed: boolean;
  isScreenShareAllowed: boolean;
  isChatEnabled: boolean;
  isAlreadyJoining: (lectureId: string) => boolean;
  markJoining: (lectureId: string, status: boolean) => void;
}

const StudentLiveKitContext = createContext<StudentLiveKitContextType | undefined>(undefined);

export const LiveKitProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [room, setRoom] = useState<Room | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dbStatus, setDbStatus] = useState<{ connected: boolean; status: string }>({ connected: true, status: 'connected' });
  const [socket, setSocket] = useState<Socket | null>(null);
  const socketRef = useRef<Socket | null>(null); // stable ref for use inside connect()
  const [isRecordingAllowed, setIsRecordingAllowed] = useState(false);
  const [isScreenShareAllowed, setIsScreenShareAllowed] = useState(false);
  const [isChatEnabled, setIsChatEnabled] = useState(true);

  // MISSION 12: SYNC LOCK - Preventing Duplicate Join Race Conditions
  const joiningLock = React.useRef<Record<string, boolean>>({});

  const isAlreadyJoining = (lectureId: string) => !!joiningLock.current[lectureId];
  const markJoining = (lectureId: string, status: boolean) => {
    joiningLock.current[lectureId] = status;
  };

  // MISSION 12: SCALE MANDATE - SOCKET ISOLATION
  useEffect(() => {
    const apiBase = import.meta.env.VITE_API_URL_BASE || 'http://localhost:5000/api';
    const socketUrl = apiBase.replace(/\/api$/, '');
    const s = io(socketUrl, { 
      transports: ['polling', 'websocket'],
      secure: true,
      rejectUnauthorized: false,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000
    }); 
    setSocket(s);
    socketRef.current = s;

    // MISSION 12: SCALE MANDATE - SOCKET ISOLATION
    s.on('connect', () => console.log('[MISSION-12] Student Cinema: Socket Connected'));

    s.on('sync_room_state', (state: any) => {
      console.log('[CONTEXT-SYNC] Received sync_room_state:', state);
      if (state.isRecordingAllowed !== undefined) {
        setIsRecordingAllowed(state.isRecordingAllowed === true || state.isRecordingAllowed === 'true');
      }
      if (state.isScreenShareAllowed !== undefined) {
        setIsScreenShareAllowed(state.isScreenShareAllowed === true || state.isScreenShareAllowed === 'true');
      }
    });

    s.on('recording_permission_updated', ({ allowed }: { allowed: any }) => {
      console.log('[CONTEXT-SYNC] Recording Permission Update:', allowed);
      setIsRecordingAllowed(allowed === true || allowed === 'true');
    });

    s.on('screenshare_permission_updated', ({ allowed }: { allowed: any }) => {
      console.log('[CONTEXT-SYNC] Screenshare Permission Update:', allowed);
      setIsScreenShareAllowed(allowed === true || allowed === 'true');
    });

    s.on('chat_status_updated', ({ enabled }: { enabled: any }) => {
      console.log('[CONTEXT-SYNC] Chat Status Update:', enabled);
      setIsChatEnabled(enabled === true || enabled === 'true');
    });

    s.on('room_state_pulse', (state: any) => {
      if (state.isRecordingAllowed !== undefined) {
        setIsRecordingAllowed(state.isRecordingAllowed === true || state.isRecordingAllowed === 'true');
      }
      if (state.isScreenShareAllowed !== undefined) {
        setIsScreenShareAllowed(state.isScreenShareAllowed === true || state.isScreenShareAllowed === 'true');
      }
    });


    return () => {
      s.removeAllListeners();
      s.disconnect();
    };
  }, []);

  // MEMORY HYGIENE: Reduced Polling for Scale
  useEffect(() => {
    const checkStatus = async () => {
      const apiBase = import.meta.env.VITE_API_URL_BASE || 'http://localhost:5000/api';
      try {
        const res = await fetch(`${apiBase}/db-status`);
        const data = await res.json();
        setDbStatus({ connected: data.connected, status: data.status });
      } catch (err) {
        setDbStatus({ connected: false, status: 'offline' });
      }
    };
    const interval = setInterval(checkStatus, 60000); 
    checkStatus();
    return () => clearInterval(interval);
  }, []);


  const connect = useCallback(async (url: string, token: string) => {
    setIsConnecting(true);
    setError(null);
    try {
      const r = new Room({
        adaptiveStream: true,
        dynacast: true, // MISSION 11: DYNAMIC UPLOAD CONTROL
        videoCaptureDefaults: {
          resolution: VideoPresets.h720.resolution, 
        },
        publishDefaults: {
          simulcast: true, // MISSION 11: ENABLE MULTI-LAYER PUBLISHING
          videoCodec: 'vp8',
          videoEncoding: VideoPresets.h720.encoding, // Max layer
          dtx: true,
          stopMicTrackOnMute: true,
        }
      });

      r.on('disconnected', (reason) => {
        // MISSION 13: Reason 5 is ROOM_DELETED (Normal when teacher ends session)
        if (reason === 5 || reason?.toString() === '5') {
          console.log('[STUDENT] Session ended normally by teacher.');
          setError(null);
          return;
        }
        console.error('[STUDENT-RECOVERY] Disconnected:', reason);
        setError(`Link lost: ${reason}. Reconnecting...`);
      });

      r.on('reconnected', () => {
        console.log('[STUDENT-RECOVERY] Link Restored.');
        setError(null);
      });

      // Point 3: Standard failover for speed (UDP -> TCP)
      // STUDENT PASSTHROUGH (Relay Forced)
      // MISSION 12: SCALE OPTIMIZATION - Disable autoSubscribe
      // This allows manual control of bandwidth, subscribing only to teacher and active speakers.
      await r.connect(url, token, {
        autoSubscribe: false,
      });
      
      setRoom(r);
      
      // Use socketRef (stable) so connect() doesn't change when socket state changes
      const s = socketRef.current;
      if (s && r.localParticipant) {
        s.emit('join_room', { 
          roomName: r.name, 
          identity: r.localParticipant.identity,
          role: 'student'
        });
      }

      console.log('[MISSION-12] Sovereign Student Cinema Established');
    } catch (err: any) {
      setError(err.message || 'Failed to connect to room');
      throw err;
    } finally {
      setIsConnecting(false);
    }
  }, []); // ← Stable: no deps, uses ref internally

  const isDisconnectingRef = useRef(false);

  const disconnect = useCallback(async () => {
    if (room && !isDisconnectingRef.current) {
      isDisconnectingRef.current = true;
      console.warn('[STUDENT-SECURITY] Sovereign Protection: Nuclear Teardown Initiated');
      
      // 1. SYNC HARDWARE STOP (Critical for BF Cache)
      if (room.localParticipant) {
        console.log('[STUDENT-SECURITY] Stopping all local tracks...');
        
        // Stop all publications
        room.localParticipant.trackPublications.forEach(p => {
          if (p.track) {
            console.log(`[STUDENT-SECURITY] Stopping track: ${p.track.kind}`);
            try { p.track.stop(); } catch (e) {}
            if ((p.track as any).mediaStreamTrack) {
              try { (p.track as any).mediaStreamTrack.stop(); } catch (e) {}
            }
          }
        });

        // Stop all video tracks specifically
        room.localParticipant.videoTrackPublications.forEach(p => {
          try { p.videoTrack?.stop(); } catch (e) {}
        });

        // Stop all audio tracks specifically
        room.localParticipant.audioTrackPublications.forEach(p => {
          try { p.audioTrack?.stop(); } catch (e) {}
        });
      }

      try {
        // 2. ASYNC CLEANUP
        if (room.localParticipant) {
          await room.localParticipant.setCameraEnabled(false).catch(e => console.error('Error disabling camera', e));
          await room.localParticipant.setMicrophoneEnabled(false).catch(e => console.error('Error disabling mic', e));
          await room.localParticipant.setScreenShareEnabled(false).catch(e => console.error('Error disabling screen share', e));
        }
        room.removeAllListeners();
        await room.disconnect();
      } catch (err) {
        console.error('[STUDENT-SECURITY] Teardown Error:', err);
      } finally {
        setRoom(null);
        setIsConnecting(false);
        setError(null);
        isDisconnectingRef.current = false;
      }
    }
  }, [room]);

  // MISSION 22: FULL PROTECTION LAYER
  useEffect(() => {
    const cleanup = () => {
      disconnect();
    };

    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        console.warn('[STUDENT-SECURITY] BF-Cache detected. Purging session...');
        window.location.reload();
      }
    };

    const handleVisibilityChange = () => {
      // Temporarily disabled so we can test with multiple tabs
      /*
      if (document.visibilityState === 'hidden' && room) {
        console.warn('[STUDENT-SECURITY] Tab backgrounded. Auto-disconnecting for privacy...');
        disconnect();
      }
      */
    };

    // Events to kill camera/mic immediately
    window.addEventListener('beforeunload', cleanup);
    window.addEventListener('pagehide', cleanup);
    window.addEventListener('unload', cleanup);
    window.addEventListener('popstate', cleanup); // Handle back button explicitly
    window.addEventListener('pageshow', handlePageShow);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', cleanup);
      window.removeEventListener('pagehide', cleanup);
      window.removeEventListener('unload', cleanup);
      window.removeEventListener('popstate', cleanup);
      window.removeEventListener('pageshow', handlePageShow);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [disconnect, room]);

  return (
    <StudentLiveKitContext.Provider value={{ room, connect, disconnect, isConnecting, error, dbStatus, socket, isRecordingAllowed, isScreenShareAllowed, isChatEnabled, isAlreadyJoining, markJoining }}>
      {children}
    </StudentLiveKitContext.Provider>
  );
};

export const useLiveKit = () => {
  const context = useContext(StudentLiveKitContext);
  if (!context) {
    throw new Error('useLiveKit must be used within a LiveKitProvider');
  }
  return context;
};

