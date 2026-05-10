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

  async init(server: HttpServer) {
    this.io = new Server(server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST', 'PATCH']
      },
      transports: ['polling', 'websocket'], // Allow polling fallback for connection stability in all environments
      pingTimeout: 60000,
      pingInterval: 25000,
      maxHttpBufferSize: 50e6 // 50MB limit for file uploads via socket
    });

    // MISSION 07: DISTRIBUTED SYNC (REDIS ADAPTER)
    // Critical for multi-node deployments (Millions of users)
    const pubClient = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
    const subClient = pubClient.duplicate();

    await Promise.all([pubClient.connect(), subClient.connect()]);
    this.io.adapter(createAdapter(pubClient, subClient));
    logger.info('[REDIS-ADAPTER] Distributed Sync Active');

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
        logger.info(`[TEACHER-COMMAND] Recording permission set to ${allowed} for room: ${roomName}`);
        await stateService.setRoomState(roomName, { isRecordingAllowed: allowed });
        this.io?.to(roomName).emit('recording_permission_changed', { allowed });
      });

      // MISSION 12: DISPLAY ORCHESTRATION
      socket.on('teacher:display_command', ({ roomName, command, payload }: { roomName: string, command: string, payload?: any }) => {
        logger.info(`[TEACHER-COMMAND] Display Command: ${command} -> ${roomName}`);
        this.io?.to(roomName).emit('display_command', { command, payload });
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
      socket.on('join_room', async ({ roomName, identity }: { roomName: string, identity: string }) => {
        socket.join(roomName);
        const state = await stateService.getRoomState(roomName) || { isMuted: false };
        socket.emit('sync_room_state', state);
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
        roomName: string, text: string, sender: string, role: string, file?: any 
      }) => {
        const state = await stateService.getRoomState(roomName);
        if (role !== 'teacher' && state?.isChatEnabled === false) {
           socket.emit('chat:error', { message: 'Chat is currently disabled by the teacher.' });
           return;
        }

        // Word Count Check (Max 300 words)
        const wordCount = text.trim().split(/\s+/).length;
        if (wordCount > 300) {
           socket.emit('chat:error', { message: 'Message too long. Maximum 300 words allowed.' });
           return;
        }

        logger.info(`[CHAT] Public: ${sender} in ${roomName} ${file ? `(with file: ${file.name}, ${Math.round(file.size / 1024 / 1024)}MB)` : ''}`);
        const payload = { 
          id: `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          text, sender, role, timestamp: Date.now(),
          file // Optional file object: { data, name, type, size }
        };
        await stateService.saveChatMessage(roomName, payload);
        this.io?.to(roomName).emit('chat:receive_message', payload);
      });

      socket.on('chat:send_private', async ({ roomName, text, sender, targetIdentity, role, file }: { 
        roomName: string, text: string, sender: string, targetIdentity: string, role: string, file?: any
      }) => {
        // Word Count Check (Max 300 words)
        const wordCount = text.trim().split(/\s+/).length;
        if (wordCount > 300) {
           socket.emit('chat:error', { message: 'Message too long. Maximum 300 words allowed.' });
           return;
        }

        logger.info(`[CHAT] Private: from ${sender} (as ${role}) to ${targetIdentity} in ${roomName} ${file ? `(with file: ${file.name}, ${Math.round(file.size / 1024 / 1024)}MB)` : ''}`);
        const payload = {
          id: `pmsg_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          text, sender, targetIdentity, role, timestamp: Date.now(), isPrivate: true,
          file
        };
        await stateService.saveChatMessage(roomName, payload);
        this.io?.to(roomName).emit('chat:receive_private', payload); 
      });

      socket.on('chat:request_history', async ({ roomName }: { roomName: string }) => {
        const history = await stateService.getChatMessages(roomName);
        // OPTIMIZATION: Strip large file data from history to prevent socket lag
        const leanHistory = history.map(msg => {
          if (msg.file) {
            const { data, ...metadata } = msg.file;
            return { ...msg, file: { ...metadata, hasData: !!data } };
          }
          return msg;
        });
        socket.emit('chat:history', { history: leanHistory });
      });

      // NEW: REQUEST SPECIFIC FILE DATA
      socket.on('chat:get_file', async ({ roomName, messageId }: { roomName: string, messageId: string }) => {
        const history = await stateService.getChatMessages(roomName);
        const msg = history.find(m => m.id === messageId);
        if (msg && msg.file) {
          socket.emit('chat:file_data', { messageId, file: msg.file });
        }
      });

      socket.on('end_session', async ({ roomName }: { roomName: string }) => {
        this.io?.to(roomName).emit('session_ended');
        this.io?.to(roomName).emit('display_command', { command: 'close_all' });
        await stateService.clearChatMessages(roomName);
        logger.info(`[TEACHER-COMMAND] Session Ended & Chat Cleared for: ${roomName}`);
      });

      socket.on('disconnect', () => {
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
