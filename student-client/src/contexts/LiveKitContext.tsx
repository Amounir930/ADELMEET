import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
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
}

const StudentLiveKitContext = createContext<StudentLiveKitContextType | undefined>(undefined);

export const LiveKitProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [room, setRoom] = useState<Room | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dbStatus, setDbStatus] = useState<{ connected: boolean; status: string }>({ connected: true, status: 'connected' });
  const [socket, setSocket] = useState<Socket | null>(null);

  // MISSION 12: SCALE MANDATE - SOCKET ISOLATION
  useEffect(() => {
    const apiBase = import.meta.env.VITE_API_URL_BASE || 'http://localhost:5000/api';
    const socketUrl = apiBase.replace(/\/api$/, '');
    const s = io(socketUrl, { 
      transports: ['websocket'],
      secure: true,
      rejectUnauthorized: false
    }); 
    setSocket(s);

    s.on('connect', () => console.log('[MISSION-12] Student Cinema: Socket Connected'));

    // MISSION 13: GLOBAL TEARDOWN - Redirect on session end
    s.on('session_ended', () => {
      console.warn('[MISSION-13] Session ended by teacher. Force redirecting...');
      window.location.href = '/';
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
        dynacast: true, 
        videoCaptureDefaults: {
          resolution: VideoPresets.h720.resolution, // Capture high, allow server to scale down
        },
        publishDefaults: {
          simulcast: false,
          videoCodec: 'vp8',
          videoEncoding: VideoPresets.h360.encoding,
          dtx: true,
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
      await r.connect(url, token, {
        autoSubscribe: true,
        rtcConfig: {
          iceTransportPolicy: 'relay',
        }
      });
      
      setRoom(r);
      
      if (socket && r.localParticipant) {
        socket.emit('join_room', { 
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
  }, [socket]);

  const disconnect = useCallback(async () => {
    if (room) {
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
    <StudentLiveKitContext.Provider value={{ room, connect, disconnect, isConnecting, error, dbStatus, socket }}>
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

