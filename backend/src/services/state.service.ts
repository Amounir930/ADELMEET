import { redisClient } from '../infra/redis';
import logger from '../infra/logger';

/**
 * MISSION 07: SOVEREIGN STATE SERVICE
 * Centralized logic for distributed room and display states.
 */
export interface RoomState {
  isMuted: boolean;
  isCameraLocked: boolean;
  isRecordingAllowed: boolean;
  isScreenShareAllowed: boolean;
  isChatEnabled: boolean;
  isRoomLocked: boolean;  // ROOM LOCK
  lectureId?: string;
  roomName: string;
  status: 'live' | 'completed';
  featuredStudent?: string;
  featuredDestination?: 'wall' | 'dashboard' | 'none';
}

class StateService {
  private readonly ROOM_PREFIX = 'sovereign:room:';
  private readonly ASSIGNMENT_PREFIX = 'sovereign:assignment:';
  private readonly HEALTH_PREFIX = 'sovereign:health:';
  private readonly ACTIVE_DISPLAYS_KEY = 'sovereign:active_displays';
  private readonly ROOM_STUDENTS_PREFIX = 'sovereign:room_students:';
  private readonly WHITEBOARD_PREFIX = 'sovereign:whiteboard:';
  private readonly GRACE_PREFIX = 'grace:';

  // --- ROOM STATE ---
  async setRoomState(roomName: string, state: Partial<RoomState>): Promise<void> {
    const key = `${this.ROOM_PREFIX}${roomName}`;
    try {
      // MISSION 07 FIX: Use hSet directly on provided fields to avoid read-modify-write race conditions
      const flatEntries: string[] = [];
      Object.entries(state).forEach(([k, v]) => {
        flatEntries.push(k, String(v));
      });

      if (flatEntries.length > 0) {
        await redisClient.hSet(key, flatEntries);
        await redisClient.expire(key, 86400); // 24h
      }
    } catch (err: any) {
      logger.error(`[STATE] Failed to set room state for ${roomName}: ${err.message || err}`);
    }
  }

  async getRoomState(roomName: string): Promise<Partial<RoomState> | null> {
    const key = `${this.ROOM_PREFIX}${roomName}`;
    try {
      const data = await redisClient.hGetAll(key);
      if (!data || Object.keys(data).length === 0) return null;

      return {
        isMuted: data.isMuted === 'true',
        isCameraLocked: data.isCameraLocked === 'true',
        isRecordingAllowed: data.isRecordingAllowed === 'true',
        isScreenShareAllowed: data.isScreenShareAllowed === 'true',
        isChatEnabled: data.isChatEnabled !== 'false',
        isRoomLocked: data.isRoomLocked === 'true', // ROOM LOCK
        lectureId: data.lectureId,
        roomName: data.roomName,
        status: data.status as any,
        featuredStudent: data.featuredStudent || undefined,
        featuredDestination: (data.featuredDestination as any) || 'none'
      };
    } catch (err: any) {
      logger.error(`[STATE] Failed to get room state for ${roomName}: ${err.message || err}`);
      return null;
    }
  }

  // --- STUDENT TRACKING (For rebalancing) ---
  async trackStudent(roomName: string, studentIdentity: string): Promise<void> {
    const key = `${this.ROOM_STUDENTS_PREFIX}${roomName}`;
    await redisClient.sAdd(key, studentIdentity);
    await redisClient.expire(key, 86400);
  }

  async untrackStudent(roomName: string, studentIdentity: string): Promise<void> {
    const key = `${this.ROOM_STUDENTS_PREFIX}${roomName}`;
    await redisClient.sRem(key, studentIdentity);
  }

  async getAllStudentsInRoom(roomName: string): Promise<string[]> {
    const key = `${this.ROOM_STUDENTS_PREFIX}${roomName}`;
    return await redisClient.sMembers(key);
  }

  async clearAllStudentsInRoom(roomName: string): Promise<void> {
    const key = `${this.ROOM_STUDENTS_PREFIX}${roomName}`;
    await redisClient.del(key);
  }

  // --- WHITEBOARD STATE ---
  async pushWhiteboardAction(roomName: string, action: any): Promise<void> {
    const key = `${this.WHITEBOARD_PREFIX}${roomName}`;
    try {
      await redisClient.rPush(key, JSON.stringify(action));
      await redisClient.expire(key, 86400); // 24h
    } catch (err: any) {
      logger.error(`[STATE] Failed to push whiteboard action for ${roomName}: ${err.message}`);
    }
  }

