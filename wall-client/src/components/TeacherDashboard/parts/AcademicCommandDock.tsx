import React from 'react';
import { 
  Users, LayoutGrid, MessageSquare, Mic, MicOff, Video, VideoOff, 
  Pencil, Lock, Unlock, ShieldCheck, ShieldAlert, MonitorUp, MonitorOff, 
  MessageSquareOff, Monitor 
} from 'lucide-react';

interface AcademicCommandDockProps {
  showControls: boolean;
  activeTab: string;
  setActiveTab: (tab: any) => void;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  
  // Alerts & Notifications
  setHasHandAlert: (val: boolean) => void;
  raisedHands: Set<string>;
  hasHandAlert: boolean;
  setHasScreenAlert: (val: boolean) => void;
  totalUnread: number;
  setTotalUnread: (val: number) => void;
  
  // Teacher Actions & State
  handleToggleClassMute: () => void;
  anyMicActive: boolean;
  handleToggleClassCamera: () => void;
  anyCameraActive: boolean;
  isWhiteboardOpen: boolean;
  setIsWhiteboardOpen: (val: boolean) => void;
  
  isRoomLocked: boolean;
  handleToggleRoomLock: () => void;
  isRecordingAllowed: boolean;
  handleToggleRecordingPermission: () => void;
  isScreenShareAllowed: boolean;
  handleToggleScreenSharePermission: () => void;
  
  roomState: any;
  handleToggleChat: () => void;
  
  // Wall Orchestration
  wallPushStatus: 'idle' | 'pushing' | 'live';
  wallGroup: string;
  handlePushToWalls: () => void;
  handleReleaseWalls: () => void;
}

/**
 * ACADEMIC COMMAND DOCK
 * 
 * The fixed left-side panel containing global class controls, 
 * permission toggles, and wall orchestration triggers.
 */
