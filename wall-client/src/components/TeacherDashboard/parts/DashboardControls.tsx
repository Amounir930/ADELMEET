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
  onStartDrag?: () => void;
  onScaleChange?: (scale: number) => void;
  currentScale?: number;
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
  localVideoTrack,
  onToggleMic,
  onToggleCamera,
  onToggleFullscreen,
  onStartRecording,
  onStopRecording,
  onPauseRecording,
  onResumeRecording,
  onEndSession,
  formatDuration,
  onStartDrag,
  onScaleChange,
  currentScale = 1
}) => {
  return (
    <div style={{ 
      position: 'relative',
      zIndex: 1000, 
      transition: 'opacity 0.4s ease, transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
      opacity: showControls ? 1 : 0
    }}>
      <div style={{
        background: 'rgba(15, 23, 42, 0.5)',
        backdropFilter: 'blur(40px)',
        padding: '10px 20px',
        borderRadius: '30px',
        border: '1px solid rgba(255,255,255,0.15)',
        display: 'flex',
        alignItems: 'center',
        gap: '15px',
        boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
      }}>
        {/* DRAG HANDLE */}
        <div 
          onMouseDown={onStartDrag}
          style={{ 
            width: '30px', height: '45px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)',
            display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'center', justifyContent: 'center',
            cursor: 'grab', flexShrink: 0
          }}
          title="Drag to Move"
        >
          {[...Array(3)].map((_, i) => (
            <div key={i} style={{ width: '12px', height: '2px', background: 'rgba(255,255,255,0.3)', borderRadius: '1px' }} />
          ))}
        </div>

        {/* SCALE CONTROLS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <button 
            onClick={() => onScaleChange?.(Math.min(1.5, currentScale + 0.1))}
            style={{ width: '24px', height: '20px', background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >+</button>
          <button 
            onClick={() => onScaleChange?.(Math.max(0.6, currentScale - 0.1))}
            style={{ width: '24px', height: '20px', background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >-</button>
        </div>

        <div style={{ width: '1px', height: '30px', background: 'rgba(255,255,255,0.1)' }} />
        
        {/* PREVIEW MINI-ISLAND */}
        <div style={{
          width: '70px', height: '40px', borderRadius: '12px', overflow: 'hidden',
          border: '1px solid rgba(99, 102, 241, 0.5)', background: '#000',
          position: 'relative', boxShadow: '0 5px 15px rgba(0,0,0,0.3)', flexShrink: 0
        }}>
          <VideoTrack participant={room.localParticipant} room={room} mode="grid" track={localVideoTrack} />
        </div>

        <div style={{ width: '1px', height: '30px', background: 'rgba(255,255,255,0.1)' }} />

        {/* MEDIA CONTROLS */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            onClick={onToggleMic}
            style={{
              width: '45px', height: '45px', borderRadius: '15px', border: 'none',
              background: isMicEnabled ? 'rgba(255,255,255,0.05)' : '#ef4444',
              color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.3s ease',
              boxShadow: !isMicEnabled ? '0 5px 15px rgba(239, 68, 68, 0.3)' : 'none'
            }}
          >
            {isMicEnabled ? <Mic size={18} /> : <MicOff size={18} />}
          </button>

          <button 
            onClick={onToggleCamera}
            style={{
              width: '45px', height: '45px', borderRadius: '15px', border: 'none',
              background: isCameraEnabled ? 'rgba(255,255,255,0.05)' : '#ef4444',
              color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.3s ease',
              boxShadow: !isCameraEnabled ? '0 5px 15px rgba(239, 68, 68, 0.3)' : 'none'
            }}
          >
            {isCameraEnabled ? <Video size={18} /> : <VideoOff size={18} />}
          </button>
        </div>

        {/* UTILITY CONTROLS */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            onClick={onToggleFullscreen}
            style={{
              width: '45px', height: '45px', borderRadius: '15px', border: 'none',
              background: 'rgba(255,255,255,0.05)', color: '#fff', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.3s'
            }}
          >
            {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
          </button>

          <div style={{ display: 'flex', gap: '5px' }}>
            <button 
              onClick={isRecording ? onStopRecording : onStartRecording}
              style={{
                height: '45px', padding: '0 15px', borderRadius: '15px', border: 'none',
                background: isRecording ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255,255,255,0.05)',
                color: isRecording ? '#ef4444' : '#fff', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.3s',
                border: isRecording ? '1px solid rgba(239,68,68,0.2)' : '1px solid transparent'
              }}
            >
              {isRecording ? <StopCircle size={18} className="animate-pulse" /> : <Circle size={18} />}
              <span style={{ fontSize: '11px', fontWeight: '900' }}>{isRecording ? formatDuration(duration) : 'REC'}</span>
            </button>
            {isRecording && (
              <button 
                onClick={isPaused ? onResumeRecording : onPauseRecording}
                style={{
                  width: '40px', height: '45px', borderRadius: '12px', border: 'none',
                  background: isPaused ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255,255,255,0.05)',
                  color: isPaused ? '#10b981' : '#fff', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
              >
                {isPaused ? <Play size={14} fill="currentColor" /> : <Pause size={14} fill="currentColor" />}
              </button>
            )}
          </div>
        </div>

        <div style={{ width: '1px', height: '30px', background: 'rgba(255,255,255,0.1)' }} />

        {/* END SESSION */}
        <button 
          onClick={onEndSession}
          style={{
            height: '45px', padding: '0 25px', borderRadius: '15px', border: 'none',
            background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
            color: '#fff', fontSize: '12px', fontWeight: '900', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '8px',
            boxShadow: '0 10px 20px rgba(239, 68, 68, 0.3)', transition: 'all 0.3s'
          }}
        >
          <PhoneOff size={18} />
          <span>END SESSION</span>
        </button>
      </div>
    </div>
  );
};
