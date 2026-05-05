import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LiveKitService } from './livekit.service';

// Mock livekit-server-sdk
vi.mock('livekit-server-sdk', () => ({
  AccessToken: vi.fn().mockImplementation(() => ({
    addGrant: vi.fn(),
    toJwt: vi.fn().mockReturnValue('mocked-jwt-token'),
  })),
}));

describe('LiveKitService', () => {
  let service: LiveKitService;

  beforeEach(() => {
    process.env.LIVEKIT_API_KEY = 'test-key';
    process.env.LIVEKIT_API_SECRET = 'test-secret';
    service = new LiveKitService();
  });

  it('should generate a token with correct options', async () => {
    const options = {
      roomName: 'test-room',
      identity: 'test-user',
      isTeacher: true,
    };

    const token = await service.generateToken(options);
    expect(token).toBe('mocked-jwt-token');
  });

  it('should throw error if API keys are missing during token generation', async () => {
    delete process.env.LIVEKIT_API_KEY;
    const serviceWithMissingKeys = new LiveKitService();
    await expect(serviceWithMissingKeys.generateToken({ roomName: 'test', identity: 'test' }))
      .rejects.toThrow('LIVEKIT_API_KEY and LIVEKIT_API_SECRET must be set');
  });
});
