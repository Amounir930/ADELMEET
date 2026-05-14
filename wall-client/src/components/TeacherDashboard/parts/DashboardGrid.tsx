import React from 'react';
import { Room, RemoteParticipant } from 'livekit-client';
import { Users } from 'lucide-react';
import { ParticipantGrid } from '../../ParticipantGrid';
import { ParticipantTile } from '../../ParticipantTile';

interface DashboardGridProps {
  room: Room;
  participants: RemoteParticipant[];
  currentPage: number;
  pageSize: number;
  onKick: (identity: string) => void;
  onPageChange: (page: number) => void;
  featuredStudent?: string;
  featuredDestination?: 'wall' | 'dashboard' | 'none';
  hasExternalScreen?: boolean;
  isFullscreen?: boolean;
}

export const DashboardGrid: React.FC<DashboardGridProps> = ({ 
  room, 
  participants, 
  currentPage, 
  pageSize, 
  onKick, 
  onPageChange,
  featuredStudent,
  featuredDestination,
  hasExternalScreen = false,
  isFullscreen = false
}) => {
  // If we have an external screen, we hide the grid entirely. The only thing that shows is a featured student if pulled to dashboard.
  const featuredList = featuredStudent ? featuredStudent.split(',').filter(Boolean) : [];
  
  const filteredForGrid = hasExternalScreen 
    ? [] 
    : participants.filter(p => !(featuredDestination === 'wall' && featuredList.includes(p.identity)));
    
  const totalPages = Math.ceil(filteredForGrid.length / pageSize);
  const paginatedParticipants = filteredForGrid.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const featuredParticipants = participants.filter(p => featuredList.includes(p.identity));
  const isFeaturedOnDashboard = featuredDestination === 'dashboard' && featuredParticipants.length > 0;

  return (
    <div style={{ 
      flex: 1, 
      padding: isFullscreen ? '0' : '20px 10px 10px 10px', 
      overflow: 'hidden', 
      position: 'relative', 
      background: 'transparent',
      borderRadius: isFullscreen ? '0' : '32px',
      margin: isFullscreen ? '0' : '0 15px 15px 15px',
      border: isFullscreen ? 'none' : '1px solid rgba(255,255,255,0.03)',
    }}>
      <div style={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        {isFeaturedOnDashboard ? (
          <div style={{ 
            width: '100%', height: '100%', maxWidth: isFullscreen ? 'none' : '1200px', 
            borderRadius: isFullscreen ? '0' : '24px', overflow: 'hidden', border: isFullscreen ? 'none' : '2px solid rgba(99, 102, 241, 0.5)',
            boxShadow: isFullscreen ? 'none' : '0 0 40px rgba(99, 102, 241, 0.3)',
            animation: 'fadeIn 0.5s ease-out',
            display: 'grid',
            gridTemplateColumns: `repeat(${Math.ceil(Math.sqrt(featuredParticipants.length))}, 1fr)`,
            gap: isFullscreen ? '0' : '10px'
          }}>
            {featuredParticipants.map(fp => (
              <div key={fp.identity} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', borderRadius: '16px' }}>
                <ParticipantTile 
                  participant={fp} 
                  isFeatured={true}
                  room={room} 
                  onKick={onKick}
                  showStats={true}
                />
              </div>
            ))}
          </div>
        ) : hasExternalScreen ? (
          // MISSION 12: RESOURCE OFFLOADING UI
          // When wall displays are active, we show this to let teacher know 
          // that bandwidth is being saved and monitoring is on the wall.
          <div style={{ textAlign: 'center', animation: 'fadeIn 0.8s ease-out' }}>
            <div style={{ 
              width: 100, height: 100, borderRadius: '35px', background: 'rgba(99,102,241,0.05)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px',
              border: '1px solid rgba(99,102,241,0.2)'
            }}>
               <Users size={50} color="#6366f1" className="animate-pulse" />
            </div>
            <h3 style={{ fontSize: 20, fontWeight: 900, color: '#fff', letterSpacing: '2px' }}>WALL DISPLAYS ACTIVE</h3>
          </div>

        ) : (
          <ParticipantGrid 
            participants={paginatedParticipants} 
            room={room} 
            onKick={onKick} 
          />
        )}
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.98); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
      
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

      {!hasExternalScreen && participants.length === 0 && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: 0.3 }}>
          <Users size={64} color="#94a3b8" />
          <p style={{ color: '#94a3b8', marginTop: '20px', fontSize: '18px' }}>Waiting for Class Participants...</p>
        </div>
      )}

    </div>
  );
};
