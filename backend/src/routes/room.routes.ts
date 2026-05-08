import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler';
import { liveKitService } from '../services/livekit.service';
import { redisClient } from '../infra/redis';
import { Request, Response } from 'express';

const router = Router();

const JoinRoomSchema = z.object({
  roomName: z.string().min(1),
  identity: z.string().min(1),
  name: z.string().optional(),
  isTeacher: z.boolean().optional(),
});

router.post('/join', asyncHandler(async (req: Request, res: Response) => {
  const validated = JoinRoomSchema.parse(req.body);
  const token = await liveKitService.generateToken(validated);
  
  res.json({
    token,
    serverUrl: process.env.LIVEKIT_URL,
  });
}));

// PHASE 1: Raise Hand Queue
router.post('/raise-hand', asyncHandler(async (req: Request, res: Response) => {
  const { roomName, identity } = req.body;
  if (!roomName || !identity) return res.status(400).json({ error: 'Missing data' });
  
  const key = `raise-hand:${roomName}`;
  await redisClient.zAdd(key, [{ score: Date.now(), value: identity }]);
  await redisClient.expire(key, 3600); // 1 hour auto-clean
  
  res.json({ success: true });
}));

// PHASE 1: Smart Chat / Q&A Metadata (Optional Backend side)
router.post('/chat/log', asyncHandler(async (req: Request, res: Response) => {
  const { roomName, identity, message } = req.body;
  // Here we could log messages to DB/Redis if needed
  res.json({ success: true });
}));

// PHASE 2: Participant Moderation
const ModerationSchema = z.object({
  roomName: z.string().min(1),
  identity: z.string().min(1),
  trackSid: z.string().optional(), // Optional because kick doesn't need it
  mute: z.boolean().optional(),
});

router.post('/mute', asyncHandler(async (req: Request, res: Response) => {
  const { roomName, identity, trackSid, mute } = ModerationSchema.parse(req.body);
  if (!trackSid) return res.status(400).json({ error: 'trackSid is required for mute' });
  await liveKitService.muteParticipant(roomName, identity, trackSid, !!mute);
  res.json({ success: true });
}));

router.post('/kick', asyncHandler(async (req: Request, res: Response) => {
  const { roomName, identity } = ModerationSchema.parse(req.body);
  await liveKitService.removeParticipant(roomName, identity);
  res.json({ success: true });
}));


export default router;
