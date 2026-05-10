import React from 'react';
import { Room, RemoteParticipant } from 'livekit-client';
import { Users } from 'lucide-react';
import { ParticipantGrid } from '../../ParticipantGrid';

interface DashboardGridProps {
  room: Room;
  participants: RemoteParticipant[];
  currentPage: number;
  pageSize: number;
  onKick: (identity: string) => void;
  onPageChange: (page: number) => void;
}

export const DashboardGrid: React.FC<DashboardGridProps> = ({ 
  room, 
  participants, 
  currentPage, 
  pageSize, 
  onKick, 
  onPageChange 
}) => {
  const totalPages = Math.ceil(participants.length / pageSize);
  const paginatedParticipants = participants.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div style={{ 
      flex: 1, 
      padding: '50px 10px 10px 10px', 
      overflow: 'hidden', 
      position: 'relative', 
      background: '#000',
      borderRadius: '32px',
      margin: '0 15px 15px 15px', // Removed top margin
      border: '1px solid rgba(255,255,255,0.05)',
      boxShadow: 'inset 0 0 50px rgba(0,0,0,0.5)'
    }}>
      <div style={{ width: '100%', height: '100%', display: 'flex' }}>
        <ParticipantGrid 
          participants={paginatedParticipants} 
          room={room} 
          onKick={onKick} 
        />
      </div>
      
      {/* PAGINATION OVERLAY */}
      {participants.length > pageSize && (
        <div style={{ 
          position: 'absolute', 
          top: '20px', 
          right: '40px', 
          display: 'flex', 
          gap: '10px', 
          alignItems: 'center', 
          background: 'rgba(15, 23, 42, 0.8)', 
          padding: '10px 20px', 
          borderRadius: '20px', 
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.1)',
          zIndex: 1000
        }}>
          <button 
            disabled={currentPage === 1}
            onClick={() => onPageChange(currentPage - 1)}
            style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', opacity: currentPage === 1 ? 0.3 : 1 }}
          >
            PREV
          </button>
          <span style={{ color: '#6366f1', fontWeight: '900', fontSize: '14px' }}>
            PAGE {currentPage} / {totalPages}
          </span>
          <button 
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(currentPage + 1)}
            style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', opacity: currentPage >= totalPages ? 0.3 : 1 }}
          >
            NEXT
          </button>
        </div>
      )}

      {participants.length === 0 && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: 0.3 }}>
          <Users size={64} color="#94a3b8" />
          <p style={{ color: '#94a3b8', marginTop: '20px', fontSize: '18px' }}>Waiting for Class Participants...</p>
        </div>
      )}
    </div>
  );
};
