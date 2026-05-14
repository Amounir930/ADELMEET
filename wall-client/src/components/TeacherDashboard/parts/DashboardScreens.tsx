import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, XSquare, PlusSquare, Search, Monitor, Activity, Wifi, WifiOff, AlertTriangle, Power, Play } from 'lucide-react';
import { Socket } from 'socket.io-client';

export interface ScreenHealth {
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
  targetScreens: number;
  setTargetScreens: (n: number) => void;
  setIsAddingScreen: (b: boolean) => void;
  isAddingScreen: boolean;
  lecture: any;
  onOnlineScreensChange?: (count: number) => void;
}

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

/* REPRODUCED Metric Badge from Original Logic */
const MetricBadge: React.FC<{ label: string; value: number; unit: string; warn: number; danger: number; invert?: boolean }> = ({
  label, value, unit, warn, danger, invert
}) => {
  let color = '#10b981';
  if (invert) {
    color = value <= danger ? '#ef4444' : value <= warn ? '#f59e0b' : '#10b981';
  } else {
    color = value >= danger ? '#ef4444' : value >= warn ? '#f59e0b' : '#10b981';
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', background: 'rgba(255,255,255,0.03)', padding: '6px 10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
      <span style={{ fontSize: '9px', fontWeight: 'bold', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>{label}</span>
      <span style={{ fontSize: '11px', fontWeight: '900', color }}>{Math.round(value)}{unit}</span>
    </div>
  );
};

export const DashboardScreens: React.FC<DashboardScreensProps> = ({
  socket,
  roomName,
  isSidebarOpen,
  targetScreens,
  setTargetScreens,
  setIsAddingScreen,
  isAddingScreen,
  lecture,
  onOnlineScreensChange
}) => {
  const [screens, setScreens] = useState<ScreenHealth[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isConnected, setIsConnected] = useState(socket?.connected || false);

  useEffect(() => {
    if (!socket) return;
    
    const handleConnect = () => {
      setIsConnected(true);
      console.log('[SCREENS-HUB] Socket Connected - Requesting Sync');
      socket.emit('teacher:request_status_sync', { roomName });
    };
    const handleDisconnect = () => setIsConnected(false);

    setIsConnected(socket.connected);
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    // MISSION 12: Real-time Status Sync
    const handleStatus = ({ screens: data }: { screens: ScreenHealth[] }) => {
      console.log('[SCREENS-HUB] Live Update Received:', data.length, 'screens');
      setScreens(data);
      if (onOnlineScreensChange) {
        const onlineCount = data.filter((s: any) => s.status === 'online').length;
        onOnlineScreensChange(onlineCount);
      }
    };
    
    socket.on('display:status_update', handleStatus);
    
    if (socket.connected) handleConnect();

    return () => { 
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('display:status_update', handleStatus); 
    };
  }, [socket, roomName]);

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
    const url = `/grid?lecture=${lecture._id || roomName}&totalScreens=${calculatedTotal}&screen=${newScreenIndex}&roomName=${roomName}`;
    window.open(url, `screen_${newScreenIndex}`, `width=800,height=600`);
  };

  const handleRefreshAll = () => {
    socket?.emit('teacher:display_command', { roomName, command: 'refresh' });
    socket?.emit('teacher:request_status_sync', { roomName });
    console.log('[SCREENS-HUB] Manual Sync Requested');
  };
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
      opacity: isSidebarOpen ? 1 : 0, transition: 'all 0.3s ease', minWidth: '320px',
      overflow: 'hidden', minHeight: 0, height: '100%'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Activity size={20} color="#6366f1" />
          <h2 style={{ color: '#fff', fontSize: '20px', fontWeight: '900', letterSpacing: '1px', margin: 0 }}>SCREENS HUB</h2>
        </div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <div style={{ 
            width: '8px', height: '8px', borderRadius: '50%', 
            background: isConnected ? '#10b981' : '#ef4444',
            boxShadow: `0 0 8px ${isConnected ? '#10b981' : '#ef4444'}`
          }} title={isConnected ? 'Sync Engine Connected' : 'Sync Engine Disconnected'} />
          <span style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', borderRadius: '6px', padding: '4px 10px', fontSize: '10px', fontWeight: '800', border: '1px solid rgba(16,185,129,0.2)' }}>
            {screens.filter(s => s.status === 'online').length} ONLINE
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button onClick={handleAddScreen} disabled={isAddingScreen} style={{ ...commandButtonStyle, background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', color: isAddingScreen ? '#94a3b8' : '#10b981' }}>
          <PlusSquare size={18} />
          <span style={{ fontSize: '11px' }}>ADD</span>
        </button>
        <button onClick={handleRefreshAll} style={{ ...commandButtonStyle, background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.3)', color: '#38bdf8' }}>
          <RefreshCw size={18} />
          <span style={{ fontSize: '11px' }}>RELOAD</span>
        </button>
        <button onClick={handleCloseAll} style={{ ...commandButtonStyle, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444' }}>
          <XSquare size={18} />
          <span style={{ fontSize: '11px' }}>OFF</span>
        </button>
      </div>

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

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '15px', paddingRight: '5px' }} className="custom-scrollbar">
        {filteredScreens.map(({ idx, screen }) => {
          const isOffline = !screen || screen.status === 'offline';
          const statusStr = isOffline ? 'offline' : screen.status;
          
          return (
            <div key={screen?.hardwareId || `screen_${idx}`} style={{
              background: 'rgba(255,255,255,0.02)',
              borderRadius: '20px',
              padding: '18px',
              border: `1px solid ${statusColor(statusStr)}33`,
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              opacity: isOffline ? 0.7 : 1,
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              position: 'relative',
              overflow: 'hidden',
              flexShrink: 0 // Prevent compression
            }}>
              {/* Status Glow Background */}
              <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: statusColor(statusStr) }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: statusColor(statusStr), boxShadow: `0 0 10px ${statusColor(statusStr)}` }} />
                  <span style={{ color: '#fff', fontSize: '14px', fontWeight: '900', letterSpacing: '0.5px' }}>SCREEN {idx + 1}</span>
                  {statusIcon(statusStr)}
                </div>
                
                <div style={{ display: 'flex', gap: '6px' }}>
                  {isOffline ? (
                    <button
                      onClick={() => {
                        const url = `/grid?lecture=${lecture._id || roomName}&totalScreens=${targetScreens}&screen=${idx}&roomName=${roomName}`;
                        window.open(url, `screen_${idx}`, `width=800,height=600`);
                      }}
                      style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '10px', padding: '8px', cursor: 'pointer', color: '#10b981' }}
                    >
                      <Play size={16} />
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => socket?.emit('teacher:display_command', { roomName, command: 'refresh_one', payload: idx })}
                        style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '10px', padding: '8px', cursor: 'pointer', color: '#6366f1' }}
                      >
                        <RefreshCw size={16} />
                      </button>
                      <button
                        onClick={() => socket?.emit('teacher:display_command', { roomName, command: 'close_one', payload: idx })}
                        style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '10px', padding: '8px', cursor: 'pointer', color: '#ef4444' }}
                      >
                        <Power size={16} />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {!isOffline && screen ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                  <MetricBadge label="CPU" value={screen.metrics.cpu} unit="%" warn={80} danger={90} />
                  <MetricBadge label="RAM" value={screen.metrics.ram} unit="%" warn={80} danger={90} />
                  <MetricBadge label="FPS" value={screen.metrics.fps} unit="" warn={30} danger={20} invert />
                  <span style={{ fontSize: '10px', color: '#6366f1', fontWeight: '800', background: 'rgba(99,102,241,0.1)', padding: '2px 8px', borderRadius: '4px' }}>
                    {screen.metrics.studentsRendered} STUDENTS
                  </span>
                  <span style={{ fontSize: '9px', color: '#475569', marginLeft: 'auto' }}>
                    Updated {screen.secondsSinceHeartbeat}s ago
                  </span>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '11px', color: '#ef4444', fontWeight: '900', letterSpacing: '1px' }}>OFFLINE / DISCONNECTED</span>
                  <div style={{ flex: 1, height: '1px', background: 'rgba(239,68,68,0.1)' }} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
