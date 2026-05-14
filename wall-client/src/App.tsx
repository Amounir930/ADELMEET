import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';

import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LiveKitProvider, useLiveKit } from './contexts/LiveKitContext';
import { Login } from './components/Login';
import { Register } from './components/Register';
import { Dashboard } from './components/Dashboard';
import { VideoRoom } from './components/VideoRoom';
import { GridPage } from './components/GridPage';
import { ScreenLauncher } from './components/ScreenLauncher';
import { WallGroupLanding } from './components/WallGroupLanding';
import { WallRoomView } from './components/WallRoomView';
import { Loader2 } from 'lucide-react';
import TitleBar from './components/TitleBar';
import { SocketProvider } from './contexts/SocketContext';


const AppRoutes: React.FC = () => {
  const { user, isLoading: authLoading } = useAuth();
  const { error: lkError } = useLiveKit();
  const [localError] = useState<string | null>(null);
  const [currentLecture] = useState<any>(null);
  const navigate = useNavigate();


  if (authLoading) {
    return (
      <div style={{ height: '100vh', background: '#0a0a0c', color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px' }}>
        <Loader2 className="animate-spin" size={40} color="#6366f1" />
        <div style={{ fontWeight: '800', letterSpacing: '1px' }}>INITIALIZING ACADEMIC SYSTEM...</div>
      </div>
    );
  }

  // MISSION 12: Redirect kiosk displays to wall landing automatically if ?group is present
  const urlParams = new URLSearchParams(window.location.search);
  const groupParam = urlParams.get('group');
  if (groupParam && window.location.pathname === '/') {
    return <Navigate to={`/display?group=${groupParam}`} replace />;
  }

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <TitleBar />
      {/* State Debugger (Small, Bottom Left) */}
      <div style={{ position: 'fixed', bottom: 10, left: 10, fontSize: '9px', opacity: 0.2, zIndex: 999 }}>
        U:{user ? 'Y' : 'N'} | L:{currentLecture ? 'Y' : 'N'}
      </div>

      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <Routes>
          <Route path="/login" element={user ? <Navigate to="/" /> : <Login onToggle={() => navigate('/register')} />} />
          <Route path="/register" element={user ? <Navigate to="/" /> : <Register onToggle={() => navigate('/login')} />} />

          <Route 
            path="/" 
            element={
              user ? (
                <div style={{ width: '100%', height: '100%' }}>
                  {localError && <div className="error-banner" style={{ background: '#ef4444', color: 'white', padding: '10px', textAlign: 'center' }}>{localError}</div>}
                  {lkError && <div className="error-banner" style={{ background: '#ef4444', color: 'white', padding: '10px', textAlign: 'center' }}>{lkError}</div>}
                  <Dashboard onJoin={(roomName: string, config: any) => {
                    const p = new URLSearchParams();
                    p.set('hall', config.hallNumber);
                    p.set('chat', config.chat.toString());
                    p.set('record', config.record.toString());
                    p.set('share', config.share.toString());
                    navigate(`/room/${roomName}?${p.toString()}`);
                  }} />
                </div>
              ) : (
                <Navigate to="/login" />
              )
            } 
          />

          <Route 
            path="/room/:lectureId" 
            element={
              user ? (
                <VideoRoom key={window.location.pathname} onDisconnect={() => navigate('/')} />
              ) : (
                <Navigate to="/login" />
              )
            } 
          />

          {/* Multi-Display Routes */}
          <Route path="/grid" element={<GridPage />} />
          <Route path="/launcher" element={user ? <ScreenLauncher /> : <Navigate to="/login" />} />

          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </div>
  );
};

const App: React.FC = () => (
  <BrowserRouter>
    <Routes>
      {/* ── PUBLIC WALL ROUTES — No auth required, kiosk mode ──────────── */}
      {/* IT sets these as permanent URLs, screens never need to log in      */}
      {/* Example: wall.60sec.shop/display?group=hall-101                    */}
      <Route path="/display" element={
        <SocketProvider>
          <WallGroupLanding />
        </SocketProvider>
      } />
      {/* Example: wall.60sec.shop/wall-view/room-abc123?group=hall-101      */}
      <Route path="/wall-view/:roomName" element={
        <SocketProvider>
          <WallRoomView />
        </SocketProvider>
      } />

      {/* ── AUTHENTICATED APP ────────────────────────────────────────────── */}
      <Route path="/*" element={
        <AuthProvider>
          <SocketProvider>
            <LiveKitProvider>
              <AppRoutes />
            </LiveKitProvider>
          </SocketProvider>
        </AuthProvider>
      } />
    </Routes>
  </BrowserRouter>
);

export default App;
