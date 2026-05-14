import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Room, RemoteParticipant, VideoQuality, RoomEvent, Track } from 'livekit-client';
import { VideoTrack } from './VideoTrack';
import { StudentChat } from './StudentChat';
import { StudentWhiteboard } from './StudentWhiteboard';
import { Mic, MicOff, Video, VideoOff, Loader2, LogOut, Gauge, Circle, StopCircle, Pause, Play, Hand, Maximize2, Minimize2, MessageSquare, MessageSquareOff, MonitorUp, ShieldAlert, MonitorOff } from 'lucide-react';
import { useLocalRecorder } from '../hooks/useLocalRecorder';
import { useLiveKit } from '../contexts/LiveKitContext';
import { useStudentModeration } from '../hooks/useStudentModeration';

interface StudentCinemaProps {
  room: Room;
  lecture: any;
  onDisconnect: () => void;
}

export const StudentCinema: React.FC<StudentCinemaProps> = ({ room, lecture, onDisconnect }) => {
  const { socket, isRecordingAllowed, isScreenShareAllowed, isChatEnabled, disconnect } = useLiveKit();
  const [teacher, setTeacher] = useState<RemoteParticipant | null>(null);
  const [isMicEnabled, setIsMicEnabled] = useState(false);
  const [isCameraEnabled, setIsCameraEnabled] = useState(false);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [currentQuality, setCurrentQuality] = useState<VideoQuality>(VideoQuality.HIGH);
  const [isWhiteboardActive, setIsWhiteboardActive] = useState(false);
  const [micRequest, setMicRequest] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [hasNewPrivate, setHasNewPrivate] = useState(false);

  // --- SOVEREIGN VIRTUAL MIXER REFS ---
  const mixerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const mixerStreamRef = useRef<MediaStream | null>(null);

  const isWhiteboardActiveRef = useRef(isWhiteboardActive);
  useEffect(() => {
    isWhiteboardActiveRef.current = isWhiteboardActive;
  }, [isWhiteboardActive]);

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
        if (isWhiteboardActiveRef.current) {
          // Draw Whiteboard
          const wbCanvas = document.querySelector('canvas[data-whiteboard="true"]') as HTMLCanvasElement;
          if (wbCanvas) {
             ctx.drawImage(wbCanvas, 0, 0, canvas.width, canvas.height);
          }
        } else {
          // Draw Teacher's Camera
          const videoElement = document.querySelector('video[data-main-video="true"]') as HTMLVideoElement;
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

  const { isRecording, isPaused, duration, startRecording, stopRecording, pauseRecording, resumeRecording } = useLocalRecorder(room, mixerStreamRef.current);
  const [participantCount, setParticipantCount] = useState(room.remoteParticipants.size + 1);
  const [isIndividualScreenShareAllowed, setIsIndividualScreenShareAllowed] = useState(true);
  const [isStudentScreenSharing, setIsStudentScreenSharing] = useState(false);
  const [isTeacherScreenSharing, setIsTeacherScreenSharing] = useState(false);
  
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  const [toast, setToast] = useState<{ msg: string; type: 'error' | 'success' } | null>(null);
  const controlsTimerRef = useRef<any>(null);

  const showToast = (msg: string, type: 'error' | 'success' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    if (!socket) return;

    // MISSION 13: SOVEREIGN ENFORCEMENT - Auto-kick on session end
    socket.on('session_ended', () => {
      console.log('[STUDENT-CINEMA] Sovereign Command: Session Ended by Teacher');
      showToast('انتهت المحاضرة. شكراً لحضورك.', 'success');
      disconnect();
      setTimeout(() => onDisconnect(), 2500);
    });

    return () => {
      socket.off('session_ended');
    };
  }, [socket, disconnect, onDisconnect]);

  useEffect(() => {
    // MISSION 12: ORCHESTRATION - Notify engine about student presence
    if (lecture?.roomName && room.localParticipant.identity) {
      console.log(`[STUDENT-ORCHESTRATOR] Announcing presence in ${lecture.roomName}`);
      if (socket) {
        socket.emit('student:joined', { 
          roomName: lecture.roomName, 
          identity: room.localParticipant.identity 
        });
      }
    }

    return () => {
      // MISSION 12: Notify exit
      if (lecture?.roomName && room.localParticipant.identity && socket) {
        socket.emit('student:left', { 
          roomName: lecture.roomName, 
          identity: room.localParticipant.identity 
        });
      }
    };
  }, [socket, lecture, room]);






  useEffect(() => {
    if (!isRecordingAllowed && isRecording) {
      stopRecording();
      showToast('Teacher revoked recording permission.', 'error');
    }
  }, [isRecordingAllowed, isRecording, stopRecording]);

  useEffect(() => {
    if (!isScreenShareAllowed && isStudentScreenSharing) {
      room.localParticipant.setScreenShareEnabled(false);
      setIsStudentScreenSharing(false);
      showToast('Teacher locked screensharing for everyone.', 'error');
    }
  }, [isScreenShareAllowed, isStudentScreenSharing, room]);


  useEffect(() => {
    if (!room) return;
    
    const discover = () => {
      const participants = Array.from(room.remoteParticipants.values());
      const teacherPart = participants.find(p => {
        try {
          const meta = p.metadata ? JSON.parse(p.metadata) : {};
          return meta.role === 'teacher';
        } catch (e) {
          return p.identity.toLowerCase().includes('teacher') || p.identity.endsWith('_teacher');
        }
      });
      if (teacherPart?.identity !== teacher?.identity) setTeacher(teacherPart || null);
    };


    const onParticipantDisconnected = (p: RemoteParticipant) => {
      if (p.identity === teacher?.identity) {
        console.log('[STUDENT-CINEMA] Teacher Left Room (Instant Detection)');
        setTeacher(null);
      }
    };

    room.on('participantDisconnected' as any, onParticipantDisconnected);
    const interval = setInterval(discover, 1000);
    
    discover();

    return () => {
      room.off('participantDisconnected' as any, onParticipantDisconnected);
      clearInterval(interval);
    };
  }, [room, teacher?.identity]);

  // MISSION 04: SOVEREIGN SUBSCRIPTION ENGINE (Optimized for Scale)
  // Students only download: Teacher (Video/Audio/Screen) + Active Student Speakers (Audio Only)
  useEffect(() => {
    if (!room) return;

    const manageSubscriptions = () => {
      const activeSpeakers = new Set(room.activeSpeakers.map(s => s.identity));
      
      room.remoteParticipants.forEach((p) => {
        let isTeacher = false;
        let isWall = false;

        try {
          const meta = p.metadata ? JSON.parse(p.metadata) : {};
          isTeacher = meta.role === 'teacher';
          isWall = meta.role === 'wall_display';
        } catch (e) {
          isTeacher = p.identity.toLowerCase().includes('teacher') || p.identity.endsWith('_teacher');
          isWall = p.identity.startsWith('wall_');
        }

        const isActiveSpeaker = activeSpeakers.has(p.identity);

        p.trackPublications.forEach((pub) => {
          // RULE 1: Teacher gets priority (Video, Audio, ScreenShare)
          if (isTeacher) {
            if (!pub.isSubscribed) {
              console.log(`[STUDENT-SYNC] Subscribing to Teacher Track: ${pub.trackSid} (${pub.kind})`);
              pub.setSubscribed(true);
            }
            // Enforce High Quality for Teacher
            if (pub.kind === Track.Kind.Video) pub.setVideoQuality(currentQuality);
            return;
          }

          // RULE 2: Wall Displays — Spectators should never publish, but we ignore them entirely just in case
          if (isWall) {
             if (pub.isSubscribed) pub.setSubscribed(false);
             return;
          }

          // RULE 3: Dynamic Q&A - Subscribe to Audio of active speakers (students)
          if (pub.kind === Track.Kind.Audio && isActiveSpeaker) {
            if (!pub.isSubscribed) {
              console.log(`[STUDENT-SYNC] Subscribing to Active Speaker Audio: ${p.identity}`);
              pub.setSubscribed(true);
            }
          } 
          // RULE 4: Unsubscribe from everyone else to save bandwidth
          else {
            if (pub.isSubscribed) {
              console.log(`[STUDENT-SYNC] Unsubscribing from Background Track: ${p.identity} (${pub.kind})`);
              pub.setSubscribed(false);
            }
          }
        });
      });
    };


    // EVENTS FOR PARTICIPANT COUNT SYNC
    const updateCount = () => {
      // Engineering Solution: Only count students in the "Online" count
      const studentsOnly = Array.from(room.remoteParticipants.values()).filter(p => {
        try {
          const meta = p.metadata ? JSON.parse(p.metadata) : {};
          return meta.role === 'student';
        } catch (e) {
          return p.identity.includes('student') && !p.identity.includes('teacher') && !p.identity.startsWith('wall_');
        }
      });
      setParticipantCount(studentsOnly.length + 1); // +1 for self
    };

    room.on(RoomEvent.ParticipantConnected, updateCount);
    room.on(RoomEvent.ParticipantDisconnected, updateCount);

    // Events that trigger a subscription re-evaluation
    room.on(RoomEvent.ParticipantConnected, manageSubscriptions);
    room.on(RoomEvent.TrackPublished, manageSubscriptions);
    room.on(RoomEvent.ActiveSpeakersChanged, manageSubscriptions);

    manageSubscriptions();
    updateCount();

    return () => {
      room.off(RoomEvent.ParticipantConnected, updateCount);
      room.off(RoomEvent.ParticipantDisconnected, updateCount);
      room.off(RoomEvent.ParticipantConnected, manageSubscriptions);
      room.off(RoomEvent.TrackPublished, manageSubscriptions);
      room.off(RoomEvent.ActiveSpeakersChanged, manageSubscriptions);
    };
  }, [room, currentQuality]);



  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => setShowControls(false), 5000); // 5 seconds per request
  }, []);

  const [dockScale, setDockScale] = useState(1);

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width < 600) setDockScale(0.75);
      else if (width < 1000) setDockScale(0.9);
      else setDockScale(1);
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleAction = () => resetControlsTimer();
    window.addEventListener('mousemove', handleAction);
    resetControlsTimer();
    return () => { window.removeEventListener('mousemove', handleAction); if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current); };
  }, [resetControlsTimer]);
  useEffect(() => {
    if (!socket) return;
    
    socket.on('request_unmute', () => {
      console.log('[STUDENT-PRIVACY] Teacher requested mic access.');
      setMicRequest(true);
      resetControlsTimer();
    });

    socket.on('teacher:lower_hand', (data: any) => {
      if (data.targetIdentity === room.localParticipant.identity || data.targetIdentity === 'all') {
        console.log('[STUDENT-HAND] Teacher lowered your hand.');
        setIsHandRaised(false);
        showToast('Teacher acknowledged your hand.', 'success');
        resetControlsTimer();
      }
    });

    // SCREEN SHARE PERMISSION EVENTS
    socket.on('teacher:grant_screenshare', (data: any) => {
      if (data.studentIdentity === room.localParticipant.identity) {
        console.log('[STUDENT-CINEMA] Teacher granted screen share permission.');
        setIsIndividualScreenShareAllowed(true);
        showToast('Teacher allowed you to share your screen!', 'success');
        resetControlsTimer();
      }
    });

    socket.on('teacher:revoke_screenshare', (data: any) => {
      if (data.studentIdentity === room.localParticipant.identity) {
        console.log('[STUDENT-CINEMA] Teacher revoked screen share permission.');
        setIsIndividualScreenShareAllowed(false);
        // Stop sharing if currently sharing
        if (isStudentScreenSharing) {
          room.localParticipant.setScreenShareEnabled(false).catch(() => {});
          setIsStudentScreenSharing(false);
        }
        showToast('Teacher removed your screen share permission.', 'error');
      }
    });

    return () => {
      socket.off('request_unmute');
      socket.off('teacher:lower_hand');
      socket.off('teacher:grant_screenshare');
      socket.off('teacher:revoke_screenshare');
    };
  }, [socket, room.localParticipant.identity, isStudentScreenSharing]);

  const handleApproveMic = async () => {
    try {
      await room?.localParticipant.setMicrophoneEnabled(true);
      setIsMicEnabled(true);
      setMicRequest(false);
    } catch (e) {
      console.error('Failed to enable mic after approval', e);
    }
  };

  useStudentModeration(room, socket, setIsMicEnabled, setIsCameraEnabled);

  useEffect(() => {
    if (!room) return;
    
    const autoEnable = async () => {
      try {
        console.log('[STUDENT-CINEMA] Sovereign Entry: Enforcing initial state...');
        // Only run once on mount/room join
        await room.localParticipant.setMicrophoneEnabled(false);
        await room.localParticipant.setCameraEnabled(true);
        setIsMicEnabled(false);
        setIsCameraEnabled(true);
      } catch (e) { console.error('Failed to auto-enable media', e); }
    };
    
    autoEnable();

    const syncWithMetadata = () => {
      if (!room.localParticipant.metadata) return;
      try {
        const meta = JSON.parse(room.localParticipant.metadata);
        if (meta.isMutedByTeacher && isMicEnabled) {
          room.localParticipant.setMicrophoneEnabled(false);
          setIsMicEnabled(false);
          showToast('Teacher has muted your microphone.', 'error');
        }
      } catch (e) { console.error('Metadata parse error', e); }
    };

    room.localParticipant.on('metadataChanged' as any, syncWithMetadata);
    return () => { room.localParticipant.off('metadataChanged' as any, syncWithMetadata); };
  }, [room]); // REMOVED isMicEnabled from dependencies to prevent auto-mute loop

  const toggleMic = async () => {
    const newState = !isMicEnabled;
    await room.localParticipant.setMicrophoneEnabled(newState);
    setIsMicEnabled(newState);
    socket?.emit(newState ? 'participant_mic_on' : 'participant_mic_off', { roomName: room.name });
  };

  const toggleCamera = async () => {
    const newState = !isCameraEnabled;
    await room.localParticipant.setCameraEnabled(newState);
    setIsCameraEnabled(newState);
  };

  const toggleFullscreen = () => {
    const el = document.getElementById('student-cinema-viewport');
    if (!document.fullscreenElement) {
      el?.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const toggleQuality = () => {
    if (!teacher) return;
    const nextQ = currentQuality === VideoQuality.LOW ? VideoQuality.MEDIUM : (currentQuality === VideoQuality.MEDIUM ? VideoQuality.HIGH : VideoQuality.LOW);
    setCurrentQuality(nextQ);
    teacher.videoTrackPublications.forEach(pub => {
      if (pub.track) pub.setVideoQuality(nextQ);
    });
    console.log(`[STUDENT-CINEMA] Subscriber Quality Set to: ${nextQ}`);
  };

  const canShareScreen = isScreenShareAllowed && isIndividualScreenShareAllowed;

  const toggleStudentScreenShare = async () => {
    if (!canShareScreen) {
      showToast('Screen sharing requires teacher permission.', 'error');
      return;
    }
    try {
      const newState = !isStudentScreenSharing;
      await room.localParticipant.setScreenShareEnabled(newState);
      setIsStudentScreenSharing(newState);
      if (newState) showToast('You are now sharing your screen.', 'success');
      else showToast('Screen sharing stopped.', 'success');
    } catch (e) {
      console.error('[STUDENT-CINEMA] Screen share failed:', e);
      setIsStudentScreenSharing(false);
      showToast('Failed to share screen. Did you cancel the selection?', 'error');
    }
  };

  if (!room) return null;

  return (
    <div id="student-cinema-viewport" style={{ height: '100vh', width: '100vw', background: '#0a0a0c', color: '#fff', overflow: 'hidden', position: 'fixed', top: 0, left: 0, zIndex: 9999 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at center, #0f172a 0%, #000 100%)', zIndex: 1 }} />
      
      {/* CINEMATIC VIGNETTE */}
      <div style={{ 
        position: 'absolute', inset: 0, 
        background: 'radial-gradient(circle, transparent 20%, rgba(0,0,0,0.4) 100%)', 
        pointerEvents: 'none', zIndex: 5 
      }} />

      <div style={{ height: '100%', width: '100%', position: 'relative', display: 'flex', flexDirection: 'column', zIndex: 10 }}>
        
        {/* ENFORCED CINEMA FRAME (Adaptive Padding) */}
        <div style={{ flex: 1, padding: isFullscreen ? '0' : '40px 60px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.5s ease' }}>
          <div style={{ 
            width: '100%', 
            height: '100%', 
            maxWidth: isFullscreen ? '100vw' : '1600px',
            maxHeight: isFullscreen ? '100vh' : '85vh',
            background: '#000', 
            borderRadius: isFullscreen ? '0px' : '40px', 
            overflow: 'hidden', 
            position: 'relative',
            boxShadow: isFullscreen ? 'none' : '0 60px 120px -20px rgba(0,0,0,1)',
            border: isFullscreen ? 'none' : '2px solid rgba(99, 102, 241, 0.3)',
            transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
          }}>
            {teacher ? (
              <>
                <div style={{ display: isWhiteboardActive ? 'none' : 'block', width: '100%', height: '100%' }}>
                  <VideoTrack participant={teacher} mode="main" isFullscreen={isFullscreen} onFullscreenToggle={toggleFullscreen} visible={showControls} />
                </div>
                
                <StudentWhiteboard 
                  socket={socket}
                  roomName={room.name}
                  isInline={true}
                  onVisibilityChange={setIsWhiteboardActive}
                />
                
                {/* PREMIUM HUD: TOP BAR */}
                <div style={{ 
                  position: 'absolute', top: isFullscreen ? '40px' : '30px', 
                  left: isFullscreen ? '40px' : '30px', right: isFullscreen ? '40px' : '30px',
                  zIndex: 100, opacity: showControls ? 1 : 0, transition: 'all 0.5s ease',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <div style={{ 
                      background: 'rgba(239, 68, 68, 0.2)', 
                      border: '1px solid #ef4444',
                      padding: '6px 14px', borderRadius: '12px', 
                      display: 'flex', alignItems: 'center', gap: '8px',
                      boxShadow: '0 0 20px rgba(239,68,68,0.3)'
                    }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', animation: 'pulse 1.5s infinite' }} />
                      <span style={{ fontSize: '11px', fontWeight: '900', color: '#ef4444', fontFamily: 'var(--font-display)' }}>LIVE</span>
                    </div>
                    <span style={{ 
                      fontSize: '18px', fontWeight: '800', 
                      fontFamily: 'var(--font-display)',
                      textShadow: '0 2px 10px rgba(0,0,0,0.8)',
                      letterSpacing: '-0.5px'
                    }}>{lecture?.title || 'Academic Session'}</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '20px', background: 'rgba(0,0,0,0.4)', padding: '8px 20px', borderRadius: '20px', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'rgba(255,255,255,0.7)' }}>
                      <span style={{ fontSize: '13px', fontWeight: 'bold' }}>👤 {participantCount} Online</span>
                    </div>
                    <div style={{ width: '1px', height: '15px', background: 'rgba(255,255,255,0.2)' }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {[1, 2, 3, 4].map(i => (
                        <div key={i} style={{ 
                          width: '3px', height: `${i * 3}px`, 
                          background: i <= 3 ? '#10b981' : 'rgba(255,255,255,0.2)', 
                          borderRadius: '1px' 
                        }} />
                      ))}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0a0a0c' }}>
                <Loader2 className="animate-spin" size={60} color="#6366f1" />
                <h2 style={{ marginTop: '25px', fontSize: '22px', fontWeight: '900', color: '#6366f1' }}>WAITING FOR TEACHER</h2>
              </div>
            )}
          </div>
        </div>

        <div style={{ 
          position: 'absolute', bottom: '25px', left: '50%', transform: `translateX(-50%) translateY(${showControls ? '0' : '150%'}) scale(${dockScale})`,
          zIndex: 1000, transition: 'all 0.6s cubic-bezier(0.23, 1, 0.32, 1)',
          pointerEvents: showControls ? 'auto' : 'none'
        }}>
          <div className="premium-glass" style={{ 
            padding: '10px', 
            paddingRight: '30px',
            borderRadius: '35px', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '20px', 
          }}>
            {/* INTEGRATED SELF VIEW PREVIEW */}
            <div style={{
              width: '100px',
              height: '56px',
              background: '#000',
              borderRadius: '24px',
              overflow: 'hidden',
              border: `2px solid ${isCameraEnabled ? 'rgba(99, 102, 241, 0.6)' : 'rgba(255,255,255,0.1)'}`,
              position: 'relative',
              flexShrink: 0,
              animation: isCameraEnabled ? 'glow-pulse-primary 3s infinite' : 'none'
            }}>
              {isCameraEnabled ? (
                <VideoTrack participant={room.localParticipant} mode="preview" visible={true} />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1e293b' }}>
                  <VideoOff size={18} color="rgba(255,255,255,0.2)" />
                </div>
              )}
            </div>

             <div style={{ display: 'flex', gap: '15px' }}>
                <button onClick={toggleMic} style={{ 
                  width: '52px', height: '52px', borderRadius: '18px', 
                  background: isMicEnabled ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.05)', 
                  color: isMicEnabled ? '#10b981' : '#fff', 
                  border: isMicEnabled ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.1)', 
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  animation: isMicEnabled ? 'glow-pulse-success 2s infinite' : 'none',
                  transition: 'all 0.3s ease'
                }}>
                    {isMicEnabled ? <Mic size={24} /> : <MicOff size={24} />}
                </button>
                <button onClick={toggleCamera} style={{ 
                  width: '52px', height: '52px', borderRadius: '18px', 
                  background: isCameraEnabled ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255,255,255,0.05)', 
                  color: isCameraEnabled ? '#6366f1' : '#fff', 
                  border: isCameraEnabled ? '1px solid #6366f1' : '1px solid rgba(255,255,255,0.1)', 
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  animation: isCameraEnabled ? 'glow-pulse-primary 2s infinite' : 'none',
                  transition: 'all 0.3s ease'
                }}>
                    {isCameraEnabled ? <Video size={24} /> : <VideoOff size={24} />}
                </button>

                {/* MISSION 12: LOCAL RECORDING BUTTON (Always Visible) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <button 
                    onClick={() => {
                      if (!isRecordingAllowed && !isRecording) {
                        showToast('Teacher has disabled recording for this session.', 'error');
                        return;
                      }
                      isRecording ? stopRecording() : startRecording();
                    }}
                    style={{
                      width: '52px',
                      height: '52px',
                      borderRadius: '18px',
                      border: isRecording ? '2px solid #ef4444' : (isRecordingAllowed ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(239, 68, 68, 0.3)'),
                      background: isRecording ? 'rgba(239, 68, 68, 0.1)' : (isRecordingAllowed ? 'rgba(255,255,255,0.05)' : 'rgba(239, 68, 68, 0.1)'),
                      color: isRecording ? '#ef4444' : (isRecordingAllowed ? '#fff' : '#ef4444'),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: (isRecordingAllowed || isRecording) ? 'pointer' : 'not-allowed',
                      transition: 'all 0.3s ease',
                      opacity: (isRecordingAllowed || isRecording) ? 1 : 0.6
                    }}
                    title={isRecordingAllowed ? (isRecording ? 'Stop Recording' : 'Start Local Recording') : 'Recording Blocked by Teacher'}
                  >
                    {isRecording ? <StopCircle size={24} className="animate-pulse" /> : (isRecordingAllowed ? <Circle size={24} /> : <ShieldAlert size={24} />)}
                    {isRecording && <span style={{ fontSize: '10px', fontWeight: 'bold', marginLeft: '5px' }}>{formatDuration(duration)}</span>}
                  </button>

                  {isRecording && (
                    <button 
                      onClick={isPaused ? resumeRecording : pauseRecording}
                      style={{
                        width: '40px',
                        height: '52px',
                        borderRadius: '12px',
                        border: isPaused ? '2px solid #10b981' : '1px solid rgba(255,255,255,0.1)',
                        background: isPaused ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255,255,255,0.05)',
                        color: isPaused ? '#10b981' : '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer'
                      }}
                    >
                      {isPaused ? <Play size={18} fill="currentColor" /> : <Pause size={18} fill="currentColor" />}
                    </button>
                  )}
                </div>

                <button onClick={toggleQuality} style={{ width: '52px', height: '52px', borderRadius: '18px', background: currentQuality === VideoQuality.HIGH ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.1)', color: currentQuality === VideoQuality.HIGH ? '#10b981' : '#fff', border: currentQuality === VideoQuality.HIGH ? '1px solid #10b981' : 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <Gauge size={20} />
                    <span style={{ fontSize: '9px', fontWeight: 'bold' }}>{currentQuality === 0 ? '360' : (currentQuality === 1 ? '720' : 'MAX')}</span>
                </button>

                <button 
                  onClick={() => {
                    const nextState = !isHandRaised;
                    setIsHandRaised(nextState);
                    socket?.emit('participant:raise_hand', { 
                      roomName: room.name, 
                      identity: room.localParticipant.identity,
                      raised: nextState 
                    });
                    showToast(nextState ? 'You raised your hand!' : 'Hand lowered.', nextState ? 'success' : 'error');
                  }}
                  style={{ 
                    width: '52px', height: '52px', borderRadius: '18px', 
                    background: isHandRaised ? 'rgba(99, 102, 241, 0.3)' : 'rgba(255,255,255,0.05)', 
                    color: isHandRaised ? '#6366f1' : '#fff', 
                    border: isHandRaised ? '2px solid #6366f1' : '1px solid rgba(255,255,255,0.1)', 
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    animation: isHandRaised ? 'glow-pulse-primary 2s infinite' : 'none',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                  }}
                  title={isHandRaised ? 'Lower Hand' : 'Raise Hand'}
                >
                  <Hand size={24} className={isHandRaised ? 'animate-bounce' : ''} />
                </button>

                {/* SCREEN SHARE BUTTON (respects global & individual permission) */}
                <button 
                  onClick={toggleStudentScreenShare}
                  style={{ 
                    width: '52px', height: '52px', borderRadius: '18px', 
                    background: isStudentScreenSharing ? 'rgba(34, 197, 94, 0.3)' : (canShareScreen ? 'rgba(255,255,255,0.07)' : 'rgba(239, 68, 68, 0.1)'), 
                    color: isStudentScreenSharing ? '#22c55e' : (canShareScreen ? '#fff' : '#ef4444'), 
                    border: isStudentScreenSharing ? '2px solid #22c55e' : (canShareScreen ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(239, 68, 68, 0.3)'), 
                    cursor: canShareScreen ? 'pointer' : 'not-allowed', 
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    animation: isStudentScreenSharing ? 'glow-pulse-success 2s infinite' : 'none',
                    transition: 'all 0.3s ease',
                    opacity: canShareScreen ? 1 : 0.6
                  }}
                  title={!canShareScreen ? 'Screen share not permitted by teacher' : (isStudentScreenSharing ? 'Stop Screen Share' : 'Share Your Screen')}
                >
                  {canShareScreen ? <MonitorUp size={24} /> : <MonitorOff size={24} />}
                </button>

                <button 
                  onClick={toggleFullscreen}
                  style={{ 
                    width: '52px', height: '52px', borderRadius: '18px', 
                    background: isFullscreen ? 'rgba(99, 102, 241, 0.3)' : 'rgba(255,255,255,0.05)', 
                    color: '#fff', 
                    border: '1px solid rgba(255,255,255,0.1)', 
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.3s ease'
                  }}
                  title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
                >
                  {isFullscreen ? <Minimize2 size={24} /> : <Maximize2 size={24} />}
                </button>

                <button 
                  onClick={() => {
                    if (!isChatEnabled && !isChatOpen) {
                      showToast('Chat is currently disabled by teacher.', 'error');
                      return;
                    }
                    setIsChatOpen(!isChatOpen);
                    setHasNewPrivate(false);
                  }}
                  className={hasNewPrivate ? 'pulse-alert' : ''}
                  style={{ 
                    width: '52px', height: '52px', borderRadius: '18px', 
                    background: isChatOpen ? 'rgba(99, 102, 241, 0.3)' : (hasNewPrivate ? 'rgba(168, 85, 247, 0.4)' : (isChatEnabled ? 'rgba(255,255,255,0.05)' : 'rgba(239, 68, 68, 0.1)')), 
                    color: hasNewPrivate ? '#a855f7' : (isChatEnabled ? '#fff' : '#ef4444'), 
                    border: hasNewPrivate ? '2px solid #a855f7' : (isChatEnabled ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(239, 68, 68, 0.3)'), 
                    cursor: isChatEnabled ? 'pointer' : 'not-allowed', 
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.3s ease',
                    position: 'relative',
                    boxShadow: hasNewPrivate ? '0 0 20px rgba(168, 85, 247, 0.5)' : 'none',
                    opacity: isChatEnabled ? 1 : 0.6
                  }}
                  title={isChatEnabled ? "Toggle Chat" : "Chat Disabled"}
                >
                  {isChatEnabled ? <MessageSquare size={24} /> : <MessageSquareOff size={24} />}
                  {hasNewPrivate && (
                    <div style={{
                      position: 'absolute', top: '-5px', right: '-5px',
                      background: '#ef4444', color: '#fff', fontSize: '10px', fontWeight: 'bold',
                      width: '18px', height: '18px', borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: '2px solid #0a0a0c', boxShadow: '0 0 10px rgba(239, 68, 68, 0.5)'
                    }}>!</div>
                  )}
                </button>
             </div>
             <button onClick={onDisconnect} style={{ 
               width: '52px', height: '52px', borderRadius: '18px', 
               background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', 
               border: '2px solid #ef4444', cursor: 'pointer', 
               display: 'flex', alignItems: 'center', justifyContent: 'center',
               boxShadow: '0 0 20px rgba(239, 68, 68, 0.3)',
               transition: 'all 0.3s ease'
             }}>
                <LogOut size={24} />
             </button>
          </div>
        </div>

      </div>

      {/* MIC REQUEST MODAL (SOVEREIGN PRIVACY) */}
      {micRequest && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(2, 6, 23, 0.95)',
          backdropFilter: 'blur(20px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100000,
          animation: 'fadeIn 0.4s ease'
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
            padding: '40px',
            borderRadius: '32px',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
            textAlign: 'center',
            maxWidth: '450px',
            width: '90%'
          }}>
            <div style={{ 
              width: '80px', height: '80px', background: 'rgba(99, 102, 241, 0.1)', 
              borderRadius: '50%', display: 'flex', alignItems: 'center', 
              justifyContent: 'center', margin: '0 auto 25px',
              border: '2px solid #6366f1',
              boxShadow: '0 0 20px rgba(99, 102, 241, 0.2)'
            }}>
              <Mic size={40} color="#6366f1" />
            </div>
            <h2 style={{ color: '#fff', fontSize: '24px', fontWeight: '800', marginBottom: '15px' }}>Mic Request</h2>
            <p style={{ color: '#94a3b8', fontSize: '16px', lineHeight: '1.6', marginBottom: '30px' }}>
              The teacher would like you to unmute for a question or contribution. Do you agree?
            </p>
            <div style={{ display: 'flex', gap: '15px' }}>
              <button 
                onClick={() => setMicRequest(false)}
                style={{
                  flex: 1, padding: '15px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(255,255,255,0.05)', color: '#fff', fontWeight: 'bold', cursor: 'pointer'
                }}
              >
                Decline
              </button>
              <button 
                onClick={handleApproveMic}
                style={{
                  flex: 1, padding: '15px', borderRadius: '16px', border: 'none',
                  background: '#6366f1', color: '#fff', fontWeight: 'bold', cursor: 'pointer',
                  boxShadow: '0 10px 20px rgba(99, 102, 241, 0.3)'
                }}
              >
                Agree & Unmute
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SOVEREIGN TOAST NOTIFICATION */}
      {toast && (
        <div style={{
          position: 'fixed',
          bottom: '120px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: toast.type === 'error' ? 'rgba(239, 68, 68, 0.9)' : 'rgba(16, 185, 129, 0.9)',
          backdropFilter: 'blur(15px)',
          padding: '16px 32px',
          borderRadius: '20px',
          color: '#fff',
          fontWeight: 'bold',
          fontSize: '14px',
          zIndex: 9999,
          boxShadow: '0 20px 50px rgba(0,0,0,0.4)',
          border: '1px solid rgba(255,255,255,0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          animation: 'toastIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
        }}>
          {toast.msg}
        </div>
      )}

      {/* Whiteboard logic is now handled inline within the cinema area */}

      <StudentChat 
        socket={socket} 
        room={room} 
        isOpen={isChatOpen} 
        isChatEnabled={isChatEnabled}
        onClose={() => setIsChatOpen(false)} 
        onNewPrivate={() => {
          setHasNewPrivate(true);
          resetControlsTimer();
        }}
      />

      <style>{`
        @keyframes pulse-alert {
          0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); border-color: #ef4444; }
          25% { transform: scale(1.15); box-shadow: 0 0 40px 20px rgba(168, 85, 247, 0.4); border-color: #a855f7; }
          50% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); border-color: #ef4444; }
          75% { transform: scale(1.15); box-shadow: 0 0 40px 20px rgba(168, 85, 247, 0.4); border-color: #a855f7; }
          100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); border-color: #ef4444; }
        }
        @keyframes toastIn {
          from { transform: translate(-50%, 100%) scale(0.8); opacity: 0; }
          to { transform: translate(-50%, 0) scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
};
