import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';
import { AppError } from '../infra/errors';

export interface TokenOptions {
  roomName: string;
  identity: string;
  name?: string;
  isTeacher?: boolean;
  metadata?: string;
}

export class LiveKitService {
  private apiKey: string;
  private apiSecret: string;
  private host: string;

  constructor() {
    this.apiKey = process.env.LIVEKIT_API_KEY || '';
    this.apiSecret = process.env.LIVEKIT_API_SECRET || '';
    this.host = process.env.LIVEKIT_URL?.replace('ws', 'http') || '';
  }

  private ensureConfigured() {
    if (!this.apiKey || !this.apiSecret) {
      throw new Error('LIVEKIT_API_KEY and LIVEKIT_API_SECRET must be set');
    }
  }

  async generateToken(options: TokenOptions): Promise<string> {
    this.ensureConfigured();
    try {
      const at = new AccessToken(this.apiKey, this.apiSecret, {
        identity: options.identity,
        name: options.name || options.identity,
        metadata: options.metadata
      });

      at.addGrant({
        roomJoin: true,
        room: options.roomName,
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
        roomAdmin: options.isTeacher || false,
      });

      return at.toJwt();
    } catch (error) {
      throw new AppError(500, 'Failed to generate LiveKit token', 'TOKEN_GEN_FAILED');
    }
  }

  async deleteRoom(roomName: string) {
    this.ensureConfigured();
    if (!this.host) return;
    try {
      const roomService = new RoomServiceClient(this.host, this.apiKey, this.apiSecret);
      await roomService.deleteRoom(roomName);
      console.log(`[LIVEKIT] Room ${roomName} deleted successfully.`);
    } catch (error) {
      console.error(`[LIVEKIT] Failed to delete room ${roomName}:`, error);
    }
  }

  async muteParticipant(roomName: string, identity: string, trackSid: string, mute: boolean) {
    this.ensureConfigured();
    if (!this.host) return;
    try {
      const roomService = new RoomServiceClient(this.host, this.apiKey, this.apiSecret);
      await roomService.mutePublishedTrack(roomName, identity, trackSid, mute);
      console.log(`[LIVEKIT] Participant ${identity} track ${trackSid} ${mute ? 'muted' : 'unmuted'}.`);
    } catch (error) {
      console.error(`[LIVEKIT] Failed to mute track:`, error);
      throw error;
    }
  }

  async removeParticipant(roomName: string, identity: string) {
    this.ensureConfigured();
    if (!this.host) return;
    try {
      const roomService = new RoomServiceClient(this.host, this.apiKey, this.apiSecret);
      await roomService.removeParticipant(roomName, identity);
      console.log(`[LIVEKIT] Participant ${identity} removed from ${roomName}.`);
    } catch (error) {
      console.error(`[LIVEKIT] Failed to remove participant:`, error);
      throw error;
    }
  }

  async updateParticipant(roomName: string, identity: string, options: { metadata?: string }) {
    this.ensureConfigured();
    if (!this.host) return;
    try {
      const roomService = new RoomServiceClient(this.host, this.apiKey, this.apiSecret);
      await roomService.updateParticipant(roomName, identity, options);
      console.log(`[LIVEKIT] Participant ${identity} updated.`);
    } catch (error) {
      console.error(`[LIVEKIT] Failed to update participant:`, error);
      throw error;
    }
  }
}

// MISSION 07: SOVEREIGN SINGLETON
export const liveKitService = new LiveKitService();
