import { Server as SocketServer } from 'socket.io';
import logger from '../infra/logger';

/**
 * MISSION 05: SOVEREIGN HEALTH MONITOR
 * Tracks per-screen health metrics from heartbeats.
 * Detects offline / warning states and broadcasts alerts to the teacher.
 */

export type ScreenStatus = 'online' | 'warning' | 'offline';

export interface ScreenMetrics {
  cpu: number;
  ram: number;
  fps: number;
  bandwidth: number;
  studentsRendered: number;
  errors: number;
}

export interface DisplayHealth {
  hardwareId: string;
  screenIndex: number;
  lectureId: string;
  roomName: string;
  status: ScreenStatus;
  metrics: ScreenMetrics;
  lastHeartbeat: number;   // epoch ms
  alertSent: boolean;
}

class HealthMonitorService {
  private io: SocketServer | null = null;
  private displayStates: Map<string, DisplayHealth> = new Map();
  private monitorInterval: ReturnType<typeof setInterval> | null = null;

  // ─── INIT ──────────────────────────────────────────────────────────────────

  init(io: SocketServer) {
    this.io = io;
    this.startMonitoring();
    logger.info('[HEALTH] Sovereign Health Monitor Active — checking every 10s');
  }

  // ─── HEARTBEAT INGESTION ───────────────────────────────────────────────────

  ingestHeartbeat(data: {
    hardwareId: string;
    screenIndex: number;
    lectureId: string;
    roomName: string;
    metrics?: Partial<ScreenMetrics>;
  }) {
    const existing = this.displayStates.get(data.hardwareId);
    const defaultMetrics: ScreenMetrics = { cpu: 0, ram: 0, fps: 30, bandwidth: 0, studentsRendered: 0, errors: 0 };

    // MISSION 06: AUTOMATIC RECOVERY
    if (existing && existing.status === 'offline') {
      logger.info(`[HEALTH] Display ${data.hardwareId} recovered. Re-registering for rebalance.`);
      try {
        const { displayAssignmentService } = require('./display-assignment.service');
        displayAssignmentService.registerScreen(data.roomName, data.screenIndex);
      } catch (err) {
        logger.error(`[HEALTH] Recovery rebalance failed for ${data.hardwareId}: ${err}`);
      }
    }

    const updated: DisplayHealth = {
      hardwareId: data.hardwareId,
      screenIndex: data.screenIndex,
      lectureId: data.lectureId,
      roomName: data.roomName,
      status: 'online',
      metrics: { ...defaultMetrics, ...(existing?.metrics ?? {}), ...(data.metrics ?? {}) },
      lastHeartbeat: Date.now(),
      alertSent: false,   // reset alert flag on fresh heartbeat
    };

    this.displayStates.set(data.hardwareId, updated);
  }

  // ─── MONITORING LOOP ───────────────────────────────────────────────────────

  startMonitoring() {
    if (this.monitorInterval) clearInterval(this.monitorInterval);
    this.monitorInterval = setInterval(() => this.checkAllDisplays(), 10_000);
  }

  private checkAllDisplays() {
    const now = Date.now();

    this.displayStates.forEach((state, hardwareId) => {
      const age = now - state.lastHeartbeat;

      if (age > 15_000) {
        // > 15s without heartbeat → offline
        if (state.status !== 'offline') {
          state.status = 'offline';
          this.triggerAlert(hardwareId, 'OFFLINE');
        }
      } else if (age > 10_000 || state.metrics.cpu > 90) {
        // 10-15s stale OR high CPU → warning
        state.status = 'warning';
        if (state.metrics.cpu > 90 && !state.alertSent) {
          this.triggerAlert(hardwareId, 'HIGH_CPU');
          state.alertSent = true;
        }
      } else {
        state.status = 'online';
        state.alertSent = false;
      }
    });

    // Push updated status to teachers watching each room
    this.broadcastStatus();
  }

  // ─── ALERTS ────────────────────────────────────────────────────────────────

  private triggerAlert(hardwareId: string, type: 'OFFLINE' | 'HIGH_CPU' | 'ERROR') {
    const state = this.displayStates.get(hardwareId);
    logger.warn(`[HEALTH] ⚠️  Display ${hardwareId} alert: ${type}`);

    if (this.io && state) {
      // Broadcast to all teacher sockets in this room
      this.io.to(state.roomName).emit('display:alert', {
        hardwareId,
        screenIndex: state.screenIndex,
        type,
        message: `Screen ${state.screenIndex + 1} is ${type}`,
        timestamp: Date.now()
      });
    }
  }

  // ─── STATUS BROADCAST ──────────────────────────────────────────────────────

  broadcastStatus() {
    if (!this.io) return;

    // Group by roomName and emit to each room
    const byRoom = new Map<string, DisplayHealth[]>();
    this.displayStates.forEach(state => {
      const list = byRoom.get(state.roomName) ?? [];
      list.push(state);
      byRoom.set(state.roomName, list);
    });

    byRoom.forEach((screens, roomName) => {
      const payload = screens
        .sort((a, b) => a.screenIndex - b.screenIndex)
        .map(s => ({
          hardwareId: s.hardwareId,
          screenIndex: s.screenIndex,
          status: s.status,
          metrics: s.metrics,
          lastHeartbeat: s.lastHeartbeat,
          secondsSinceHeartbeat: Math.floor((Date.now() - s.lastHeartbeat) / 1000)
        }));

      this.io!.to(roomName).emit('display:status_update', { screens: payload });
    });
  }

  // ─── QUERY ─────────────────────────────────────────────────────────────────

  getStatusForRoom(roomName: string): DisplayHealth[] {
    const result: DisplayHealth[] = [];
    this.displayStates.forEach(s => {
      if (s.roomName === roomName) result.push(s);
    });
    return result.sort((a, b) => a.screenIndex - b.screenIndex);
  }

  markOffline(hardwareId: string) {
    const state = this.displayStates.get(hardwareId);
    if (state && state.status !== 'offline') {
      state.status = 'offline';
      this.triggerAlert(hardwareId, 'OFFLINE');
      
      // MISSION 06: TRIGGER AUTOMATIC REBALANCE
      try {
        const { displayAssignmentService } = require('./display-assignment.service');
        displayAssignmentService.unregisterScreen(state.roomName, state.screenIndex);
      } catch (err) {
        logger.error(`[HEALTH] Rebalance failed for ${hardwareId}: ${err}`);
      }

      this.broadcastStatus();
    }
  }
}

export const healthMonitorService = new HealthMonitorService();
