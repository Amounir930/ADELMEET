import React from 'react';
import { Room, VideoQuality } from 'livekit-client';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Maximize, Minimize, Circle, StopCircle, Pause, Play, Gauge, MonitorUp, PlusSquare } from 'lucide-react';
import { VideoTrack } from '../../VideoTrack';

interface DashboardControlsProps {
  room: Room;
  showControls: boolean;
  isFullscreen: boolean;
  isMicEnabled: boolean;
  isCameraEnabled: boolean;
  isScreenSharing: boolean;
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  localVideoTrack: any;
  isWhiteboardOpen?: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onToggleScreenShare: () => void;
  onToggleFullscreen: () => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onPauseRecording: () => void;
  onResumeRecording: () => void;
  onEndSession: () => void;
  formatDuration: (s: number) => string;
  onStartDrag?: () => void;
  onScaleChange?: (scale: number) => void;
  currentScale?: number;
  currentQuality: VideoQuality;
  onToggleQuality: () => void;
  onPushToWalls: () => void;
  onReleaseWalls: () => void;
  hasExternalScreen: boolean;
}

export const DashboardControls: React.FC<DashboardControlsProps> = ({
  room,
  showControls,
  isFullscreen,
  isMicEnabled,
  isCameraEnabled,
  isScreenSharing,
  isRecording,
  isPaused,
  duration,
  localVideoTrack,
  isWhiteboardOpen,
  onToggleMic,
  onToggleCamera,
  onToggleScreenShare,
  onToggleFullscreen,
  onStartRecording,
  onStopRecording,
  onPauseRecording,
  onResumeRecording,
  onEndSession,
  formatDuration,
  onStartDrag,
  onScaleChange,
  currentScale = 1,
  currentQuality,
  onToggleQuality,
  onPushToWalls,
  onReleaseWalls,
  hasExternalScreen
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
        


        {/* MEDIA CONTROLS */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            onClick={onToggleMic}
            className="tooltip-top"
            data-tooltip={isMicEnabled ? "Mute Microphone" : "Unmute Microphone"}
            style={{
              width: '45px', height: '45px', borderRadius: '15px', border: 'none',
              background: isMicEnabled ? 'rgba(255,255,255,0.05)' : '#ef4444',
              color: isMicEnabled ? '#cbd5e1' : '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: isMicEnabled ? 'none' : '0 5px 15px rgba(239, 68, 68, 0.3)'
            }}
          >
            {isMicEnabled ? <Mic size={18} /> : <MicOff size={18} />}
          </button>

          <button 
            onClick={onToggleCamera}
            className="tooltip-top"
            data-tooltip={isCameraEnabled ? "Stop Camera" : "Start Camera"}
            style={{
              width: '45px', height: '45px', borderRadius: '15px', border: 'none',
              background: isCameraEnabled ? 'rgba(255,255,255,0.05)' : '#ef4444',
              color: isCameraEnabled ? '#cbd5e1' : '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: isCameraEnabled ? 'none' : '0 5px 15px rgba(239, 68, 68, 0.3)'
            }}
          >
            {isCameraEnabled ? <Video size={18} /> : <VideoOff size={18} />}
          </button>

          <button 
            onClick={onToggleScreenShare}
            className="tooltip-top"
            data-tooltip={isScreenSharing ? "Stop Screen Sharing" : "Start Screen Sharing"}
            style={{
              width: '45px', height: '45px', borderRadius: '15px',
              background: isScreenSharing ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255,255,255,0.05)',
              color: isScreenSharing ? '#818cf8' : '#cbd5e1', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              border: isScreenSharing ? '1px solid #818cf8' : '1px solid transparent',
              boxShadow: isScreenSharing ? '0 0 15px rgba(99, 102, 241, 0.3)' : 'none'
            }}
          >
            <MonitorUp size={18} />
          </button>

          <button 
            onClick={hasExternalScreen ? onReleaseWalls : onPushToWalls}
            className="tooltip-top"
            data-tooltip={hasExternalScreen ? "Release Wall Displays" : "Push Link to Walls"}
            style={{
              width: '45px', height: '45px', borderRadius: '15px',
              background: hasExternalScreen ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.05)',
              color: hasExternalScreen ? '#10b981' : '#cbd5e1', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              border: hasExternalScreen ? '1px solid #10b981' : '1px solid transparent',
              boxShadow: hasExternalScreen ? '0 0 15px rgba(16, 185, 129, 0.3)' : 'none'
            }}
          >
            <PlusSquare size={18} />
          </button>
        </div>

        {/* UTILITY CONTROLS */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            onClick={onToggleFullscreen}
            className="tooltip-top"
            data-tooltip={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
            style={{
              width: '45px', height: '45px', borderRadius: '15px', border: 'none',
              background: 'rgba(255,255,255,0.05)', color: '#cbd5e1', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', 
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          >
            {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
          </button>

          {/* QUALITY CONTROL */}
          <button 
            onClick={onToggleQuality}
            className="tooltip-top"
            data-tooltip="Toggle Stream Quality"
            style={{
              width: '45px', height: '45px', borderRadius: '15px',
              background: currentQuality === VideoQuality.HIGH ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255,255,255,0.05)',
              color: currentQuality === VideoQuality.HIGH ? '#10b981' : '#fff',
              border: currentQuality === VideoQuality.HIGH ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid transparent',
              cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', transition: 'all 0.3s'
            }}
          >
            <Gauge size={18} />
            <span style={{ fontSize: '8px', fontWeight: 'bold' }}>
              {currentQuality === VideoQuality.LOW ? '360' : (currentQuality === VideoQuality.MEDIUM ? '720' : 'MAX')}
            </span>
          </button>

          <div style={{ display: 'flex', gap: '5px' }}>
            <button 
              onClick={isRecording ? onStopRecording : onStartRecording}
              className="tooltip-top"
              data-tooltip={isRecording ? "Stop Recording Session" : "Start Archival Recording"}
              style={{
                height: '45px', padding: '0 15px', borderRadius: '15px',
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
          className="tooltip-top"
          data-tooltip="Terminate Class Session"
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
