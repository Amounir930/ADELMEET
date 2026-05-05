import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';

import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LiveKitProvider, useLiveKit } from './contexts/LiveKitContext';
import { Login } from './components/Login';
import { Register } from './components/Register';
import { Dashboard } from './components/Dashboard';
import { VideoRoom } from './components/VideoRoom';

import { Loader2 } from 'lucide-react';

const AppRoutes: React.FC = () => {
  const { user, isLoading: authLoading } = useAuth();
  const { error: lkError } = useLiveKit();
  const navigate = useNavigate();


  if (authLoading) {
    return (
      <div style={{ height: '100vh', background: '#0a0a0c', color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px' }}>
        <Loader2 className="spin" size={40} color="#6366f1" />
        <div style={{ fontWeight: '800' }}>LOADING ACADEMIC PORTAL...</div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" /> : <Login onToggle={() => navigate('/register')} />} />
        <Route path="/register" element={user ? <Navigate to="/" /> : <Register onToggle={() => navigate('/login')} />} />

        <Route 
          path="/" 
          element={
            user ? (
              <div>
                {lkError && <div className="error-banner">{lkError}</div>}
                <Dashboard onJoin={(roomName: string) => navigate(`/room/${roomName}`)} />
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
              <VideoRoom onDisconnect={() => navigate('/')} />
            ) : (
              <Navigate to="/login" />
            )
          } 
        />

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </div>
  );
};

const App: React.FC = () => (
  <BrowserRouter>
    <AuthProvider>
      <LiveKitProvider>
        <AppRoutes />
      </LiveKitProvider>
    </AuthProvider>
  </BrowserRouter>
);

export default App;
