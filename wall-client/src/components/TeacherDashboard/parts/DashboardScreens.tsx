import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, XSquare, PlusSquare, Search, Monitor, Activity, Wifi, WifiOff, AlertTriangle, Power, Play, LayoutGrid } from 'lucide-react';
import { Socket } from 'socket.io-client';

interface ScreenHealth {
  hardwareId: string;
  screenIndex: number;
  status: 'online' | 'warning' | 'offline';
  metrics: {
    cpu: number;
    ram: number;
    fps: number;
    bandwidth: number;
    studentsRendered: number;
    errors: number;
  };
  lastHeartbeat: number;
  secondsSinceHeartbeat: number;
}

interface DashboardScreensProps {
  socket: Socket | null;
  roomName: string;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  // Passed from index.tsx to keep logic central
  targetScreens: number;
  setTargetScreens: (n: number) => void;
  setIsAddingScreen: (b: boolean) => void;
  isAddingScreen: boolean;
  lecture: any;
}

// EXACT CLONE OF ORIGINAL BUTTON STYLES
const commandButtonStyle = {
  padding: '12px 24px',
  borderRadius: '16px',
  border: 'none',
  color: '#fff',
  fontSize: '13px',
  fontWeight: '800',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  boxShadow: '0 8px 20px rgba(0,0,0,0.4)',
  justifyContent: 'center',
  flex: 1
} as React.CSSProperties;

