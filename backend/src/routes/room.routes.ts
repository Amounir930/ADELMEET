import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler';
import { liveKitService } from '../services/livekit.service';

const router = Router();

const JoinRoomSchema = z.object({
  roomName: z.string().min(1),
  identity: z.string().min(1),
  name: z.string().optional(),
  isTeacher: z.boolean().optional(),
});

import { Request, Response } from 'express';

router.post('/join', asyncHandler(async (req: Request, res: Response) => {
  const validated = JoinRoomSchema.parse(req.body);
  const token = await liveKitService.generateToken(validated);
  
  res.json({
    token,
    serverUrl: process.env.LIVEKIT_URL,
  });
}));

export default router;
