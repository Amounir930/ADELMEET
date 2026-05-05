import React from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff } from 'lucide-react';

interface ControlBarProps {
  isMicOn: boolean;
  isCamOn: boolean;
  onToggleMic: () => void;
  onToggleCam: () => void;
  onLeave: () => void;
  isVisible?: boolean;
}

export const ControlBar: React.FC<ControlBarProps> = ({
  isMicOn,
  isCamOn,
  onToggleMic,
  onToggleCam,
  onLeave,
  isVisible = true,
}) => {
  if (!isVisible) {
    return null;
  }

  return (
    <div
      className="glass"
      style={{
        position: 'fixed',
        bottom: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 50,
        display: 'flex',
        gap: '12px',
        padding: '16px 24px',
        backdropFilter: 'blur(12px)',
        backgroundColor: 'rgba(10, 10, 12, 0.8)',
        borderRadius: '50px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
        animation: 'slideUp 0.3s ease-out',
      }}
    >
      {/* Microphone Toggle */}
      <button
        onClick={onToggleMic}
        className={`btn ${isMicOn ? 'btn-primary' : 'glass'}`}
        style={{
          width: '48px',
          height: '48px',
          padding: 0,
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: isMicOn ? 'var(--accent-color)' : 'rgba(255, 255, 255, 0.1)',
          color: 'white',
          border: 'none',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
        }}
        title={isMicOn ? 'Mute microphone' : 'Unmute microphone'}
      >
        {isMicOn ? <Mic size={24} /> : <MicOff size={24} />}
      </button>

      {/* Camera Toggle */}
      <button
        onClick={onToggleCam}
        className={`btn ${isCamOn ? 'btn-primary' : 'glass'}`}
        style={{
          width: '48px',
          height: '48px',
          padding: 0,
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: isCamOn ? 'var(--accent-color)' : 'rgba(255, 255, 255, 0.1)',
          color: 'white',
          border: 'none',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
        }}
        title={isCamOn ? 'Turn off camera' : 'Turn on camera'}
      >
        {isCamOn ? <Video size={24} /> : <VideoOff size={24} />}
      </button>

      {/* Leave Button */}
      <button
        onClick={onLeave}
        style={{
          width: '48px',
          height: '48px',
          padding: 0,
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#ef4444',
          color: 'white',
          border: 'none',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
        }}
        title="Leave room"
      >
        <PhoneOff size={24} />
      </button>
    </div>
  );
};
