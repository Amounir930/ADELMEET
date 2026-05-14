import { Router, Request, Response } from 'express';
import { liveKitService } from '../services/livekit.service';
import { Lecture } from '../models/Lecture';
import mongoose from 'mongoose';

/**
 * PUBLIC WALL ROUTES — No authentication required.
 * These endpoints serve wall display screens (kiosk mode).
 * Tokens are subscribe-only (spectator) — cannot publish audio/video.
 */
const router = Router();

/**
 * GET /api/wall/token/:roomName?group=hall-101
 * Returns a subscribe-only LiveKit spectator token for wall displays.
 * No auth required — rate limited by IP in production via nginx.
 */
router.get('/token/:roomName', async (req: Request, res: Response) => {
  const { roomName } = req.params;
  const group = (req.query.group as string) || 'wall-display';

  if (!roomName || typeof roomName !== 'string') {
    return res.status(400).json({ error: 'roomName is required' });
  }

  try {
    // Verify the lecture is active — prevent access to closed rooms
    const lecture = await Lecture.findOne({
      $or: [
        { _id: mongoose.isValidObjectId(roomName) ? roomName : new mongoose.Types.ObjectId() },
        { roomName }
      ],
      status: 'active'
    }).lean();

    if (!lecture) {
      return res.status(404).json({ error: 'Lecture not found or has ended', code: 'LECTURE_INACTIVE' });
    }

    // Generate a SPECTATOR-ONLY token — no publish permissions
    const { AccessToken } = await import('livekit-server-sdk');
    const apiKey = process.env.LIVEKIT_API_KEY!;
    const apiSecret = process.env.LIVEKIT_API_SECRET!;

    const identity = `wall_${group}_${Date.now()}`;
    const at = new AccessToken(apiKey, apiSecret, {
      identity,
      name: `Wall Display (${group})`,
      metadata: JSON.stringify({ role: 'wall_display', group })
    });

    at.addGrant({
      roomJoin: true,
      room: (lecture as any).roomName,
      canPublish: false,      // ← Cannot publish
      canSubscribe: true,     // ← Can watch/listen only
      canPublishData: false,  // ← Cannot send data
      roomAdmin: false,
    });

    const token = await at.toJwt();

    return res.json({
      token,
      serverUrl: process.env.LIVEKIT_URL,
      roomName: (lecture as any).roomName,
      lectureTitle: (lecture as any).title,
    });
  } catch (err: any) {
    console.error('[WALL-TOKEN] Error:', err.message);
    return res.status(500).json({ error: 'Failed to generate wall token' });
  }
});

export default router;
