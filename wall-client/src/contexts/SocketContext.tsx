import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface SocketContextType {
  socket: Socket | null;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    // MISSION 13: RESILIENT SOVEREIGN LOCAL-FIRST: Ensure we point to the right sync node
    const apiBase = import.meta.env.VITE_API_URL_BASE || 'http://localhost:5000/api';
    const socketUrl = apiBase.replace(/\/api$/, '');
    
    console.log('[MISSION-12] Sovereign Sync: Establishing link to', socketUrl);
    const s = io(socketUrl, { 
      transports: ['websocket'],
      secure: true,
      rejectUnauthorized: false,
      reconnectionAttempts: 10
    });

    setSocket(s);

    s.on('connect', () => {
      console.log('[SOVEREIGN-SOCKET] Authority Link Established');
    });

    return () => {
      s.disconnect();
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) throw new Error('useSocket must be used within a SocketProvider');
  return context;
};
