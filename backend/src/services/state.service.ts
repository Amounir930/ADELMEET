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
  lectureId?: string;
  roomName: string;
  status: 'live' | 'completed';
}

class StateService {
  private readonly ROOM_PREFIX = 'sovereign:room:';
  private readonly ASSIGNMENT_PREFIX = 'sovereign:assignment:';
  private readonly HEALTH_PREFIX = 'sovereign:health:';
  private readonly ACTIVE_DISPLAYS_KEY = 'sovereign:active_displays';

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
        lectureId: data.lectureId,
        roomName: data.roomName,
        status: data.status as any
      };
    } catch (err: any) {
      logger.error(`[STATE] Failed to get room state for ${roomName}: ${err.message || err}`);
      return null;
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
        if (k !== 'lastSeen') flatMetrics.push(k, String(v));
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
}

export const stateService = new StateService();
