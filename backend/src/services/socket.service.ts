import { Server } from 'socket.io';
import { Server as HttpServer } from 'http';
import logger from '../infra/logger';
import { stateService } from './state.service';
import { healthMonitorService } from './health-monitor.service';
import { displayAssignmentService } from './display-assignment.service';
import { roomOrchestratorService } from './room-orchestrator.service';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

/**
 * MISSION 12: SOVEREIGN SYNC ENGINE (SOCKET)
 * Optimized for Targeted Sync, High-Concurrency, and Distributed State.
 */
class SocketService {
  private io: Server | null = null;

  private readonly GRACE_WINDOW_SECONDS = 300; // 5 minutes

  async init(server: HttpServer) {
    this.io = new Server(server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST', 'PATCH']
      },
      transports: ['polling', 'websocket'], // Allow polling fallback for connection stability in all environments
      pingTimeout: 60000,
      pingInterval: 25000,
      maxHttpBufferSize: 1e6 // 1MB limit — strictly for signaling/text
    });

    // MISSION 07: DISTRIBUTED SYNC (REDIS ADAPTER)
    // Critical for multi-node deployments (Millions of users)
    try {
      const pubClient = createClient({ 
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        socket: { connectTimeout: 5000 } 
      });
      const subClient = pubClient.duplicate();

      await Promise.all([pubClient.connect(), subClient.connect()]);
      this.io.adapter(createAdapter(pubClient, subClient));
      logger.info('[REDIS-ADAPTER] Distributed Sync Active');
    } catch (err: any) {
      logger.warn(`[REDIS-ADAPTER] Failed to initialize Redis Adapter: ${err.message}. Falling back to In-Memory sync.`);
    }

    // Initialize Engines with Dependency Injection
    displayAssignmentService.init(this.io);
    healthMonitorService.init(this.io, displayAssignmentService);

    this.io.on('connection', (socket) => {
      logger.info(`[MISSION-12] Sync Node Connected: ${socket.id}`);

      // MISSION 13: SOVEREIGN TEACHER HANDSHAKE
      socket.on('teacher:join_room', async ({ roomName, identity }: { roomName: string, identity: string }) => {
        try {
          socket.join(roomName);
          logger.info(`[TEACHER-SERVICE] Sovereign Entry: ${identity} joined ${roomName}`);

          const state = await stateService.getRoomState(roomName) || { isMuted: false };
          socket.emit('sync_room_state', state);
          
          // MISSION 13: Immediate sync on join
          if (healthMonitorService) {
            await healthMonitorService.broadcastStatus().catch(e => logger.error(`[SYNC-ERROR] ${e.message}`));
          }
        } catch (err: any) {
          logger.error(`[TEACHER-JOIN-ERROR] ${err.message}`);
        }
      });

      socket.on('teacher:request_status_sync', async ({ roomName }: { roomName: string }) => {
        try {
          logger.info(`[TEACHER-COMMAND] Status Sync Requested for Room: ${roomName}`);
          if (healthMonitorService) {
            await healthMonitorService.broadcastStatus().catch(e => logger.error(`[SYNC-ERROR] ${e.message}`));
          }
          // MISSION 12: Also trigger an orchestration update to notify about wall screens
          if (displayAssignmentService) {
            await (displayAssignmentService as any).broadcastAssignment(roomName).catch((e: any) => logger.error(`[ORCH-SYNC-ERROR] ${e.message}`));
          }
        } catch (err: any) {
          logger.error(`[SYNC-REQ-ERROR] ${err.message}`);
        }
      });


      // TEACHER-ONLY SERVICES
      socket.on('teacher:mute_all', async ({ roomName }: { roomName: string }) => {
        logger.info(`[TEACHER-COMMAND] Global Mute Requested for Room: ${roomName}`);
        await stateService.setRoomState(roomName, { isMuted: true });
        this.io?.to(roomName).emit('force_mute', { targetIdentity: 'all' });
      });


      socket.on('teacher:force_mute', ({ roomName, targetIdentity }: { roomName: string, targetIdentity: string }) => {
        logger.info(`[TEACHER-COMMAND] Individual Mute: ${targetIdentity} in ${roomName}`);
        this.io?.to(roomName).emit('force_mute', { targetIdentity });
      });

      socket.on('teacher:force_camera_off', ({ roomName, targetIdentity }: { roomName: string, targetIdentity: string }) => {
        logger.info(`[TEACHER-COMMAND] Individual Camera Lock: ${targetIdentity} in ${roomName}`);
        this.io?.to(roomName).emit('force_camera_off', { targetIdentity });
      });

      socket.on('teacher:lower_hand', ({ roomName, targetIdentity }: { roomName: string, targetIdentity: string }) => {
        logger.info(`[TEACHER-COMMAND] Lower Hand: ${targetIdentity} in ${roomName}`);
        this.io?.to(roomName).emit('teacher:lower_hand', { targetIdentity });
      });


      // MISSION 14: GLOBAL CAMERA CONTROL
      socket.on('teacher:lock_cameras', async ({ roomName }: { roomName: string }) => {
        logger.info(`[TEACHER-COMMAND] Global Camera Lock Requested: ${roomName}`);
        await stateService.setRoomState(roomName, { isCameraLocked: true });
        this.io?.to(roomName).emit('force_camera_off', { targetIdentity: 'all' });
      });


      // MISSION 12: RECORDING CONTROL
      socket.on('teacher:toggle_recording_permission', async ({ roomName, allowed }: { roomName: string, allowed: boolean }) => {
        logger.info(`[TEACHER-COMMAND] Recording Permission → ${allowed} in Room: ${roomName}`);
        await stateService.setRoomState(roomName, { isRecordingAllowed: allowed });
        this.io?.to(roomName).emit('recording_permission_updated', { allowed });
      });

      socket.on('teacher:toggle_screenshare_permission', async ({ roomName, allowed }: { roomName: string, allowed: boolean }) => {
        logger.info(`[TEACHER-COMMAND] Screenshare Permission → ${allowed} in Room: ${roomName}`);
        await stateService.setRoomState(roomName, { isScreenShareAllowed: allowed });
        this.io?.to(roomName).emit('screenshare_permission_updated', { allowed });
      });

      socket.on('teacher:toggle_chat', async ({ roomName, enabled }: { roomName: string, enabled: boolean }) => {
        logger.info(`[TEACHER-COMMAND] Chat Toggle → ${enabled} in Room: ${roomName}`);
        await stateService.setRoomState(roomName, { isChatEnabled: enabled });
        this.io?.to(roomName).emit('chat_status_updated', { enabled });
      });

      
      // MISSION 15: STUDENT FEATURING (Multi-Display Orchestration)
      socket.on('teacher:feature_student', async ({ roomName, studentIdentity, destination }: { 
        roomName: string, studentIdentity: string, destination: 'wall' | 'dashboard' | 'none' 
      }) => {
        logger.info(`[TEACHER-COMMAND] Feature Student: ${studentIdentity} -> ${destination} in ${roomName}`);
        
        await stateService.setRoomState(roomName, { 
          featuredStudent: studentIdentity, 
          featuredDestination: destination 
        });
        
        // Broadcast update to all clients in the room
        this.io?.to(roomName).emit('room:featured_update', { 
          studentIdentity, 
          destination 
        });
      });

      // SCREEN SHARE PERMISSION: Teacher grants/revokes per student
      socket.on('teacher:grant_screenshare', ({ roomName, studentIdentity }: { roomName: string, studentIdentity: string }) => {
        logger.info(`[TEACHER-COMMAND] Grant Screen Share: ${studentIdentity} in ${roomName}`);
        // Relay directly to everyone in the room — the student-side filters by identity
        this.io?.to(roomName).emit('teacher:grant_screenshare', { studentIdentity });
      });

      socket.on('teacher:revoke_screenshare', ({ roomName, studentIdentity }: { roomName: string, studentIdentity: string }) => {
        logger.info(`[TEACHER-COMMAND] Revoke Screen Share: ${studentIdentity} in ${roomName}`);
        this.io?.to(roomName).emit('teacher:revoke_screenshare', { studentIdentity });
      });

      // MISSION 12: DISPLAY ORCHESTRATION
      socket.on('teacher:display_command', ({ roomName, command, payload }: { roomName: string, command: string, payload?: any }) => {
        logger.info(`[TEACHER-COMMAND] Display Command: ${command} -> ${roomName}`);
        this.io?.to(roomName).emit('display_command', { command, payload });
      });

      // --- SOVEREIGN WHITEBOARD PROTOCOL ---
      socket.on('whiteboard:open', ({ roomName }: { roomName: string }) => {
        socket.to(roomName).emit('whiteboard:open');
      });

      socket.on('whiteboard:close', ({ roomName }: { roomName: string }) => {
        socket.to(roomName).emit('whiteboard:close');
      });

      socket.on('whiteboard:delete_stroke', ({ roomName, strokeId }: { roomName: string, strokeId: string }) => {
        socket.to(roomName).emit('whiteboard:delete_stroke', { strokeId });
      });

      socket.on('whiteboard:draw', ({ roomName, data }: { roomName: string, data: any }) => {
        socket.to(roomName).emit('whiteboard:draw', data);
      });

      socket.on('whiteboard:clear', ({ roomName }: { roomName: string }) => {
        socket.to(roomName).emit('whiteboard:clear');
      });

      socket.on('whiteboard:undo', ({ roomName }: { roomName: string }) => {
        socket.to(roomName).emit('whiteboard:undo');
      });

      socket.on('whiteboard:set_background', ({ roomName, imageUrl }: { roomName: string, imageUrl: string }) => {
        socket.to(roomName).emit('whiteboard:set_background', { imageUrl });
      });

      socket.on('whiteboard:request_history', async ({ roomName }: { roomName: string }) => {
        // Return empty history for ephemeral behavior
        socket.emit('whiteboard:history', { history: [] });
      });

      // MISSION 03: GRID SCREEN REGISTRATION
      socket.on('display:register_screen', async ({ roomName, screenIndex, hardwareId }: { roomName: string, screenIndex: number, hardwareId: string }) => {
        socket.join(`${roomName}:screen:${screenIndex}`);
        socket.join(roomName);
        logger.info(`[DISPLAY-ENGINE] Screen ${screenIndex} (${hardwareId}) registered socket ${socket.id} in ${roomName}`);

        await displayAssignmentService.registerScreen(roomName, screenIndex);

        socket.once('disconnect', async () => {
          logger.info(`[DISPLAY-ENGINE] Screen ${screenIndex} (${hardwareId}) disconnected from ${roomName}`);
          await displayAssignmentService.unregisterScreen(roomName, screenIndex);
          await healthMonitorService.markOffline(hardwareId);
        });
      });

      // MISSION 04 + 05: Heartbeat from grid screen
      socket.on('display:heartbeat', async ({ hardwareId, screenIndex, lectureId, roomName, metrics }: {
        hardwareId: string, screenIndex?: number, lectureId?: string, roomName?: string, metrics?: any
      }) => {
        // MISSION 04: PERSIST TO DB (History tracking restored)
        roomOrchestratorService.updateHeartbeat(hardwareId, metrics).catch(() => { });

        // MISSION 05: Ingest into health monitor
        if (roomName) {
          await healthMonitorService.ingestHeartbeat({
            hardwareId,
            screenIndex: screenIndex ?? 0,
            lectureId: lectureId ?? '',
            roomName,
            metrics
          });
        }
      });

      // MISSION 03: STUDENT TRACKING
      socket.on('student:joined', async ({ roomName, identity }: { roomName: string, identity: string }) => {
        await displayAssignmentService.addStudent(roomName, identity);
      });

      socket.on('student:left', async ({ roomName, identity }: { roomName: string, identity: string }) => {
        await displayAssignmentService.removeStudent(roomName, identity);
      });

      // HYBRID MISSION 13: Join Room (Student/Teacher legacy)
      socket.on('join_room', async ({ roomName, identity, role }: { roomName: string, identity: string, role?: string }) => {
        const state = await stateService.getRoomState(roomName) || {};
        
        // ROOM LOCK: Block new students if room is locked (teachers always pass)
        if (state.isRoomLocked && role === 'student') {
          const hasGrace = await stateService.checkRoomGrace(roomName, identity);

          // Allow reconnection ONLY if student has an active grace record in Redis
          if (hasGrace) {
            logger.info(`[ROOM-LOCK] Distributed grace re-entry for ${identity} in ${roomName}`);
            // Remove from grace list — they get one re-entry
            await stateService.clearRoomGrace(roomName, identity);
          } else {
            logger.warn(`[ROOM-LOCK] Blocked student ${identity} — Room ${roomName} is locked and no grace record found.`);
            socket.emit('room:locked', { message: 'تم قفل قاعة الدراسة. لا يمكنك الدخول الآن.' });
            return;
          }
        }

        socket.join(roomName);
        socket.emit('sync_room_state', state);
        // Tag the socket with identity and role for grace list and orchestration lookups
        (socket as any).studentIdentity = identity;
        (socket as any).studentRoom = roomName;
        (socket as any).studentRole = role;
        logger.info(`[JOIN-ROOM] ${identity} (${role || 'unknown'}) joined ${roomName}`);


        // Track disconnect time if room is locked (for grace window)
        socket.on('disconnect', async () => {
          const currentState = await stateService.getRoomState(roomName);
          if (currentState?.isRoomLocked && role === 'student') {
            // Store grace in Redis with 5-minute TTL
            await stateService.setRoomGrace(roomName, identity, this.GRACE_WINDOW_SECONDS);
            logger.info(`[ROOM-LOCK] Distributed grace stored for ${identity} in ${roomName} (300s TTL)`);
          }
        });
      });

      // ROOM LOCK CONTROL
      socket.on('teacher:lock_room', async ({ roomName, locked }: { roomName: string, locked: boolean }) => {
        logger.info(`[TEACHER-COMMAND] Room ${roomName} lock set to: ${locked}`);
        await stateService.setRoomState(roomName, { isRoomLocked: locked });
        
        if (locked) {
          // Snapshot all currently connected students into the grace list (Distributed)
          const sockets = await this.io?.in(roomName).fetchSockets();
          
          if (sockets) {
            for (const s of sockets) {
              const identity = (s as any).studentIdentity;
              // Pre-populate with infinite grace (TTL only starts on disconnect)
              // We use a large TTL (e.g., 24h) or a sentinel value if we want them to stay forever while connected.
              // Actually, the disconnect handler will set the 5-min TTL.
              // Here, we just need to ensure they ARE in the "allowed" list if they drop.
              if (identity && (s as any).studentRole === 'student') {
                await stateService.setRoomGrace(roomName, identity, 86400); // 24h safety while connected
              }
            }
          }
          logger.info(`[ROOM-LOCK] Distributed grace list initialized for ${roomName}`);
        } else {
          // Clear all grace records for this room would be ideal, 
          // but since they expire anyway and check is only done when locked, 
          // we just log it. Unlock means the check is skipped.
          logger.info(`[ROOM-LOCK] Room ${roomName} unlocked. Grace records will expire naturally.`);
        }

        // Broadcast status change — existing students stay connected
        this.io?.to(roomName).emit('room:lock_changed', { locked });
      });

      // RESTORED: LEGACY SECURITY
      socket.on('force_mute', () => logger.warn('[SECURITY] Blocked legacy force_mute'));
      socket.on('force_unmute', () => logger.warn('[SECURITY] Blocked legacy force_unmute'));

      // RESTORED: STUDENT TELEMETRY
      socket.on('participant:raise_hand', ({ roomName, identity, raised }: { roomName: string, identity: string, raised: boolean }) => {
        logger.info(`[STUDENT-INTERACTION] Hand Event: ${identity} in ${roomName} -> ${raised}`);
        this.io?.to(roomName).emit('participant:raise_hand', { identity, raised });
      });

      socket.on('participant_mic_on', ({ roomName }: { roomName: string }) => {
        logger.info(`[STUDENT-SERVICE] Telemetry: Student turned Mic ON in ${roomName}`);
      });

      // MISSION 12: CHAT CONTROL
      socket.on('teacher:toggle_chat', async ({ roomName, enabled }: { roomName: string, enabled: boolean }) => {
        logger.info(`[TEACHER-COMMAND] Chat permission set to ${enabled} for room: ${roomName}`);
        await stateService.setRoomState(roomName, { isChatEnabled: enabled });
        this.io?.to(roomName).emit('chat:permission_changed', { enabled });
      });

      socket.on('chat:send_message', async ({ roomName, text, sender, role, file }: { 
        roomName: string, text: string, sender: string, role: string, file?: { url: string, name: string, size: number } 
      }) => {
        const state = await stateService.getRoomState(roomName);
        if (role !== 'teacher' && state?.isChatEnabled === false) {
           socket.emit('chat:error', { message: 'Chat is currently disabled by the teacher.' });
           return;
        }

        // MISSION 22: REJECT BINARY BOMB
        if (file && (file as any).data) {
          logger.error(`[CHAT-SECURITY] Blocked binary payload attempt from ${sender}`);
          socket.emit('chat:error', { message: 'Binary file transfer via Sockets is forbidden. Use the upload API.' });
          return;
        }

        // MISSION 22: ENFORCE TEACHER-ONLY FILES
        if (file && role !== 'teacher') {
          logger.warn(`[CHAT-SECURITY] Student ${sender} attempted to share file metadata. Blocked.`);
          socket.emit('chat:error', { message: 'Only teachers can share files.' });
          return;
        }

        // Word Count Check (Max 300 words)
        const wordCount = text.trim().split(/\s+/).length;
        if (wordCount > 300) {
           socket.emit('chat:error', { message: 'Message too long. Maximum 300 words allowed.' });
           return;
        }

        logger.info(`[CHAT] Public: ${sender} in ${roomName} ${file ? `(Shared URL: ${file.name})` : ''}`);
        const payload = { 
          id: `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          text, sender, role, timestamp: Date.now(),
          file: file ? { url: file.url, name: file.name, size: file.size } : undefined
        };
        await stateService.saveChatMessage(roomName, payload);
        this.io?.to(roomName).emit('chat:receive_message', payload);
      });

      socket.on('chat:send_private', async ({ roomName, text, sender, targetIdentity, role, file }: { 
        roomName: string, text: string, sender: string, targetIdentity: string, role: string, file?: { url: string, name: string, size: number }
      }) => {
        // MISSION 22: REJECT BINARY BOMB
        if (file && (file as any).data) {
          socket.emit('chat:error', { message: 'Binary file transfer via Sockets is forbidden.' });
          return;
        }

        // MISSION 22: ENFORCE TEACHER-ONLY FILES
        if (file && role !== 'teacher') {
          socket.emit('chat:error', { message: 'Only teachers can share files.' });
          return;
        }

        // Word Count Check (Max 300 words)
        const wordCount = text.trim().split(/\s+/).length;
        if (wordCount > 300) {
           socket.emit('chat:error', { message: 'Message too long. Maximum 300 words allowed.' });
           return;
        }

        logger.info(`[CHAT] Private: from ${sender} (as ${role}) to ${targetIdentity} in ${roomName} ${file ? `(Shared URL: ${file.name})` : ''}`);
        const payload = {
          id: `pmsg_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          text, sender, targetIdentity, role, timestamp: Date.now(), isPrivate: true,
          file: file ? { url: file.url, name: file.name, size: file.size } : undefined
        };
        await stateService.saveChatMessage(roomName, payload);
        this.io?.to(roomName).emit('chat:receive_private', payload); 
      });

      socket.on('chat:request_history', async ({ roomName }: { roomName: string }) => {
        const history = await stateService.getChatMessages(roomName);
        socket.emit('chat:history', { history });
      });

      socket.on('end_session', async ({ roomName }: { roomName: string }) => {
        this.io?.to(roomName).emit('session_ended');
        this.io?.to(roomName).emit('display_command', { command: 'close_all' });
        await stateService.clearChatMessages(roomName);
        logger.info(`[TEACHER-COMMAND] Session Ended & Chat Cleared for: ${roomName}`);
      });

      // ═══════════════════════════════════════════════════════════════════════
      // SCREENS HUB — Targeted Student Monitoring
      // ═══════════════════════════════════════════════════════════════════════

      /**
       * screen:register — A display (Wall or Kiosk) registers for a specific screen index.
       * Used for showing a specific subset of students assigned by the teacher.
       */
      socket.on('screen:register', async ({ roomName, screenIndex }: { roomName: string, screenIndex: number }) => {
        if (!roomName || screenIndex === undefined) return;
        
        const socketRoom = `${roomName}:screen:${screenIndex}`;
        socket.join(socketRoom);
        logger.info(`[DISPLAY-HUB] Socket ${socket.id} joined targeted monitor: ${socketRoom}`);

        // Register with assignment engine to trigger rebalance/initial data
        await displayAssignmentService.registerScreen(roomName, screenIndex);
        
        // Push initial data immediately
        const assignments = await displayAssignmentService.getAssignments(roomName);
        const students = assignments[`screen:${screenIndex}`] || [];
        socket.emit('display:rebalance', { students, screenIndex });
      });

      /**
       * screen:auto_register — Display asks for an automatic assignment.
       */
      socket.on('screen:auto_register', async ({ roomName, hardwareId }: { roomName: string, hardwareId: string }) => {
        if (!roomName || !hardwareId) return;
        const assignedIndex = await displayAssignmentService.autoRegisterScreen(roomName, socket.id, hardwareId);
        
        const socketRoom = `${roomName}:screen:${assignedIndex}`;
        socket.join(socketRoom);
        
        socket.emit('display:rebalance', { 
          students: (await displayAssignmentService.getAssignments(roomName))[`screen:${assignedIndex}`] || [],
          screenIndex: assignedIndex 
        });
      });

      // ═══════════════════════════════════════════════════════════════════════
      // WALL GROUPS — Zero-Touch Display Navigation
      // ═══════════════════════════════════════════════════════════════════════

      /**
       * wall:register — Wall display announces its group on connect.
       * Immediately checks Redis for an active_room (Late Joiner / Crash Recovery).
       * If found → pushes wall:navigate instantly without teacher action.
       */
      socket.on('wall:register', async ({ groupName }: { groupName: string }) => {
        if (!groupName) return;

        // Join the socket.io room for this wall group
        const socketRoom = `wall:${groupName}`;
        socket.join(socketRoom);
        // Tag socket for cleanup on disconnect
        (socket as any).wallGroup = groupName;

        logger.info(`[WALL-GROUPS] Display ${socket.id} registered in group "${groupName}"`);

        // LATE JOINER CHECK: Is there an active lecture for this group?
        try {
          const activeRoom = await stateService.getWallGroupRoom(groupName);
          if (activeRoom) {
            logger.info(`[WALL-GROUPS] Late Joiner detected — pushing room "${activeRoom}" to ${socket.id}`);
            socket.emit('wall:navigate', { roomName: activeRoom, groupName });
          } else {
            socket.emit('wall:idle', { groupName });
          }
        } catch (err: any) {
          logger.error(`[WALL-GROUPS] Late joiner check failed: ${err.message}`);
          socket.emit('wall:idle', { groupName });
        }
      });

      /**
       * teacher:push_to_walls — Teacher sends a lecture to a wall group.
       * 1. Saves roomName to Redis (durable state for Late Joiners)
       * 2. Emits wall:navigate to ALL connected displays in that group instantly
       */
      socket.on('teacher:push_to_walls', async ({
        groupName, roomName, teacherRoomName
      }: { groupName: string; roomName: string; teacherRoomName: string }) => {
        if (!groupName || !roomName) return;

        logger.info(`[WALL-GROUPS] Teacher pushed room "${roomName}" → group "${groupName}"`);

        try {
          // Persist to Redis for crash recovery
          await stateService.setWallGroupRoom(groupName, roomName);

          // Broadcast to all displays in this group
          const socketRoom = `wall:${groupName}`;
          this.io?.to(socketRoom).emit('wall:navigate', { roomName, groupName });

          // Confirm back to teacher
          socket.emit('wall:push_confirmed', { groupName, roomName, timestamp: Date.now() });
        } catch (err: any) {
          logger.error(`[WALL-GROUPS] push_to_walls failed: ${err.message}`);
          socket.emit('wall:push_error', { message: 'Failed to push to wall group' });
        }
      });

      /**
       * teacher:release_walls — Teacher releases a wall group back to idle.
       * Clears Redis state and notifies all displays to return to idle screen.
       */
      socket.on('teacher:release_walls', async ({ groupName }: { groupName: string }) => {
        if (!groupName) return;

        logger.info(`[WALL-GROUPS] Teacher released group "${groupName}" → idle`);

        try {
          await stateService.clearWallGroupRoom(groupName);
          this.io?.to(`wall:${groupName}`).emit('wall:idle', { groupName });
          socket.emit('wall:release_confirmed', { groupName, timestamp: Date.now() });
        } catch (err: any) {
          logger.error(`[WALL-GROUPS] release_walls failed: ${err.message}`);
        }
      });

      // ═══════════════════════════════════════════════════════════════════════

      socket.on('disconnect', async () => {
        const wallGroup = (socket as any).wallGroup;
        if (wallGroup) {
          logger.info(`[WALL-GROUPS] Display ${socket.id} disconnected from group "${wallGroup}"`);
        }
        
        // MISSION 12: STUDENT ORCHESTRATION CLEANUP
        const { studentIdentity, studentRoom, studentRole } = socket as any;
        if (studentRole === 'student' && studentIdentity && studentRoom) {
          logger.info(`[ORCHESTRATOR] Student ${studentIdentity} disconnected. Removing from assignments...`);
          await displayAssignmentService.removeStudent(studentRoom, studentIdentity);
        }

        // Cleanup auto-assigned screen
        await displayAssignmentService.handleDisconnect(socket.id);

        logger.info(`[MISSION-12] Sync Node Disconnected: ${socket.id}`);
      });

    });


    logger.info('[MISSION-12] Sovereign Sync Engine Active');
  }

  emitToRoom(roomName: string, event: string, data: any) {
    if (this.io) {
      this.io.to(roomName).emit(event, data);
    }
  }

  getIO() {
    return this.io;
  }
}

export const socketService = new SocketService();
