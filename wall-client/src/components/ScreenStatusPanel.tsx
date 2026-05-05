import React, { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useSocket } from '../contexts/SocketContext';
import { RefreshCw, Wifi, WifiOff, AlertTriangle, Activity, Monitor, Power, Play } from 'lucide-react';

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

interface ScreenStatusPanelProps {
  roomName: string;
  totalScreens: number;
  onRefreshScreen: (screenIndex: number) => void;
  onRebalanceAll: () => void;
  onOpenScreen: (screenIndex: number) => void;
  onCloseScreen: (screenIndex: number) => void;
}

export const ScreenStatusPanel: React.FC<ScreenStatusPanelProps> = ({
  roomName,
  totalScreens,
  onRefreshScreen,
  onRebalanceAll,
  onOpenScreen,
  onCloseScreen
}) => {
  const { socket } = useSocket();
  const [screens, setScreens] = useState<ScreenHealth[]>([]);
  const [alerts, setAlerts] = useState<{ id: number; message: string; type: string }[]>([]);
  const [isVisible, setIsVisible] = useState(false);
  const alertIdRef = React.useRef(0);

  // Listen for live status updates
  useEffect(() => {
    if (!socket) return;

    const handleStatus = ({ screens: data }: { screens: ScreenHealth[] }) => {
      setScreens(data);
    };

    const handleAlert = ({ type, message }: { screenIndex: number, type: string, message: string }) => {
      const id = ++alertIdRef.current;
      setAlerts(prev => [{ id, message: `⚠️ ${message}`, type }, ...prev.slice(0, 4)]);
      // Auto-dismiss after 6s
      setTimeout(() => setAlerts(prev => prev.filter(a => a.id !== id)), 6000);
    };

    socket.on('display:status_update', handleStatus);
    socket.on('display:alert', handleAlert);

    return () => {
      socket.off('display:status_update', handleStatus);
      socket.off('display:alert', handleAlert);
    };
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

  const online = screens.filter(s => s.status === 'online').length;
  const warning = screens.filter(s => s.status === 'warning').length;
  const offline = screens.filter(s => s.status === 'offline').length;

  return (
    <>
      {/* INLINE TOGGLE BUTTON (RENDERS IN TOOLBAR) */}
      <button
        onClick={() => setIsVisible(v => !v)}
        title="Screen Health Monitor"
        style={{
          background: offline > 0 ? 'rgba(239,68,68,0.2)' : warning > 0 ? 'rgba(245,158,11,0.2)' : 'rgba(16,185,129,0.15)',
          border: `1px solid ${offline > 0 ? '#ef4444' : warning > 0 ? '#f59e0b' : '#10b981'}`,
          borderRadius: '12px',
          padding: '8px 14px',
          color: '#fff',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '12px',
          fontWeight: '700',
          transition: 'all 0.3s ease',
          height: '100%'
        }}
      >
        <Monitor size={14} />
        <span>{totalScreens} SCREENS</span>
        {offline > 0 && <span style={{ color: '#ef4444' }}>● {offline} OFF</span>}
        {warning > 0 && <span style={{ color: '#f59e0b' }}>● {warning} WARN</span>}
      </button>

      {/* PORTAL FOR PANELS AND ALERTS */}
      {createPortal(
        <>
          {/* ALERT TOASTS */}
      <div style={{ position: 'fixed', top: '70px', right: '20px', zIndex: 10001, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {alerts.map(a => (
          <div key={a.id} style={{
            background: a.type === 'OFFLINE' ? 'rgba(239,68,68,0.9)' : 'rgba(245,158,11,0.9)',
            backdropFilter: 'blur(10px)',
            padding: '10px 16px',
            borderRadius: '10px',
            color: '#fff',
            fontSize: '12px',
            fontWeight: '700',
            boxShadow: '0 8px 20px rgba(0,0,0,0.4)',
            animation: 'slideInRight 0.3s ease',
            maxWidth: '260px'
          }}>
            {a.message}
          </div>
        ))}
      </div>

      {/* MAIN PANEL */}
      {isVisible && (
        <div style={{
          position: 'fixed',
          top: '60px',
          right: '20px',
          zIndex: 9999,
          width: '320px',
          maxHeight: '80vh',
          overflowY: 'auto',
          background: 'rgba(10, 14, 30, 0.95)',
          backdropFilter: 'blur(20px)',
          borderRadius: '20px',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
          padding: '16px'
        }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity size={14} color="#6366f1" />
              <span style={{ color: '#fff', fontWeight: '800', fontSize: '12px', letterSpacing: '1px' }}>SCREEN HEALTH</span>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <span style={{ background: 'rgba(16,185,129,0.2)', color: '#10b981', borderRadius: '6px', padding: '2px 8px', fontSize: '10px', fontWeight: '700' }}>
                {online} ON
              </span>
              {warning > 0 && <span style={{ background: 'rgba(245,158,11,0.2)', color: '#f59e0b', borderRadius: '6px', padding: '2px 8px', fontSize: '10px', fontWeight: '700' }}>
                {warning} WARN
              </span>}
              {offline > 0 && <span style={{ background: 'rgba(239,68,68,0.2)', color: '#ef4444', borderRadius: '6px', padding: '2px 8px', fontSize: '10px', fontWeight: '700' }}>
                {offline} OFF
              </span>}
            </div>
          </div>

          {/* Screen List */}
          {totalScreens === 0 ? (
            <div style={{ color: '#475569', textAlign: 'center', padding: '20px', fontSize: '12px' }}>
              No active screens detected.<br />Open grid screens to monitor them.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {Array.from({ length: totalScreens }).map((_, idx) => {
                const screen = screens.find(s => s.screenIndex === idx);
                const isOffline = !screen || screen.status === 'offline';
                const statusStr = isOffline ? 'offline' : screen.status;
                
                return (
                <div key={screen?.hardwareId || `screen_${idx}`} style={{
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: '12px',
                  padding: '10px 12px',
                  border: `1px solid ${statusColor(statusStr)}22`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  transition: 'all 0.3s ease',
                  opacity: isOffline ? 0.6 : 1
                }}>
                  {/* Status dot */}
                  <div style={{
                    width: '8px', height: '8px', borderRadius: '50%',
                    background: statusColor(statusStr),
                    boxShadow: `0 0 6px ${statusColor(statusStr)}`,
                    flexShrink: 0
                  }} />

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {statusIcon(statusStr)}
                      <span style={{ color: '#e2e8f0', fontSize: '11px', fontWeight: '700' }}>
                        SCREEN {idx + 1}
                      </span>
                      {!isOffline && screen && (
                        <span style={{ color: '#475569', fontSize: '10px' }}>
                          · {screen.metrics.studentsRendered} students
                        </span>
                      )}
                    </div>
                    
                    {!isOffline && screen ? (
                      <div style={{ display: 'flex', gap: '8px', marginTop: '3px' }}>
                        <MetricBadge label="CPU" value={screen.metrics.cpu} unit="%" warn={80} danger={90} />
                        <MetricBadge label="RAM" value={screen.metrics.ram} unit="%" warn={80} danger={90} />
                        <MetricBadge label="FPS" value={screen.metrics.fps} unit="" warn={30} danger={20} invert />
                        <span style={{ color: '#334155', fontSize: '9px' }}>
                          {screen.secondsSinceHeartbeat}s ago
                        </span>
                      </div>
                    ) : (
                      <div style={{ fontSize: '9px', color: '#ef4444', marginTop: '3px', fontWeight: 'bold' }}>
                        DISCONNECTED
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                    {isOffline ? (
                      <button
                        onClick={() => onOpenScreen(idx)}
                        title={`Open Screen ${idx + 1}`}
                        style={{
                          background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)',
                          borderRadius: '8px', padding: '5px', cursor: 'pointer', color: '#10b981',
                          display: 'flex', alignItems: 'center'
                        }}
                      >
                        <Play size={11} />
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => onRefreshScreen(idx)}
                          title={`Refresh Screen ${idx + 1}`}
                          style={{
                            background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)',
                            borderRadius: '8px', padding: '5px', cursor: 'pointer', color: '#6366f1',
                            display: 'flex', alignItems: 'center'
                          }}
                        >
                          <RefreshCw size={11} />
                        </button>
                        <button
                          onClick={() => onCloseScreen(idx)}
                          title={`Close Screen ${idx + 1}`}
                          style={{
                            background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
                            borderRadius: '8px', padding: '5px', cursor: 'pointer', color: '#ef4444',
                            display: 'flex', alignItems: 'center'
                          }}
                        >
                          <Power size={11} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )})}
            </div>
          )}

          {/* Footer Actions */}
          {screens.length > 0 && (
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
              <button
                onClick={onRebalanceAll}
                style={{
                  flex: 1, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)',
                  borderRadius: '10px', padding: '8px', color: '#6366f1', cursor: 'pointer',
                  fontSize: '11px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                }}
              >
                ⚖️ Rebalance All
              </button>
              <button
                onClick={() => socket?.emit('teacher:display_command', { roomName, command: 'refresh' })}
                style={{
                  flex: 1, background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.3)',
                  borderRadius: '10px', padding: '8px', color: '#38bdf8', cursor: 'pointer',
                  fontSize: '11px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                }}
              >
                🔄 Refresh All
              </button>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(20px); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
        </>,
        document.body
      )}
    </>
  );
};

/* Tiny metric badge */
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
    <span style={{ fontSize: '9px', color, fontWeight: '700' }}>
      {label} {Math.round(value)}{unit}
    </span>
  );
};
