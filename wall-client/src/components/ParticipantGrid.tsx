import React from 'react';
import { RemoteParticipant } from 'livekit-client';
import { VideoTrack } from './VideoTrack';

interface ParticipantGridProps {
  participants: RemoteParticipant[];
  showUserTags?: boolean;
}

import { useSocket } from '../contexts/SocketContext';
import { Mic, MicOff, UserMinus } from 'lucide-react';

interface ParticipantGridProps {
  participants: RemoteParticipant[];
  showUserTags?: boolean;
  onKick?: (identity: string) => void;
  room: any;
}

export const ParticipantGrid: React.FC<ParticipantGridProps> = ({ participants, room, onKick }) => {
  const { socket } = useSocket();
  
  const getGridLayout = () => {
    const n = participants.length;
    if (n <= 1) return { columns: '1fr', rows: '1fr' };
    
    const isPortrait = window.innerHeight > window.innerWidth;
    
    if (n === 2) {
      return isPortrait 
        ? { columns: '1fr', rows: '1fr 1fr' } 
        : { columns: '1fr 1fr', rows: '1fr' };
    }
    
    // Geometric optimization for N > 2
    let cols = Math.ceil(Math.sqrt(n));
    if (isPortrait && n > 2) cols = Math.floor(Math.sqrt(n)); // Prioritize rows in portrait
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
      gap: '2px',
      width: '100%',
      height: '100%',
      background: '#000',
      overflow: 'hidden'
    }}>
      {participants.map((p) => (
        <div key={p.identity} style={{ 
          position: 'relative', 
          overflow: 'hidden', 
          background: '#0f172a',
          border: '1px solid rgba(255,255,255,0.03)'
        }}>
          <VideoTrack participant={p} room={room} mode="grid" />
          
          {/* SOVEREIGN MINI-OVERLAY */}
          <div style={{ position: 'absolute', bottom: '10px', left: '10px', right: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
            <div style={{ background: 'rgba(0,0,0,0.5)', padding: '4px 10px', borderRadius: '8px', backdropFilter: 'blur(5px)' }}>
              <span style={{ color: 'white', fontSize: '10px', fontWeight: 'bold' }}>{p.name || p.identity.split('_')[0]}</span>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => {
                  const isMuted = !p.isMicrophoneEnabled;
                  socket?.emit(isMuted ? 'teacher:force_unmute' : 'teacher:force_mute', { roomName: room.name, targetIdentity: p.identity });
                }}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: p.isMicrophoneEnabled ? '#22c55e' : '#ef4444',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
                  transition: 'all 0.2s ease'
                }}
              >
                {p.isMicrophoneEnabled ? <Mic size={14} /> : <MicOff size={14} />}
              </button>

              <button
                onClick={() => onKick?.(p.identity)}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: 'rgba(239, 68, 68, 0.2)',
                  color: '#ef4444',
                  border: '1px solid #ef4444',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 10px rgba(239, 68, 68, 0.1)',
                  transition: 'all 0.2s ease'
                }}
                title="Kick & Ban Student"
              >
                <UserMinus size={14} />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
