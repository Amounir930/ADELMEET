import express, { Router, Request, Response } from 'express';
import { WebhookReceiver } from 'livekit-server-sdk';
import { Attendance } from '../models/Attendance';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();
const receiver = new WebhookReceiver(
  process.env.LIVEKIT_API_KEY || '',
  process.env.LIVEKIT_API_SECRET || ''
);

// LiveKit sends webhooks with application/webhook+json or application/json
// We MUST get the raw body as a string to verify the signature correctly
router.post('/livekit', express.text({ type: ['application/webhook+json', 'application/json'] }), asyncHandler(async (req: Request, res: Response) => {
  const authHeader = req.get('Authorization');
  if (!authHeader) {
    console.error('[LIVEKIT-WEBHOOK] Missing Authorization header');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  let event;
  try {
    event = receiver.receive(req.body, authHeader);
  } catch (err: any) {
    console.error(`[LIVEKIT-WEBHOOK] Signature verification failed: ${err.message}`);
    return res.status(400).json({ error: 'Invalid signature' });
  }
  
  console.log(`[LIVEKIT-WEBHOOK] Event received: ${event.event}`, {
    room: event.room?.name,
    participant: event.participant?.identity,
    lectureId: event.participant?.metadata ? JSON.parse(event.participant.metadata).lectureId : 'none'
  });

  if (event.event === 'participant_joined') {
    // MISSION 12: We now use Proactive Attendance in LectureService
    // No need to create duplicate records here. 
    // Just log for debugging.
    console.log(`[LIVEKIT-WEBHOOK] Participant ${event.participant?.identity} joined room ${event.room?.name}`);
  }

  if (event.event === 'participant_left') {
    const roomName = event.room?.name;
    const identity = event.participant?.identity;
    const metadata = event.participant?.metadata ? JSON.parse(event.participant.metadata) : {};

    if (roomName && identity) {
      // Find the latest active attendance for this specific lecture
      const query: any = { identity, status: 'active' };
      if (metadata.lectureId) query.lecture = metadata.lectureId;

      const attendance = await Attendance.findOne(query).sort({ createdAt: -1 });
      if (attendance) {
        const leaveTime = new Date();
        const duration = Math.max(1, Math.floor((leaveTime.getTime() - attendance.joinTime.getTime()) / 1000));
        
        attendance.leaveTime = leaveTime;
        attendance.status = 'completed';
        attendance.duration = duration;
        await attendance.save();
        console.log(`[LIVEKIT-WEBHOOK] Closed attendance for ${identity} - Duration: ${duration}s`);
      }
    }
  }

  res.json({ received: true });
}));

export default router;
