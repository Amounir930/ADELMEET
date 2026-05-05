import { Server } from 'socket.io';
import { Server as HttpServer } from 'http';
import logger from '../infra/logger';
import { stateService } from './state.service';
import { healthMonitorService } from './health-monitor.service';
import { displayAssignmentService } from './display-assignment.service';
import { roomOrchestratorService } from './room-orchestrator.service';

/**
 * MISSION 12: SOVEREIGN SYNC ENGINE (SOCKET)
 * Optimized for Targeted Sync, High-Concurrency, and Distributed State.
 */
class SocketService {
  private io: Server | null = null;

  init(server: HttpServer) {
    this.io = new Server(server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST', 'PATCH']
      },
      transports: ['websocket'] // SCALE MANDATE
    });

    // Initialize Engines with Dependency Injection
    displayAssignmentService.init(this.io);
    healthMonitorService.init(this.io, displayAssignmentService);

    this.io.on('connection', (socket) => {
      logger.info(`[MISSION-12] Sync Node Connected: ${socket.id}`);

      // MISSION 13: SOVEREIGN TEACHER HANDSHAKE
      socket.on('teacher:join_room', async ({ roomName, identity }: { roomName: string, identity: string }) => {
        socket.join(roomName);
        logger.info(`[TEACHER-SERVICE] Sovereign Entry: ${identity} joined ${roomName}`);
        
        const state = await stateService.getRoomState(roomName) || { isMuted: false };
        socket.emit('sync_room_state', state);
      });

      // TEACHER-ONLY SERVICES
      socket.on('teacher:mute_all', async ({ roomName }: { roomName: string }) => {
        logger.info(`[TEACHER-COMMAND] Global Mute Requested for Room: ${roomName}`);
        await stateService.setRoomState(roomName, { isMuted: true });
        this.io?.to(roomName).emit('force_mute', { targetIdentity: 'all' });
      });

      socket.on('teacher:unmute_all', async ({ roomName }: { roomName: string }) => {
        logger.info(`[TEACHER-COMMAND] Global Unmute Requested for Room: ${roomName}`);
        await stateService.setRoomState(roomName, { isMuted: false });
        this.io?.to(roomName).emit('force_unmute', { targetIdentity: 'all' });
      });

      socket.on('teacher:force_mute', ({ roomName, targetIdentity }: { roomName: string, targetIdentity: string }) => {
        this.io?.to(roomName).emit('force_mute', { targetIdentity });
      });

      socket.on('teacher:force_unmute', ({ roomName, targetIdentity }: { roomName: string, targetIdentity: string }) => {
        this.io?.to(roomName).emit('force_unmute', { targetIdentity });
      });

      // MISSION 12: DISPLAY ORCHESTRATION
      socket.on('teacher:display_command', ({ roomName, command, payload }: { roomName: string, command: string, payload?: any }) => {
        logger.info(`[TEACHER-COMMAND] Display Command: ${command} -> ${roomName}`);
        this.io?.to(roomName).emit('display_command', { command, payload });
      });

      // MISSION 03: GRID SCREEN REGISTRATION
      socket.on('display:register_screen', async ({ roomName, screenIndex }: { roomName: string, screenIndex: number }) => {
        socket.join(`${roomName}:screen:${screenIndex}`);
        socket.join(roomName);
        logger.info(`[DISPLAY-ENGINE] Screen ${screenIndex} registered socket ${socket.id} in ${roomName}`);

        await displayAssignmentService.registerScreen(roomName, screenIndex);

        socket.once('disconnect', async () => {
          logger.info(`[DISPLAY-ENGINE] Screen ${screenIndex} disconnected from ${roomName}`);
          await displayAssignmentService.unregisterScreen(roomName, screenIndex);
          await healthMonitorService.markOffline(`screen_${screenIndex}`);
        });
      });

      // MISSION 04 + 05: Heartbeat from grid screen
      socket.on('display:heartbeat', async ({ hardwareId, screenIndex, lectureId, roomName, metrics }: {
        hardwareId: string, screenIndex?: number, lectureId?: string, roomName?: string, metrics?: any
      }) => {
        // MISSION 04: PERSIST TO DB (History tracking restored)
        roomOrchestratorService.updateHeartbeat(hardwareId, metrics).catch(() => {});

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
      socket.on('participant_mic_on', ({ roomName }: { roomName: string }) => {
        logger.info(`[STUDENT-SERVICE] Telemetry: Student turned Mic ON in ${roomName}`);
      });

      socket.on('end_session', ({ roomName }: { roomName: string }) => {
        this.io?.to(roomName).emit('session_ended');
        this.io?.to(roomName).emit('display_command', { command: 'close_all' });
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
