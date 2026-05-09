import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Room, VideoPresets } from 'livekit-client';
import { io, Socket } from 'socket.io-client';

/**
 * MISSION 12: SOVEREIGN SUPERVISION CONTEXT
 * Optimized for Teacher/Administrator role.
 * Focus: High-Bitrate Publishing, Control Sync, Low-Latency UDP.
 */
interface TeacherLiveKitContextType {
  room: Room | null;
  connect: (url: string, token: string) => Promise<void>;
  disconnect: () => void;
  isConnecting: boolean;
  error: string | null;
  dbStatus: { connected: boolean; status: string };
  socket: Socket | null;
}

const TeacherLiveKitContext = createContext<TeacherLiveKitContextType | undefined>(undefined);

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
    
    console.log('[MISSION-12] Teacher Sovereignty: Sync Link to', socketUrl);
    const s = io(socketUrl, { 
      transports: ['websocket'],
      reconnectionAttempts: 5
    }); 
    setSocket(s);

    s.on('connect', () => console.log('[MISSION-12] Teacher Sovereignty: Socket Connected'));
    
    return () => {
      s.removeAllListeners();
      s.disconnect();
    };
  }, []);

  // MEMORY HYGIENE: DB Status Polling
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
    const interval = setInterval(checkStatus, 60000); // Reduce frequency for scale
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
          videoEncoding: VideoPresets.h720.encoding,
          dtx: true,
        },
        reconnectPolicy: {
          nextRetryDelayInMs: () => 1000 
        }
      });

      r.on('disconnected', (reason) => {
        if (reason === 5 || reason?.toString() === '5') {
          console.log('[SOVEREIGN] Session ended normally by teacher.');
          setError(null);
          return;
        }
        console.error('[SOVEREIGN-RECOVERY] Disconnected from Sovereign Link:', reason);
        setError(`Connection lost: ${reason}. Attempting to recover...`);
      });

      r.on('reconnecting', () => {
        console.warn('[SOVEREIGN-RECOVERY] Signal weak. Re-establishing link...');
      });

      r.on('reconnected', () => {
        console.log('[SOVEREIGN-RECOVERY] Sovereignty Restored. Connection stable.');
        setError(null);
      });

      // MISSION 12: SCALE OPTIMIZATION
      await r.connect(url, token, {
        autoSubscribe: true,
      });
      
      setRoom(r);
      
      if (socket && r.localParticipant) {
        // SOVEREIGN MISSION 13: Use the prefixed event for administrative entry
        socket.emit('teacher:join_room', { 
          roomName: r.name, 
          identity: r.localParticipant.identity,
          role: 'teacher'
        });
      }

      console.log('[MISSION-12] Sovereign Teacher Connected');
    } catch (err: any) {
      setError(err.message || 'Failed to connect to room');
      throw err;
    } finally {
      setIsConnecting(false);
    }
  }, [socket]);

  const disconnect = useCallback(async () => {
    if (room) {
      console.warn('[SOVEREIGN-SECURITY] Sovereign Protection: Nuclear Teardown Initiated');
      
      // 1. SYNC HARDWARE STOP (Critical for BF Cache)
      if (room.localParticipant) {
        console.log('[SOVEREIGN-SECURITY] Stopping all local tracks...');
        
        // Stop all publications
        room.localParticipant.trackPublications.forEach(p => {
          if (p.track) {
            console.log(`[SOVEREIGN-SECURITY] Stopping track: ${p.track.kind}`);
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
        console.error('[SOVEREIGN-SECURITY] Teardown Error:', err);
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
        console.warn('[SOVEREIGN-SECURITY] BF-Cache detected. Purging session...');
        window.location.reload();
      }
    };

    const handleVisibilityChange = () => {
      // Temporarily disabled so teacher can switch tabs during testing
      /*
      if (document.visibilityState === 'hidden' && room) {
        console.warn('[SOVEREIGN-SECURITY] Tab backgrounded. Auto-disconnecting for privacy...');
        disconnect();
      }
      */
    };

    // Events to kill camera/mic immediately
    window.addEventListener('beforeunload', cleanup);
    window.addEventListener('pagehide', cleanup);
    window.addEventListener('unload', cleanup);
    window.addEventListener('popstate', cleanup); 
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
    <TeacherLiveKitContext.Provider value={{ room, connect, disconnect, isConnecting, error, dbStatus, socket }}>
      {children}
    </TeacherLiveKitContext.Provider>
  );
};

export const useLiveKit = () => {
  const context = useContext(TeacherLiveKitContext);
  if (!context) {
    throw new Error('useLiveKit must be used within a LiveKitProvider');
  }
  return context;
};

