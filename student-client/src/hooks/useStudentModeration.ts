import { useEffect } from 'react';
import { Room } from 'livekit-client';
import { Socket } from 'socket.io-client';

/**
 * MISSION 12: ISOLATED MODERATION ENGINE (STUDENT SIDE)
 * Handles all remote synchronization commands without bloating the UI component.
 */
export const useStudentModeration = (
  room: Room | null, 
  socket: Socket | null, 
  setIsMicEnabled: (val: boolean) => void,
  setIsCameraEnabled: (val: boolean) => void
) => {
  useEffect(() => {
    if (!room || !socket) return;

    const handleForceMute = (data: any) => {
      console.log(`[STUDENT-MODERATION] Incoming force_mute for: ${data.targetIdentity}`);
      if (data.targetIdentity === 'all' || data.targetIdentity === room.localParticipant.identity) {
        console.warn('[STUDENT-MODERATION] EXECUTION: Muting local microphone by teacher command.');
        room.localParticipant.setMicrophoneEnabled(false);
        setIsMicEnabled(false);
      }
    };

    const handleForceCameraOff = (data: any) => {
      console.log(`[STUDENT-MODERATION] Incoming force_camera_off for: ${data.targetIdentity}`);
      if (data.targetIdentity === 'all' || data.targetIdentity === room.localParticipant.identity) {
        console.warn('[STUDENT-MODERATION] EXECUTION: Locking camera by teacher command.');
        room.localParticipant.setCameraEnabled(false);
        setIsCameraEnabled(false);
        // Visual confirmation for debugging
        if (window.showToast) window.showToast('Teacher has locked your camera.', 'error');
      }
    };

    const handleForceUnmute = (data: any) => {
      // MISSION 15: PRIVACY OVERRIDE
      // Teacher can NO LONGER force-open a student's mic.
      console.warn('[STUDENT-MODERATION] Teacher requested unmute, but privacy rules prevent automatic activation.');
    };

    const handleForceCameraOn = (data: any) => {
      // MISSION 15: PRIVACY OVERRIDE
      // Teacher can NO LONGER force-open a student's camera.
      console.warn('[STUDENT-MODERATION] Teacher requested camera-on, but privacy rules prevent automatic activation.');
    };

    // Socket Listeners
    socket.on('force_mute', handleForceMute);
    socket.on('force_unmute', handleForceUnmute);
    socket.on('mute_all', () => handleForceMute({ targetIdentity: 'all' }));
    socket.on('force_camera_off', handleForceCameraOff);
    socket.on('force_camera_on', handleForceCameraOn);
    socket.on('lock_cameras', () => handleForceCameraOff({ targetIdentity: 'all' }));
    
    const handleSync = (state: any) => {
      if (state.isMuted) {
        console.warn('[STUDENT-MODERATION] Room is globally muted. Enforcing silence.');
        handleForceMute({ targetIdentity: 'all' });
      }
      if (state.isCameraLocked) {
        console.warn('[STUDENT-MODERATION] Room cameras are globally locked.');
        handleForceCameraOff({ targetIdentity: 'all' });
      }
    };

    socket.on('sync_room_state', handleSync);
    
    return () => {
      socket.off('force_mute', handleForceMute);
      socket.off('force_unmute', handleForceUnmute);
      socket.off('mute_all');
      socket.off('force_camera_off');
      socket.off('force_camera_on');
      socket.off('lock_cameras');
      socket.off('sync_room_state', handleSync);
    };
  }, [room, socket, setIsMicEnabled, setIsCameraEnabled]);
};
