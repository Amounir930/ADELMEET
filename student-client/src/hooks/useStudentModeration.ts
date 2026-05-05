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
  setIsMicEnabled: (val: boolean) => void
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

    const handleForceUnmute = (data: any) => {
      console.log(`[STUDENT-MODERATION] Incoming force_unmute for: ${data.targetIdentity}`);
      if (data.targetIdentity === 'all' || data.targetIdentity === room.localParticipant.identity) {
        console.warn('[STUDENT-MODERATION] EXECUTION: Unmuting local microphone by teacher command.');
        room.localParticipant.setMicrophoneEnabled(true);
        setIsMicEnabled(true);
      }
    };

    // Socket Listeners
    socket.on('force_mute', handleForceMute);
    socket.on('force_unmute', handleForceUnmute);
    socket.on('mute_all', () => handleForceMute({ targetIdentity: 'all' }));
    socket.on('unmute_all', () => handleForceUnmute({ targetIdentity: 'all' }));
    
    // MISSION 14: INITIAL STATE SYNC
    socket.on('sync_room_state', ({ isMuted }: { isMuted: boolean }) => {
      if (isMuted) {
        console.warn('[STUDENT-MODERATION] Room is globally muted. Enforcing silence.');
        handleForceMute({ targetIdentity: 'all' });
      }
    });

    return () => {
      socket.off('force_mute', handleForceMute);
      socket.off('force_unmute', handleForceUnmute);
      socket.off('mute_all');
      socket.off('unmute_all');
      socket.off('sync_room_state');
    };
  }, [room, socket, setIsMicEnabled]);
};
