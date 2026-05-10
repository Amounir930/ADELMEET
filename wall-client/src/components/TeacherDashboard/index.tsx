import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Room, RoomEvent, RemoteParticipant, ParticipantEvent } from 'livekit-client';
import { useLocalRecorder } from '../../hooks/useLocalRecorder';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';

// Import Refactored Parts
import { DashboardHUD } from './parts/DashboardHUD';
import { DashboardGrid } from './parts/DashboardGrid';
import { DashboardControls } from './parts/DashboardControls';
import { DashboardSidebar } from './parts/DashboardSidebar';
import { DashboardScreens } from './parts/DashboardScreens';
import { DashboardChat } from './parts/DashboardChat';
import { Users, LayoutGrid, MessageSquare, ChevronLeft, ChevronRight } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL_BASE || 'http://localhost:5000/api';

interface TeacherDashboardProps {
  room: Room;
  onDisconnect: () => void;
  lecture: any;
}

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({ room, onDisconnect, lecture }) => {
  const [searchParams] = useSearchParams();
  const initialScreens = parseInt(searchParams.get('screens') || '1', 10);
  const [targetScreens, setTargetScreens] = useState(initialScreens);

  const { token } = useAuth();
  const { socket } = useSocket();
  const [isAddingScreen, setIsAddingScreen] = useState(false);
  const [classParticipants, setClassParticipants] = useState<RemoteParticipant[]>([]);
  const [allTimeParticipants, setAllTimeParticipants] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 32; 
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  const [isCameraEnabled, setIsCameraEnabled] = useState(true);
  const [isEnding, setIsEnding] = useState(false);
  const [isRecordingAllowed, setIsRecordingAllowed] = useState(false);
  const { isRecording, isPaused, duration, startRecording, stopRecording, pauseRecording, resumeRecording } = useLocalRecorder(room);
  const [searchQuery, setSearchQuery] = useState('');

  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'participants' | 'screens' | 'chat'>('participants');
  const [raisedHands, setRaisedHands] = useState<Set<string>>(new Set());
  const controlsTimeoutRef = useRef<any | null>(null);
  const [localVideoTrack, setLocalVideoTrack] = useState<any>(null);
  const [roomState, setRoomState] = useState<any>({ isChatEnabled: true });
  const [totalUnread, setTotalUnread] = useState(0);
  const [isHUDOpen, setIsHUDOpen] = useState(false);
  const hudTimeoutRef = useRef<any | null>(null);

  const triggerHUD = () => {
    setIsHUDOpen(true);
    if (hudTimeoutRef.current) clearTimeout(hudTimeoutRef.current);
    hudTimeoutRef.current = setTimeout(() => setIsHUDOpen(false), 5000);
  };

  const [hasHandAlert, setHasHandAlert] = useState(false);
  const [hasScreenAlert, setHasScreenAlert] = useState(false);
  const [studentUnreadCounts, setStudentUnreadCounts] = useState<Record<string, number>>({});

  const wakeUp = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 5000); // 5 seconds per request
  }, []);

  // DRAG & RESIZE STATE
  const [sidebarPos, setSidebarPos] = useState({ x: 105, y: 50 }); // y is %
  const [sidebarSize, setSidebarSize] = useState({ width: 380, height: 85 }); // height is vh
  const [dockPos, setDockPos] = useState({ x: 50, y: 90 }); // x, y are %
  const [dockScale, setDockScale] = useState(1);
  const [islandPos, setIslandPos] = useState({ x: 25, y: 50 }); // x is px, y is %
  const [islandScale, setIslandScale] = useState(1);
  const [sidebarScale, setSidebarScale] = useState(1);

  const [isDraggingSidebar, setIsDraggingSidebar] = useState(false);
  const [isDraggingDock, setIsDraggingDock] = useState(false);
  const [isDraggingIsland, setIsDraggingIsland] = useState(false);

  const filteredParticipants = classParticipants.filter(p => 
    p.identity.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (p.name && p.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width < 800) {
        setIslandScale(0.65);
        setDockScale(0.75);
        setSidebarScale(0.75);
        setSidebarSize(prev => ({ ...prev, width: 300, height: 70 }));
        setIslandPos(prev => ({ ...prev, x: 15 }));
      } else if (width < 1200) {
        setIslandScale(0.85);
        setDockScale(0.9);
        setSidebarScale(0.9);
        setSidebarSize(prev => ({ ...prev, width: 340, height: 80 }));
        setIslandPos(prev => ({ ...prev, x: 20 }));
      } else {
        setIslandScale(1);
        setDockScale(1);
        setSidebarScale(1);
        setSidebarSize(prev => ({ ...prev, width: 380, height: 85 }));
        setIslandPos(prev => ({ ...prev, x: 25 }));
      }
    };

    const handleActivity = () => {
      setShowControls(true);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 5000);
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // Initial call
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('touchstart', handleActivity);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    const handleBeforeUnload = () => {
      socket?.emit('teacher:display_command', { roomName: room.name, command: 'close_all' });
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [socket, room.name]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const updateParticipants = useCallback(() => {
    if (!room) return;
    const participants = Array.from(room.remoteParticipants.values()).filter(p => {
      const isTeacher = p.identity.includes('teacher') || (p.metadata && JSON.parse(p.metadata).role === 'teacher');
      return !isTeacher;
    });
    setClassParticipants(participants);
    setAllTimeParticipants(prev => {
      const next = [...prev];
      participants.forEach(p => {
        if (!next.find(item => item.identity === p.identity)) {
          next.push({ identity: p.identity, name: p.name });
        }
      });
      return next;
    });
  }, [room]);

  useEffect(() => {
    if (!room || !socket) return;
    if (socket?.connected && room.localParticipant) {
      socket.emit('teacher:join_room', { roomName: room.name, identity: room.localParticipant.identity, role: 'teacher' });
      socket.emit('join_room', { roomName: room.name, identity: room.localParticipant.identity, role: 'teacher' });
    }

    let updateTimeout: any;
    const handleUpdate = () => {
      clearTimeout(updateTimeout);
      updateTimeout = setTimeout(() => updateParticipants(), 100);
    };

    const attachToParticipant = (p: RemoteParticipant) => {
      p.on('isMutedChanged' as any, handleUpdate);
      p.on(ParticipantEvent.TrackPublished, handleUpdate);
      p.on(ParticipantEvent.TrackUnpublished, handleUpdate);
    };

    room.remoteParticipants.forEach(attachToParticipant);
    room.on(RoomEvent.ParticipantConnected, (p) => { attachToParticipant(p); handleUpdate(); });
    room.on(RoomEvent.ParticipantDisconnected, (p) => { 
      setHasScreenAlert(true);
      wakeUp();
      setClassParticipants(prev => prev.filter(item => item.identity !== p.identity)); 
    });
    room.on(RoomEvent.TrackSubscribed, handleUpdate);
    room.on(RoomEvent.TrackUnsubscribed, handleUpdate);
    room.on(RoomEvent.TrackMuted, handleUpdate);
    room.on(RoomEvent.TrackUnmuted, handleUpdate);

    socket.on('participant:raise_hand', ({ identity, raised }: { identity: string, raised: boolean }) => {
      setRaisedHands(prev => {
        const next = new Set(prev);
        if (raised) {
          next.add(identity);
          setHasHandAlert(true);
          wakeUp();
        } else {
          next.delete(identity);
        }
        return next;
      });
    });

    const handlePrivate = (msg: any) => {
      if (msg.role !== 'teacher' && (msg.targetIdentity === room.localParticipant.identity || msg.isPrivate)) {
        setStudentUnreadCounts(prev => ({
          ...prev,
          [msg.sender]: (prev[msg.sender] || 0) + 1
        }));
        setTotalUnread(prev => prev + 1);
        wakeUp();
      }
    };
    socket.on('chat:receive_private', handlePrivate);

    const handleMessage = (msg: any) => {
      if (msg.role !== 'teacher') {
        wakeUp();
      }
    };
    socket.on('chat:receive_message', handleMessage);

    socket.on('sync_room_state', (state: any) => {
      if (state.isRecordingAllowed !== undefined) setIsRecordingAllowed(state.isRecordingAllowed === true || state.isRecordingAllowed === 'true');
      if (state.isChatEnabled !== undefined) setRoomState((prev: any) => ({ ...prev, isChatEnabled: state.isChatEnabled }));
    });

    const handleLocalTrack = (pub: any) => {
      if (pub.source === 'camera') {
        const track = pub.videoTrack || pub.track;
        if (track) setLocalVideoTrack(track);
      }
    };

    room.localParticipant.on(ParticipantEvent.TrackPublished, handleLocalTrack);
    room.localParticipant.videoTrackPublications.forEach(handleLocalTrack);
    
    const startMedia = async () => {
      try {
        await new Promise(r => setTimeout(r, 800));
        await room.localParticipant.setMicrophoneEnabled(true);
        await room.localParticipant.setCameraEnabled(true);
        setIsMicEnabled(true);
        setIsCameraEnabled(true);
        room.localParticipant.videoTrackPublications.forEach(handleLocalTrack);
      } catch (e) { console.error('Media Activation Failed', e); }
    };
    startMedia();

    return () => {
      socket.off('participant:raise_hand');
      socket.off('chat:receive_message', handleMessage);
      socket.off('chat:receive_private', handlePrivate);
      socket.off('sync_room_state');
      room.off(RoomEvent.ParticipantConnected, handleUpdate);
      room.off(RoomEvent.ParticipantDisconnected, handleUpdate);
      room.off(RoomEvent.TrackSubscribed, handleUpdate);
      room.off(RoomEvent.TrackUnsubscribed, handleUpdate);
      room.off(RoomEvent.TrackMuted, handleUpdate);
      room.off(RoomEvent.TrackUnmuted, handleUpdate);
      room.localParticipant.off(ParticipantEvent.TrackPublished, handleLocalTrack);
      clearTimeout(updateTimeout);
    };
  }, [room, socket, updateParticipants, wakeUp]);

  const handleKick = async (studentIdentity: string) => {
    if (!window.confirm(`Are you sure you want to PERMANENTLY ban ${studentIdentity}?`)) return;
    const studentId = studentIdentity.split('_')[0];
    try {
      await axios.delete(`${API_BASE}/lectures/${lecture._id}/kick/${studentId}`, { headers: { Authorization: `Bearer ${token}` } });
    } catch (err) { console.error('Kick failed', err); }
  };

  const handleGrantAudio = async (participantId: string) => {
    try {
      await axios.post(`${API_BASE}/lectures/${lecture._id}/grant-audio`, { participantId }, { headers: { Authorization: `Bearer ${token}` } });
    } catch (err) { console.error('Grant audio failed', err); }
  };

  const handleMuteStudent = (participantId: string) => {
    socket?.emit('teacher:force_mute', { 
      roomName: room.name, 
      targetIdentity: participantId 
    });
  };

  const handleLockStudentCamera = (participantId: string) => {
    socket?.emit('teacher:force_camera_off', { 
      roomName: room.name, 
      targetIdentity: participantId 
    });
  };

  const handleLowerHand = (studentIdentity: string) => {
    socket?.emit('teacher:lower_hand', { roomName: room.name, targetIdentity: studentIdentity });
    setRaisedHands(prev => {
      const next = new Set(prev);
      next.delete(studentIdentity);
      return next;
    });
  };

  const handleToggleClassMute = () => socket?.emit('teacher:mute_all', { roomName: room.name });
  const handleToggleClassCamera = () => socket?.emit('teacher:lock_cameras', { roomName: room.name });
  
  const handleToggleRecordingPermission = () => {
    const nextAllowed = !isRecordingAllowed;
    setIsRecordingAllowed(nextAllowed);
    socket?.emit('teacher:toggle_recording_permission', { roomName: room.name, allowed: nextAllowed });
  };

  const handleToggleRoomChat = () => {
    const nextEnabled = !roomState.isChatEnabled;
    setRoomState((prev: any) => ({ ...prev, isChatEnabled: nextEnabled }));
    socket?.emit('teacher:toggle_chat', { roomName: room.name, enabled: nextEnabled });
  };

  const handleDockDrag = (e: React.MouseEvent) => {
    if (!isDraggingDock) return;
    const xPct = (e.clientX / window.innerWidth) * 100;
    const yPct = (e.clientY / window.innerHeight) * 100;
    setDockPos({ x: xPct, y: yPct });
  };

  const handleSidebarDrag = (e: React.MouseEvent) => {
    if (!isDraggingSidebar) return;
    setSidebarPos({ 
      x: e.clientX, 
      y: (e.clientY / window.innerHeight) * 100 
    });
  };

  const handleIslandDrag = (e: React.MouseEvent) => {
    if (!isDraggingIsland) return;
    setIslandPos({
      x: e.clientX,
      y: (e.clientY / window.innerHeight) * 100
    });
  };

  const handleGlobalMouseUp = () => {
    setIsDraggingSidebar(false);
    setIsDraggingDock(false);
    setIsDraggingIsland(false);
  };

  const handleEndSession = async () => {
    if (!window.confirm('Are you sure?')) return;
    setIsEnding(true);
    try {
      await axios.patch(`${API_BASE}/lectures/${lecture._id}/status`, { status: 'completed' }, { headers: { Authorization: `Bearer ${token}` } });
      socket?.emit('teacher:display_command', { roomName: room.name, command: 'close_all' });
      socket?.emit('end_session', { roomName: room.name });
      onDisconnect();
    } catch (err) { onDisconnect(); }
  };

  return (
    <div 
      onMouseMove={(e) => { handleDockDrag(e); handleSidebarDrag(e); handleIslandDrag(e); }}
      onMouseUp={handleGlobalMouseUp}
      style={{ 
        height: '100%', width: '100vw', background: '#020617', 
        overflow: 'hidden', fontFamily: "'Outfit', sans-serif", position: 'relative'
      }}
    >
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(99, 102, 241, 0.5);
          border-radius: 10px;
          border: 2px solid rgba(15, 23, 42, 0.85);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(99, 102, 241, 0.8);
        }
        @keyframes pulse-purple {
          0% { box-shadow: 0 0 0 0 rgba(168, 85, 247, 0.4); }
          70% { box-shadow: 0 0 0 15px rgba(168, 85, 247, 0); }
          100% { box-shadow: 0 0 0 0 rgba(168, 85, 247, 0); }
        }
        .pulse-chat {
          animation: pulse-purple 2s infinite;
        }
      `}</style>
      {/* BASE LAYER: FULL SCREEN VIDEO GRID & HUD */}
      <div style={{ 
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1,
        display: 'flex', flexDirection: 'column'
      }}>
        <DashboardHUD 
          connected={!!socket?.connected} 
          participantCount={classParticipants.length} 
          roomName={room.name}
          showControls={showControls || isHUDOpen}
        />
        {/* HUD TRIGGER SLOT */}
        {!showControls && !isHUDOpen && (
          <div 
            onClick={triggerHUD}
            style={{ 
              position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
              width: '100px', height: '10px', background: 'rgba(255,255,255,0.05)',
              borderRadius: '0 0 10px 10px', cursor: 'pointer', zIndex: 1001,
              transition: 'all 0.3s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.height = '15px'}
            onMouseLeave={(e) => e.currentTarget.style.height = '10px'}
          />
        )}
        <DashboardGrid 
          participants={filteredParticipants}
          room={room}
          currentPage={currentPage}
          pageSize={PAGE_SIZE}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* OVERLAY LAYER: FLOATING COMMAND DOCK (BOTTOM) */}
      <div 
        style={{
          position: 'absolute',
          left: `${dockPos.x}%`,
          top: `${dockPos.y}%`,
          transform: `translate(-50%, -50%) scale(${dockScale})`,
          zIndex: 10001,
          transition: isDraggingDock ? 'none' : 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <DashboardControls 
          room={room}
          showControls={showControls}
          isFullscreen={isFullscreen}
          isMicEnabled={isMicEnabled}
          isCameraEnabled={isCameraEnabled}
          isRecording={isRecording}
          isPaused={isPaused}
          duration={duration}
          localVideoTrack={localVideoTrack}
          onToggleMic={() => { room.localParticipant.setMicrophoneEnabled(!isMicEnabled); setIsMicEnabled(!isMicEnabled); }}
          onToggleCamera={() => { room.localParticipant.setCameraEnabled(!isCameraEnabled); setIsCameraEnabled(!isCameraEnabled); }}
          onToggleFullscreen={toggleFullscreen}
          onStartRecording={startRecording}
          onStopRecording={stopRecording}
          onPauseRecording={pauseRecording}
          onResumeRecording={resumeRecording}
          onEndSession={handleEndSession}
          formatDuration={formatDuration}
          onStartDrag={() => setIsDraggingDock(true)}
          onScaleChange={setDockScale}
          currentScale={dockScale}
        />
      </div>

      {/* OVERLAY LAYER: FLOATING SIDEBAR ISLANDS (LEFT) */}
      <div style={{ 
        position: 'absolute', 
        left: `${islandPos.x}px`, 
        top: `${islandPos.y}%`, 
        transform: `translate(-50%, -50%) scale(${islandScale})`,
        zIndex: 10000, 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '15px',
        background: 'rgba(15, 23, 42, 0.4)', 
        backdropFilter: 'blur(25px)',
        padding: '15px', 
        borderRadius: '30px', 
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
        transition: isDraggingIsland ? 'none' : 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.5s ease',
        opacity: showControls ? 1 : 0,
        pointerEvents: showControls ? 'all' : 'none'
      }}>
        {/* DRAG HANDLE FOR ISLAND */}
        <div 
          onMouseDown={() => setIsDraggingIsland(true)}
          style={{ width: '100%', height: '15px', cursor: 'grab', display: 'flex', gap: '3px', justifyContent: 'center', opacity: 0.3 }}>
          {[...Array(3)].map((_, i) => <div key={i} style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#fff' }} />)}
        </div>

        {/* SCALE BUTTONS FOR ISLAND */}
        <div style={{ display: 'flex', gap: '5px', justifyContent: 'center' }}>
          <button onClick={() => setIslandScale(s => Math.min(1.5, s + 0.1))} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '4px', color: '#fff', fontSize: '10px', cursor: 'pointer', padding: '2px 6px' }}>+</button>
          <button onClick={() => setIslandScale(s => Math.max(0.6, s - 0.1))} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '4px', color: '#fff', fontSize: '10px', cursor: 'pointer', padding: '2px 6px' }}>-</button>
        </div>

        <button 
          onClick={() => { 
            setActiveTab('participants'); 
            setIsSidebarOpen(activeTab !== 'participants' || !isSidebarOpen); 
            if (activeTab !== 'participants' || !isSidebarOpen) setHasHandAlert(false);
          }}
          className={hasHandAlert ? 'pulse-alert-teacher' : ''}
          style={{ 
            width: '50px', height: '50px', borderRadius: '20px', 
            background: activeTab === 'participants' && isSidebarOpen ? 'rgba(99, 102, 241, 0.2)' : (hasHandAlert ? 'rgba(239, 68, 68, 0.15)' : 'transparent'), 
            color: activeTab === 'participants' && isSidebarOpen ? '#6366f1' : (hasHandAlert ? '#ef4444' : 'rgba(255,255,255,0.5)'), 
            border: hasHandAlert ? '1px solid #ef4444' : 'none',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
          title="Participants"
        >
          <Users size={24} />
        </button>

        <button 
          onClick={() => { 
            setActiveTab('screens'); 
            setIsSidebarOpen(activeTab !== 'screens' || !isSidebarOpen); 
            if (activeTab !== 'screens' || !isSidebarOpen) setHasScreenAlert(false);
          }}
          className={hasScreenAlert ? 'pulse-alert-teacher' : ''}
          style={{ 
            width: '50px', height: '50px', borderRadius: '20px', 
            background: activeTab === 'screens' && isSidebarOpen ? 'rgba(34, 197, 94, 0.2)' : (hasScreenAlert ? 'rgba(239, 68, 68, 0.15)' : 'transparent'), 
            color: activeTab === 'screens' && isSidebarOpen ? '#22c55e' : (hasScreenAlert ? '#ef4444' : 'rgba(255,255,255,0.5)'), 
            border: hasScreenAlert ? '1px solid #ef4444' : 'none',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
          title="Screens"
        >
          <LayoutGrid size={24} />
        </button>

        <button 
          onClick={() => { 
            setActiveTab('chat'); 
            setIsSidebarOpen(activeTab !== 'chat' || !isSidebarOpen);
            if (activeTab === 'chat' && !isSidebarOpen) setTotalUnread(0);
          }}
          className={totalUnread > 0 ? 'pulse-alert-teacher' : ''}
          style={{ 
            width: '50px', height: '50px', borderRadius: '20px', 
            background: activeTab === 'chat' && isSidebarOpen ? 'rgba(168, 85, 247, 0.2)' : (totalUnread > 0 ? 'rgba(239, 68, 68, 0.15)' : 'transparent'), 
            color: activeTab === 'chat' && isSidebarOpen ? '#a855f7' : (totalUnread > 0 ? '#ef4444' : 'rgba(255,255,255,0.5)'), 
            border: totalUnread > 0 ? '1px solid #ef4444' : 'none', 
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            position: 'relative'
          }}
          title="Chat Hub"
        >
          <MessageSquare size={24} />
          {totalUnread > 0 && (
            <div style={{
              position: 'absolute', top: '-5px', right: '-5px',
              background: '#ef4444', color: '#fff', fontSize: '10px', fontWeight: 'bold',
              minWidth: '18px', height: '18px', borderRadius: '9px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '2px solid #020617', boxShadow: '0 0 10px rgba(239, 68, 68, 0.5)'
            }}>
              {totalUnread}
            </div>
          )}
        </button>
      </div>

      {/* OVERLAY LAYER: FLOATING GLASS PANELS (CONTENT) */}
      <div 
        style={{ 
          position: 'absolute', 
          left: `${sidebarPos.x}px`, 
          top: `${sidebarPos.y}%`, 
          transform: `translateY(-50%) translateX(${isSidebarOpen ? '0' : '-120%'}) scale(${sidebarScale})`,
          width: `${sidebarSize.width}px`, 
          height: `${sidebarSize.height}vh`, 
          zIndex: 9999, 
          transition: isDraggingSidebar ? 'none' : 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.5s ease',
          opacity: (showControls && isSidebarOpen) ? 1 : 0, 
          transformOrigin: 'left center',
          pointerEvents: (showControls && isSidebarOpen) ? 'all' : 'none',
        }}
      >
        <div style={{ 
          width: '100%', height: '100%', background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(40px)',
          borderRadius: '35px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 40px 100px rgba(0,0,0,0.6)',
          overflow: 'hidden', display: 'grid', gridTemplateRows: '40px 1fr', position: 'relative'
        }}>
          {/* INTERNAL DRAG HANDLE & SCALE CONTROLS (HEADER) */}
          <div style={{ 
            width: '100%', height: '40px', background: 'rgba(255,255,255,0.03)', 
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px',
            cursor: 'default', borderBottom: '1px solid rgba(255,255,255,0.05)'
          }}>
            <div 
              onMouseDown={() => setIsDraggingSidebar(true)}
              style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'center', cursor: 'grab' }}
            >
              <div style={{ display: 'flex', gap: '3px' }}>
                {[...Array(3)].map((_, i) => <div key={i} style={{ width: '3px', height: '3px', borderRadius: '50%', background: 'rgba(255,255,255,0.3)' }} />)}
              </div>
              <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', fontWeight: '800', marginLeft: '10px', letterSpacing: '1px' }}>DRAG TO MOVE</span>
            </div>
            
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                onClick={() => setSidebarSize(prev => ({ ...prev, height: Math.min(95, prev.height + 5) }))}
                style={{ background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '4px', color: '#fff', fontSize: '12px', cursor: 'pointer', width: '24px', height: '24px' }}
              >+</button>
              <button 
                onClick={() => setSidebarSize(prev => ({ ...prev, height: Math.max(40, prev.height - 5) }))}
                style={{ background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '4px', color: '#fff', fontSize: '12px', cursor: 'pointer', width: '24px', height: '24px' }}
              >-</button>
            </div>
          </div>
          {/* Resize Handle for Sidebar */}
          <div 
            onMouseDown={(e) => {
              e.stopPropagation();
              const startX = e.clientX;
              const startW = sidebarSize.width;
              const onMove = (moveEvent: MouseEvent) => {
                setSidebarSize(prev => ({ ...prev, width: Math.max(300, startW + (moveEvent.clientX - startX)) }));
              };
              const onUp = () => {
                window.removeEventListener('mousemove', onMove);
                window.removeEventListener('mouseup', onUp);
              };
              window.addEventListener('mousemove', onMove);
              window.addEventListener('mouseup', onUp);
            }}
            style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '10px', cursor: 'ew-resize', zIndex: 100 }} 
          />

          <div style={{ minHeight: 0, height: '100%', width: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {activeTab === 'participants' ? (
              <DashboardSidebar 
                room={room} socket={socket} isSidebarOpen={true}
                participantCount={classParticipants.length} isRecordingAllowed={isRecordingAllowed}
                searchQuery={searchQuery} allTimeParticipants={allTimeParticipants}
                raisedHands={raisedHands} onToggleSidebar={() => setIsSidebarOpen(false)}
                onToggleMuteAll={handleToggleClassMute} onToggleLockAll={handleToggleClassCamera}
                onToggleRecordingPermission={handleToggleRecordingPermission} onSearchChange={setSearchQuery}
                onMuteStudent={handleMuteStudent} onLockCamera={handleLockStudentCamera}
                onToggleRoomChat={handleToggleRoomChat} isChatEnabled={roomState.isChatEnabled}
                onGrantAudio={handleGrantAudio} onKick={handleKick} onLowerHand={handleLowerHand}
                studentUnreadCounts={studentUnreadCounts}
                hasHandAlert={hasHandAlert}
                hasScreenAlert={hasScreenAlert}
              />
            ) : activeTab === 'screens' ? (
              <DashboardScreens 
                socket={socket} roomName={room.name} isSidebarOpen={true}
                onToggleSidebar={() => setIsSidebarOpen(false)} targetScreens={targetScreens}
                setTargetScreens={setTargetScreens} setIsAddingScreen={setIsAddingScreen}
                isAddingScreen={isAddingScreen} lecture={lecture}
              />
            ) : (
              <DashboardChat 
                socket={socket} room={room} isSidebarOpen={true}
                participants={classParticipants} isChatEnabled={roomState.isChatEnabled}
                onUnreadUpdate={setTotalUnread}
                onStudentUnreadUpdate={(identity, count) => {
                  setStudentUnreadCounts(prev => ({ ...prev, [identity]: count }));
                }}
              />
            )}
          </div>
        </div>
      </div>
      <style>{`
        .pulse-alert-teacher {
          animation: pulse-alert-teacher 1.5s infinite;
        }
        @keyframes pulse-alert-teacher {
          0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
          50% { transform: scale(1.1); box-shadow: 0 0 20px 10px rgba(239, 68, 68, 0); }
          100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
      `}</style>
    </div>
  );
};
