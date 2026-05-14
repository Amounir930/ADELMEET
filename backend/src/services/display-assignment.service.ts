import { Server as SocketServer } from 'socket.io';
import logger from '../infra/logger';
import { stateService } from './state.service';
import { redisClient } from '../infra/redis';

class DisplayAssignmentService {
  private io: SocketServer | null = null;

  init(io: SocketServer) {
    this.io = io;
    logger.info('[DISPLAY-ENGINE] Sovereign Display Assignment Service Active — Redis-backed');
  }

  // MISSION 12: AUTO-DISCOVERY STATE
  // Maps hardwareId -> { roomName, screenIndex, socketIds: Set<string> }
  private activeScreens: Map<string, { roomName: string, screenIndex: number, socketIds: Set<string> }> = new Map();

  /** 
   * Automatic Screen Index Assignment
   * Finds the lowest available screen index or reclaims existing one for a hardwareId.
   */
  async autoRegisterScreen(roomName: string, socketId: string, hardwareId: string): Promise<number> {
    // 1. Check if this hardware already has an assignment in this room
    const existing = this.activeScreens.get(hardwareId);
    if (existing && existing.roomName === roomName) {
      existing.socketIds.add(socketId);
      logger.info(`[DISPLAY-ENGINE] Hardware ${hardwareId} reclaimed Screen ${existing.screenIndex}`);
      return existing.screenIndex;
    }

    // 2. Find lowest available index
    const assignments = await stateService.getAllAssignmentsForRoom(roomName);
    const existingIndices = Object.keys(assignments).map(k => Number(k.replace('screen:', ''))).sort((a,b) => a-b);
    
    let targetIndex = 0;
    while (existingIndices.includes(targetIndex)) {
      targetIndex++;
    }

    await this.registerScreen(roomName, targetIndex);
    this.activeScreens.set(hardwareId, { roomName, screenIndex: targetIndex, socketIds: new Set([socketId]) });
    
    logger.info(`[DISPLAY-ENGINE] New Hardware ${hardwareId} assigned Screen ${targetIndex} (${socketId})`);
    return targetIndex;
  }

  /**
   * Cleanup screen on disconnect
   */
  async handleDisconnect(socketId: string) {
    // Find hardwareId by socketId
    for (const [hwId, data] of this.activeScreens.entries()) {
      if (data.socketIds.has(socketId)) {
        data.socketIds.delete(socketId);
        // Only cleanup if ALL sockets for this hardware are gone
        if (data.socketIds.size === 0) {
          logger.info(`[DISPLAY-ENGINE] Hardware ${hwId} offline. Cleaning up Screen ${data.screenIndex}...`);
          await this.unregisterScreen(data.roomName, data.screenIndex);
          this.activeScreens.delete(hwId);
        }
        break;
      }
    }
  }

  // ─── SCREEN REGISTRY ─────────────────────────────────────────────────────

  async registerScreen(roomName: string, screenIndex: number) {
    const currentAssignments = await stateService.getAllAssignmentsForRoom(roomName);
    
    if (!currentAssignments[`screen:${screenIndex}`]) {
      await stateService.setAssignment(roomName, screenIndex, []);
      logger.info(`[DISPLAY-ENGINE] Screen ${screenIndex} registered for room ${roomName}.`);
    }

    await this.rebalance(roomName);
  }

  async unregisterScreen(roomName: string, screenIndex: number) {
    const assignments = await stateService.getAllAssignmentsForRoom(roomName);
    
    const orphans = assignments[`screen:${screenIndex}`] || [];
    const key = `sovereign:assignment:${roomName}`;
    await redisClient.hDel(key, `screen:${screenIndex}`);

    const remainingKeys = Object.keys(assignments).filter(k => k !== `screen:${screenIndex}`);

    if (orphans.length > 0 && remainingKeys.length > 0) {
      for (let i = 0; i < orphans.length; i++) {
        const targetKey = remainingKeys[i % remainingKeys.length];
        const targetIndex = Number(targetKey.replace('screen:', ''));
        const targetStudents = assignments[targetKey];
        targetStudents.push(orphans[i]);
        await stateService.setAssignment(roomName, targetIndex, targetStudents);
      }
      logger.info(`[DISPLAY-ENGINE] ${orphans.length} orphaned students redistributed after screen ${screenIndex} went offline`);
    }

    await this.broadcastAssignment(roomName);
  }

