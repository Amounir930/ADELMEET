import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Track, Participant, Room } from 'livekit-client';
import { User } from 'lucide-react';
import io from 'socket.io-client';

interface VideoTrackProps {
  participant: Participant;
  room: Room;
  mode?: 'grid' | 'main' | 'pip';
  track?: any;
}

/**
 * MISSION 10: PROFESSIONAL VIDEO TILE
 * - Automatic Track Discovery.
 * - Real-time Name & Mic Status Overlay.
 * - Optimized for Grid View (object-fit: cover).
 */
export const VideoTrack: React.FC<VideoTrackProps> = ({ participant, room, mode = 'grid', track }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [videoTrack, setVideoTrack] = useState<any>(track || null);
  const [audioTrack, setAudioTrack] = useState<any>(null);
  const [isMicEnabled, setIsMicEnabled] = useState(participant.isMicrophoneEnabled);
  const [isMuted, setIsMuted] = useState(false);
  const [isKicked, setIsKicked] = useState(false);
  const [hasAudioPriority, setHasAudioPriority] = useState(false);

  // Update if manual track changes
  useEffect(() => {
    if (track) setVideoTrack(track);
  }, [track]);

  // MISSION 12: RESILIENT TRACK DISCOVERY
  const updateTracks = useCallback(() => {
    if (!participant) return;

    // Resolve Video (Sovereign Local/Remote Discovery)
    const vPub = participant.getTrackPublication(Track.Source.Camera) ||
                 participant.getTrackPublication(Track.Source.ScreenShare) ||
                 (participant.isLocal ? Array.from(participant.videoTrackPublications.values())[0] : null);
    
    const vTrack = vPub?.videoTrack || vPub?.track;
    
    if (vTrack && vTrack !== videoTrack) {
      console.log(`[MISSION-12] Video Resolved for ${participant.identity} (${participant.isLocal ? 'LOCAL' : 'REMOTE'})`);
      setVideoTrack(vTrack);
    }

    // Resolve Audio
    const aPub = participant.getTrackPublication(Track.Source.Microphone);
    const aTrack = aPub?.audioTrack || aPub?.track;
    
    if (aTrack && aTrack !== audioTrack) {
      setAudioTrack(aTrack);
    }

    setIsMicEnabled(participant.isMicrophoneEnabled);
  }, [participant, videoTrack, audioTrack]);

  useEffect(() => {
    if (!participant) return;

    const handleUpdate = () => {
      console.log(`[MISSION-12] Track Update for ${participant.identity}`);
      updateTracks();
    };

    participant.on('trackSubscribed' as any, handleUpdate);
    participant.on('trackUnsubscribed' as any, handleUpdate);
    participant.on('trackPublished' as any, handleUpdate);
    participant.on('trackUnpublished' as any, handleUpdate);
    participant.on('isMutedChanged' as any, handleUpdate);

    handleUpdate();

    return () => {
      participant.off('trackSubscribed' as any, handleUpdate);
      participant.off('trackUnsubscribed' as any, handleUpdate);
      participant.off('trackPublished' as any, handleUpdate);
      participant.off('trackUnpublished' as any, handleUpdate);
      participant.off('isMutedChanged' as any, handleUpdate);
    };
  }, [participant, updateTracks]);

  // 2. Attach Video Track (SOVEREIGN CONSOLIDATION)
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !videoTrack) return;
    
    const actualTrack = videoTrack.track || videoTrack;
    
    // Mission 13: Avoid redundant attachments to fix AbortError
    if ((el as any)._attachedTrackSid === actualTrack.sid) return;

    console.log('[TEACHER-ENGINE] Binding Sovereign Video Track:', actualTrack.sid);
    actualTrack.attach(el);
    (el as any)._attachedTrackSid = actualTrack.sid;

    el.play().catch(e => {
      // Mission 13: Silent expected errors to clean logs
      if (e.name !== 'AbortError' && e.name !== 'NotAllowedError') {
        console.warn('[TEACHER-ENGINE] Play failed:', e);
      }
    });

    return () => {
      actualTrack.detach(el);
      (el as any)._attachedTrackSid = null;
    };
  }, [videoTrack]);

  // 3. Attach Audio Track (High-Fidelity Sync)
  useEffect(() => {
    const el = audioRef.current;
    if (!el || !audioTrack) return;
    
    // Safety: Never play your own audio back to yourself (prevents feedback loops)
    if (room && participant.identity === room.localParticipant.identity) {
      el.muted = true;
      return;
    }

    const actualTrack = audioTrack.track || audioTrack;
    
    if (isMicEnabled) {
      console.log(`[AUDIO-ENGINE] Unmuting ${participant.identity}...`);
      actualTrack.attach(el);
      el.muted = false;
      el.volume = hasAudioPriority ? 1.0 : 0.5;
      el.play().catch(err => {
        if (err.name !== 'AbortError') console.warn('[AUDIO-ENGINE] Play blocked:', err);
      });
    } else {
      console.log(`[AUDIO-ENGINE] Muting ${participant.identity}`);
      actualTrack.detach(el);
      el.muted = true;
      el.pause();
    }

    return () => {
      actualTrack.detach(el);
    };
  }, [audioTrack, isMicEnabled, participant.identity, room?.localParticipant.identity, hasAudioPriority]);

  const handleMute = () => {
    setIsMuted(!isMuted);
    if (isMuted) {
      // Send request to backend to unmute participant
      fetch('/api/unmute-participant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          participantId: participant.identity,
        }),
      });
    } else {
      // Send request to backend to mute participant
      fetch('/api/mute-participant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          participantId: participant.identity,
        }),
      });
    }
  };

  const handleKick = () => {
    setIsKicked(true);
    // Send request to backend to kick participant
    fetch('/api/kick-participant', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        participantId: participant.identity,
      }),
    });
  };

  const handleGrantAudio = () => {
    setHasAudioPriority(!hasAudioPriority);
    if (hasAudioPriority) {
      // Send request to backend to revoke audio priority
      fetch('/api/revoke-audio-priority', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          participantId: participant.identity,
        }),
      });
    } else {
      // Send request to backend to grant audio priority
      fetch('/api/grant-audio-priority', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          participantId: participant.identity,
        }),
      });
    }
  };

  const socket = io();

  useEffect(() => {
    socket.on('participant-updated', (data) => {
      if (data.participantId === participant.identity) {
        updateTracks();
      }
    });
  }, [socket, participant.identity, updateTracks]);

  return (
    <div style={{
      width: '100%',
      height: '100%',
      background: '#000',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <audio ref={audioRef} autoPlay />
      {videoTrack ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={true} // Teacher preview is always muted locally
          style={{
            width: '100%',
            height: '100%',
            objectFit: mode === 'main' ? 'contain' : 'cover'
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
          color: 'rgba(255,255,255,0.4)',
          position: 'relative'
        }}>
          <div className="pulse-icon" style={{
            width: mode === 'pip' ? '25px' : (mode === 'grid' ? '80px' : '60px'),
            height: mode === 'pip' ? '25px' : (mode === 'grid' ? '80px' : '60px'),
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.02)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: mode === 'pip' ? '4px' : '15px',
            border: '2px solid rgba(255,255,255,0.05)',
            boxShadow: '0 0 30px rgba(0,0,0,0.5)'
          }}>
            <User size={mode === 'pip' ? 14 : (mode === 'grid' ? 40 : 30)} />
          </div>
          <span style={{ 
            fontSize: mode === 'pip' ? '7px' : '11px', 
            fontWeight: '900', 
            textTransform: 'uppercase', 
            letterSpacing: '3px', 
            opacity: 0.6,
            color: '#94a3b8'
          }}>
            {participant.identity === room.localParticipant.identity ? 'ADMIN PREVIEW' : 'CAMERA OFF'}
          </span>
          <style>{`
            .pulse-icon {
              animation: pulse-glow 2s infinite ease-in-out;
            }
            @keyframes pulse-glow {
              0% { transform: scale(1); opacity: 0.8; box-shadow: 0 0 0px rgba(255,255,255,0); }
              50% { transform: scale(1.05); opacity: 1; box-shadow: 0 0 20px rgba(255,255,255,0.05); }
              100% { transform: scale(1); opacity: 0.8; box-shadow: 0 0 0px rgba(255,255,255,0); }
            }
          `}</style>
        </div>
      )}
      <div style={{
        position: 'absolute',
        top: '10px',
        right: '10px',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <button onClick={handleMute} style={{
          backgroundColor: isMuted ? '#ccc' : '#4CAF50',
          color: '#fff',
          padding: '10px',
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer',
        }}>
          {isMuted ? 'Unmute' : 'Mute'}
        </button>
        <button onClick={handleKick} style={{
          backgroundColor: '#f44336',
          color: '#fff',
          padding: '10px',
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer',
          marginTop: '10px',
        }}>
          Kick
        </button>
        <button onClick={handleGrantAudio} style={{
          backgroundColor: hasAudioPriority ? '#ccc' : '#4CAF50',
          color: '#fff',
          padding: '10px',
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer',
          marginTop: '10px',
        }}>
          {hasAudioPriority ? 'Revoke Audio Priority' : 'Grant Audio Priority'}
        </button>
      </div>
    </div>
  );
};