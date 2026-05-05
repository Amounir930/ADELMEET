import { Display } from '../models/Display';
import { displayAssignmentService } from './display-assignment.service';
import { socketService } from './socket.service';
import logger from '../infra/logger';

/**
 * MISSION 04: SOVEREIGN ROOM ORCHESTRATOR
 * Central authority for all screen management:
 * - Display registration & persistence
 * - Heartbeat tracking & offline detection
 * - Assignment coordination with DisplayAssignmentService
 * - Remote command dispatch
 */

interface RegisterDisplayDTO {
  hardwareId: string;
  roomId: string;
  lectureId?: string;
  displayIndex: number;
  ipAddress?: string;
}

class RoomOrchestratorService {

  // ─── DISPLAY REGISTRATION ──────────────────────────────────────────────────

  /**
   * Register or update a display.
   * Returns the upserted display document.
   */
  async registerDisplay(data: RegisterDisplayDTO) {
    const display = await Display.findOneAndUpdate(
      { hardwareId: data.hardwareId },
      {
        ...data,
        status: 'online',
        lastHeartbeat: new Date()
      },
      { upsert: true, new: true }
    );

    logger.info(`[ORCHESTRATOR] Display registered: ${data.hardwareId} (index ${data.displayIndex}) for lecture ${data.lectureId || 'none'}`);

    // Wire into the in-memory assignment engine
    if (data.lectureId) {
      displayAssignmentService.registerScreen(data.lectureId, data.displayIndex);
    }

    return display;
  }

  // ─── ASSIGNMENT ────────────────────────────────────────────────────────────

  /**
   * Returns the current assignment state for a lecture.
   */
  async computeAssignment(lectureId: string) {
    const displays = await Display.find({ lectureId, status: 'online' }).sort('displayIndex');
    const assignments = await displayAssignmentService.getAssignments(lectureId);

    const totalStudents = Object.values(assignments).reduce((s: number, students: string[]) => s + students.length, 0);

    return {
      lectureId,
      totalStudents,
      totalScreens: displays.length,
      studentsPerScreen: displays.length ? Math.ceil(totalStudents / displays.length) : 0,
      screens: displays.map(d => {
        const students = assignments[`screen:${d.displayIndex}`] ?? [];
        return {
          screenIndex: d.displayIndex,
          hardwareId: d.hardwareId,
          status: d.status,
          students: students,
          studentCount: students.length,
          lastHeartbeat: d.lastHeartbeat,
          isAlive: (Date.now() - new Date(d.lastHeartbeat).getTime()) < 30_000
        };
      })
    };
  }

  /**
   * Force a full rebalance and broadcast to all screens.
   */
  async rebalance(lectureId: string): Promise<void> {
    displayAssignmentService.rebalance(lectureId);
    logger.info(`[ORCHESTRATOR] Manual rebalance triggered for lecture ${lectureId}`);
  }

  // ─── HEARTBEAT ─────────────────────────────────────────────────────────────

  async updateHeartbeat(hardwareId: string, metrics?: { cpu?: number; ram?: number }) {
    const display = await Display.findOneAndUpdate(
      { hardwareId },
      { lastHeartbeat: new Date(), status: 'online' },
      { new: true }
    );

    if (!display) {
      logger.warn(`[ORCHESTRATOR] Heartbeat from unknown display: ${hardwareId}`);
      return null;
    }

    logger.info(`[ORCHESTRATOR] Heartbeat: ${hardwareId} (CPU: ${metrics?.cpu ?? '?'}%, RAM: ${metrics?.ram ?? '?'}%)`);
    return display;
  }

  /**
   * Periodic job: mark displays with stale heartbeats as offline
   * and redistribute their students.
   */
  async detectOfflineDisplays(): Promise<void> {
    const threshold = new Date(Date.now() - 30_000);
    const stale = await Display.find({ status: 'online', lastHeartbeat: { $lt: threshold } });

    for (const display of stale) {
      await Display.findByIdAndUpdate(display._id, { status: 'offline' });
      logger.warn(`[ORCHESTRATOR] Display ${display.hardwareId} (index ${display.displayIndex}) went offline`);

      if (display.lectureId) {
        displayAssignmentService.unregisterScreen(display.lectureId.toString(), display.displayIndex);
      }
    }
  }

  // ─── COMMAND DISPATCH ──────────────────────────────────────────────────────

  /**
   * Send a targeted command to a specific screen via Socket.io.
   * Commands: 'refresh' | 'close' | 'set_quality' | 'rebalance'
   */
  async sendCommand(lectureId: string, screenIndex: number, command: string, params?: any): Promise<void> {
    const io = socketService.getIO();
    if (!io) {
      logger.error('[ORCHESTRATOR] Socket.io not initialized — cannot dispatch command');
      return;
    }

    const channel = `${lectureId}:screen:${screenIndex}`;
    io.to(channel).emit('display_command', { command, payload: params });
    logger.info(`[ORCHESTRATOR] Command "${command}" dispatched to screen ${screenIndex} in lecture ${lectureId}`);
  }

  /**
   * Broadcast a command to ALL screens of a lecture.
   */
  async broadcastCommand(lectureId: string, command: string, params?: any): Promise<void> {
    const io = socketService.getIO();
    if (!io) return;

    const displays = await Display.find({ lectureId, status: 'online' });
    for (const d of displays) {
      io.to(`${lectureId}:screen:${d.displayIndex}`).emit('display_command', { command, payload: params });
    }
    logger.info(`[ORCHESTRATOR] Broadcast "${command}" to ${displays.length} screens in lecture ${lectureId}`);
  }
}

export const roomOrchestratorService = new RoomOrchestratorService();

// Start the offline-detection watchdog (every 15 seconds)
setInterval(() => {
  roomOrchestratorService.detectOfflineDisplays().catch((err: any) =>
    logger.error(`[ORCHESTRATOR] Offline detection error: ${err.message || err}`)
  );
}, 15_000);
