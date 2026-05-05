import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import {
  registerDisplay,
  getAssignment,
  rebalanceDisplays,
  heartbeat,
  sendCommand
} from '../controllers/display.controller';

const router = Router();

/**
 * MISSION 04: DISPLAY API ROUTES
 * 
 * POST /api/displays/register          — Register / update a screen
 * POST /api/displays/heartbeat         — Screen sends periodic heartbeat
 * GET  /api/displays/:lectureId/assignment — Get current student distribution
 * POST /api/displays/:lectureId/rebalance  — Force rebalance
 * POST /api/displays/:lectureId/command    — Send command to screen(s)
 */

// No auth for heartbeat (screens may not have JWT)
router.post('/heartbeat', heartbeat);
router.post('/register', registerDisplay);

// Teacher-authenticated routes
router.get('/:lectureId/assignment', authMiddleware, getAssignment);
router.post('/:lectureId/rebalance', authMiddleware, rebalanceDisplays);
router.post('/:lectureId/command', authMiddleware, sendCommand);

export default router;
