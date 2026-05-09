import React, { useEffect, useRef } from 'react';
import { Participant, Track } from 'livekit-client';

interface ParticipantTileProps {
  participant: Participant;
}

export const ParticipantTile: React.FC<ParticipantTileProps> = ({ participant }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const attachTrack = (track: any) => {
      if (!track) return;
      console.log(`[Track] Attaching ${track.kind} for ${participant.identity}`);
      if (track.kind === Track.Kind.Video && videoRef.current) {
        track.attach(videoRef.current);
      } else if (track.kind === Track.Kind.Audio && audioRef.current) {
        track.attach(audioRef.current);
      }
    };

    // 1. Initial check for existing tracks
    participant.getTrackPublications().forEach(pub => {
      if (pub.track) attachTrack(pub.track);
    });

    // 2. Listen for future tracks
    const handleSubscribed = (track: any) => attachTrack(track);
    const handlePublished = (pub: any) => {
      if (pub.track) attachTrack(pub.track);
      pub.on('subscribed', attachTrack);
    };

    participant.on('trackSubscribed', handleSubscribed);
    participant.on('trackPublished', handlePublished);
    
    return () => {
      participant.off('trackSubscribed', handleSubscribed);
      participant.off('trackPublished', handlePublished);
      participant.getTrackPublications().forEach(pub => {
        if (pub.track) pub.track.detach();
      });
    };
  }, [participant]);

  return (
    <div className="glass" style={{ 
      position: 'relative', 
      overflow: 'hidden', 
      aspectRatio: '16/9',
      maxHeight: '70vh',
      background: '#000',
      border: '2px solid var(--accent-color)',
      boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
    }}>
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        muted={participant.isLocal}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
      />
      <audio ref={audioRef} autoPlay muted={participant.isLocal} />
      <div style={{ 
        position: 'absolute', 
        bottom: '12px', 
        left: '12px', 
        background: 'rgba(0,0,0,0.6)', 
        backdropFilter: 'blur(4px)',
        padding: '4px 12px', 
        borderRadius: '8px',
        fontSize: '12px',
        fontWeight: '500',
        color: 'white',
        border: '1px solid rgba(255,255,255,0.1)'
      }}>
        {participant.identity}
      </div>
    </div>
  );
};
