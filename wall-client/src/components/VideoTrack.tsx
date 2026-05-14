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

export const VideoTrack: React.FC<VideoTrackProps> = ({ participant, room, mode = 'grid', track }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [hasVideo, setHasVideo] = useState(false);

  useEffect(() => {
    const videoEl = videoRef.current;
    const audioEl = audioRef.current;

    const attachTrack = (track: any) => {
      if (!track) return;
      console.log(`[VideoTrack] Attaching ${track.kind} for ${participant.identity}`);
      if (track.kind === Track.Kind.Video) {
        setHasVideo(true);
        if (videoEl) track.attach(videoEl);
      } else if (track.kind === Track.Kind.Audio && audioEl) {
        track.attach(audioEl);
      }
    };

    const detachTrack = (track: any) => {
      if (!track) return;
      if (track.kind === Track.Kind.Video && videoEl) {
        track.detach(videoEl);
      } else if (track.kind === Track.Kind.Audio && audioEl) {
        track.detach(audioEl);
      }
    };

    // 1. Initial Attachment
    let initialVideo = false;
    if (track && track.kind === Track.Kind.Video) {
      attachTrack(track);
      initialVideo = true;
    } else {
      participant.getTrackPublications().forEach(pub => {
        if (pub.track) attachTrack(pub.track);
        if (pub.kind === Track.Kind.Video && pub.track) initialVideo = true;
        // MISSION 22: Pre-emptive listener for late-subscription
        pub.on(Track.Event.Subscribed, attachTrack);
        pub.on(Track.Event.Unsubscribed, detachTrack);
      });
    }
    setHasVideo(initialVideo);

    // 2. Dynamic Handlers
    const handleSubscribed = (track: any) => {
      console.log(`[VideoTrack] Track Subscribed:`, track.kind);
      attachTrack(track);
    };

    const handleUnsubscribed = (track: any) => {
      console.log(`[VideoTrack] Track Unsubscribed:`, track.kind);
      detachTrack(track);
    };

    const handlePublished = (pub: any) => {
      console.log(`[VideoTrack] Track Published:`, pub.kind);
      if (pub.track) attachTrack(pub.track);
      // Ensure new publications are tracked
      pub.on(Track.Event.Subscribed, attachTrack);
      pub.on(Track.Event.Unsubscribed, detachTrack);
    };

    participant.on(Participant.Event.TrackSubscribed, handleSubscribed);
    participant.on(Participant.Event.TrackUnsubscribed, handleUnsubscribed);
    participant.on(Participant.Event.TrackPublished, handlePublished);
    
    // 3. NUCLEAR CLEANUP
    return () => {
      console.log(`[VideoTrack] Memory Cleanup for ${participant.identity}`);
      
      participant.off(Participant.Event.TrackSubscribed, handleSubscribed);
      participant.off(Participant.Event.TrackUnsubscribed, handleUnsubscribed);
      participant.off(Participant.Event.TrackPublished, handlePublished);

      participant.getTrackPublications().forEach(pub => {
        pub.off(Track.Event.Subscribed, attachTrack);
        pub.off(Track.Event.Unsubscribed, detachTrack);
        if (pub.track) detachTrack(pub.track);
      });

      if (track) detachTrack(track);
    };
  }, [participant, track]);

  return (
    <div style={{ width: '100%', height: '100%', background: '#000', position: 'relative', overflow: 'hidden' }}>
      <audio ref={audioRef} autoPlay muted={participant.isLocal} />
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        muted={true}
        data-local-video={participant.isLocal ? "true" : undefined}
        data-mixer-video="true"
        style={{ 
          width: '100%', 
          height: '100%', 
          objectFit: mode === 'pip' ? 'cover' : 'contain',
          zIndex: 2,
          position: 'relative'
        }} 
      />
      {/* MISSION 12: ELEGANT BACKGROUND FOR LETTERBOXING */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(circle at center, #1e293b 0%, #020617 100%)',
        zIndex: 1
      }} />

      {!hasVideo && (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(circle at center, #1e293b 0%, #020617 100%)', color: 'rgba(255,255,255,0.4)', position: 'absolute', top: 0, left: 0 }}>
          <div className="pulse-icon" style={{ width: mode === 'pip' ? '25px' : (mode === 'grid' ? '80px' : '60px'), height: mode === 'pip' ? '25px' : (mode === 'grid' ? '80px' : '60px'), borderRadius: '50%', background: 'rgba(255,255,255,0.02)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: mode === 'pip' ? '4px' : '15px', border: '2px solid rgba(255,255,255,0.05)', boxShadow: '0 0 30px rgba(0,0,0,0.5)' }}>
            <User size={mode === 'pip' ? 14 : (mode === 'grid' ? 40 : 30)} />
          </div>
          <span style={{ fontSize: mode === 'pip' ? '7px' : '11px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '3px', opacity: 0.6, color: '#94a3b8' }}>
            {participant.identity === room.localParticipant.identity ? 'ADMIN PREVIEW' : 'CAMERA OFF'}
          </span>
          <style>{`
            .pulse-icon { animation: pulse-glow 2s infinite ease-in-out; }
            @keyframes pulse-glow {
              0% { transform: scale(1); opacity: 0.8; box-shadow: 0 0 0px rgba(255,255,255,0); }
              50% { transform: scale(1.05); opacity: 1; box-shadow: 0 0 20px rgba(255,255,255,0.05); }
              100% { transform: scale(1); opacity: 0.8; box-shadow: 0 0 0px rgba(255,255,255,0); }
            }
          `}</style>
        </div>
      )}
    </div>
  );
};