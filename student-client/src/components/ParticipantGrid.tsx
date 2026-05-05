import React from 'react';
import { Participant, RemoteParticipant, Track } from 'livekit-client';
import { VideoTrack } from './VideoTrack';

interface ParticipantGridProps {
  participants: (Participant | RemoteParticipant)[];
  showUserTags?: boolean;
}

export const ParticipantGrid: React.FC<ParticipantGridProps> = ({
  participants,
}) => {
  // Dynamic sizing based on participant count for Wall View
  const getGridTemplate = () => {
    const count = participants.length;
    if (count <= 1) return '1fr';
    if (count <= 2) return 'repeat(2, 1fr)';
    if (count <= 4) return 'repeat(2, 1fr)';
    if (count <= 6) return 'repeat(3, 1fr)';
    if (count <= 9) return 'repeat(3, 1fr)';
    return 'repeat(auto-fit, minmax(300px, 1fr))';
  };

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: getGridTemplate(),
        gridAutoRows: '1fr',
        gap: '2px',
        width: '100%',
        height: '100%',
        backgroundColor: '#000',
        overflow: 'hidden',
      }}
    >
      {participants.map((participant) => {
        const videoTrack = (participant as any).getTrackPublication?.(Track.Source.Camera)?.videoTrack;
        return (
          <div key={participant.sid} style={{ position: 'relative', width: '100%', height: '100%' }}>
            <VideoTrack 
              track={videoTrack} 
              participant={participant} 
              mode="grid" 
            />
          </div>
        );
      })}
    </div>
  );
};
