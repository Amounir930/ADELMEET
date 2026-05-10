import { Server as SocketServer } from 'socket.io';
import logger from '../infra/logger';
import { stateService } from './state.service';

export type ScreenStatus = 'online' | 'warning' | 'offline';

export interface ScreenMetrics {
  cpu: number;
  ram: number;
  fps: number;
  bandwidth: number;
  studentsRendered: number;
  errors: number;
}

class HealthMonitorService {
  private io: SocketServer | null = null;
  private assignmentService: any = null; // Dependency Injection
  private isRunning = false;

  // ─── INIT ──────────────────────────────────────────────────────────────────

  init(io: SocketServer, assignmentService: any) {
    this.io = io;
    this.assignmentService = assignmentService;
    if (!this.isRunning) {
      this.isRunning = true;
      this.startMonitoring();
    }
    logger.info('[HEALTH] Sovereign Health Monitor Active — Redis-backed & DI Integrated');
  }

  // ─── HEARTBEAT INGESTION ───────────────────────────────────────────────────

  async ingestHeartbeat(data: {
    hardwareId: string;
    screenIndex: number;
    lectureId: string;
    roomName: string;
    metrics?: Partial<ScreenMetrics>;
  }) {
    // MISSION 07: Fetch existing state from Redis
    const allHealth = await stateService.getAllHealth();
    const existing = allHealth[data.hardwareId];
    
    const defaultMetrics: ScreenMetrics = { cpu: 0, ram: 0, fps: 30, bandwidth: 0, studentsRendered: 0, errors: 0 };

    // MISSION 06: AUTOMATIC RECOVERY
    if (existing && existing.status === 'offline' && this.assignmentService) {
      logger.info(`[HEALTH] Display ${data.hardwareId} recovered. Re-registering for rebalance.`);
      try {
        await this.assignmentService.registerScreen(data.roomName, Number(data.screenIndex));
      } catch (recoveryErr) {
        logger.error(recoveryErr, `[HEALTH] Automatic recovery failed for ${data.hardwareId}:`);
      }

    }


    let existingMetrics = {};
    if (typeof existing?.metrics === 'string') {
      try {
        existingMetrics = JSON.parse(existing.metrics);
      } catch (e) {
        logger.warn(`[HEALTH] Failed to parse existing metrics for ${data.hardwareId}, using defaults`);
      }
    } else if (existing?.metrics) {
      existingMetrics = existing.metrics;
    }

    const updatedMetrics = { ...defaultMetrics, ...existingMetrics, ...(data.metrics ?? {}) };
    
    await stateService.updateHealth(data.hardwareId, {
      screenIndex: data.screenIndex,
      lectureId: data.lectureId,
      roomName: data.roomName,
      status: 'online',
      metrics: updatedMetrics
    });
  }

  // ─── MONITORING LOOP ───────────────────────────────────────────────────────

  private async startMonitoring() {
    while (this.isRunning) {
      try {
        await this.checkAllDisplays();
      } catch (err: any) {
        logger.error(`[HEALTH] Monitor Loop Error: ${err.message || err}`);
      }
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  }

  private async checkAllDisplays() {
    const allHealth = await stateService.getAllHealth();
    const now = Date.now();

    for (const [hardwareId, state] of Object.entries(allHealth)) {
      const lastSeen = Number(state.lastSeen);
      const age = now - lastSeen;
      let newStatus: ScreenStatus = state.status as ScreenStatus;

      if (age > 15000) {
        if (state.status !== 'offline') {
          newStatus = 'offline';
          await this.triggerAlert(hardwareId, state.roomName, Number(state.screenIndex), 'OFFLINE');
        }
      } else if (age > 10000 || Number(state.cpu) > 90) {
        newStatus = 'warning';
      } else {
        newStatus = 'online';
      }

      if (newStatus !== state.status) {
        await stateService.updateHealth(hardwareId, { status: newStatus });
      }
    }

    await this.broadcastStatus();
  }

  // ─── ALERTS ────────────────────────────────────────────────────────────────

  private async triggerAlert(hardwareId: string, roomName: string, screenIndex: number, type: 'OFFLINE' | 'HIGH_CPU' | 'ERROR') {
    logger.warn(`[HEALTH] ⚠️  Display ${hardwareId} alert: ${type}`);

    if (!this.io) {
      logger.warn(`[HEALTH] Cannot emit alert for ${hardwareId} — Socket.io not initialized`);
      return;
    }

    this.io.to(roomName).emit('display:alert', {

        hardwareId,
        screenIndex: Number(screenIndex),
        type,
        message: `Screen ${Number(screenIndex) + 1} is ${type}`,
        timestamp: Date.now()
      });
  }

  // ─── STATUS BROADCAST ──────────────────────────────────────────────────────


  async broadcastStatus() {
    if (!this.io) return;
    const allHealth = await stateService.getAllHealth();

    const byRoom = new Map<string, Map<number, any>>();
    Object.entries(allHealth).forEach(([hardwareId, s]) => {
      const roomName = s.roomName;
      const screenIndex = Number(s.screenIndex);
      
      let metrics = {};
      if (typeof s.metrics === 'string') {
        try {
          metrics = JSON.parse(s.metrics);
        } catch (e) {
          logger.warn(`[HEALTH] Failed to parse metrics for ${hardwareId} during broadcast`);
        }
      } else if (s.metrics) {
        metrics = s.metrics;
      }

      const screenData = {
        hardwareId,
        screenIndex,
        status: s.status,
        metrics,
        lastHeartbeat: Number(s.lastSeen),
        secondsSinceHeartbeat: Math.floor((Date.now() - Number(s.lastSeen)) / 1000)
      };

      const roomMap = byRoom.get(roomName) ?? new Map<number, any>();
      const existing = roomMap.get(screenIndex);

      // Deduplication Logic: Prefer online over offline, or more recent heartbeat
      if (!existing || 
          (screenData.status === 'online' && existing.status !== 'online') ||
          (screenData.status === existing.status && screenData.lastHeartbeat > existing.lastHeartbeat)) {
        roomMap.set(screenIndex, screenData);
      }
      
      byRoom.set(roomName, roomMap);
    });

    byRoom.forEach((screenMap, roomName) => {
      const payload = Array.from(screenMap.values()).sort((a, b) => a.screenIndex - b.screenIndex);
      this.io!.to(roomName).emit('display:status_update', { screens: payload });
    });
  }

  // ─── QUERY ─────────────────────────────────────────────────────────────────

  async markOffline(hardwareId: string) {
    const allHealth = await stateService.getAllHealth();
    const state = allHealth[hardwareId];

    if (state && state.status !== 'offline') {
      await stateService.updateHealth(hardwareId, { status: 'offline' });
      await this.triggerAlert(hardwareId, state.roomName, Number(state.screenIndex), 'OFFLINE');
      
      if (this.assignmentService) {
        await this.assignmentService.unregisterScreen(state.roomName, Number(state.screenIndex));
      }

      await this.broadcastStatus();
    }
  }
}

export const healthMonitorService = new HealthMonitorService();
