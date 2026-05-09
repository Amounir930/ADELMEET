import React from 'react';
import { Users } from 'lucide-react';

interface DashboardHUDProps {
  connected: boolean;
  participantCount: number;
  showControls: boolean;
}

export const DashboardHUD: React.FC<DashboardHUDProps> = ({ connected, participantCount, showControls }) => {
  return (
    <div style={{ 
      position: 'absolute', 
      top: '20px', 
      left: '40px', 
      display: 'flex', 
      gap: '15px', 
      zIndex: 100, 
      pointerEvents: 'none',
      opacity: showControls ? 1 : 0,
      transition: 'opacity 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
    }}>
      <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '8px 16px', borderRadius: '12px', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: '8px', pointerEvents: 'all' }}>
        <div style={{ width: '8px', height: '8px', background: connected ? '#10b981' : '#6366f1', borderRadius: '50%', boxShadow: connected ? '0 0 10px #10b981' : '0 0 10px #6366f1' }}></div>
        <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '13px', letterSpacing: '1px' }}>{connected ? 'SYNC ACTIVE' : 'LIVE CLASS'}</span>
      </div>
      <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '8px 16px', borderRadius: '12px', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: '10px', pointerEvents: 'all' }}>
        <Users size={16} color="#94a3b8" />
        <span style={{ color: '#fff', fontSize: '18px', fontWeight: '900' }}>{participantCount}</span>
      </div>
    </div>
  );
};
