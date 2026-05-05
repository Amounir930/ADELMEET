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
import { Loader2 } from 'lucide-react';


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

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {/* State Debugger (Small, Bottom Left) */}
      <div style={{ position: 'fixed', bottom: 10, left: 10, fontSize: '9px', opacity: 0.2, zIndex: 999 }}>
        U:{user ? 'Y' : 'N'} | L:{currentLecture ? 'Y' : 'N'}
      </div>

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
                <Dashboard onJoin={(roomName: string, screens: number) => navigate(`/room/${roomName}?screens=${screens || 0}`)} />
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
  );
};

import { SocketProvider } from './contexts/SocketContext';

const App: React.FC = () => (
  <BrowserRouter>
    <AuthProvider>
      <SocketProvider>
        <LiveKitProvider>
          <AppRoutes />
        </LiveKitProvider>
      </SocketProvider>
    </AuthProvider>
  </BrowserRouter>
);

export default App;
