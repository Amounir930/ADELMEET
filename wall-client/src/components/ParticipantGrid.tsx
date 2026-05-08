import React from 'react';
import { RemoteParticipant, Room } from 'livekit-client';
import { VideoTrack } from './VideoTrack';


interface ParticipantGridProps {
  participants: RemoteParticipant[];
  showUserTags?: boolean;
  onKick?: (identity: string) => void;
  room: Room;
}

/**
 * MISSION 12: SOVEREIGN GRID ORCHESTRATOR
 * Optimized to prevent distortion on wide displays.
 * Enforces cinematic aspect ratios.
 */
export const ParticipantGrid: React.FC<ParticipantGridProps> = ({ participants, room }) => {
  
  const getGridLayout = () => {
    const n = participants.length;
    if (n === 0) return { columns: '1fr', rows: '1fr' };
    
    const isPortrait = window.innerHeight > window.innerWidth;
    
    // Geometric optimization
    let cols = Math.ceil(Math.sqrt(n));
    if (isPortrait && n > 2) cols = Math.floor(Math.sqrt(n));
    const rows = Math.ceil(n / cols);
    
    return {
      columns: `repeat(${cols}, 1fr)`,
      rows: `repeat(${rows}, 1fr)`
    };
  };

  const layout = getGridLayout();

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: layout.columns,
      gridTemplateRows: layout.rows,
      gap: '15px',
      width: '100%',
      height: '100%',
      background: 'transparent',
      overflow: 'hidden',
      padding: '10px',
      placeItems: 'center'
    }}>
      {participants.map((p) => (
        <div key={p.identity} style={{ 
          position: 'relative', 
          overflow: 'hidden', 
          background: '#0a0a0c',
          borderRadius: '24px',
          border: '1px solid rgba(255,255,255,0.05)',
          boxShadow: '0 15px 35px rgba(0,0,0,0.5)',
          width: '100%',
          height: '100%',
          maxWidth: '100%',
          maxHeight: '100%',
          aspectRatio: '16 / 9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <VideoTrack participant={p} room={room} mode="grid" />
          
          {/* SOVEREIGN MINI-OVERLAY */}
          <div style={{ position: 'absolute', bottom: '15px', left: '15px', right: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
            <div style={{ background: 'rgba(15, 23, 42, 0.7)', padding: '6px 14px', borderRadius: '10px', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <span style={{ color: 'white', fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px' }}>{p.name || p.identity.split('_')[0]}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
