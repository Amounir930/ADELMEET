import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Room, RoomEvent, RemoteParticipant, Track, ParticipantEvent, VideoQuality } from 'livekit-client';
import { VideoTrack } from './VideoTrack';
import { ParticipantGrid } from './ParticipantGrid';
import { Users, Mic, MicOff, Video, VideoOff, PhoneOff, Maximize, Minimize, Gauge, RefreshCw, XSquare, PlusSquare } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { ScreenStatusPanel } from './ScreenStatusPanel';

const API_BASE = import.meta.env.VITE_API_URL_BASE || 'http://localhost:5000/api';

interface TeacherDashboardProps {
  room: Room;
  onDisconnect: () => void;
  lecture: any;
}

/**
 * MISSION 12: SOVEREIGN TEACHER CONTROLLER
 * Strictly separated from student logic.
 * Handles: Grid Orchestration, Global Moderation, Class Sync.
 */
export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({ room, onDisconnect, lecture }) => {
  const [searchParams] = useSearchParams();
  const initialScreens = parseInt(searchParams.get('screens') || '1', 10);
  const [targetScreens, setTargetScreens] = useState(initialScreens);

  const { token } = useAuth();
  const { socket } = useSocket();
  const [isAddingScreen, setIsAddingScreen] = useState(false);
  const [classParticipants, setClassParticipants] = useState<RemoteParticipant[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 32; // SOVEREIGN LIMIT: Balanced for browser stability
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  const [isCameraEnabled, setIsCameraEnabled] = useState(true);
  const [isEnding, setIsEnding] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentQuality, setCurrentQuality] = useState<VideoQuality>(VideoQuality.HIGH);
  const [qualityMessage, setQualityMessage] = useState<string | null>(null);
  const controlsTimeoutRef = useRef<any | null>(null);
  const [localVideoTrack, setLocalVideoTrack] = useState<any>(null);

  // AUTO-HIDE LOGIC (MISSION 13)
  useEffect(() => {
    const handleActivity = () => {
      setShowControls(true);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 3000);
    };

    window.addEventListener('mousemove', handleActivity);
    handleActivity();
    return () => {
      window.removeEventListener('mousemove', handleActivity);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const handleQualityChange = (quality: VideoQuality) => {
    if (!room) {
      console.error('[TEACHER-QUALITY] Room not initialized!');
      return;
    }
    
    const qualityLabel = quality === 0 ? 'LOW (360p)' : (quality === 1 ? 'MEDIUM (720p)' : 'HIGH (1080p)');
    console.warn(`[TEACHER-QUALITY] EXECUTION: Setting all students to ${qualityLabel}`);
    
    setCurrentQuality(quality);
    
    // Apply to current participants
    let count = 0;
    room.remoteParticipants.forEach(p => {
      p.videoTrackPublications.forEach(pub => {
        if (pub.kind === Track.Kind.Video) {
          pub.setVideoQuality(quality);
          count++;
        }
      });
    });
    console.log(`[TEACHER-QUALITY] SUCCESS: Quality enforced on ${count} active video tracks.`);
    
    // SOVEREIGN NOTIFICATION: Proof of work
    setQualityMessage(`QUALITY ENFORCED: ${qualityLabel}`);
    setTimeout(() => setQualityMessage(null), 3000);
  };

  // MISSION 13: STICKY QUALITY ENFORCEMENT
  useEffect(() => {
    if (!room) return;
    
    const onTrackSubscribed = (track: any, pub: any, participant: RemoteParticipant) => {
      if (track.kind === Track.Kind.Video) {
        console.log(`[TEACHER-QUALITY] New Track Detected from ${participant.identity}. Enforcing: ${currentQuality}`);
        pub.setVideoQuality(currentQuality);
      }
    };

    room.on(RoomEvent.TrackSubscribed, onTrackSubscribed);
    return () => {
      room.off(RoomEvent.TrackSubscribed, onTrackSubscribed);
    };
  }, [room, currentQuality]);

  const updateParticipants = useCallback(() => {
    if (!room) return;
    // SOVEREIGN ISOLATION: Only include remote participants (Students)
    const participants = Array.from(room.remoteParticipants.values()).filter(p => {
      const isTeacher = p.identity.includes('teacher') || (p.metadata && JSON.parse(p.metadata).role === 'teacher');
      return !isTeacher;
    });
    console.log('[TEACHER-CORE] Audited Student Participants:', participants.length);
    setClassParticipants(participants);
  }, [room]);

  // MISSION 13: RESPONSIVE COMMAND CENTER STYLES
  const commandButtonStyle = {
    padding: '12px 24px',
    borderRadius: '16px',
    border: 'none',
    color: '#fff',
    fontSize: 'clamp(10px, 2vw, 14px)',
    fontWeight: '800',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    boxShadow: '0 8px 20px rgba(0,0,0,0.4)',
    minWidth: 'clamp(80px, 15vw, 140px)',
    justifyContent: 'center'
  };

  // UNIFIED DISCOVERY ENGINE
  useEffect(() => {
    if (!room || !socket) return;

    console.log(`[TEACHER-CORE] Sovereign Session Active: ${room.name}`);
    console.log(`[TEACHER-CORE] Current Remote Participants: ${room.remoteParticipants.size}`);

    // MISSION 12: COMMAND AUTHORITY SYNC
    if (socket?.connected && room.localParticipant) {
      socket.emit('teacher:join_room', { 
        roomName: room.name, 
        identity: room.localParticipant.identity, 
        role: 'teacher' 
      });
    }

    // CRITICAL: Join the socket room as teacher to enable moderation authority
    if (room.localParticipant) {
      socket.emit('join_room', { 
        roomName: room.name, 
        identity: room.localParticipant.identity, 
        role: 'teacher' 
      });
    }

    let updateTimeout: any;
    const handleUpdate = () => {
      clearTimeout(updateTimeout);
      updateTimeout = setTimeout(() => {
        console.log('[TEACHER-CORE] Debounced Room State Update Executed');
        updateParticipants();
      }, 100);
    };

    // MISSION 12: ATTACH LISTENERS TO BOTH EXISTING AND NEW PARTICIPANTS
    const attachToParticipant = (p: RemoteParticipant) => {
      p.on('isMutedChanged' as any, handleUpdate);
      p.on(ParticipantEvent.TrackPublished, handleUpdate);
      p.on(ParticipantEvent.TrackUnpublished, handleUpdate);
    };

    // Attach to existing
    room.remoteParticipants.forEach(attachToParticipant);

    room.on(RoomEvent.ParticipantConnected, (p) => {
      attachToParticipant(p);
      handleUpdate();
    });

    room.on(RoomEvent.ParticipantDisconnected, (p) => {
      console.log(`[TEACHER-CORE] Participant Left: ${p.identity}`);
      setClassParticipants(prev => prev.filter(item => item.identity !== p.identity));
    });
    room.on(RoomEvent.TrackSubscribed, handleUpdate);
    room.on(RoomEvent.TrackUnsubscribed, handleUpdate);
    room.on(RoomEvent.TrackMuted, handleUpdate);
    room.on(RoomEvent.TrackUnmuted, handleUpdate);

    socket.on('sync_room_state', ({ isMuted: _isMuted }: { isMuted: boolean }) => {
      // Logic for class mute sync
    });

    const handleLocalTrack = (pub: any) => {
      if (pub.source === 'camera') {
        const track = pub.videoTrack || pub.track;
        if (track) {
          console.log('[TEACHER-CORE] Local Camera Track Bound:', track.sid);
          setLocalVideoTrack(track);
        }
      }
    };

    room.localParticipant.on(ParticipantEvent.TrackPublished, handleLocalTrack);

    const startMedia = async () => {
      try {
        console.log('[TEACHER-CORE] Requesting Media Permissions...');
        await new Promise(r => setTimeout(r, 800));

        await room.localParticipant.setMicrophoneEnabled(true);
        await room.localParticipant.setCameraEnabled(true);

        setIsMicEnabled(true);
        setIsCameraEnabled(true);

        // Re-check publications after enabling
        room.localParticipant.videoTrackPublications.forEach(handleLocalTrack);

        console.log('[TEACHER-CORE] Media Published & Verified');
        handleUpdate();
      } catch (e) {
        console.error('[TEACHER-CORE] Fatal: Media Activation Failed', e);
      }
    };

    // Immediate check + Trigger publish
    room.localParticipant.videoTrackPublications.forEach(handleLocalTrack);
    startMedia();

    return () => {
      room.off(RoomEvent.ParticipantConnected, handleUpdate);
      room.off(RoomEvent.ParticipantDisconnected, handleUpdate);
      socket.off('sync_room_state');
    };
  }, [room, socket, updateParticipants]);

  const handleKick = async (studentIdentity: string) => {
    if (!window.confirm(`Are you sure you want to PERMANENTLY ban ${studentIdentity} from this session?`)) return;
    
    // Identity format: userId_student
    const studentId = studentIdentity.split('_')[0];
    if (!studentId) return;

    try {
      await axios.delete(`${API_BASE}/lectures/${lecture._id}/kick/${studentId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // The socket event 'kick_participant' is emitted by the backend service.
    } catch (err: any) {
      console.error('Failed to kick student:', err);
      alert(err.response?.data?.message || 'Failed to kick student');
    }
  };

  // MISSION 12: DYNAMIC MODERATION ENGINE
  // Instead of a simple state, we derive "isClassMuted" from the actual state of participants
  const anyStudentUnmuted = classParticipants.some(p => p.isMicrophoneEnabled);
  const classStatusLabel = anyStudentUnmuted ? 'MUTE ALL' : 'UNMUTE ALL';

  const handleToggleClassMute = () => {
    if (anyStudentUnmuted) {
      // If someone is unmuted, we want to MUTE EVERYONE
      socket?.emit('teacher:mute_all', { roomName: room.name });
    } else {
      // If everyone is already muted, we UNMUTE EVERYONE
      socket?.emit('teacher:unmute_all', { roomName: room.name });
    }
  };

  const handleEndSession = async () => {
    if (!window.confirm('Are you sure you want to end this lecture?')) return;
    setIsEnding(true);
    try {
      // SOVEREIGN FIX: Use PATCH /status as per backend routes
      await axios.patch(`${API_BASE}/lectures/${lecture._id}/status`, { status: 'completed' }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      socket?.emit('end_session', { roomName: room.name });
      onDisconnect();
    } catch (err) {
      console.error('Failed to end session', err);
      // Fallback: still try to disconnect client side if API fails
      socket?.emit('end_session', { roomName: room.name });
      onDisconnect();
    }
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* SOVEREIGN OVERLAYS (AUTO-HIDING) */}
      <div style={{ 
        position: 'absolute', 
        top: '20px', 
        left: '40px', 
        display: 'flex', 
        gap: '15px', 
        zIndex: 100, 
        pointerEvents: 'none',
        opacity: showControls ? 1 : 0,
        transition: 'opacity 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
      }}>
        <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '8px 16px', borderRadius: '12px', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: '8px', pointerEvents: 'all' }}>
          <div style={{ width: '8px', height: '8px', background: socket?.connected ? '#10b981' : '#6366f1', borderRadius: '50%', boxShadow: socket?.connected ? '0 0 10px #10b981' : '0 0 10px #6366f1' }}></div>
          <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '13px', letterSpacing: '1px' }}>{socket?.connected ? 'SYNC ACTIVE' : 'LIVE CLASS'}</span>
        </div>
        <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '8px 16px', borderRadius: '12px', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: '10px', pointerEvents: 'all' }}>
          <Users size={16} color="#94a3b8" />
          <span style={{ color: '#fff', fontSize: '18px', fontWeight: '900' }}>{classParticipants.length}</span>
        </div>
      </div>

      {/* Main Grid: Sovereign Cinema Wall */}
      <div style={{ 
        flex: 1, 
        padding: '10px', 
        overflow: 'hidden', 
        position: 'relative', 
        background: '#000',
        borderRadius: '32px',
        margin: '10px',
        border: '1px solid rgba(255,255,255,0.05)',
        boxShadow: 'inset 0 0 50px rgba(0,0,0,0.5)'
      }}>
        <div style={{ width: '100%', height: '100%', display: 'flex' }}>
          <ParticipantGrid 
            participants={classParticipants.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)} 
            room={room} 
            onKick={handleKick} 
          />
        </div>
        
        {/* PAGINATION OVERLAY */}
        {classParticipants.length > PAGE_SIZE && (
          <div style={{ 
            position: 'absolute', 
            top: '20px', 
            right: '40px', 
            display: 'flex', 
            gap: '10px', 
            alignItems: 'center', 
            background: 'rgba(15, 23, 42, 0.8)', 
            padding: '10px 20px', 
            borderRadius: '20px', 
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.1)',
            zIndex: 1000
          }}>
            <button 
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => p - 1)}
              style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', opacity: currentPage === 1 ? 0.3 : 1 }}
            >
              PREV
            </button>
            <span style={{ color: '#6366f1', fontWeight: '900', fontSize: '14px' }}>
              PAGE {currentPage} / {Math.ceil(classParticipants.length / PAGE_SIZE)}
            </span>
            <button 
              disabled={currentPage >= Math.ceil(classParticipants.length / PAGE_SIZE)}
              onClick={() => setCurrentPage(p => p + 1)}
              style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', opacity: currentPage >= Math.ceil(classParticipants.length / PAGE_SIZE) ? 0.3 : 1 }}
            >
              NEXT
            </button>
          </div>
        )}

        {classParticipants.length === 0 && (
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: 0.3 }}>
            <Users size={64} color="#94a3b8" />
            <p style={{ color: '#94a3b8', marginTop: '20px', fontSize: '18px' }}>Waiting for Class Participants...</p>
          </div>
        )}
      </div>

      {/* TEACHER COMMAND CENTER (Auto-Hiding) */}
      <div style={{ 
        position: 'fixed', 
        bottom: '30px', 
        left: '50%', 
        transform: `translateX(-50%) translateY(${showControls ? '0' : '120px'})`, 
        zIndex: 99999, 
        display: 'flex', 
        justifyContent: 'center',
        pointerEvents: 'all',
        width: 'auto',
        transition: 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.5s ease',
        opacity: showControls ? 1 : 0
      }}>
        <div style={{
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(30px)',
          padding: '12px 35px',
          borderRadius: '35px',
          border: '1px solid rgba(255,255,255,0.12)',
          display: 'flex',
          alignItems: 'center',
          gap: '35px',
          boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
          transition: 'all 0.3s ease'
        }}>

          {/* Teacher Preview (Enlarged & Professional) */}
          <div style={{
            width: '160px',
            height: '90px',
            borderRadius: '20px',
            overflow: 'hidden',
            position: 'relative',
            border: '2px solid #6366f1',
            boxShadow: '0 8px 25px rgba(99, 102, 241, 0.3)',
            background: '#000'
          }}>
            <VideoTrack participant={room.localParticipant} room={room} mode="grid" track={localVideoTrack} />
            <div style={{ position: 'absolute', top: '5px', left: '10px', fontSize: '9px', fontWeight: 'bold', color: '#6366f1', zIndex: 30, textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>TEACHER VIEW</div>
          </div>

          <div style={{ width: '1px', height: '40px', background: 'rgba(255,255,255,0.1)' }}></div>

          {/* DYNAMIC COMMAND GROUP */}
          <div style={{ display: 'flex', gap: 'clamp(8px, 1.5vw, 15px)', alignItems: 'center' }}>
            <button 
              onClick={handleToggleClassMute}
              style={{
                ...commandButtonStyle,
                background: !anyStudentUnmuted ? '#6366f1' : 'rgba(239, 68, 68, 0.2)',
                border: `1px solid ${!anyStudentUnmuted ? '#6366f1' : 'rgba(239, 68, 68, 0.3)'}`
              }}
            >
              {anyStudentUnmuted ? <MicOff size={18} /> : <Mic size={18} />}
              <span>{classStatusLabel}</span>
            </button>

            <button 
              onClick={() => {
                const newState = !isMicEnabled;
                room.localParticipant.setMicrophoneEnabled(newState);
                setIsMicEnabled(newState);
              }}
              style={{
                ...commandButtonStyle,
                background: isMicEnabled ? 'rgba(255,255,255,0.05)' : '#ef4444',
                border: '1px solid rgba(255,255,255,0.1)',
                minWidth: 'auto',
                padding: '12px'
              }}
            >
              {isMicEnabled ? <Mic size={20} /> : <MicOff size={20} />}
            </button>

            <button 
              onClick={() => {
                const newState = !isCameraEnabled;
                room.localParticipant.setCameraEnabled(newState);
                setIsCameraEnabled(newState);
              }}
              style={{
                ...commandButtonStyle,
                background: isCameraEnabled ? 'rgba(255,255,255,0.05)' : '#ef4444',
                border: '1px solid rgba(255,255,255,0.1)',
                minWidth: 'auto',
                padding: '12px'
              }}
            >
              {isCameraEnabled ? <Video size={20} /> : <VideoOff size={20} />}
            </button>

            <button 
              onClick={toggleFullscreen}
              style={{
                ...commandButtonStyle,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                minWidth: 'auto',
                padding: '12px'
              }}
            >
              {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
            </button>

            <button 
              onClick={() => {
                const nextQ = currentQuality === VideoQuality.LOW ? VideoQuality.MEDIUM : (currentQuality === VideoQuality.MEDIUM ? VideoQuality.HIGH : VideoQuality.LOW);
                handleQualityChange(nextQ);
              }}
              style={{
                ...commandButtonStyle,
                background: currentQuality === VideoQuality.HIGH ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                border: currentQuality === VideoQuality.HIGH ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.1)',
                minWidth: 'auto',
                padding: '12px',
                color: currentQuality === VideoQuality.HIGH ? '#10b981' : '#fff'
              }}
              title={`Receiver Quality: ${currentQuality === 0 ? 'LOW' : (currentQuality === 1 ? 'MED' : 'HIGH')}`}
            >
              <Gauge size={20} />
              <span style={{ fontSize: '10px' }}>{currentQuality === 0 ? '360P' : (currentQuality === 1 ? '720P' : '1080P')}</span>
            </button>

            <div style={{ width: '1px', height: '30px', background: 'rgba(255,255,255,0.1)', margin: '0 5px' }}></div>

            {/* SCREEN ORCHESTRATION CONTROLS */}
            <button 
              onClick={() => {
                if (isAddingScreen) return;
                
                // SOVEREIGN LOGIC: Check exactly what is currently open via LiveKit
                const grids = Array.from(room.remoteParticipants.values()).filter(p => p.identity.includes('_screen_'));
                
                // Find highest screen index to avoid collision
                let maxIndex = -1;
                grids.forEach(p => {
                  const match = p.identity.match(/_screen_(\d+)/);
                  if (match) {
                    const idx = parseInt(match[1], 10);
                    if (idx > maxIndex) maxIndex = idx;
                  }
                });
                const newScreenIndex = maxIndex + 1;
                
                const calculatedTotal = Math.max(targetScreens + 1, newScreenIndex + 1);
                setTargetScreens(calculatedTotal);

                // Lock the button to prevent spamming while the new screen connects
                setIsAddingScreen(true);
                setTimeout(() => setIsAddingScreen(false), 3000);

                socket?.emit('teacher:display_command', { roomName: room.name, command: 'rebalance', payload: calculatedTotal });
                const url = `/grid?lecture=${lecture._id || room.name}&totalScreens=${calculatedTotal}&screen=${newScreenIndex}`;
                window.open(url, `screen_${newScreenIndex}`, `width=800,height=600`);
              }}
              style={{
                ...commandButtonStyle,
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                color: isAddingScreen ? '#94a3b8' : '#10b981',
                minWidth: 'auto',
                padding: '12px',
                cursor: isAddingScreen ? 'not-allowed' : 'pointer',
                opacity: isAddingScreen ? 0.5 : 1
              }}
              title="Add New Screen"
            >
              <PlusSquare size={20} />
            </button>

            <button 
              onClick={() => {
                if (!window.confirm('Refresh all remote grid screens?')) return;
                socket?.emit('teacher:display_command', { roomName: room.name, command: 'refresh' });
              }}
              style={{
                ...commandButtonStyle,
                background: 'rgba(56, 189, 248, 0.1)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                color: '#38bdf8',
                minWidth: 'auto',
                padding: '12px'
              }}
              title="Refresh All Screens"
            >
              <RefreshCw size={20} />
            </button>

            <button 
              onClick={() => {
                if (!window.confirm('WARNING: This will close ALL remote grid screens. Continue?')) return;
                socket?.emit('teacher:display_command', { roomName: room.name, command: 'close_all' });
              }}
              style={{
                ...commandButtonStyle,
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#ef4444',
                minWidth: 'auto',
                padding: '12px'
              }}
              title="Close All Screens"
            >
              <XSquare size={20} />
            </button>

          </div>

          <div style={{ width: '1px', height: '40px', background: 'rgba(255,255,255,0.1)' }}></div>

          {/* MISSION 05: HEALTH MONITOR PANEL (NOW IN TOOLBAR) */}
          <div style={{ display: 'flex', height: '44px' }}>
            <ScreenStatusPanel
              roomName={room.name}
              totalScreens={targetScreens}
              onOpenScreen={(screenIndex) => {
                const url = `/grid?lecture=${lecture._id || room.name}&totalScreens=${targetScreens}&screen=${screenIndex}`;
                window.open(url, `screen_${screenIndex}`, `width=800,height=600`);
              }}
              onCloseScreen={(screenIndex) => {
                socket?.emit('teacher:display_command', {
                  roomName: room.name,
                  command: 'close_one',
                  payload: screenIndex
                });
              }}
              onRefreshScreen={(screenIndex) => {
                socket?.emit('teacher:display_command', {
                  roomName: room.name,
                  command: 'refresh_one',
                  payload: screenIndex
                });
              }}
              onRebalanceAll={() => {
                socket?.emit('teacher:display_command', { roomName: room.name, command: 'refresh' });
              }}
            />
          </div>

          <div style={{ width: '1px', height: '40px', background: 'rgba(255,255,255,0.1)' }}></div>

          <button 
            onClick={handleEndSession}
            disabled={isEnding}
            style={{
              ...commandButtonStyle,
              background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
              boxShadow: '0 8px 25px rgba(239, 68, 68, 0.4)'
            }}
          >
            <PhoneOff size={18} />
            <span>{isEnding ? 'ENDING...' : 'END'}</span>
          </button>
        </div>
      </div>
      {/* QUALITY TOAST NOTIFICATION */}
      {qualityMessage && (
        <div style={{
          position: 'fixed',
          top: '100px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(16, 185, 129, 0.9)',
          backdropFilter: 'blur(10px)',
          padding: '12px 24px',
          borderRadius: '12px',
          color: '#fff',
          fontWeight: 'bold',
          fontSize: '14px',
          zIndex: 9999,
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
          border: '1px solid rgba(255,255,255,0.2)',
          animation: 'slideDown 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        }}>
          {qualityMessage}
        </div>
      )}

      <style>{`
        @keyframes slideDown {
          from { transform: translate(-50%, -20px); opacity: 0; }
          to { transform: translate(-50%, 0); opacity: 1; }
        }
      `}</style>
    </div>
  );
};
