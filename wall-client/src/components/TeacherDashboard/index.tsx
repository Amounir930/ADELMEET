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
import { Users, LayoutGrid, ChevronLeft, ChevronRight } from 'lucide-react';

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
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<'participants' | 'screens'>('participants');
  const [raisedHands, setRaisedHands] = useState<Set<string>>(new Set());
  const controlsTimeoutRef = useRef<any | null>(null);
  const [localVideoTrack, setLocalVideoTrack] = useState<any>(null);

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
    room.on(RoomEvent.ParticipantDisconnected, (p) => { setClassParticipants(prev => prev.filter(item => item.identity !== p.identity)); });
    room.on(RoomEvent.TrackSubscribed, handleUpdate);
    room.on(RoomEvent.TrackUnsubscribed, handleUpdate);
    room.on(RoomEvent.TrackMuted, handleUpdate);
    room.on(RoomEvent.TrackUnmuted, handleUpdate);

    socket.on('participant:raise_hand', ({ identity, raised }: { identity: string, raised: boolean }) => {
      setRaisedHands(prev => {
        const next = new Set(prev);
        if (raised) next.add(identity); else next.delete(identity);
        return next;
      });
    });

    socket.on('sync_room_state', (state: any) => {
      if (state.isRecordingAllowed !== undefined) setIsRecordingAllowed(state.isRecordingAllowed === true || state.isRecordingAllowed === 'true');
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
      room.off(RoomEvent.ParticipantConnected, handleUpdate);
      room.off(RoomEvent.ParticipantDisconnected, handleUpdate);
      socket.off('sync_room_state');
    };
  }, [room, socket, updateParticipants]);

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
    <div style={{ 
      height: '100vh', width: '100vw', display: 'grid', 
      gridTemplateColumns: isSidebarOpen ? '1fr 450px' : '1fr 60px',
      background: '#020617', overflow: 'hidden', fontFamily: "'Outfit', sans-serif",
      transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
    }}>
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        
        <DashboardHUD 
          connected={!!socket?.connected} 
          participantCount={classParticipants.length} 
          showControls={showControls} 
        />

        <DashboardGrid 
          room={room}
          participants={filteredParticipants}
          currentPage={currentPage}
          pageSize={PAGE_SIZE}
          onKick={handleKick}
          onPageChange={setCurrentPage}
        />

        <DashboardControls 
          room={room}
          showControls={showControls}
          isFullscreen={isFullscreen}
          isMicEnabled={isMicEnabled}
          isCameraEnabled={isCameraEnabled}
          isRecording={isRecording}
          isPaused={isPaused}
          duration={duration}
          isAddingScreen={isAddingScreen}
          isEnding={isEnding}
          targetScreens={targetScreens}
          localVideoTrack={localVideoTrack}
          lecture={lecture}
          socket={socket}
          onToggleMic={() => { room.localParticipant.setMicrophoneEnabled(!isMicEnabled); setIsMicEnabled(!isMicEnabled); }}
          onToggleCamera={() => { room.localParticipant.setCameraEnabled(!isCameraEnabled); setIsCameraEnabled(!isCameraEnabled); }}
          onToggleFullscreen={toggleFullscreen}
          onStartRecording={startRecording}
          onStopRecording={stopRecording}
          onPauseRecording={pauseRecording}
          onResumeRecording={resumeRecording}
          onAddScreen={() => {}} 
          onRefreshScreens={() => socket?.emit('teacher:display_command', { roomName: room.name, command: 'refresh' })}
          onCloseAllScreens={() => socket?.emit('teacher:display_command', { roomName: room.name, command: 'close_all' })}
          onEndSession={handleEndSession}
          formatDuration={formatDuration}
          setTargetScreens={setTargetScreens}
          setIsAddingScreen={setIsAddingScreen}
        />
      </div>

      {/* DYNAMIC SIDEBAR HUB */}
      <div style={{ 
        display: 'flex', 
        background: 'rgba(15, 23, 42, 0.98)', 
        borderLeft: '1px solid rgba(255,255,255,0.1)', 
        overflow: 'hidden'
      }}>
        {/* VERTICAL TAB SWITCHER */}
        <div style={{ 
          width: '60px', 
          background: 'rgba(15, 23, 42, 0.5)', 
          borderRight: isSidebarOpen ? '1px solid rgba(255,255,255,0.05)' : 'none',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '20px 0',
          gap: '20px',
          flexShrink: 0
        }}>
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            {isSidebarOpen ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </button>
          
          <div style={{ width: '30px', height: '1px', background: 'rgba(255,255,255,0.1)' }} />

          <button 
            onClick={() => { setActiveTab('participants'); setIsSidebarOpen(true); }}
            style={{ 
              width: '40px', height: '40px', borderRadius: '12px', 
              background: activeTab === 'participants' ? 'rgba(99, 102, 241, 0.2)' : 'transparent', 
              color: activeTab === 'participants' ? '#6366f1' : 'rgba(255,255,255,0.4)', 
              border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.3s ease'
            }}
            title="Students List"
          >
            <Users size={20} />
          </button>

          <button 
            onClick={() => { setActiveTab('screens'); setIsSidebarOpen(true); }}
            style={{ 
              width: '40px', height: '40px', borderRadius: '12px', 
              background: activeTab === 'screens' ? 'rgba(34, 197, 94, 0.2)' : 'transparent', 
              color: activeTab === 'screens' ? '#22c55e' : 'rgba(255,255,255,0.4)', 
              border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.3s ease'
            }}
            title="Screens Management"
          >
            <LayoutGrid size={20} />
          </button>
        </div>

        {/* TAB CONTENT CONTAINER */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {activeTab === 'participants' ? (
            <DashboardSidebar 
              room={room}
              socket={socket}
              isSidebarOpen={isSidebarOpen}
              participantCount={classParticipants.length}
              isRecordingAllowed={isRecordingAllowed}
              searchQuery={searchQuery}
              allTimeParticipants={allTimeParticipants}
              raisedHands={raisedHands}
              onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
              onToggleMuteAll={handleToggleClassMute}
              onToggleLockAll={handleToggleClassCamera}
              onToggleRecordingPermission={handleToggleRecordingPermission}
              onSearchChange={setSearchQuery}
              onMuteStudent={handleMuteStudent}
              onLockCamera={handleLockStudentCamera}
              onGrantAudio={handleGrantAudio}
              onKick={handleKick}
              onLowerHand={handleLowerHand}
            />
          ) : (
            <DashboardScreens 
              socket={socket}
              roomName={room.name}
              isSidebarOpen={isSidebarOpen}
              onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
              targetScreens={targetScreens}
              setTargetScreens={setTargetScreens}
              setIsAddingScreen={setIsAddingScreen}
              isAddingScreen={isAddingScreen}
              lecture={lecture}
            />
          )}
        </div>
      </div>
    </div>
  );
};