  async popWhiteboardAction(roomName: string): Promise<void> {
    const key = `${this.WHITEBOARD_PREFIX}${roomName}`;
    try {
      await redisClient.rPop(key);
    } catch (err: any) {
      logger.error(`[STATE] Failed to pop whiteboard action for ${roomName}: ${err.message}`);
    }
  }

  async getWhiteboardHistory(roomName: string): Promise<any[]> {
    const key = `${this.WHITEBOARD_PREFIX}${roomName}`;
    try {
      const actions = await redisClient.lRange(key, 0, -1);
      return actions.map(a => JSON.parse(a));
    } catch (err: any) {
      logger.error(`[STATE] Failed to get whiteboard history for ${roomName}: ${err.message}`);
      return [];
    }
  }

  async clearWhiteboardHistory(roomName: string): Promise<void> {
    const key = `${this.WHITEBOARD_PREFIX}${roomName}`;
    try {
      await redisClient.del(key);
    } catch (err: any) {
      logger.error(`[STATE] Failed to clear whiteboard history for ${roomName}: ${err.message}`);
    }
  }

  // --- DISPLAY ASSIGNMENTS ---
  async setAssignment(roomName: string, screenIndex: number, students: string[]): Promise<void> {
    const key = `${this.ASSIGNMENT_PREFIX}${roomName}`;
    try {
      await redisClient.hSet(key, `screen:${screenIndex}`, JSON.stringify(students));
      await redisClient.expire(key, 86400);
    } catch (err: any) {
      logger.error(`[STATE] Failed to set assignment for ${roomName} screen ${screenIndex}: ${err.message || err}`);
    }
  }

  async getAssignment(roomName: string, screenIndex: number): Promise<string[]> {
    const key = `${this.ASSIGNMENT_PREFIX}${roomName}`;
    try {
      const data = await redisClient.hGet(key, `screen:${screenIndex}`);
      return data ? JSON.parse(data) : [];
    } catch (err: any) {
      logger.error(`[STATE] Failed to get assignment for ${roomName} screen ${screenIndex}: ${err.message || err}`);
      return [];
    }
  }

  async getAllAssignmentsForRoom(roomName: string): Promise<Record<string, string[]>> {
    const key = `${this.ASSIGNMENT_PREFIX}${roomName}`;
    try {
      const data = await redisClient.hGetAll(key);
      const results: Record<string, string[]> = {};
      Object.entries(data).forEach(([k, v]) => {
        results[k] = JSON.parse(v);
      });
      return results;
    } catch (err) {
      return {};
    }
  }

  // --- HEARTBEAT / HEALTH ---
  async updateHealth(hardwareId: string, metrics: any): Promise<void> {
    const key = `${this.HEALTH_PREFIX}${hardwareId}`;
    try {
      const flatMetrics: string[] = ['lastSeen', Date.now().toString()];
      Object.entries(metrics).forEach(([k, v]) => {
        if (k !== 'lastSeen') {
          const value = typeof v === 'object' ? JSON.stringify(v) : String(v);
          flatMetrics.push(k, value);
        }
      });

      await redisClient.hSet(key, flatMetrics);
      await redisClient.expire(key, 3600); // 1h
      
      // MISSION 07 FIX: Track active hardware IDs in a Set to avoid KEYS *
      await redisClient.sAdd(this.ACTIVE_DISPLAYS_KEY, hardwareId);
    } catch (err: any) {
      logger.error(`[STATE] Failed to update health for ${hardwareId}: ${err.message || err}`);
    }
  }

  async removeHealth(hardwareId: string): Promise<void> {
    try {
      await redisClient.del(`${this.HEALTH_PREFIX}${hardwareId}`);
      await redisClient.sRem(this.ACTIVE_DISPLAYS_KEY, hardwareId);
    } catch (err) {}
  }

  // --- HARDWARE PERSISTENCE ---
  async setHardwareAssignment(hardwareId: string, roomName: string, screenIndex: number): Promise<void> {
    const key = `${this.HW_ASSIGNMENT_PREFIX}${hardwareId}`;
    await redisClient.hSet(key, { roomName, screenIndex: String(screenIndex) });
    await redisClient.expire(key, 86400);
  }

