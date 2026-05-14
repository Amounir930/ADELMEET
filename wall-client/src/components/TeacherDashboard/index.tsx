import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Room, RoomEvent, RemoteParticipant, ParticipantEvent, VideoQuality, Track, ConnectionQuality } from 'livekit-client';
import { useLocalRecorder } from '../../hooks/useLocalRecorder';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import { VideoTrack } from '../VideoTrack';

// Import Refactored Parts
import { DashboardHUD } from './parts/DashboardHUD';
import { DashboardGrid } from './parts/DashboardGrid';
import { DashboardControls } from './parts/DashboardControls';
import { DashboardSidebar } from './parts/DashboardSidebar';
import { DashboardScreens } from './parts/DashboardScreens';
import { DashboardChat } from './parts/DashboardChat';
import { SovereignWhiteboard } from './parts/SovereignWhiteboard';
import { Users, LayoutGrid, MessageSquare, ChevronLeft, ChevronRight, Monitor, Mic, MicOff, Video, VideoOff, Lock, Unlock, ShieldCheck, MonitorUp, ShieldAlert, MonitorOff, MessageSquareOff, Pencil } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL_BASE || 'http://localhost:5000/api';

interface TeacherDashboardProps {
  room: Room;
  onDisconnect: () => void;
  lecture: any;
}

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({ room, onDisconnect, lecture }) => {
  const [searchParams] = useSearchParams();
  const initialHall = searchParams.get('hall') || '101';
  const initialChat = searchParams.get('chat') !== 'false';
  const initialRecord = searchParams.get('record') === 'true';
  const initialShare = searchParams.get('share') === 'true';

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
  const [isRecordingAllowed, setIsRecordingAllowed] = useState(initialRecord);
  const [searchQuery, setSearchQuery] = useState('');

  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'participants' | 'screens' | 'chat'>('participants');
  const [raisedHands, setRaisedHands] = useState<Set<string>>(new Set());
  const controlsTimeoutRef = useRef<any | null>(null);
  const [localVideoTrack, setLocalVideoTrack] = useState<any>(null);

  // (Moved MISSION 14 sync below state declarations)
  const [roomState, setRoomState] = useState<any>({ isChatEnabled: initialChat });
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
  const [currentQuality, setCurrentQuality] = useState<VideoQuality>(VideoQuality.HIGH);
  const [featuredStudent, setFeaturedStudent] = useState<string | undefined>(undefined);
  const [featuredDestination, setFeaturedDestination] = useState<'wall' | 'dashboard' | 'none'>('none');
  const [onlineScreensCount, setOnlineScreensCount] = useState(0);
  
  // --- SOVEREIGN VIRTUAL MIXER REFS ---
  const mixerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const mixerStreamRef = useRef<MediaStream | null>(null);

  const { isRecording, isPaused, duration, startRecording, stopRecording, pauseRecording, resumeRecording } = useLocalRecorder(room, featuredStudent, featuredDestination, mixerStreamRef.current);
  
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenShareAllowed, setScreenShareAllowed] = useState<Set<string>>(new Set());
  const [isRoomLocked, setIsRoomLocked] = useState(false);
  const [isScreenShareAllowed, setIsScreenShareAllowed] = useState(initialShare);
  const [isWhiteboardOpen, setIsWhiteboardOpen] = useState(false);
  const [whiteboardTrack, setWhiteboardTrack] = useState<any>(null);
  const [originalVideoTrack, setOriginalVideoTrack] = useState<any>(null);

  // --- SOVEREIGN CUSTOM DIALOG STATE ---
  const [dialogConfig, setDialogConfig] = useState<{
    isOpen: boolean;
    type: 'alert' | 'confirm' | 'prompt';
    title: string;
    message: string;
    defaultValue?: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm?: (val?: string) => void;
    onCancel?: () => void;
  }>({ isOpen: false, type: 'alert', title: '', message: '' });

  const closeDialog = () => setDialogConfig(prev => ({ ...prev, isOpen: false }));

  // ── WALL GROUPS ─────────────────────────────────────────────────────────
  const [wallGroup, setWallGroup] = useState(`hall-${initialHall}`);
  const [wallPushStatus, setWallPushStatus] = useState<'idle' | 'pushing' | 'live'>('idle');

  const handlePushToWalls = useCallback(() => {
    if (!socket || !room) return;
    
    const currentNum = wallGroup.replace('hall-', '');
    setDialogConfig({
      isOpen: true,
      type: 'prompt',
      title: 'بث الشاشات الجدارية',
      message: 'اكتب رقم الغرفة لبدء البث المباشر (مثال: 120, 80):',
      defaultValue: currentNum,
      confirmText: 'بدء البث',
      cancelText: 'إلغاء',
      onConfirm: (hallNumber) => {
        closeDialog();
        if (!hallNumber || hallNumber.trim() === '') return;
        
        const targetGroup = `hall-${hallNumber.trim()}`;
        setWallGroup(targetGroup);
        setWallPushStatus('pushing');
        
        socket.emit('teacher:push_to_walls', {
          groupName: targetGroup,
          roomName: room.name,
          teacherRoomName: room.name
        });

        const link = `${window.location.origin}/display?group=${targetGroup}`;
        navigator.clipboard.writeText(link).then(() => {
          setDialogConfig({
            isOpen: true,
            type: 'alert',
            title: 'تم نسخ الرابط بنجاح',
            message: `تم نسخ رابط العرض بنجاح!\n${link}`,
            confirmText: 'حسناً',
            onConfirm: closeDialog
          });
        });

        socket.once('wall:push_confirmed', () => {
          console.log(`[WALL-GROUPS] Push confirmed → ${targetGroup}`);
          setWallPushStatus('live');
        });
        socket.once('wall:push_error', () => setWallPushStatus('idle'));
      },
      onCancel: closeDialog
    });
  }, [socket, room, wallGroup]);


  const handleReleaseWalls = useCallback(() => {
    if (!socket) return;
    socket.emit('teacher:release_walls', { groupName: wallGroup });
    setWallPushStatus('idle');
  }, [socket, wallGroup]);
  // ────────────────────────────────────────────────────────────────────────

  const handleToggleRoomLock = useCallback(() => {
    if (!socket || !room) return;
    const newState = !isRoomLocked;
    setIsRoomLocked(newState);
    socket.emit('teacher:lock_room', { roomName: room.name, locked: newState });
    console.log(`[TEACHER-DASHBOARD] Room ${newState ? 'LOCKED' : 'UNLOCKED'}`);
  }, [socket, room, isRoomLocked]);

  const handleToggleScreenSharePermission = useCallback(() => {
    if (!socket || !room) return;
    const nextState = !isScreenShareAllowed;
    setIsScreenShareAllowed(nextState);
    socket.emit('teacher:toggle_screenshare_permission', { roomName: room.name, allowed: nextState });
    console.log(`[TEACHER-DASHBOARD] Global Screenshare: ${nextState ? 'ALLOWED' : 'LOCKED'}`);
  }, [socket, room, isScreenShareAllowed]);

  const handleToggleChat = useCallback(() => {
    if (!socket || !room) return;
    const nextState = !roomState.isChatEnabled;
    setRoomState((prev: any) => ({ ...prev, isChatEnabled: nextState }));
    socket.emit('teacher:toggle_chat', { roomName: room.name, enabled: nextState });
    console.log(`[TEACHER-DASHBOARD] Global Chat: ${nextState ? 'ENABLED' : 'LOCKED'}`);
  }, [socket, room, roomState.isChatEnabled]);


  const handleToggleStudentScreenShare = useCallback((identity: string) => {
    setScreenShareAllowed(prev => {
      const next = new Set(prev);
      const isCurrentlyAllowed = next.has(identity);
      if (isCurrentlyAllowed) {
        next.delete(identity);
      } else {
        next.add(identity);
      }
      
      // Emit socket event to notify student
      socket?.emit(isCurrentlyAllowed ? 'teacher:revoke_screenshare' : 'teacher:grant_screenshare', {
        roomName: room.name,
        studentIdentity: identity
      });
      
      return next;
    });
  }, [socket, room.name]);

  const handleToggleScreenShare = useCallback(async () => {
    if (!room || !room.localParticipant) return;
    try {
      const newState = !isScreenSharing;
      console.log(`[TEACHER-DASHBOARD] Toggling screen share to: ${newState}`);
      
      // Feature request: "تنقطع كاميرا المعلم و يتحول الي بث مباشر لل ملف او الشاشة"
      // Turn OFF camera to save bandwidth when sharing screen.
      if (newState) {
        if (isCameraEnabled) {
          await room.localParticipant.setCameraEnabled(false);
          setIsCameraEnabled(false);
        }
        await room.localParticipant.setScreenShareEnabled(true);
      } else {
        await room.localParticipant.setScreenShareEnabled(false);
        // Optionally turn camera back on if it was on, but for now we just let them manually turn it on.
      }
      setIsScreenSharing(newState);
    } catch (e) {
      console.error('[TEACHER-DASHBOARD] Error toggling screen share', e);
      // Revert state if failed
      setIsScreenSharing(isScreenSharing);
    }
  }, [room, isScreenSharing, isCameraEnabled]);

  const toggleQuality = useCallback(() => {
    const nextQ = currentQuality === VideoQuality.LOW ? VideoQuality.MEDIUM : (currentQuality === VideoQuality.MEDIUM ? VideoQuality.HIGH : VideoQuality.LOW);
    console.log('[TEACHER-QUALITY] Toggling to:', nextQ);
    setCurrentQuality(nextQ);
    
    room.remoteParticipants.forEach(p => {
      p.videoTrackPublications.forEach(pub => {
        if (pub.kind === Track.Kind.Video) {
          console.log(`[TEACHER-QUALITY] Setting quality ${nextQ} for ${p.identity}`);
          pub.setVideoQuality(nextQ);
        }
      });
    });
  }, [currentQuality, room]);

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
  const [isDraggingSelfView, setIsDraggingSelfView] = useState(false);
  const [isResizingSelfView, setIsResizingSelfView] = useState(false);
  const [selfViewPos, setSelfViewPos] = useState({ x: window.innerWidth - 260, y: 30 });
  const [selfViewSize, setSelfViewSize] = useState({ width: 240, height: 140 });
  const [connectionQuality, setConnectionQuality] = useState<ConnectionQuality>(ConnectionQuality.Excellent);

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

  // MISSION 12: PERSISTENCE MANDATE
  // We REMOVED the beforeunload 'close_all' trigger.
  // This ensures that if the teacher's tab closes accidentally, 
  // the wall displays and students STAY IN THE ROOM.
  // The session only ends when the teacher explicitly clicks "END SESSION".
  useEffect(() => {
    // No-op for accidental closure safety
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

  const updateParticipants = useCallback(() => {
    if (!room) return;
    
    // Engineering Solution: Explicitly define what constitutes a "Student"
    // rather than just excluding "Teacher". This ensures Wall Displays and 
    // other spectator roles are naturally excluded from student lists.
    const participants = Array.from(room.remoteParticipants.values()).filter(p => {
      try {
        const meta = p.metadata ? JSON.parse(p.metadata) : {};
        // 1. Primary check: Metadata Role
        if (meta.role === 'student') return true;
        if (meta.role === 'teacher' || meta.role === 'wall_display') return false;
      } catch (e) {
        // Silently fail parse
      }

      // 2. Secondary check: Identity patterns (Fallback)
      const isTeacher = p.identity.includes('teacher');
      const isWall = p.identity.startsWith('wall_');
      const isStudent = p.identity.includes('student');
      
      return isStudent && !isTeacher && !isWall;
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
      
      // Sync initial configuration from URL params to backend
      socket.emit('teacher:toggle_chat', { roomName: room.name, enabled: initialChat });
      socket.emit('teacher:toggle_recording_permission', { roomName: room.name, allowed: initialRecord });
      socket.emit('teacher:toggle_screenshare_permission', { roomName: room.name, allowed: initialShare });
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

    const handleTrackSubscribed = (track: any, pub: any) => {
      if (pub.kind === Track.Kind.Video) {
        pub.setVideoQuality(currentQuality);
      }
      handleUpdate();
    };

    room.on(RoomEvent.TrackSubscribed, handleTrackSubscribed);
    room.remoteParticipants.forEach(attachToParticipant);
    updateParticipants(); // MISSION 13: Sync existing participants immediately
    
    room.on(RoomEvent.ParticipantConnected, (p) => { attachToParticipant(p); handleUpdate(); });
    room.on(RoomEvent.ParticipantDisconnected, (p) => { 
      setHasScreenAlert(true);
      wakeUp();
      setClassParticipants(prev => prev.filter(item => item.identity !== p.identity)); 
    });
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

    // MISSION 12: Global Real-time Screen Status Sync
    const handleScreenStatus = ({ screens: data }: { screens: any[] }) => {
      const onlineCount = data.filter((s: any) => s.status === 'online').length;
      setOnlineScreensCount(onlineCount);
    };
    socket.on('display:status_update', handleScreenStatus);
    
    // MISSION 12: Real-time Orchestration Listener
    socket.on('display:orchestration_update', ({ onlineScreensCount: count }: { onlineScreensCount: number }) => {
      console.log(`[TEACHER-OFFLOAD] Real-time screen update: ${count} screens`);
      setOnlineScreensCount(count);
    });

    socket.emit('teacher:request_status_sync', { roomName: room.name });

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
      if (state.featuredStudent) setFeaturedStudent(state.featuredStudent);
      if (state.featuredDestination) setFeaturedDestination(state.featuredDestination);
    });

    socket.on('room:featured_update', ({ studentIdentity, destination }: { studentIdentity: string, destination: any }) => {
      console.log('[TEACHER-ORCHESTRATION] Featured Student Update:', studentIdentity, destination);
      setFeaturedStudent(studentIdentity);
      setFeaturedDestination(destination);
      if (destination === 'dashboard') {
        wakeUp(); // Show controls to indicate focus
      }
    });

    // MISSION 14: AGGRESSIVE LOCAL TRACK SYNCHRONIZATION
    const syncLocalTrack = () => {
      const screenPub = room.localParticipant.getTrackPublication(Track.Source.ScreenShare);
      const camPub = room.localParticipant.getTrackPublication(Track.Source.Camera);
      
      const activeTrack = (screenPub?.videoTrack || screenPub?.track) || (camPub?.videoTrack || camPub?.track);
      
      if (activeTrack) {
        setLocalVideoTrack(activeTrack);
      } else {
        setLocalVideoTrack(null);
      }
    };

    // Sync when LiveKit tells us a track was published/unpublished
    room.localParticipant.on(ParticipantEvent.LocalTrackPublished, syncLocalTrack);
    room.localParticipant.on(ParticipantEvent.LocalTrackUnpublished, syncLocalTrack);
    
    // Initial sync
    syncLocalTrack();

    const startMedia = async () => {
      try {
        await new Promise(r => setTimeout(r, 800));
        await room.localParticipant.setMicrophoneEnabled(true);
        await room.localParticipant.setCameraEnabled(true);
        setIsMicEnabled(true);
        setIsCameraEnabled(true);
        syncLocalTrack();
      } catch (e) { console.error('Media Activation Failed', e); }
    };
    startMedia();


    
    const handleQualityChanged = (q: ConnectionQuality) => {
      setConnectionQuality(q);
    };
    room.localParticipant.on(ParticipantEvent.ConnectionQualityChanged, handleQualityChanged);

    return () => {
      socket.off('participant:raise_hand');
      socket.off('chat:receive_message', handleMessage);
      socket.off('chat:receive_private', handlePrivate);
      socket.off('display:status_update', handleScreenStatus);
      socket.off('sync_room_state');
      room.off(RoomEvent.ParticipantConnected, (p) => { attachToParticipant(p); handleUpdate(); });
      room.off(RoomEvent.ParticipantDisconnected, handleUpdate);
      room.off(RoomEvent.TrackSubscribed, handleTrackSubscribed);
      room.off(RoomEvent.TrackUnsubscribed, handleUpdate);
      room.off(RoomEvent.TrackMuted, handleUpdate);
      room.off(RoomEvent.TrackUnmuted, handleUpdate);
      room.localParticipant.off(ParticipantEvent.LocalTrackPublished, syncLocalTrack);
      room.localParticipant.off(ParticipantEvent.LocalTrackUnpublished, syncLocalTrack);
      room.localParticipant.off(ParticipantEvent.ConnectionQualityChanged, handleQualityChanged);
      clearTimeout(updateTimeout);
    };
  }, [room, socket, updateParticipants, wakeUp]);

  const handleKick = async (studentIdentity: string) => {
    setDialogConfig({
      isOpen: true,
      type: 'confirm',
      title: 'طرد نهائي',
      message: `هل أنت متأكد أنك تريد طرد الطالب ${studentIdentity} بشكل نهائي؟`,
      confirmText: 'طرد',
      cancelText: 'إلغاء',
      onConfirm: async () => {
        closeDialog();
        const studentId = studentIdentity.split('_')[0];
        try {
          await axios.delete(`${API_BASE}/lectures/${lecture._id}/kick/${studentId}`, { headers: { Authorization: `Bearer ${token}` } });
        } catch (err) { console.error('Kick failed', err); }
      },
      onCancel: closeDialog
    });
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

  const anyMicActive = classParticipants.some(p => p.isMicrophoneEnabled);
  const anyCameraActive = classParticipants.some(p => p.isCameraEnabled);

  const handleToggleClassMute = () => {
    if (!socket || !room) return;
    socket.emit('teacher:mute_all', { roomName: room.name });
    console.log('[SOVEREIGN-COMMAND] Force Muting All Students');
  };

  const handleToggleClassCamera = () => {
    if (!socket || !room) return;
    socket.emit('teacher:lock_cameras', { roomName: room.name });
    console.log('[SOVEREIGN-COMMAND] Global Camera Lock Triggered');
  };
  
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
    
    const scaledWidth = sidebarSize.width * sidebarScale;
    const scaledHeight = sidebarSize.height * sidebarScale; // in vh
    
    // X boundary logic (Pixels)
    let newX = e.clientX;
    const paddingX = 20;
    if (newX < paddingX) newX = paddingX;
    if (newX + scaledWidth > window.innerWidth - paddingX) newX = window.innerWidth - scaledWidth - paddingX;
    
    // Y boundary logic (Percentage)
    // Sidebar is translateY(-50%), so top is y - (height/2)
    let newY = (e.clientY / window.innerHeight) * 100;
    const halfHeight = scaledHeight / 2;
    const paddingY = 2; // 2% safety margin
    
    if (newY - halfHeight < paddingY) newY = halfHeight + paddingY;
    if (newY + halfHeight > 100 - paddingY) newY = 100 - paddingY - halfHeight;
    
    setSidebarPos({ x: newX, y: newY });
  };


  const handleIslandDrag = (e: React.MouseEvent) => {
    if (!isDraggingIsland) return;
    setIslandPos({
      x: e.clientX,
      y: (e.clientY / window.innerHeight) * 100
    });
  };
  
  const handleSelfViewDrag = (e: React.MouseEvent) => {
    if (!isDraggingSelfView) return;
    setSelfViewPos({
      x: Math.max(0, Math.min(window.innerWidth - selfViewSize.width, e.clientX - selfViewSize.width / 2)),
      y: Math.max(0, Math.min(window.innerHeight - selfViewSize.height, e.clientY - 12))
    });
  };

  const handleSelfViewResize = (e: React.MouseEvent) => {
    if (!isResizingSelfView) return;
    const newWidth = Math.max(160, Math.min(600, e.clientX - selfViewPos.x));
    const newHeight = Math.max(100, Math.min(450, e.clientY - selfViewPos.y));
    setSelfViewSize({ width: newWidth, height: newHeight });
  };

  const handleGlobalMouseUp = () => {
    setIsDraggingSidebar(false);
    setIsDraggingDock(false);
    setIsDraggingIsland(false);
    setIsDraggingSelfView(false);
    setIsResizingSelfView(false);
  };

  // Use a ref to track whiteboard state without triggering useEffect teardown
  const isWhiteboardOpenRef = useRef(isWhiteboardOpen);
  useEffect(() => {
    isWhiteboardOpenRef.current = isWhiteboardOpen;
  }, [isWhiteboardOpen]);

  // --- SOVEREIGN VIRTUAL MIXER AND TRACK SYNC ---

  // MISSION 14: BULLETPROOF LOCAL TRACK SYNC
  // Actively scan for the active local video track whenever UI state changes
  useEffect(() => {
    if (!room || !room.localParticipant) return;
    const sync = () => {
      const screenPub = room.localParticipant.getTrackPublication(Track.Source.ScreenShare);
      const camPub = room.localParticipant.getTrackPublication(Track.Source.Camera);
      const activeTrack = (screenPub?.videoTrack || screenPub?.track) || (camPub?.videoTrack || camPub?.track);
      if (activeTrack) setLocalVideoTrack(activeTrack);
      else setLocalVideoTrack(null);
    };
    
    // Slight delay to allow LiveKit to complete publishing/unpublishing
    const timer = setTimeout(sync, 500);
    return () => clearTimeout(timer);
  }, [isScreenSharing, isCameraEnabled, room]);

  useEffect(() => {
    // Create hidden mixer canvas ONCE. Never destroy it.
    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    mixerCanvasRef.current = canvas;
    // @ts-ignore
    mixerStreamRef.current = canvas.captureStream(30);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    const render = () => {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      try {
        if (isWhiteboardOpenRef.current) {
          // Draw Whiteboard
          const wbCanvas = document.querySelector('canvas[data-whiteboard="true"]') as HTMLCanvasElement;
          if (wbCanvas) {
             ctx.drawImage(wbCanvas, 0, 0, canvas.width, canvas.height);
          }
        } else {
          // Draw Camera or Screen Share
          const videoElement = document.querySelector('video[data-local-video="true"]') as HTMLVideoElement;
          if (videoElement && videoElement.readyState >= 2) {
             ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
          }
        }
      } catch (err) {
        // Silently catch cross-origin taint errors to prevent loop crash!
      }
      animationId = requestAnimationFrame(render);
    };
    render();
    
    return () => cancelAnimationFrame(animationId);
  }, []); // EMPTY ARRAY: Stream is permanent!

  const handleWhiteboardStream = useCallback(async (stream: MediaStream) => {
    // Logic handled by Mixer now
  }, []);

  const restoreCamera = useCallback(async () => {
    // Logic handled by Mixer now
  }, []);

  useEffect(() => {
    if (!isWhiteboardOpen && whiteboardTrack) {
      restoreCamera();
    }
  }, [isWhiteboardOpen]);

  const handleEndSession = async () => {
    setDialogConfig({
      isOpen: true,
      type: 'confirm',
      title: 'إنهاء المحاضرة',
      message: 'هل أنت متأكد من إنهاء المحاضرة للجميع؟',
      confirmText: 'إنهاء',
      cancelText: 'إلغاء',
      onConfirm: async () => {
        closeDialog();
        setIsEnding(true);
        try {
          // MISSION 12: Final Seal - Mark as completed and clean up
          await axios.patch(`${API_BASE}/lectures/${lecture._id}/status`, { status: 'completed' }, { headers: { Authorization: `Bearer ${token}` } });
          
          // Force a final attendance reconciliation on server
          await axios.post(`${API_BASE}/lectures/${lecture._id}/complete`, {}, { headers: { Authorization: `Bearer ${token}` } });
          
          socket?.emit('teacher:display_command', { roomName: room.name, command: 'close_all' });
          socket?.emit('end_session', { roomName: room.name });
          onDisconnect();
        } catch (err) { onDisconnect(); }
      },
      onCancel: closeDialog
    });
  };

  return (
    <div 
      onMouseMove={(e) => { handleDockDrag(e); handleSidebarDrag(e); handleIslandDrag(e); handleSelfViewDrag(e); handleSelfViewResize(e); }}
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
          quality={connectionQuality}
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
          featuredStudent={featuredStudent}
          featuredDestination={featuredDestination}
          hasExternalScreen={onlineScreensCount > 0 && wallPushStatus === 'live'}

          isFullscreen={isFullscreen}
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
          isScreenSharing={isScreenSharing}
          onToggleScreenShare={handleToggleScreenShare}
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
          isWhiteboardOpen={isWhiteboardOpen}
          currentQuality={currentQuality}
          onToggleQuality={toggleQuality}
        />
      </div>

      {/* OVERLAY LAYER: FIXED ACADEMIC COMMAND DOCK (LEFT) */}
      <div style={{ 
        position: 'absolute', 
        left: '20px', 
        top: '50%', 
        transform: 'translateY(-50%)',
        zIndex: 10000, 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '12px',
        background: 'rgba(15, 23, 42, 0.3)', 
        backdropFilter: 'blur(30px)',
        padding: '12px', 
        borderRadius: '24px', 
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
        transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
        opacity: showControls ? 1 : 0.2,
        pointerEvents: 'all'
      }}>
        {/* SECTION: NAVIGATION TABS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '10px' }}>
          <button 
            onClick={() => { setActiveTab('participants'); setIsSidebarOpen(activeTab !== 'participants' || !isSidebarOpen); setHasHandAlert(false); }}
            className="tooltip-right"
            data-tooltip="Participants List"
            style={{ 
              width: '44px', height: '44px', borderRadius: '14px', 
              background: activeTab === 'participants' && isSidebarOpen ? 'rgba(99, 102, 241, 0.2)' : 'transparent', 
              color: (raisedHands.size > 0 && hasHandAlert) ? '#a855f7' : (activeTab === 'participants' && isSidebarOpen ? '#818cf8' : 'rgba(255,255,255,0.7)'), 
              border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              position: 'relative',
              boxShadow: (raisedHands.size > 0 && hasHandAlert) ? '0 0 15px rgba(168, 85, 247, 0.5)' : (activeTab === 'participants' && isSidebarOpen ? '0 0 15px rgba(99, 102, 241, 0.3)' : 'none')
            }}
          >
            <Users size={20} />
            {raisedHands.size > 0 && (
              <div style={{ 
                position: 'absolute', top: 2, right: 2, width: 8, height: 8, 
                borderRadius: '50%', background: '#a855f7', border: '2px solid #0f172a',
                boxShadow: '0 0 10px #a855f7'
              }} />
            )}
          </button>

          <button 
            onClick={() => { setActiveTab('screens'); setIsSidebarOpen(activeTab !== 'screens' || !isSidebarOpen); setHasScreenAlert(false); }}
            className="tooltip-right"
            data-tooltip="Wall Displays"
            style={{ 
              width: '44px', height: '44px', borderRadius: '14px', 
              background: activeTab === 'screens' && isSidebarOpen ? 'rgba(34, 197, 94, 0.2)' : 'transparent', 
              color: activeTab === 'screens' && isSidebarOpen ? '#4ade80' : 'rgba(255,255,255,0.7)', 
              border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: activeTab === 'screens' && isSidebarOpen ? '0 0 15px rgba(34, 197, 94, 0.3)' : 'none'
            }}
          >
            <LayoutGrid size={20} />
          </button>

          <button 
            onClick={() => { setActiveTab('chat'); setIsSidebarOpen(activeTab !== 'chat' || !isSidebarOpen); if (activeTab === 'chat' && !isSidebarOpen) setTotalUnread(0); }}
            className={`tooltip-right ${totalUnread > 0 ? 'pulse-chat' : ''}`}
            data-tooltip="Class Chat"
            style={{ 
              width: '44px', height: '44px', borderRadius: '14px', 
              background: activeTab === 'chat' && isSidebarOpen ? 'rgba(168, 85, 247, 0.2)' : 'transparent', 
              color: activeTab === 'chat' && isSidebarOpen ? '#c084fc' : 'rgba(255,255,255,0.7)', 
              border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', position: 'relative',
              boxShadow: activeTab === 'chat' && isSidebarOpen ? '0 0 15px rgba(168, 85, 247, 0.3)' : 'none'
            }}
          >
            <MessageSquare size={20} />
            {totalUnread > 0 && <div style={{ position: 'absolute', top: 2, right: 2, width: 8, height: 8, borderRadius: '50%', background: '#ef4444', border: '2px solid #0f172a' }} />}
          </button>

          {/* WHITEBOARD TOGGLE (Moved under Chat) */}
          <button 
            onClick={() => setIsWhiteboardOpen(true)}
            className="tooltip-right"
            data-tooltip="Launch Whiteboard"
            style={{ 
              width: '44px', height: '44px', borderRadius: '14px', 
              background: isWhiteboardOpen ? 'rgba(99, 102, 241, 0.2)' : 'transparent', 
              color: isWhiteboardOpen ? '#818cf8' : 'rgba(255,255,255,0.7)', 
              border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: isWhiteboardOpen ? '0 0 15px rgba(99, 102, 241, 0.3)' : 'none'
            }}
          >
            <Pencil size={20} />
          </button>
        </div>

        {/* SECTION: ACADEMIC AUTHORITY CONTROLS (GLOBAL ACTIONS) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '10px' }}>
          {/* SMART MUTE ALL */}
          <button 
            onClick={handleToggleClassMute}
            className="tooltip-right"
            data-tooltip={anyMicActive ? "Force Mute All Active Students" : "All Students Muted"}
            style={{ 
              width: '44px', height: '44px', borderRadius: '14px', 
              background: anyMicActive ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.2)', 
              color: anyMicActive ? '#22c55e' : '#ef4444', 
              border: `1px solid ${anyMicActive ? '#22c55e' : '#ef4444'}`, 
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.2s',
              boxShadow: anyMicActive ? '0 0 15px rgba(34, 197, 94, 0.3)' : 'none'
            }}
          >
            {anyMicActive ? <Mic size={18} /> : <MicOff size={18} />}
          </button>

          {/* SMART LOCK CAMERAS */}
          <button 
            onClick={handleToggleClassCamera}
            className="tooltip-right"
            data-tooltip={anyCameraActive ? "Force Off All Active Cameras" : "All Cameras Locked"}
            style={{ 
              width: '44px', height: '44px', borderRadius: '14px', 
              background: anyCameraActive ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.2)', 
              color: anyCameraActive ? '#22c55e' : '#ef4444', 
              border: `1px solid ${anyCameraActive ? '#22c55e' : '#ef4444'}`, 
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.2s',
              boxShadow: anyCameraActive ? '0 0 15px rgba(34, 197, 94, 0.3)' : 'none'
            }}
          >
            {anyCameraActive ? <Video size={18} /> : <VideoOff size={18} />}
          </button>

          {/* LOCK ROOM ENTRY */}
          <button 
            onClick={handleToggleRoomLock}
            className="tooltip-right"
            data-tooltip={isRoomLocked ? "Room Locked" : "Room Open"}
            style={{ 
              width: '44px', height: '44px', borderRadius: '14px', 
              background: isRoomLocked ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 197, 94, 0.15)', 
              color: isRoomLocked ? '#f87171' : '#4ade80', 
              border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: isRoomLocked ? 'none' : '0 0 15px rgba(34, 197, 94, 0.2)'
            }}
          >
            {isRoomLocked ? <Lock size={18} /> : <Unlock size={18} />}
          </button>

          {/* GLOBAL RECORDING PERMISSION */}
          <button 
            onClick={handleToggleRecordingPermission}
            className="tooltip-right"
            data-tooltip={isRecordingAllowed ? "Students Allowed to Record" : "Student Recording Blocked"}
            style={{ 
              width: '44px', height: '44px', borderRadius: '14px', 
              background: isRecordingAllowed ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.2)', 
              color: isRecordingAllowed ? '#4ade80' : '#f87171', 
              border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: isRecordingAllowed ? '0 0 15px rgba(34, 197, 94, 0.2)' : 'none'
            }}
          >
            {isRecordingAllowed ? <ShieldCheck size={18} /> : <ShieldAlert size={18} />}
          </button>
          
          {/* GLOBAL SCREENSHARE PERMISSION */}
          <button 
            onClick={handleToggleScreenSharePermission}
            className="tooltip-right"
            data-tooltip={isScreenShareAllowed ? "Students Allowed to Share Screen" : "Student Screenshare Blocked"}
            style={{ 
              width: '44px', height: '44px', borderRadius: '14px', 
              background: isScreenShareAllowed ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.2)', 
              color: isScreenShareAllowed ? '#4ade80' : '#f87171', 
              border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: isScreenShareAllowed ? '0 0 15px rgba(34, 197, 94, 0.2)' : 'none'
            }}
          >
            {isScreenShareAllowed ? <MonitorUp size={18} /> : <MonitorOff size={18} />}
          </button>

          {/* GLOBAL CHAT CONTROL */}
          <button 
            onClick={handleToggleChat}
            className="tooltip-right"
            data-tooltip={roomState.isChatEnabled ? "Public Chat Enabled" : "Public Chat Blocked"}
            style={{ 
              width: '44px', height: '44px', borderRadius: '14px', 
              background: roomState.isChatEnabled ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.2)', 
              color: roomState.isChatEnabled ? '#4ade80' : '#f87171', 
              border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: roomState.isChatEnabled ? '0 0 15px rgba(34, 197, 94, 0.2)' : 'none'
            }}
          >
            {roomState.isChatEnabled ? <MessageSquare size={18} /> : <MessageSquareOff size={18} />}
          </button>
        </div>


        {/* SECTION: WALL ORCHESTRATION */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div 
            onClick={() => {
              const link = `${window.location.origin}/display?group=${wallGroup}`;
              navigator.clipboard.writeText(link).then(() => {
                setDialogConfig({
                  isOpen: true,
                  type: 'alert',
                  title: 'تم النسخ',
                  message: `تم نسخ رابط العرض بنجاح!\n${link}`,
                  confirmText: 'حسناً',
                  onConfirm: closeDialog
                });
              });
            }}
            title="Click to copy display link"
            style={{
              background: 'rgba(99, 102, 241, 0.05)',
              border: '1px solid rgba(99, 102, 241, 0.15)',
              borderRadius: 10,
              color: wallPushStatus === 'live' ? '#818cf8' : '#64748b',
              fontSize: 8,
              padding: '6px 2px',
              width: '44px',
              textAlign: 'center',
              fontFamily: 'monospace',
              fontWeight: 900,
              cursor: 'pointer',
            }}
          >
            {wallGroup.replace('hall-', '').toUpperCase()}
          </div>
          
          <button
            onClick={wallPushStatus === 'live' ? handleReleaseWalls : handlePushToWalls}
            style={{
              width: '44px', height: '44px', borderRadius: '14px',
              background: wallPushStatus === 'live' ? 'rgba(239,68,68,0.15)' : 'rgba(99,102,241,0.15)',
              border: `1px solid ${wallPushStatus === 'live' ? 'rgba(239,68,68,0.3)' : 'rgba(99,102,241,0.3)'}`,
              color: wallPushStatus === 'live' ? '#f87171' : '#818cf8',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.25s ease',
            }}
            title={wallPushStatus === 'live' ? "Release Walls" : "Push to Wall"}
          >
            <Monitor size={20} className={wallPushStatus === 'pushing' ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>


      {/* SIDEBAR OVERLAY (Background Blur) */}
      <div 
        onClick={() => setIsSidebarOpen(false)}
        style={{
          position: 'absolute', inset: 0, 
          background: isSidebarOpen ? 'rgba(2, 6, 23, 0.4)' : 'transparent', 
          backdropFilter: isSidebarOpen ? 'blur(10px)' : 'none',
          opacity: isSidebarOpen ? 1 : 0,
          zIndex: 9998,
          transition: 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
          pointerEvents: isSidebarOpen ? 'all' : 'none'
        }}
      />

      {/* OVERLAY LAYER: SLIDING GLASS PANELS (CONTENT) */}
      <div 
        style={{ 
          position: 'absolute', 
          left: '100px', 
          top: '50%', 
          transform: `translateY(-50%) translateX(${isSidebarOpen ? '0' : '-120%'}) scale(${sidebarScale})`,
          width: `${sidebarSize.width}px`, 
          height: `${sidebarSize.height}vh`, 
          zIndex: 9999, 
          transition: 'transform 0.7s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.5s ease',
          opacity: isSidebarOpen ? 1 : 0, 
          transformOrigin: 'left center',
          pointerEvents: isSidebarOpen ? 'all' : 'none',
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
              style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'center' }}
            >
              <div style={{ display: 'flex', gap: '3px' }}>
                {[...Array(3)].map((_, i) => <div key={i} style={{ width: '3px', height: '3px', borderRadius: '50%', background: '#818cf8' }} />)}
              </div>
              <span style={{ fontSize: '10px', color: '#818cf8', fontWeight: '900', marginLeft: '10px', letterSpacing: '2px' }}>{activeTab.toUpperCase()} PANEL</span>
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
                featuredStudent={featuredStudent}
                featuredDestination={featuredDestination}
                isRoomLocked={isRoomLocked}
                onToggleRoomLock={handleToggleRoomLock}
                screenShareAllowed={screenShareAllowed}
                onToggleScreenSharePermission={handleToggleStudentScreenShare}
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

      <SovereignWhiteboard 
        roomName={room.name}
        socket={socket}
        isOpen={isWhiteboardOpen}
        onClose={() => setIsWhiteboardOpen(false)}
        onStreamReady={handleWhiteboardStream}
      />

      {/* SOVEREIGN DIALOG OVERLAY */}
      {dialogConfig.isOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 99999,
          background: 'rgba(2, 6, 23, 0.8)', backdropFilter: 'blur(12px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div style={{
            background: 'rgba(15, 23, 42, 0.95)',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5), 0 0 30px rgba(99, 102, 241, 0.1)',
            borderRadius: '24px',
            padding: '30px',
            width: '90%', maxWidth: '420px',
            display: 'flex', flexDirection: 'column', gap: '20px',
            transform: 'translateY(0)',
            animation: 'slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
          }}>
            <h3 style={{ margin: 0, color: '#fff', fontSize: '20px', fontWeight: '700', letterSpacing: '0.5px' }}>
              {dialogConfig.title}
            </h3>
            <p style={{ margin: 0, color: '#94a3b8', fontSize: '15px', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
              {dialogConfig.message}
            </p>
            
            {dialogConfig.type === 'prompt' && (
              <input 
                autoFocus
                defaultValue={dialogConfig.defaultValue}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') dialogConfig.onConfirm?.(e.currentTarget.value);
                  if (e.key === 'Escape') dialogConfig.onCancel?.();
                }}
                id="sovereign-prompt-input"
                style={{
                  background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px', padding: '12px 16px', color: '#fff', fontSize: '16px',
                  outline: 'none', transition: 'border 0.2s', width: '100%',
                  textAlign: 'center', letterSpacing: '2px', fontWeight: 'bold'
                }}
                onFocus={(e) => e.target.style.borderColor = '#6366f1'}
                onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
              />
            )}

            <div style={{ display: 'flex', gap: '12px', marginTop: '10px', justifyContent: 'flex-end' }}>
              {(dialogConfig.type === 'prompt' || dialogConfig.type === 'confirm') && (
                <button 
                  onClick={() => dialogConfig.onCancel?.()}
                  style={{
                    padding: '10px 20px', borderRadius: '12px', background: 'transparent',
                    border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8',
                    cursor: 'pointer', fontWeight: '600', transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#fff'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94a3b8'; }}
                >
                  {dialogConfig.cancelText || 'Cancel'}
                </button>
              )}
              <button 
                onClick={() => {
                  if (dialogConfig.type === 'prompt') {
                    const val = (document.getElementById('sovereign-prompt-input') as HTMLInputElement)?.value;
                    dialogConfig.onConfirm?.(val);
                  } else {
                    dialogConfig.onConfirm?.();
                  }
                }}
                style={{
                  padding: '10px 24px', borderRadius: '12px', background: '#6366f1',
                  border: 'none', color: '#fff', cursor: 'pointer', fontWeight: '700',
                  boxShadow: '0 4px 15px rgba(99, 102, 241, 0.4)', transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(99, 102, 241, 0.6)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 15px rgba(99, 102, 241, 0.4)'; }}
              >
                {dialogConfig.confirmText || 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes pulse-alert-hand {
          0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(168, 85, 247, 0.4); }
          50% { transform: scale(1.1); box-shadow: 0 0 20px 10px rgba(168, 85, 247, 0.2); }
          100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(168, 85, 247, 0); }
        }
        .pulse-alert-hand {
          animation: pulse-alert-hand 2s infinite;
        }
        .pulse-alert-teacher {
          animation: pulse-alert-teacher 1.5s infinite;
        }
        @keyframes pulse-alert-teacher {
          0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
          50% { transform: scale(1.1); box-shadow: 0 0 20px 10px rgba(239, 68, 68, 0); }
          100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }

        /* SMART TOOLTIPS */
        [data-tooltip] { position: relative; }
        [data-tooltip]:after {
          content: attr(data-tooltip);
          position: absolute;
          background: rgba(15, 23, 42, 0.95);
          backdrop-filter: blur(10px);
          padding: 6px 12px;
          border-radius: 8px;
          color: #fff;
          font-size: 11px;
          font-weight: 600;
          white-space: nowrap;
          opacity: 0;
          visibility: hidden;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          border: 1px solid rgba(255,255,255,0.1);
          box-shadow: 0 10px 25px rgba(0,0,0,0.6);
          z-index: 100000;
          pointer-events: none;
          letter-spacing: 0.5px;
        }
        [data-tooltip]:hover:after {
          opacity: 1;
          visibility: visible;
        }

        /* Right positioning (Sidebar) */
        .tooltip-right:after {
          left: 120%;
          top: 50%;
          transform: translateY(-50%) translateX(-10px);
        }
        .tooltip-right:hover:after {
          transform: translateY(-50%) translateX(0);
        }

        /* Top positioning (Dock) */
        .tooltip-top:after {
          bottom: 120%;
          left: 50%;
          transform: translateX(-50%) translateY(10px);
        }
        .tooltip-top:hover:after {
          transform: translateX(-50%) translateY(0);
        }
      `}</style>
      {/* MISSION 15: FLOATING SELF-VIEW (Teacher Perspective) */}
      <div 
        style={{
          position: 'absolute',
          left: `${selfViewPos.x}px`,
          top: `${selfViewPos.y}px`,
          width: `${selfViewSize.width}px`,
          height: `${selfViewSize.height}px`,
          zIndex: 10002,
          background: 'rgba(15, 23, 42, 0.7)',
          backdropFilter: 'blur(30px)',
          borderRadius: '24px',
          border: '1px solid rgba(255,255,255,0.15)',
          overflow: 'hidden',
          boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
          display: 'flex',
          flexDirection: 'column',
          transition: (isDraggingSelfView || isResizingSelfView) ? 'none' : 'all 0.3s ease',
          opacity: showControls ? 1 : 0.4,
          pointerEvents: 'all'
        }}
      >
        {/* DRAG HEADER */}
        <div 
          onMouseDown={() => setIsDraggingSelfView(true)}
          style={{ 
            height: '24px', background: 'rgba(255,255,255,0.05)', cursor: 'grab',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
            flexShrink: 0
          }}
        >
          <div style={{ width: '30px', height: '3px', background: 'rgba(255,255,255,0.2)', borderRadius: '2px' }} />
        </div>
        
        <div style={{ flex: 1, position: 'relative', background: '#000', overflow: 'hidden' }}>
           {room.localParticipant && (
             <VideoTrack participant={room.localParticipant} room={room} mode="grid" track={localVideoTrack} />
           )}
           
           {/* LABEL Overlay */}
           <div style={{ 
             position: 'absolute', bottom: 8, left: 8, 
             background: 'rgba(0,0,0,0.6)', padding: '4px 10px', borderRadius: '8px',
             fontSize: '10px', color: '#fff', fontWeight: '900', backdropFilter: 'blur(10px)',
             border: '1px solid rgba(255,255,255,0.1)', letterSpacing: '0.5px'
           }}>
             YOU (TEACHER)
           </div>

           {/* RESIZE HANDLE */}
           <div 
             onMouseDown={(e) => { e.stopPropagation(); setIsResizingSelfView(true); }}
             style={{ 
               position: 'absolute', bottom: 0, right: 0, width: '20px', height: '20px', 
               cursor: 'nwse-resize', background: 'linear-gradient(135deg, transparent 50%, rgba(255,255,255,0.2) 50%)',
               zIndex: 20
             }}
           />
        </div>
      </div>
    </div>
  );
};
