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

    const allStudents = Array.from(new Set(Object.values(assignments).flat())).sort();
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

    logger.info(`[DISPLAY-ENGINE] Assignment broadcast → ${roomName} (${totalStudents} students, ${totalScreens} screens)`);
  }

  async getAssignments(roomName: string) {
    return await stateService.getAllAssignmentsForRoom(roomName);
  }
}

export const displayAssignmentService = new DisplayAssignmentService();