export const DashboardScreens: React.FC<DashboardScreensProps> = ({
  socket,
  roomName,
  isSidebarOpen,
  targetScreens,
  setTargetScreens,
  setIsAddingScreen,
  isAddingScreen,
  lecture
}) => {
  const [screens, setScreens] = useState<ScreenHealth[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!socket) return;
    const handleStatus = ({ screens: data }: { screens: ScreenHealth[] }) => {
      setScreens(data);
    };
    socket.on('display:status_update', handleStatus);
    return () => { socket.off('display:status_update'); };
  }, [socket]);

  const statusColor = useCallback((s: ScreenHealth['status']) => {
    if (s === 'online') return '#10b981';
    if (s === 'warning') return '#f59e0b';
    return '#ef4444';
  }, []);

  const statusIcon = useCallback((s: ScreenHealth['status']) => {
    if (s === 'online') return <Wifi size={12} color="#10b981" />;
    if (s === 'warning') return <AlertTriangle size={12} color="#f59e0b" />;
    return <WifiOff size={12} color="#ef4444" />;
  }, []);

  const handleAddScreen = () => {
    if (isAddingScreen) return;
    const newScreenIndex = targetScreens;
    const calculatedTotal = targetScreens + 1;
    setTargetScreens(calculatedTotal);
    setIsAddingScreen(true);
    setTimeout(() => setIsAddingScreen(false), 3000);
    socket?.emit('teacher:display_command', { roomName, command: 'rebalance', payload: calculatedTotal });
    const url = `/grid?lecture=${lecture._id || roomName}&totalScreens=${calculatedTotal}&screen=${newScreenIndex}`;
    window.open(url, `screen_${newScreenIndex}`, `width=800,height=600`);
  };

  const handleRefreshAll = () => socket?.emit('teacher:display_command', { roomName, command: 'refresh' });
  const handleCloseAll = () => socket?.emit('teacher:display_command', { roomName, command: 'close_all' });

  const filteredScreens = Array.from({ length: targetScreens }).map((_, idx) => {
    const screen = screens.find(s => s.screenIndex === idx);
    return { idx, screen };
  }).filter(item => 
    `Screen ${item.idx + 1}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ 
      flex: 1, padding: '25px', display: 'flex', flexDirection: 'column',
      opacity: isSidebarOpen ? 1 : 0, transition: 'all 0.3s ease', minWidth: '320px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ color: '#fff', fontSize: '20px', fontWeight: '900', letterSpacing: '1px', margin: 0 }}>SCREENS HUB</h2>
        <div style={{ display: 'flex', gap: '6px' }}>
          <span style={{ background: 'rgba(16,185,129,0.2)', color: '#10b981', borderRadius: '6px', padding: '2px 8px', fontSize: '10px', fontWeight: '700' }}>
            {screens.filter(s => s.status === 'online').length} ON
          </span>
          {screens.some(s => s.status === 'offline') && (
            <span style={{ background: 'rgba(239,68,68,0.2)', color: '#ef4444', borderRadius: '6px', padding: '2px 8px', fontSize: '10px', fontWeight: '700' }}>
               OFF
            </span>
          )}
        </div>
      </div>

      {/* TOP COMMANDS - EXACT STYLE TRANSFER */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button 
          onClick={handleAddScreen}
          disabled={isAddingScreen}
          style={{ ...commandButtonStyle, background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', color: isAddingScreen ? '#94a3b8' : '#10b981' }}
        >
          <PlusSquare size={20} />
          <span style={{ fontSize: '10px' }}>ADD</span>
        </button>

        <button 
          onClick={handleRefreshAll}
          style={{ ...commandButtonStyle, background: 'rgba(56, 189, 248, 0.15)', border: '1px solid rgba(56, 189, 248, 0.3)', color: '#38bdf8' }}
        >
          <RefreshCw size={20} />
          <span style={{ fontSize: '10px' }}>RELOAD</span>
        </button>

        <button 
          onClick={handleCloseAll}
          style={{ ...commandButtonStyle, background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444' }}
        >
          <XSquare size={20} />
          <span style={{ fontSize: '10px' }}>OFF</span>
        </button>
      </div>

      {/* SEARCH BAR - EXACT SIDEBAR COPY */}
      <div style={{ position: 'relative', marginBottom: '20px' }}>
        <Search style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', color: '#6366f1' }} size={16} />
        <input 
          type="text" 
          placeholder="Search screens..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '12px 12px 12px 40px', color: '#fff', outline: 'none', fontSize: '13px' }} 
        />
      </div>

      {/* SCREEN LIST - EXACT STYLE TRANSFER FROM PANEL */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {filteredScreens.map(({ idx, screen }) => {
          const isOffline = !screen || screen.status === 'offline';
          const statusStr = isOffline ? 'offline' : screen.status;
          
          return (
            <div key={screen?.hardwareId || `screen_${idx}`} style={{
              background: 'rgba(255,255,255,0.03)',
              borderRadius: '16px',
              padding: '12px 15px',
              border: `1px solid ${statusColor(statusStr)}22`,
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              opacity: isOffline ? 0.7 : 1,
              transition: 'all 0.3s ease'
            }}>
              <div style={{
                width: '8px', height: '8px', borderRadius: '50%',
                background: statusColor(statusStr),
                boxShadow: `0 0 8px ${statusColor(statusStr)}`,
                flexShrink: 0
              }} />

              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {statusIcon(statusStr)}
                  <span style={{ color: '#fff', fontSize: '13px', fontWeight: '800' }}>
                    SCREEN {idx + 1}
                  </span>
                </div>
                {isOffline ? (
                  <div style={{ fontSize: '10px', color: '#ef4444', marginTop: '4px', fontWeight: 'bold' }}>DISCONNECTED</div>
                ) : (
                  <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                    <span style={{ fontSize: '9px', color: '#10b981', fontWeight: 'bold' }}>FPS {screen?.metrics.fps}</span>
                    <span style={{ fontSize: '9px', color: '#94a3b8' }}>{screen?.metrics.studentsRendered} STU</span>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '6px' }}>
                {isOffline ? (
                  <button
                    onClick={() => {
                      const url = `/grid?lecture=${lecture._id || roomName}&totalScreens=${targetScreens}&screen=${idx}`;
                      window.open(url, `screen_${idx}`, `width=800,height=600`);
                    }}
                    style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '8px', padding: '6px', cursor: 'pointer', color: '#10b981' }}
                  >
                    <Play size={14} />
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => socket?.emit('teacher:display_command', { roomName, command: 'refresh_one', payload: idx })}
                      style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '8px', padding: '6px', cursor: 'pointer', color: '#6366f1' }}
                    >
                      <RefreshCw size={14} />
                    </button>
                    <button
                      onClick={() => socket?.emit('teacher:display_command', { roomName, command: 'close_one', payload: idx })}
                      style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', padding: '6px', cursor: 'pointer', color: '#ef4444' }}
                    >
                      <Power size={14} />
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