  async getHardwareAssignment(hardwareId: string): Promise<{ roomName: string, screenIndex: number } | null> {
    const key = `${this.HW_ASSIGNMENT_PREFIX}${hardwareId}`;
    const data = await redisClient.hGetAll(key);
    if (!data || !data.roomName) return null;
    return { roomName: data.roomName, screenIndex: parseInt(data.screenIndex) };
  }

  async removeHardwareAssignment(hardwareId: string): Promise<void> {
    await redisClient.del(`${this.HW_ASSIGNMENT_PREFIX}${hardwareId}`);
  }

  async getAllHealth(): Promise<Record<string, any>> {
    try {
      // MISSION 07 FIX: Use the Set instead of KEYS *
      const hardwareIds = await redisClient.sMembers(this.ACTIVE_DISPLAYS_KEY);
      const results: Record<string, any> = {};
      
      for (const hardwareId of hardwareIds) {
        const key = `${this.HEALTH_PREFIX}${hardwareId}`;
        const data = await redisClient.hGetAll(key);
        if (data && Object.keys(data).length > 0) {
          results[hardwareId] = data;
        } else {
          // Cleanup stale IDs from the set
          await redisClient.sRem(this.ACTIVE_DISPLAYS_KEY, hardwareId);
        }
      }
      
      return results;
    } catch (err: any) {
      logger.error(`[STATE] Failed to fetch all health records: ${err.message || err}`);
      return {};
    }
  }

  // MISSION 12: EPHEMERAL CHAT PERSISTENCE
  async saveChatMessage(roomName: string, message: any): Promise<void> {
    const key = `chat:messages:${roomName}`;
    await redisClient.rPush(key, JSON.stringify(message));
    await redisClient.expire(key, 86400); // 24h safety expiry
  }

  async getChatMessages(roomName: string): Promise<any[]> {
    const key = `chat:messages:${roomName}`;
    const data = await redisClient.lRange(key, 0, -1);
    return data.map(m => JSON.parse(m));
  }

  async clearChatMessages(roomName: string): Promise<void> {
    await redisClient.del(`chat:messages:${roomName}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // WALL GROUPS — Durable Navigation State
  // Key schema:
  //   wall:group:{groupName}:active_room  → roomName string (or deleted = idle)
  // ─────────────────────────────────────────────────────────────────────────
  private readonly WALL_GROUP_PREFIX = 'wall:group:';

  /** Persist which room a wall group is currently displaying */
  async setWallGroupRoom(groupName: string, roomName: string): Promise<void> {
    const key = `${this.WALL_GROUP_PREFIX}${groupName}:active_room`;
    try {
      await redisClient.set(key, roomName, { EX: 86400 }); // 24h safety TTL
      logger.info(`[WALL-GROUPS] Group "${groupName}" → room "${roomName}"`);
    } catch (err: any) {
      logger.error(`[WALL-GROUPS] setWallGroupRoom error: ${err.message}`);
    }
  }

  /** Clear the active room for a wall group (return to idle) */
  async clearWallGroupRoom(groupName: string): Promise<void> {
    const key = `${this.WALL_GROUP_PREFIX}${groupName}:active_room`;
    try {
      await redisClient.del(key);
      logger.info(`[WALL-GROUPS] Group "${groupName}" → idle`);
    } catch (err: any) {
      logger.error(`[WALL-GROUPS] clearWallGroupRoom error: ${err.message}`);
    }
  }

  /** Get the active room for a wall group (null = idle) */
  async getWallGroupRoom(groupName: string): Promise<string | null> {
    const key = `${this.WALL_GROUP_PREFIX}${groupName}:active_room`;
    try {
      return await redisClient.get(key);
    } catch (err: any) {
      logger.error(`[WALL-GROUPS] getWallGroupRoom error: ${err.message}`);
      return null;
    }
  }

  // --- ROOM GRACE LIST (Distributed) ---
  async setRoomGrace(roomName: string, identity: string, ttlSeconds: number): Promise<void> {
    const key = `${this.GRACE_PREFIX}${roomName}:${identity}`;
    await redisClient.set(key, '1', { EX: ttlSeconds });
  }

  async checkRoomGrace(roomName: string, identity: string): Promise<boolean> {
    const key = `${this.GRACE_PREFIX}${roomName}:${identity}`;
    const exists = await redisClient.exists(key);
    return exists === 1;
  }

  async clearRoomGrace(roomName: string, identity: string): Promise<void> {
    const key = `${this.GRACE_PREFIX}${roomName}:${identity}`;
    await redisClient.del(key);
  }
}

export const stateService = new StateService();