  // ─── STUDENT REGISTRY ─────────────────────────────────────────────────────

  async addStudent(roomName: string, studentIdentity: string) {
    await stateService.trackStudent(roomName, studentIdentity);
    const assignments = await stateService.getAllAssignmentsForRoom(roomName);
    const screenKeys = Object.keys(assignments);
    
    if (screenKeys.length === 0) return;

    let minKey = screenKeys[0];
    screenKeys.forEach(k => {
      if (assignments[k].length < assignments[minKey].length) minKey = k;
    });

    const targetIndex = Number(minKey.replace('screen:', ''));
    const students = assignments[minKey];
    if (!students.includes(studentIdentity)) {
        students.push(studentIdentity);
        await stateService.setAssignment(roomName, targetIndex, students);
        logger.info(`[DISPLAY-ENGINE] Student ${studentIdentity} → Screen ${targetIndex}`);
    }
    
    await this.broadcastAssignment(roomName);
  }

  async removeStudent(roomName: string, studentIdentity: string) {
    await stateService.untrackStudent(roomName, studentIdentity);
    const assignments = await stateService.getAllAssignmentsForRoom(roomName);
    
    for (const [key, students] of Object.entries(assignments)) {
      const idx = students.indexOf(studentIdentity);
      if (idx !== -1) {
        students.splice(idx, 1);
        const screenIndex = Number(key.replace('screen:', ''));
        await stateService.setAssignment(roomName, screenIndex, students);
        logger.info(`[DISPLAY-ENGINE] Student ${studentIdentity} removed from Screen ${screenIndex}`);
      }
    }

    await this.broadcastAssignment(roomName);
  }

  // ─── CORE REBALANCE ──────────────────────────────────────────────────────

  async rebalance(roomName: string) {
    const assignments = await stateService.getAllAssignmentsForRoom(roomName);
    const screenKeys = Object.keys(assignments).sort();
    
    if (screenKeys.length === 0) return;

    // MISSION 12 FIX: Use master student list from StateService for rebalancing
    const allStudents = (await stateService.getAllStudentsInRoom(roomName)).sort();
    const n = screenKeys.length;

    for (let i = 0; i < n; i++) {
      const targetIndex = Number(screenKeys[i].replace('screen:', ''));
      const redistributed = allStudents.filter((_, idx) => idx % n === i);
      await stateService.setAssignment(roomName, targetIndex, redistributed);
    }

    logger.info(`[DISPLAY-ENGINE] Rebalanced ${allStudents.length} students across ${n} screens in room ${roomName}`);
    await this.broadcastAssignment(roomName);
  }

  // ─── SOCKET BROADCAST ────────────────────────────────────────────────────

  async broadcastAssignment(roomName: string) {
    if (!this.io) return;
    const assignments = await stateService.getAllAssignmentsForRoom(roomName);
    
    const allStudents = Object.values(assignments).flat();
    const totalStudents = allStudents.length;
    const screenKeys = Object.keys(assignments).sort();
    const totalScreens = screenKeys.length;
    const activeIndices = screenKeys.map(k => Number(k.replace('screen:', ''))).sort((a, b) => a - b);

    for (const [key, students] of Object.entries(assignments)) {
      const screenIndex = Number(key.replace('screen:', ''));
      this.io.to(`${roomName}:screen:${screenIndex}`).emit('display:rebalance', {
        students,
        screenIndex,
        totalStudents,
        totalScreens,
        activeIndices
      });
    }

    // MISSION 12: Real-time Teacher Notification
    // Inform everyone in the room (especially the teacher) about the orchestration state
    this.io.to(roomName).emit('display:orchestration_update', {
      onlineScreensCount: totalScreens,
      activeIndices
    });

    logger.info(`[DISPLAY-ENGINE] Assignment broadcast → ${roomName} (${totalStudents} students, ${totalScreens} screens)`);
  }


  async getAssignments(roomName: string) {
    return await stateService.getAllAssignmentsForRoom(roomName);
  }
}

export const displayAssignmentService = new DisplayAssignmentService();
