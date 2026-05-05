import { Server } from 'socket.io';
import { Server as HttpServer } from 'http';
import logger from '../infra/logger';

/**
 * MISSION 12: SOVEREIGN SYNC ENGINE (SOCKET)
 * Optimized for Targeted Sync and High-Concurrency.
 */
class SocketService {
  private io: Server | null = null;
  private roomStates: Map<string, { isMuted: boolean }> = new Map();

  init(server: HttpServer) {
    this.io = new Server(server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST', 'PATCH']
      },
      transports: ['websocket'] // SCALE MANDATE
    });

    // MISSION 03: Init Display Assignment Engine with our socket server
    const { displayAssignmentService } = require('./display-assignment.service');
    displayAssignmentService.init(this.io);

    // MISSION 05: Init Health Monitor
    const { healthMonitorService } = require('./health-monitor.service');
    healthMonitorService.init(this.io);

    this.io.on('connection', (socket) => {
      logger.info(`[MISSION-12] Sync Node Connected: ${socket.id}`);

      // MISSION 12 - ROLE ISOLATION
      // MISSION 13: SOVEREIGN TEACHER HANDSHAKE
      socket.on('teacher:join_room', ({ roomName, identity }: { roomName: string, identity: string }) => {
        socket.join(roomName);
        logger.info(`[TEACHER-SERVICE] Sovereign Entry: ${identity} joined ${roomName}`);
        const state = this.roomStates.get(roomName) || { isMuted: false };
        socket.emit('sync_room_state', state);
      });

      // MISSION 04/05: TEACHER COMMAND DISPATCH
      socket.on('teacher:display_command', ({ roomName, command, payload }: { roomName: string, command: string, payload?: any }) => {
        logger.info(`[ORCHESTRATOR] Teacher command '${command}' for room ${roomName}`);
        const { roomOrchestratorService } = require('./room-orchestrator.service');
        if (command === 'refresh_one' && payload !== undefined) {
           roomOrchestratorService.sendCommand(roomName, payload, 'refresh_one', payload);
        } else {
           roomOrchestratorService.broadcastCommand(roomName, command, payload);
        }
      });

      // TEACHER-ONLY SERVICES (MISSION 13 UPGRADED)
      socket.on('teacher:mute_all', ({ roomName }: { roomName: string }) => {
        logger.info(`[TEACHER-COMMAND] Global Mute Requested for Room: ${roomName}`);
        this.roomStates.set(roomName, { isMuted: true });
        this.io?.to(roomName).emit('force_mute', { targetIdentity: 'all' });
        logger.info(`[TEACHER-COMMAND] Broadcast Sent: force_mute (all) -> ${roomName}`);
      });

      socket.on('teacher:unmute_all', ({ roomName }: { roomName: string }) => {
        logger.info(`[TEACHER-COMMAND] Global Unmute Requested for Room: ${roomName}`);
        this.roomStates.set(roomName, { isMuted: false });
        this.io?.to(roomName).emit('force_unmute', { targetIdentity: 'all' });
        logger.info(`[TEACHER-COMMAND] Broadcast Sent: force_unmute (all) -> ${roomName}`);
      });

      socket.on('teacher:force_mute', ({ roomName, targetIdentity }: { roomName: string, targetIdentity: string }) => {
        logger.info(`[TEACHER-COMMAND] Targeted Mute Requested: ${targetIdentity} in ${roomName}`);
        this.io?.to(roomName).emit('force_mute', { targetIdentity });
        logger.info(`[TEACHER-COMMAND] Broadcast Sent: force_mute (${targetIdentity}) -> ${roomName}`);
      });

      socket.on('teacher:force_unmute', ({ roomName, targetIdentity }: { roomName: string, targetIdentity: string }) => {
        logger.info(`[TEACHER-COMMAND] Targeted Unmute Requested: ${targetIdentity} in ${roomName}`);
        this.io?.to(roomName).emit('force_unmute', { targetIdentity });
        logger.info(`[TEACHER-COMMAND] Broadcast Sent: force_unmute (${targetIdentity}) -> ${roomName}`);
      });

      // MISSION 12: DISPLAY ORCHESTRATION (Grid Control)
      socket.on('teacher:display_command', ({ roomName, command, payload }: { roomName: string, command: string, payload?: any }) => {
        logger.info(`[TEACHER-COMMAND] Display Command: ${command} -> ${roomName}`);
        this.io?.to(roomName).emit('display_command', { command, payload });
      });

      // MISSION 03: GRID SCREEN REGISTRATION
      socket.on('display:register_screen', ({ roomName, screenIndex }: { roomName: string, screenIndex: number }) => {
        // Join screen-specific channel for targeted broadcasts
        socket.join(`${roomName}:screen:${screenIndex}`);
        socket.join(roomName); // also join main room for global commands
        logger.info(`[DISPLAY-ENGINE] Screen ${screenIndex} registered socket ${socket.id} in ${roomName}`);

        const { displayAssignmentService } = require('./display-assignment.service');
        displayAssignmentService.registerScreen(roomName, screenIndex);

        // On disconnect: auto-unregister and notify remaining screens
        socket.once('disconnect', () => {
          logger.info(`[DISPLAY-ENGINE] Screen ${screenIndex} disconnected from ${roomName}`);
          displayAssignmentService.unregisterScreen(roomName, screenIndex);

          // MISSION 05: Mark offline instead of removing so the teacher still sees it
          const { healthMonitorService } = require('./health-monitor.service');
          healthMonitorService.markOffline(`screen_${screenIndex}`);

          // Tell all remaining screens the new totalScreens count so they recalculate
          const state = displayAssignmentService.getState(roomName);
          const remainingScreens: number = state?.assignments?.length ?? 0;
          const activeIndices = Array.from(state?.screenIndices || []).sort((a: any, b: any) => a - b);
          logger.info(`[DISPLAY-ENGINE] Broadcasting rebalance to room ${roomName}: ${remainingScreens} screens remaining`);

          if (remainingScreens > 0) {
            // Use display_command so each screen navigates with correct totalScreens in URL
            this.io?.to(roomName).emit('display_command', {
              command: 'rebalance',
              payload: {
                totalScreens: remainingScreens,
                activeIndices: activeIndices
              }
            });
          }
        });
      });

      // MISSION 04 + 05: Heartbeat from grid screen
      socket.on('display:heartbeat', ({ hardwareId, screenIndex, lectureId, roomName, metrics }: {
        hardwareId: string, screenIndex?: number, lectureId?: string, roomName?: string, metrics?: any
      }) => {
        // Persist heartbeat to DB
        const { roomOrchestratorService } = require('./room-orchestrator.service');
        roomOrchestratorService.updateHeartbeat(hardwareId, metrics).catch(() => {});

        // MISSION 05: Ingest into health monitor
        if (roomName) {
          const { healthMonitorService } = require('./health-monitor.service');
          healthMonitorService.ingestHeartbeat({
            hardwareId,
            screenIndex: screenIndex ?? 0,
            lectureId: lectureId ?? '',
            roomName,
            metrics
          });
        }
      });

      // MISSION 03: STUDENT TRACKING (called by LiveKit webhook or student socket join)
      socket.on('student:joined', ({ roomName, identity }: { roomName: string, identity: string }) => {
        logger.info(`[DISPLAY-ENGINE] Student joined: ${identity} in ${roomName}`);
        const { displayAssignmentService } = require('./display-assignment.service');
        displayAssignmentService.addStudent(roomName, identity);
      });

      socket.on('student:left', ({ roomName, identity }: { roomName: string, identity: string }) => {
        logger.info(`[DISPLAY-ENGINE] Student left: ${identity} in ${roomName}`);
        const { displayAssignmentService } = require('./display-assignment.service');
        displayAssignmentService.removeStudent(roomName, identity);
      });

      // LEGACY & STUDENT ENTRY (HYBRID MISSION 13)
      socket.on('join_room', ({ roomName, identity }: { roomName: string, identity: string }) => {
        socket.join(roomName);
        logger.info(`[STUDENT-SERVICE] Consumer Entry: ${identity} joined ${roomName}`);
        const state = this.roomStates.get(roomName) || { isMuted: false };
        socket.emit('sync_room_state', state);
      });

      socket.on('force_mute', () => logger.warn('[SECURITY] Blocked legacy force_mute'));
      socket.on('force_unmute', () => logger.warn('[SECURITY] Blocked legacy force_unmute'));

      // STUDENT-ONLY SERVICES
      socket.on('participant_mic_on', ({ roomName }: { roomName: string }) => {
        logger.info(`[STUDENT-SERVICE] Telemetry: Student turned Mic ON in ${roomName}`);
      });

      // MISSION 13: GLOBAL TEARDOWN COMMAND
      socket.on('end_session', ({ roomName }: { roomName: string }) => {
        logger.info(`[TEACHER-COMMAND] End Session Requested: ${roomName}`);
        // 1. Tell all students to redirect
        this.io?.to(roomName).emit('session_ended');
        // 2. Tell all grid screens to close
        this.io?.to(roomName).emit('display_command', { command: 'close_all' });
        logger.info(`[TEACHER-COMMAND] Broadcast Sent: session_ended & close_all -> ${roomName}`);
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
      logger.info(`[SOCKET-ORCHESTRA] Targeted Emit: ${event} -> ${roomName}`);
    }
  }

  getIO() {
    return this.io;
  }
}

export const socketService = new SocketService();
