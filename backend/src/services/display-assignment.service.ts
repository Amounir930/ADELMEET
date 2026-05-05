import { Server as SocketServer } from 'socket.io';
import logger from '../infra/logger';

/**
 * MISSION 03: SOVEREIGN DISPLAY ASSIGNMENT ENGINE
 * Tracks all active screens and students per room.
 * Distributes students evenly across screens (Round-Robin Balanced).
 * Re-distributes automatically on any join/leave/screen-offline event.
 */

export interface DisplayAssignment {
  screenIndex: number;
  students: string[]; // student socket identities
}

interface RoomState {
  assignments: DisplayAssignment[];
  screenIndices: Set<number>; // currently active screen indices
}

class DisplayAssignmentService {
  private rooms: Map<string, RoomState> = new Map();
  private io: SocketServer | null = null;

  init(io: SocketServer) {
    this.io = io;
    logger.info('[DISPLAY-ENGINE] Sovereign Display Assignment Service Active');
  }

  // ─── SCREEN REGISTRY ─────────────────────────────────────────────────────

  registerScreen(roomName: string, screenIndex: number) {
    const state = this.getOrCreateRoom(roomName);
    state.screenIndices.add(screenIndex);

    // Ensure assignment slot exists
    if (!state.assignments.find(a => a.screenIndex === screenIndex)) {
      state.assignments.push({ screenIndex, students: [] });
      state.assignments.sort((a, b) => a.screenIndex - b.screenIndex);
    }

    logger.info(`[DISPLAY-ENGINE] Screen ${screenIndex} registered for room ${roomName}. Total screens: ${state.screenIndices.size}`);
    this.rebalance(roomName);
  }

  unregisterScreen(roomName: string, screenIndex: number) {
    const state = this.rooms.get(roomName);
    if (!state) return;

    // Move orphaned students to remaining screens
    const offlineAssignment = state.assignments.find(a => a.screenIndex === screenIndex);
    const orphans = offlineAssignment?.students ?? [];
    state.screenIndices.delete(screenIndex);
    state.assignments = state.assignments.filter(a => a.screenIndex !== screenIndex);

    if (orphans.length > 0 && state.assignments.length > 0) {
      orphans.forEach((student, i) => {
        state.assignments[i % state.assignments.length].students.push(student);
      });
      logger.info(`[DISPLAY-ENGINE] ${orphans.length} orphaned students redistributed after screen ${screenIndex} went offline`);
    }

    this.broadcastAssignment(roomName);
  }

  // ─── STUDENT REGISTRY ─────────────────────────────────────────────────────

  addStudent(roomName: string, studentIdentity: string) {
    const state = this.getOrCreateRoom(roomName);
    if (state.assignments.length === 0) return;

    // Find screen with fewest students
    const target = state.assignments.reduce((min, cur) =>
      cur.students.length < min.students.length ? cur : min
    );
    target.students.push(studentIdentity);

    logger.info(`[DISPLAY-ENGINE] Student ${studentIdentity} → Screen ${target.screenIndex} (${target.students.length} total)`);
    this.broadcastAssignment(roomName);
  }

  removeStudent(roomName: string, studentIdentity: string) {
    const state = this.rooms.get(roomName);
    if (!state) return;

    state.assignments.forEach(a => {
      const idx = a.students.indexOf(studentIdentity);
      if (idx !== -1) {
        a.students.splice(idx, 1);
        logger.info(`[DISPLAY-ENGINE] Student ${studentIdentity} removed from Screen ${a.screenIndex}`);
      }
    });

    this.broadcastAssignment(roomName);
  }

  // ─── CORE REBALANCE ──────────────────────────────────────────────────────

  /**
   * Full redistribution of all students across all active screens.
   * Preserves student order (alphabetical) for Refresh stability.
   */
  rebalance(roomName: string) {
    const state = this.rooms.get(roomName);
    if (!state || state.assignments.length === 0) return;

    // Gather all students and sort for deterministic order
    const allStudents = state.assignments.flatMap(a => a.students).sort();
    const n = state.assignments.length;

    state.assignments.forEach((a, i) => {
      a.students = allStudents.filter((_, idx) => idx % n === i);
    });

    logger.info(`[DISPLAY-ENGINE] Rebalanced ${allStudents.length} students across ${n} screens in room ${roomName}`);
    this.broadcastAssignment(roomName);
  }

  // ─── SOCKET BROADCAST ────────────────────────────────────────────────────

  broadcastAssignment(roomName: string) {
    const state = this.rooms.get(roomName);
    if (!state || !this.io) return;

    const totalStudents = state.assignments.reduce((sum, a) => sum + a.students.length, 0);
    const totalScreens = state.assignments.length;
    const activeIndices = Array.from(state.screenIndices).sort((a, b) => a - b);

    state.assignments.forEach(a => {
      // Each screen is in a dedicated socket channel: `room:screen:N`
      this.io!.to(`${roomName}:screen:${a.screenIndex}`).emit('display:rebalance', {
        students: a.students,
        screenIndex: a.screenIndex,
        totalStudents,
        totalScreens,
        activeIndices
      });
    });

    logger.info(`[DISPLAY-ENGINE] Assignment broadcast → ${roomName} (${totalStudents} students, ${totalScreens} screens)`);
  }

  // ─── QUERY ───────────────────────────────────────────────────────────────

  getState(roomName: string): RoomState | undefined {
    return this.rooms.get(roomName);
  }

  getAssignments(roomName: string): DisplayAssignment[] {
    return this.rooms.get(roomName)?.assignments ?? [];
  }

  // ─── HELPERS ─────────────────────────────────────────────────────────────

  private getOrCreateRoom(roomName: string): RoomState {
    if (!this.rooms.has(roomName)) {
      this.rooms.set(roomName, { assignments: [], screenIndices: new Set() });
    }
    return this.rooms.get(roomName)!;
  }
}

export const displayAssignmentService = new DisplayAssignmentService();
