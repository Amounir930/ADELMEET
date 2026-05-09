import React, { useState } from 'react';
import { Room, Track, RemoteParticipant } from 'livekit-client';
import { Mic, MicOff, Video, VideoOff, ShieldCheck, ShieldAlert, Search, ChevronLeft, ChevronRight, Hand, XSquare, PlusSquare } from 'lucide-react';
import { Socket } from 'socket.io-client';

interface DashboardSidebarProps {
  room: Room;
  socket: Socket | null;
  isSidebarOpen: boolean;
  participantCount: number;
  isRecordingAllowed: boolean;
  searchQuery: string;
  allTimeParticipants: any[];
  raisedHands: Set<string>;
  onToggleSidebar: () => void;
  onToggleMuteAll: () => void;
  onToggleLockAll: () => void;
  onToggleRecordingPermission: () => void;
  onSearchChange: (query: string) => void;
  onMuteStudent: (identity: string) => void;
  onLockCamera: (identity: string) => void;
  onGrantAudio: (identity: string) => void;
  onKick: (identity: string) => void;
  onLowerHand: (identity: string) => void;
}

export const DashboardSidebar: React.FC<DashboardSidebarProps> = ({
  room,
  socket,
  isSidebarOpen,
  participantCount,
  isRecordingAllowed,
  searchQuery,
  allTimeParticipants,
  raisedHands,
  onToggleSidebar,
  onToggleMuteAll,
  onToggleLockAll,
  onToggleRecordingPermission,
  onSearchChange,
  onMuteStudent,
  onLockCamera,
  onGrantAudio,
  onKick,
  onLowerHand
}) => {
  const [muteStatus, setMuteStatus] = useState<'idle' | 'sending'>('idle');
  const [lockStatus, setLockStatus] = useState<'idle' | 'sending'>('idle');
  const [recStatus, setRecStatus] = useState<'idle' | 'sending'>('idle');

  return (
    <div style={{ 
      flex: 1,
      padding: '25px', 
      display: 'flex', 
      flexDirection: 'column',
      opacity: isSidebarOpen ? 1 : 0,
      visibility: isSidebarOpen ? 'visible' : 'hidden',
      transition: 'all 0.3s ease',
      minWidth: '320px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ color: '#fff', fontSize: '20px', fontWeight: '900', letterSpacing: '1px', margin: 0 }}>PARTICIPANTS</h2>
        <span style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' }}>
          {participantCount} ONLINE
        </span>
      </div>

      {/* MISSION 14: GLOBAL COMMAND HUB */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(3, 1fr)', 
        gap: '10px', 
        marginBottom: '20px',
        padding: '15px',
        background: 'rgba(15, 23, 42, 0.4)',
        borderRadius: '20px',
        border: '1px solid rgba(255,255,255,0.05)'
      }}>
        <button 
          onClick={() => {
            setMuteStatus('sending');
            onToggleMuteAll();
            setTimeout(() => setMuteStatus('idle'), 2000);
          }}
          style={{ 
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '12px',
            background: muteStatus === 'sending' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.1)',
            color: muteStatus === 'sending' ? '#10b981' : '#ef4444',
            border: `1px solid ${muteStatus === 'sending' ? '#10b981' : 'rgba(239, 68, 68, 0.2)'}`,
            borderRadius: '15px', cursor: 'pointer', transition: 'all 0.3s ease',
            transform: muteStatus === 'sending' ? 'scale(0.95)' : 'scale(1)'
          }}
        >
          <MicOff size={20} />
          <span style={{ fontSize: '10px', fontWeight: '900' }}>{muteStatus === 'sending' ? 'SENT!' : 'MUTE ALL'}</span>
        </button>

        <button 
          onClick={() => {
            setLockStatus('sending');
            onToggleLockAll();
            setTimeout(() => setLockStatus('idle'), 2000);
          }}
          style={{ 
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '12px',
            background: lockStatus === 'sending' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.1)',
            color: lockStatus === 'sending' ? '#10b981' : '#ef4444',
            border: `1px solid ${lockStatus === 'sending' ? '#10b981' : 'rgba(239, 68, 68, 0.2)'}`,
            borderRadius: '15px', cursor: 'pointer', transition: 'all 0.3s ease',
            transform: lockStatus === 'sending' ? 'scale(0.95)' : 'scale(1)'
          }}
        >
          <VideoOff size={20} />
          <span style={{ fontSize: '10px', fontWeight: '900' }}>{lockStatus === 'sending' ? 'SENT!' : 'LOCK ALL'}</span>
        </button>

        <button 
          onClick={() => {
            setRecStatus('sending');
            onToggleRecordingPermission();
            setTimeout(() => setRecStatus('idle'), 2000);
          }}
          style={{ 
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '12px',
            background: recStatus === 'sending' ? 'rgba(16, 185, 129, 0.2)' : (isRecordingAllowed ? 'rgba(34, 197, 94, 0.1)' : 'rgba(255, 255, 255, 0.05)'),
            color: recStatus === 'sending' ? '#10b981' : (isRecordingAllowed ? '#22c55e' : '#94a3b8'),
            border: `1px solid ${recStatus === 'sending' ? '#10b981' : (isRecordingAllowed ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255,255,255,0.1)')}`,
            borderRadius: '15px', cursor: 'pointer', transition: 'all 0.3s ease',
            transform: recStatus === 'sending' ? 'scale(0.95)' : 'scale(1)'
          }}
        >
          {recStatus === 'sending' ? <ShieldCheck size={20} /> : (isRecordingAllowed ? <ShieldCheck size={20} /> : <ShieldAlert size={20} />)}
          <span style={{ fontSize: '10px', fontWeight: '900' }}>{recStatus === 'sending' ? 'UPDATED!' : (isRecordingAllowed ? 'STU-REC: ON' : 'STU-REC: OFF')}</span>
        </button>
      </div>
      
      <div style={{ position: 'relative', marginBottom: '20px' }}>
        <Search style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', color: '#6366f1' }} size={16} />
        <input 
          type="text" 
          placeholder="Search students..." 
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '12px 12px 12px 40px', color: '#fff', outline: 'none', fontSize: '13px' }} 
        />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {allTimeParticipants
          .sort((a, b) => {
            // SMART SORT: Hand Raised students always at the top
            const aRaised = raisedHands.has(a.identity);
            const bRaised = raisedHands.has(b.identity);
            if (aRaised && !bRaised) return -1;
            if (!aRaised && bRaised) return 1;
            return 0;
          })
          .filter(p => p.identity.toLowerCase().includes(searchQuery.toLowerCase()) || (p.name && p.name.toLowerCase().includes(searchQuery.toLowerCase())))
          .map(pData => {
            const p = room.remoteParticipants.get(pData.identity);
            const isOnline = !!p;
            const hasHandRaised = raisedHands.has(pData.identity);
            
            const micPub = p?.getTrackPublication(Track.Source.Microphone);
            const camPub = p?.getTrackPublication(Track.Source.Camera);
            
            const isMicMuted = micPub?.isMuted ?? true;
            const isCamMuted = camPub?.isMuted ?? true;

            return (
              <div 
                key={pData.identity} 
                style={{ 
                  background: hasHandRaised ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255,255,255,0.03)', 
                  padding: '12px', 
                  borderRadius: '20px', 
                  border: hasHandRaised ? '2px solid #6366f1' : '1px solid rgba(255,255,255,0.05)', 
                  opacity: isOnline ? 1 : 0.6,
                  boxShadow: hasHandRaised ? '0 0 20px rgba(99, 102, 241, 0.4)' : 'none',
                  transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                  animation: hasHandRaised ? 'pulse-border 2s infinite' : 'none'
                }}
              >
                <style>{`
                  @keyframes pulse-border {
                    0% { border-color: #6366f1; box-shadow: 0 0 10px rgba(99, 102, 241, 0.2); }
                    50% { border-color: #818cf8; box-shadow: 0 0 25px rgba(99, 102, 241, 0.6); }
                    100% { border-color: #6366f1; box-shadow: 0 0 10px rgba(99, 102, 241, 0.2); }
                  }
                `}</style>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <div style={{ width: '8px', height: '8px', background: isOnline ? '#10b981' : '#ef4444', borderRadius: '50%', boxShadow: isOnline ? '0 0 10px #10b981' : 'none' }}></div>
                    <span style={{ color: '#fff', fontSize: '13px', fontWeight: '900', letterSpacing: '0.5px' }}>
                      {pData.name || pData.identity.split('_student')[0]}
                    </span>
                  </div>
                  
                  {hasHandRaised && (
                    <button 
                      onClick={() => onLowerHand(pData.identity)}
                      style={{ 
                        background: '#6366f1', color: '#fff', padding: '4px 8px', borderRadius: '8px', 
                        display: 'flex', alignItems: 'center', gap: '4px', animation: 'bounce 1s infinite',
                        border: 'none', cursor: 'pointer', boxShadow: '0 0 10px rgba(99, 102, 241, 0.5)'
                      }}
                      title="Click to Acknowledge & Lower Hand"
                    >
                      <Hand size={12} fill="#fff" />
                      <span style={{ fontSize: '9px', fontWeight: 'bold' }}>WAITING</span>
                    </button>
                  )}
                </div>

                {isOnline ? (
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {/* MIC STATUS & CONTROL */}
                    <button 
                      onClick={() => {
                        if (!isMicMuted) {
                          onMuteStudent(pData.identity);
                        }
                      }}
                      style={{ 
                        width: '38px', height: '38px', borderRadius: '12px', 
                        background: isMicMuted ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)', 
                        color: isMicMuted ? '#ef4444' : '#10b981', 
                        border: isMicMuted ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid rgba(16, 185, 129, 0.2)', 
                        cursor: isMicMuted ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.3s ease',
                        opacity: isMicMuted ? 0.6 : 1
                      }}
                      title={isMicMuted ? "Privacy: You cannot force-open mic" : "Mute Student"}
                    >
                      {isMicMuted ? <MicOff size={16} /> : <Mic size={16} />}
                    </button>

                    {/* CAMERA STATUS & CONTROL */}
                    <button 
                      onClick={() => {
                        if (!isCamMuted) {
                           onLockCamera(pData.identity);
                        }
                      }}
                      style={{ 
                        width: '38px', height: '38px', borderRadius: '12px', 
                        background: isCamMuted ? 'rgba(239, 68, 68, 0.1)' : 'rgba(99, 102, 241, 0.1)', 
                        color: isCamMuted ? '#ef4444' : '#6366f1', 
                        border: isCamMuted ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid rgba(99, 102, 241, 0.2)', 
                        cursor: isCamMuted ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.3s ease',
                        opacity: isCamMuted ? 0.6 : 1
                      }}
                      title={isCamMuted ? "Privacy: You cannot force-open camera" : "Lock Camera"}
                    >
                      {isCamMuted ? <VideoOff size={16} /> : <Video size={16} />}
                    </button>

                    <div style={{ flex: 1 }} />

                    {/* ACTIONS */}
                    <button 
                      onClick={() => onKick(pData.identity)}
                      style={{ 
                        width: '38px', height: '38px', borderRadius: '12px', 
                        background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', 
                        border: '1px solid rgba(239, 68, 68, 0.2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' 
                      }}
                      title="Ban Student"
                    >
                      <XSquare size={16} />
                    </button>
                  </div>
                ) : (
                  <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'bold', letterSpacing: '1px' }}>OFFLINE</div>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
};