export const AcademicCommandDock: React.FC<AcademicCommandDockProps> = ({
  showControls, activeTab, setActiveTab, isSidebarOpen, setIsSidebarOpen,
  setHasHandAlert, raisedHands, hasHandAlert, setHasScreenAlert,
  totalUnread, setTotalUnread,
  handleToggleClassMute, anyMicActive,
  handleToggleClassCamera, anyCameraActive,
  isWhiteboardOpen, setIsWhiteboardOpen,
  isRoomLocked, handleToggleRoomLock,
  isRecordingAllowed, handleToggleRecordingPermission,
  isScreenShareAllowed, handleToggleScreenSharePermission,
  roomState, handleToggleChat,
  wallPushStatus, wallGroup, handlePushToWalls, handleReleaseWalls
}) => {
  return (
    <>
      <div style={{ 
        position: 'absolute', 
        left: '20px', 
        top: '50%', 
        transform: 'translateY(-50%)',
        zIndex: 10000, 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '12px',
        background: 'rgba(15, 23, 42, 0.3)', 
        backdropFilter: 'blur(30px)',
        padding: '12px', 
        borderRadius: '24px', 
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
        transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
        opacity: showControls ? 1 : 0.2,
        pointerEvents: 'all'
      }}>
        {/* SECTION: NAVIGATION TABS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '10px' }}>
          <button 
            onClick={() => { setActiveTab('participants'); setIsSidebarOpen(activeTab !== 'participants' || !isSidebarOpen); setHasHandAlert(false); }}
            className={raisedHands.size > 0 ? 'pulse-alert-hand' : ''}
            style={{ 
              width: '44px', height: '44px', borderRadius: '14px', 
              background: activeTab === 'participants' && isSidebarOpen ? 'rgba(99, 102, 241, 0.2)' : 'transparent', 
              color: (raisedHands.size > 0 && hasHandAlert) ? '#a855f7' : (activeTab === 'participants' && isSidebarOpen ? '#6366f1' : 'rgba(255,255,255,0.4)'), 
              border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.2s',
              position: 'relative',
              boxShadow: (raisedHands.size > 0 && hasHandAlert) ? '0 0 15px rgba(168, 85, 247, 0.5)' : 'none'
            }}
            title="Participants List"
          >
            <Users size={20} />
            {raisedHands.size > 0 && (
              <div style={{ 
                position: 'absolute', top: 2, right: 2, width: 8, height: 8, 
                borderRadius: '50%', background: '#a855f7', border: '2px solid #0f172a',
                boxShadow: '0 0 10px #a855f7'
              }} />
            )}
          </button>

          <button 
            onClick={() => { setActiveTab('screens'); setIsSidebarOpen(activeTab !== 'screens' || !isSidebarOpen); setHasScreenAlert(false); }}
            style={{ 
              width: '44px', height: '44px', borderRadius: '14px', 
              background: activeTab === 'screens' && isSidebarOpen ? 'rgba(34, 197, 94, 0.2)' : 'transparent', 
              color: activeTab === 'screens' && isSidebarOpen ? '#22c55e' : 'rgba(255,255,255,0.4)', 
              border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.2s'
            }}
            title="Wall Displays"
          >
            <LayoutGrid size={20} />
          </button>

          <button 
            onClick={() => { setActiveTab('chat'); setIsSidebarOpen(activeTab !== 'chat' || !isSidebarOpen); if (activeTab === 'chat' && !isSidebarOpen) setTotalUnread(0); }}
            style={{ 
              width: '44px', height: '44px', borderRadius: '14px', 
              background: activeTab === 'chat' && isSidebarOpen ? 'rgba(168, 85, 247, 0.2)' : 'transparent', 
              color: activeTab === 'chat' && isSidebarOpen ? '#a855f7' : 'rgba(255,255,255,0.4)', 
              border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.2s', position: 'relative'
            }}
            title="Class Chat"
          >
            <MessageSquare size={20} />
            {totalUnread > 0 && <div style={{ position: 'absolute', top: 2, right: 2, width: 8, height: 8, borderRadius: '50%', background: '#ef4444', border: '2px solid #0f172a' }} />}
          </button>
        </div>

        {/* SECTION: ACADEMIC AUTHORITY CONTROLS (GLOBAL ACTIONS) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '10px' }}>
          {/* SMART MUTE ALL */}
          <button 
            onClick={handleToggleClassMute}
            style={{ 
              width: '44px', height: '44px', borderRadius: '14px', 
              background: anyMicActive ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.2)', 
              color: anyMicActive ? '#22c55e' : '#ef4444', 
              border: `1px solid ${anyMicActive ? '#22c55e' : '#ef4444'}`, 
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.2s',
              boxShadow: anyMicActive ? '0 0 15px rgba(34, 197, 94, 0.3)' : 'none'
            }}
            title={anyMicActive ? "Force Mute All Active Students" : "All Students Muted"}
          >
            {anyMicActive ? <Mic size={18} /> : <MicOff size={18} />}
          </button>

          {/* SMART LOCK CAMERAS */}
          <button 
            onClick={handleToggleClassCamera}
            style={{ 
              width: '44px', height: '44px', borderRadius: '14px', 
              background: anyCameraActive ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.2)', 
              color: anyCameraActive ? '#22c55e' : '#ef4444', 
              border: `1px solid ${anyCameraActive ? '#22c55e' : '#ef4444'}`, 
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.2s',
              boxShadow: anyCameraActive ? '0 0 15px rgba(34, 197, 94, 0.3)' : 'none'
            }}
            title={anyCameraActive ? "Force Off All Active Cameras" : "All Cameras Locked"}
          >
            {anyCameraActive ? <Video size={18} /> : <VideoOff size={18} />}
          </button>

          {/* WHITEBOARD TOGGLE */}
          <button 
            onClick={() => setIsWhiteboardOpen(!isWhiteboardOpen)}
            style={{ 
              width: '44px', height: '44px', borderRadius: '14px', 
              background: isWhiteboardOpen ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255,255,255,0.05)', 
              color: isWhiteboardOpen ? '#6366f1' : 'rgba(255,255,255,0.4)', 
              border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.2s'
            }}
            title="Launch Whiteboard"
          >
            <Pencil size={18} />
          </button>

          {/* LOCK ROOM ENTRY */}
          <button 
            onClick={handleToggleRoomLock}
            style={{ 
              width: '44px', height: '44px', borderRadius: '14px', 
              background: isRoomLocked ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 197, 94, 0.15)', 
              color: isRoomLocked ? '#ef4444' : '#22c55e', 
              border: `1px solid ${isRoomLocked ? '#ef4444' : '#22c55e'}`, 
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.2s'
            }}
            title={isRoomLocked ? "Room Locked" : "Room Open"}
          >
            {isRoomLocked ? <Lock size={18} /> : <Unlock size={18} />}
          </button>

          {/* GLOBAL RECORDING PERMISSION */}
          <button 
            onClick={handleToggleRecordingPermission}
            style={{ 
              width: '44px', height: '44px', borderRadius: '14px', 
              background: isRecordingAllowed ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.2)', 
              color: isRecordingAllowed ? '#22c55e' : '#ef4444', 
              border: `1px solid ${isRecordingAllowed ? '#22c55e' : '#ef4444'}`, 
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.2s'
            }}
            title={isRecordingAllowed ? "Students Allowed to Record" : "Student Recording Blocked"}
          >
            {isRecordingAllowed ? <ShieldCheck size={18} /> : <ShieldAlert size={18} />}
          </button>
          
          {/* GLOBAL SCREENSHARE PERMISSION */}
          <button 
            onClick={handleToggleScreenSharePermission}
            style={{ 
              width: '44px', height: '44px', borderRadius: '14px', 
              background: isScreenShareAllowed ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.2)', 
              color: isScreenShareAllowed ? '#22c55e' : '#ef4444', 
              border: `1px solid ${isScreenShareAllowed ? '#22c55e' : '#ef4444'}`, 
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.2s'
            }}
            title={isScreenShareAllowed ? "Students Allowed to Share Screen" : "Student Screenshare Blocked"}
          >
            {isScreenShareAllowed ? <MonitorUp size={18} /> : <MonitorOff size={18} />}
          </button>

          {/* GLOBAL CHAT CONTROL */}
          <button 
            onClick={handleToggleChat}
            style={{ 
              width: '44px', height: '44px', borderRadius: '14px', 
              background: roomState.isChatEnabled ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.2)', 
              color: roomState.isChatEnabled ? '#22c55e' : '#ef4444', 
              border: `1px solid ${roomState.isChatEnabled ? '#22c55e' : '#ef4444'}`, 
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.2s'
            }}
            title={roomState.isChatEnabled ? "Public Chat Enabled" : "Public Chat Blocked"}
          >
            {roomState.isChatEnabled ? <MessageSquare size={18} /> : <MessageSquareOff size={18} />}
          </button>
        </div>


        {/* SECTION: WALL ORCHESTRATION */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div 
            style={{
              background: 'rgba(99, 102, 241, 0.05)',
              border: '1px solid rgba(99, 102, 241, 0.15)',
              borderRadius: 10,
              color: wallPushStatus === 'live' ? '#818cf8' : '#64748b',
              fontSize: 8,
              padding: '6px 2px',
              width: '44px',
              textAlign: 'center',
              fontFamily: 'monospace',
              fontWeight: 900,
              cursor: 'default',
            }}
          >
            {wallGroup.replace('hall-', '').toUpperCase()}
          </div>
          
          <button
            onClick={wallPushStatus === 'live' ? handleReleaseWalls : handlePushToWalls}
            style={{
              width: '44px', height: '44px', borderRadius: '14px',
              background: wallPushStatus === 'live' ? 'rgba(239,68,68,0.15)' : 'rgba(99,102,241,0.15)',
              border: `1px solid ${wallPushStatus === 'live' ? 'rgba(239,68,68,0.3)' : 'rgba(99,102,241,0.3)'}`,
              color: wallPushStatus === 'live' ? '#f87171' : '#818cf8',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.25s ease',
            }}
            title={wallPushStatus === 'live' ? "Release Walls" : "Push to Wall"}
          >
            <Monitor size={20} className={wallPushStatus === 'pushing' ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <style>{`
        @keyframes pulse-alert-hand {
          0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(168, 85, 247, 0.4); }
          50% { transform: scale(1.1); box-shadow: 0 0 20px 10px rgba(168, 85, 247, 0.2); }
          100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(168, 85, 247, 0); }
        }
        .pulse-alert-hand {
          animation: pulse-alert-hand 2s infinite;
        }
      `}</style>
    </>
  );
};
