import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Room, RemoteParticipant, VideoQuality, RoomEvent, Track } from 'livekit-client';
import { VideoTrack } from './VideoTrack';
import { Mic, MicOff, Video, VideoOff, Loader2, LogOut, Gauge, Circle, StopCircle, Pause, Play, Hand, Maximize2, Minimize2 } from 'lucide-react';
import { useLocalRecorder } from '../hooks/useLocalRecorder';
import { useLiveKit } from '../contexts/LiveKitContext';
import { useStudentModeration } from '../hooks/useStudentModeration';

interface StudentCinemaProps {
  room: Room;
  lecture: any;
  onDisconnect: () => void;
}

export const StudentCinema: React.FC<StudentCinemaProps> = ({ room, lecture, onDisconnect }) => {
  const { socket, isRecordingAllowed } = useLiveKit();
  const [teacher, setTeacher] = useState<RemoteParticipant | null>(null);
  const [isMicEnabled, setIsMicEnabled] = useState(false);
  const [isCameraEnabled, setIsCameraEnabled] = useState(false);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [currentQuality, setCurrentQuality] = useState<VideoQuality>(VideoQuality.HIGH);
  const [micRequest, setMicRequest] = useState(false);
  const { isRecording, isPaused, duration, startRecording, stopRecording, pauseRecording, resumeRecording } = useLocalRecorder(room);
  const [participantCount, setParticipantCount] = useState(room.remoteParticipants.size + 1);
  
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
    if (!room || !socket || !room.localParticipant) return;
    socket.emit('join_room', { roomName: room.name, identity: room.localParticipant.identity, role: 'student' });

    // MISSION 13: SOVEREIGN ENFORCEMENT - Auto-kick on session end
    socket.on('session_ended', () => {
      console.log('[STUDENT-CINEMA] Sovereign Command: Session Ended by Teacher');
      showToast('The teacher has ended this session. Redirecting...', 'success');
      setTimeout(() => onDisconnect(), 2000);
    });

    return () => {
      socket.off('session_ended');
    };
  }, [room.name, socket]);

  useEffect(() => {
    if (!isRecordingAllowed && isRecording) {
      stopRecording();
      showToast('Teacher revoked recording permission.', 'error');
    }
  }, [isRecordingAllowed, isRecording, stopRecording]);

  useEffect(() => {
    if (!room) return;
    
    const discover = () => {
      const participants = Array.from(room.remoteParticipants.values());
      const teacherPart = participants.find(p => p.identity.toLowerCase().includes('teacher') || p.identity.endsWith('_teacher'));
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
        const isTeacher = p.identity.toLowerCase().includes('teacher') || p.identity.endsWith('_teacher');
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

          // RULE 2: Dynamic Q&A - Subscribe to Audio of active speakers (students)
          if (pub.kind === Track.Kind.Audio && isActiveSpeaker) {
            if (!pub.isSubscribed) {
              console.log(`[STUDENT-SYNC] Subscribing to Active Speaker Audio: ${p.identity}`);
              pub.setSubscribed(true);
            }
          } 
          // RULE 3: Unsubscribe from everyone else to save bandwidth
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
      setParticipantCount(room.remoteParticipants.size + 1);
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
    if (teacher) controlsTimerRef.current = setTimeout(() => setShowControls(false), 4000);
  }, [teacher]);

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
    });

    socket.on('teacher:lower_hand', (data: any) => {
      if (data.targetIdentity === room.localParticipant.identity || data.targetIdentity === 'all') {
        console.log('[STUDENT-HAND] Teacher lowered your hand.');
        setIsHandRaised(false);
        showToast('Teacher acknowledged your hand.', 'success');
      }
    });

    return () => {
      socket.off('request_unmute');
      socket.off('teacher:lower_hand');
    };
  }, [socket, room.localParticipant.identity]);

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
                <VideoTrack participant={teacher} mode="main" isFullscreen={isFullscreen} onFullscreenToggle={toggleFullscreen} visible={showControls} />
                
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
          position: 'absolute', bottom: isFullscreen ? '60px' : '40px', left: '50%', transform: `translateX(-50%) translateY(${showControls ? '0' : '40px'})`, 
          opacity: showControls ? 1 : 0, transition: 'all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)', zIndex: 1000,
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
                        showToast('Teacher has not enabled recording for students yet.', 'error');
                        return;
                      }
                      isRecording ? stopRecording() : startRecording();
                    }}
                    style={{
                      width: '52px',
                      height: '52px',
                      borderRadius: '18px',
                      border: isRecording ? '2px solid #ef4444' : (isRecordingAllowed ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(255,255,255,0.05)'),
                      background: isRecording ? 'rgba(239, 68, 68, 0.1)' : (isRecordingAllowed ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)'),
                      color: isRecording ? '#ef4444' : (isRecordingAllowed ? '#fff' : '#4b5563'),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: (isRecordingAllowed || isRecording) ? 'pointer' : 'not-allowed',
                      transition: 'all 0.3s ease',
                      opacity: (isRecordingAllowed || isRecording) ? 1 : 0.6
                    }}
                    title={isRecordingAllowed ? (isRecording ? 'Stop Recording' : 'Start Local Recording') : 'Recording Disabled by Teacher'}
                  >
                    {isRecording ? <StopCircle size={24} className="animate-pulse" /> : <Circle size={24} />}
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

      <style>{`
        @keyframes toastIn {
          from { transform: translate(-50%, 100%) scale(0.8); opacity: 0; }
          to { transform: translate(-50%, 0) scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
};
