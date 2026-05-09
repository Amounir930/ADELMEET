import React, { useState, useRef, useEffect } from 'react';
import { VideoTrack } from './VideoTrack';
import { Participant, Room } from 'livekit-client';

interface PictureInPictureProps {
  participant: Participant;
  room: Room;
  isVisible?: boolean;
}

export const PictureInPicture: React.FC<PictureInPictureProps> = ({
  participant,
  room,
  isVisible = true,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 20, y: window.innerHeight - 220 });
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;

      const newX = e.clientX - offset.x;
      const newY = e.clientY - offset.y;

      // Constrain to viewport
      const maxX = window.innerWidth - containerRef.current.offsetWidth;
      const maxY = window.innerHeight - containerRef.current.offsetHeight;

      setPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY)),
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, offset]);

  if (!isVisible) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: '240px',
        height: '135px',
        zIndex: 9999,
        borderRadius: '20px',
        overflow: 'hidden',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
        border: '2px solid #6366f1',
        background: '#000',
        cursor: isDragging ? 'grabbing' : 'grab',
        userSelect: 'none',
        transition: isDragging ? 'none' : 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
      }}
      onMouseDown={handleMouseDown}
    >
      <div style={{ position: 'absolute', top: '8px', left: '12px', fontSize: '9px', fontWeight: '900', color: '#6366f1', zIndex: 100, textShadow: '0 1px 4px #000', letterSpacing: '1px' }}>
        ADMIN PREVIEW
      </div>
      <div style={{ width: '100%', height: '100%' }}>
        <VideoTrack
          participant={participant}
          room={room}
          mode="pip"
        />
      </div>
    </div>
  );
};
