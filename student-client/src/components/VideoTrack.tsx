import React, { useEffect, useState, useRef } from 'react';
import { Track, Participant, ParticipantEvent } from 'livekit-client';
import { Maximize2, Minimize2, ZoomIn, ZoomOut } from 'lucide-react';

// MISSION 13: HARD REFRESH TIMESTAMP - 1777583231960_STABLE

interface VideoTrackProps {
  track?: any;
  participant?: Participant | null;
  mode?: 'main' | 'grid' | 'pip';
  isFullscreen?: boolean;
  onFullscreenToggle?: () => void;
  visible?: boolean;
}

/**
 * MISSION 10: STUDENT HIGH-FOCUS VIDEO (Lines 1935 - 2044)
 * - Cinema Logic: Focused Teacher View.
 * - Zoom Controls: Toggle Contain vs Cover.
 * - Fullscreen Integration.
 */
export const VideoTrack: React.FC<VideoTrackProps> = ({
  track,
  participant,
  mode = 'grid',
  isFullscreen = false,
  onFullscreenToggle,
  visible = true
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isZoomed, setIsZoomed] = useState(false); // Default to FALSE (Cover/Fill mode)
  const [resolvedVideoTrack, setResolvedVideoTrack] = useState<any>(null);
  const [resolvedAudioTrack, setResolvedAudioTrack] = useState<any>(null);

  // MISSION 11: FULL-MEDIA DISCOVERY ENGINE
  useEffect(() => {
    if (track) {
      if (track.kind === 'video') setResolvedVideoTrack(track.track || track);
      if (track.kind === 'audio') setResolvedAudioTrack(track.track || track);
      return;
    }
  }, [track]);

  useEffect(() => {
    if (!participant) return;

    const handleUpdate = () => {
      console.log(`[STUDENT-VIDEO-TRACK] Resolving Media for ${participant.identity} (Local: ${participant.isLocal})`);

      // MISSION 12: AGGRESSIVE TRACK DISCOVERY (LOCAL + REMOTE)
      const vTrack = participant.getTrackPublication(Track.Source.Camera)?.videoTrack ||
        participant.getTrackPublication(Track.Source.ScreenShare)?.videoTrack ||
        Array.from(participant.videoTrackPublications.values())[0]?.videoTrack;

      const aTrack = participant.getTrackPublication(Track.Source.Microphone)?.audioTrack ||
        Array.from(participant.audioTrackPublications.values())[0]?.audioTrack;

      if (vTrack && vTrack.sid !== (resolvedVideoTrack?.sid)) {
        console.log(`[STUDENT-VIDEO-TRACK] Found Video: ${vTrack.sid}`);
        setResolvedVideoTrack(vTrack);
      }
      if (aTrack && aTrack.sid !== (resolvedAudioTrack?.sid)) {
        setResolvedAudioTrack(aTrack);
      }
    };

    participant.on(ParticipantEvent.TrackPublished, handleUpdate);
    participant.on(ParticipantEvent.TrackUnpublished, handleUpdate);

    // MISSION 12: SOVEREIGN MEDIA SYNC ENGINE
    // Retries resolution for 10 seconds to catch delayed local tracks
    const syncInterval = setInterval(handleUpdate, 1000);
    setTimeout(() => clearInterval(syncInterval), 10000);

    handleUpdate();

    return () => {
      participant.off(ParticipantEvent.TrackSubscribed, handleUpdate);
      participant.off(ParticipantEvent.TrackUnsubscribed, handleUpdate);
      participant.off(ParticipantEvent.TrackPublished, handleUpdate);
      participant.off(ParticipantEvent.TrackUnpublished, handleUpdate);
      clearInterval(syncInterval);
    };
  }, [participant]);

  // MISSION 12: SOVEREIGN ATTACHMENT (CONSOLIDATED)
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !resolvedVideoTrack) return;
    
    // Avoid re-attaching if already attached to same track
    if ((el as any)._attachedTrackSid === resolvedVideoTrack.sid) return;

    console.log('[CINEMA-ENGINE] Binding Sovereign Track:', resolvedVideoTrack.sid);
    resolvedVideoTrack.attach(el);
    (el as any)._attachedTrackSid = resolvedVideoTrack.sid;
    
    el.play().catch(e => {
      // Mission 13: Silent expected errors to clean logs
      if (e.name !== 'AbortError' && e.name !== 'NotAllowedError') {
        console.warn('[VIDEO-ENGINE] Play failed:', e);
      }
    });

    return () => {
      resolvedVideoTrack.detach(el);
      (el as any)._attachedTrackSid = null;
    };
  }, [resolvedVideoTrack]);

  // Audio Engine remains on useEffect for background management
  useEffect(() => {
    const el = audioRef.current;
    if (resolvedAudioTrack && el) {
      resolvedAudioTrack.attach(el);
      return () => {
        resolvedAudioTrack.detach(el);
      };
    }
  }, [resolvedAudioTrack]);

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: '100%',
      background: '#000',
      overflow: 'hidden'
    }}>
      <audio ref={audioRef} autoPlay />
      {resolvedVideoTrack ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={mode === 'pip'}
          style={{
            width: '100%',
            height: '100%',
            objectFit: mode === 'main' ? 'contain' : 'cover',
            opacity: isFullscreen ? 1 : 0.9,
            transition: 'opacity 0.3s ease'
          }}
        />
      ) : (
        <div style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'radial-gradient(circle at center, #1e293b 0%, #020617 100%)',
          color: 'rgba(255,255,255,0.4)'
        }}>
           <div className="pulse-icon" style={{
            width: mode === 'pip' ? '25px' : (mode === 'grid' ? '80px' : '60px'),
            height: mode === 'pip' ? '25px' : (mode === 'grid' ? '80px' : '60px'),
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.02)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '15px',
            border: '2px solid rgba(255,255,255,0.05)'
          }}>
            <Maximize2 size={mode === 'pip' ? 14 : 30} style={{ opacity: 0.3 }} />
          </div>
          <span style={{ fontSize: '10px', fontWeight: '900', letterSpacing: '2px', opacity: 0.5 }}>
             CAMERA OFF
          </span>
          <style>{`
            .pulse-icon { animation: pulse-glow 2s infinite ease-in-out; }
            @keyframes pulse-glow {
              0% { transform: scale(1); opacity: 0.5; }
              50% { transform: scale(1.05); opacity: 0.8; }
              100% { transform: scale(1); opacity: 0.5; }
            }
          `}</style>
        </div>
      )}

      {/* Floating Director Controls */}
      {mode === 'main' && (
        <div style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          display: 'flex',
          gap: '10px',
          zIndex: 1000,
          opacity: visible ? 1 : 0,
          transform: `translateY(${visible ? '0' : '-10px'})`,
          transition: 'all 0.4s ease',
          pointerEvents: visible ? 'auto' : 'none'
        }}>
          <button
            onClick={() => setIsZoomed(!isZoomed)}
            style={{
              background: 'rgba(255,255,255,0.1)',
              backdropFilter: 'blur(10px)',
              border: 'none',
              color: '#fff',
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Toggle Zoom (Cover/Contain)"
          >
            {isZoomed ? <ZoomOut size={18} /> : <ZoomIn size={18} />}
          </button>

          <button
            onClick={onFullscreenToggle}
            style={{
              background: 'rgba(255,255,255,0.1)',
              backdropFilter: 'blur(10px)',
              border: 'none',
              color: '#fff',
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
        </div>
      )}

      {/* Participant Name Tag */}
      {mode !== 'pip' && (
        <div style={{
          position: 'absolute',
          bottom: '20px',
          left: '20px',
          padding: '8px 16px',
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(10px)',
          borderRadius: '12px',
          color: '#fff',
          fontSize: '12px',
          fontWeight: 'bold'
        }}>
          {participant?.name || participant?.identity || 'Teacher'}
        </div>
      )}
    </div>
  );
};
