import React from 'react';
import { Users, Activity } from 'lucide-react';

interface DashboardHUDProps {
  connected: boolean;
  participantCount: number;
  roomName: string;
  showControls: boolean;
}

export const DashboardHUD: React.FC<DashboardHUDProps> = ({ connected, participantCount, roomName, showControls }) => {
  return (
    <div style={{ 
      position: 'absolute', 
      top: 0, 
      left: '50%', 
      transform: `translateX(-50%) translateY(${showControls ? '0' : '-100%'})`,
      display: 'flex', 
      alignItems: 'center',
      gap: '20px', 
      zIndex: 1000, 
      pointerEvents: 'none',
      background: 'rgba(15, 23, 42, 0.85)',
      backdropFilter: 'blur(30px)',
      padding: '8px 25px',
      borderRadius: '0 0 24px 24px',
      border: '1px solid rgba(255,255,255,0.08)',
      borderTop: 'none',
      boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
      transition: 'all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
      opacity: showControls ? 1 : 0
    }}>
      {/* SYNC STATUS */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', pointerEvents: 'all' }}>
        <div style={{ 
          width: '8px', height: '8px', 
          background: connected ? '#10b981' : '#6366f1', 
          borderRadius: '50%', 
          boxShadow: connected ? '0 0 12px #10b981' : '0 0 12px #6366f1',
          animation: connected ? 'none' : 'pulse 2s infinite'
        }}></div>
        <span style={{ color: '#fff', fontWeight: '900', fontSize: '11px', letterSpacing: '1.5px', textTransform: 'uppercase' }}>
          {connected ? 'Sync Active' : 'Offline Mode'}
        </span>
      </div>

      <div style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.1)' }} />

      {/* CLASS NAME (Optional Centerpiece) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Activity size={14} color="#6366f1" />
        <span style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 'bold', fontSize: '11px' }}>{roomName.toUpperCase()}</span>
      </div>

      <div style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.1)' }} />

      {/* PARTICIPANT COUNT */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', pointerEvents: 'all' }}>
        <Users size={16} color="#94a3b8" />
        <span style={{ color: '#fff', fontSize: '18px', fontWeight: '950', fontFamily: "'Outfit', sans-serif" }}>
          {participantCount}
        </span>
      </div>

      <style>{`
        @keyframes pulse {
          0% { opacity: 0.5; }
          50% { opacity: 1; }
          100% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
};
