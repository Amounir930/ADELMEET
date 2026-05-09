import React from 'react';
import { Room, Track } from 'livekit-client';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Maximize, Minimize, RefreshCw, XSquare, PlusSquare, Circle, StopCircle, Pause, Play } from 'lucide-react';
import { VideoTrack } from '../../VideoTrack';
import { ScreenStatusPanel } from '../../ScreenStatusPanel';

interface DashboardControlsProps {
  room: Room;
  showControls: boolean;
  isFullscreen: boolean;
  isMicEnabled: boolean;
  isCameraEnabled: boolean;
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  isAddingScreen: boolean;
  isEnding: boolean;
  targetScreens: number;
  localVideoTrack: any;
  lecture: any;
  socket: any;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onToggleFullscreen: () => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onPauseRecording: () => void;
  onResumeRecording: () => void;
  onAddScreen: () => void;
  onRefreshScreens: () => void;
  onCloseAllScreens: () => void;
  onEndSession: () => void;
  formatDuration: (s: number) => string;
  setTargetScreens: (n: number) => void;
  setIsAddingScreen: (b: boolean) => void;
}

const commandButtonStyle = {
  padding: '12px 24px',
  borderRadius: '16px',
  border: 'none',
  color: '#fff',
  fontSize: 'clamp(10px, 2vw, 14px)',
  fontWeight: '800',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  boxShadow: '0 8px 20px rgba(0,0,0,0.4)',
  minWidth: 'clamp(80px, 15vw, 140px)',
  justifyContent: 'center'
} as React.CSSProperties;

export const DashboardControls: React.FC<DashboardControlsProps> = ({
  room,
  showControls,
  isFullscreen,
  isMicEnabled,
  isCameraEnabled,
  isRecording,
  isPaused,
  duration,
  isAddingScreen,
  isEnding,
  targetScreens,
  localVideoTrack,
  lecture,
  socket,
  onToggleMic,
  onToggleCamera,
  onToggleFullscreen,
  onStartRecording,
  onStopRecording,
  onPauseRecording,
  onResumeRecording,
  onAddScreen,
  onRefreshScreens,
  onCloseAllScreens,
  onEndSession,
  formatDuration,
  setTargetScreens,
  setIsAddingScreen
}) => {
  return (
    <div style={{ 
      position: 'fixed', 
      bottom: '30px', 
      left: '50%', 
      transform: `translateX(-50%) translateY(${showControls ? '0' : '120px'})`, 
      zIndex: 99999, 
      display: 'flex', 
      justifyContent: 'center',
      pointerEvents: 'all',
      width: 'auto',
      transition: 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.5s ease',
      opacity: showControls ? 1 : 0
    }}>
      <div style={{
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(30px)',
        padding: '12px 35px',
        borderRadius: '35px',
        border: '1px solid rgba(255,255,255,0.12)',
        display: 'flex',
        alignItems: 'center',
        gap: '35px',
        boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
        transition: 'all 0.3s ease'
      }}>

        {/* Teacher Preview (Enlarged & Professional) */}
        <div style={{
          width: '160px',
          height: '90px',
          borderRadius: '20px',
          overflow: 'hidden',
          position: 'relative',
          border: '2px solid #6366f1',
          boxShadow: '0 8px 25px rgba(99, 102, 241, 0.3)',
          background: '#000'
        }}>
          <VideoTrack participant={room.localParticipant} room={room} mode="grid" track={localVideoTrack} />
          <div style={{ position: 'absolute', top: '5px', left: '10px', fontSize: '9px', fontWeight: 'bold', color: '#6366f1', zIndex: 30, textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>TEACHER VIEW</div>
        </div>

        <div style={{ width: '1px', height: '40px', background: 'rgba(255,255,255,0.1)' }}></div>

        {/* GROUP 1: PERSONAL MEDIA & VIEW */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', padding: '5px 15px', background: 'rgba(255,255,255,0.03)', borderRadius: '25px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <button 
            onClick={onToggleMic}
            style={{
              ...commandButtonStyle,
              background: isMicEnabled ? 'rgba(255,255,255,0.05)' : '#ef4444',
              border: '1px solid rgba(255,255,255,0.1)',
              minWidth: 'auto',
              padding: '12px'
            }}
            title="Toggle My Mic"
          >
            {isMicEnabled ? <Mic size={20} /> : <MicOff size={20} />}
          </button>

          <button 
            onClick={onToggleCamera}
            style={{
              ...commandButtonStyle,
              background: isCameraEnabled ? 'rgba(255,255,255,0.05)' : '#ef4444',
              border: '1px solid rgba(255,255,255,0.1)',
              minWidth: 'auto',
              padding: '12px'
            }}
            title="Toggle My Camera"
          >
            {isCameraEnabled ? <Video size={20} /> : <VideoOff size={20} />}
          </button>

          <button 
            onClick={onToggleFullscreen}
            style={{
              ...commandButtonStyle,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              minWidth: 'auto',
              padding: '12px'
            }}
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <button 
              onClick={isRecording ? onStopRecording : onStartRecording}
              style={{
                ...commandButtonStyle,
                background: isRecording ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255,255,255,0.05)',
                color: isRecording ? '#ef4444' : '#fff',
                border: isRecording ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.1)',
                minWidth: 'auto', padding: '12px'
              }}
              title={isRecording ? 'Stop Recording' : 'Start My Recording'}
            >
              {isRecording ? <StopCircle size={20} className="animate-pulse" /> : <Circle size={20} />}
              <span style={{ fontSize: '10px', fontWeight: 'bold' }}>
                {isRecording ? formatDuration(duration) : 'REC'}
              </span>
            </button>

            {isRecording && (
              <button 
                onClick={isPaused ? onResumeRecording : onPauseRecording}
                style={{
                  ...commandButtonStyle,
                  background: isPaused ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                  color: isPaused ? '#10b981' : '#fff',
                  border: isPaused ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.1)',
                  minWidth: 'auto', padding: '12px'
                }}
                title={isPaused ? 'Resume' : 'Pause'}
              >
                {isPaused ? <Play size={14} fill="currentColor" /> : <Pause size={14} fill="currentColor" />}
              </button>
            )}
          </div>
        </div>


        <div style={{ width: '1px', height: '40px', background: 'rgba(255,255,255,0.1)' }}></div>

        <button 
          onClick={onEndSession}
          disabled={isEnding}
          style={{
            ...commandButtonStyle,
            background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
            boxShadow: '0 8px 25px rgba(239, 68, 68, 0.4)'
          }}
        >
          <PhoneOff size={18} />
          <span>{isEnding ? 'ENDING...' : 'END'}</span>
        </button>
      </div>
    </div>
  );
};
