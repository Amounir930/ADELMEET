import { Request, Response } from 'express';
import { roomOrchestratorService } from '../services/room-orchestrator.service';
import logger from '../infra/logger';

/**
 * MISSION 04: DISPLAY CONTROLLER
 * REST handlers for screen management API.
 */

/** POST /api/displays/register */
export const registerDisplay = async (req: Request, res: Response) => {
  try {
    const { hardwareId, roomId, lectureId, displayIndex, ipAddress } = req.body as Record<string, any>;

    if (!hardwareId || !roomId || displayIndex === undefined) {
      return res.status(400).json({ error: 'hardwareId, roomId and displayIndex are required' });
    }

    const display = await roomOrchestratorService.registerDisplay({
      hardwareId,
      roomId,
      lectureId,
      displayIndex: Number(displayIndex),
      ipAddress
    });

    return res.status(200).json({ success: true, display });
  } catch (err: any) {
    logger.error('[DISPLAY-CONTROLLER] registerDisplay error:', err);
    return res.status(500).json({ error: 'Failed to register display' });
  }
};

/** GET /api/displays/:lectureId/assignment */
export const getAssignment = async (req: Request, res: Response) => {
  try {
    const lectureId = req.params.lectureId as string;
    const result = await roomOrchestratorService.computeAssignment(lectureId);
    return res.status(200).json(result);
  } catch (err: any) {
    logger.error('[DISPLAY-CONTROLLER] getAssignment error:', err);
    return res.status(500).json({ error: 'Failed to compute assignment' });
  }
};

/** POST /api/displays/:lectureId/rebalance */
export const rebalanceDisplays = async (req: Request, res: Response) => {
  try {
    const lectureId = req.params.lectureId as string;
    await roomOrchestratorService.rebalance(lectureId);
    return res.status(200).json({ success: true, message: `Rebalanced displays for lecture ${lectureId}` });
  } catch (err: any) {
    logger.error('[DISPLAY-CONTROLLER] rebalance error:', err);
    return res.status(500).json({ error: 'Rebalance failed' });
  }
};

/** POST /api/displays/heartbeat */
export const heartbeat = async (req: Request, res: Response) => {
  try {
    const { hardwareId, metrics } = req.body;

    if (!hardwareId) {
      return res.status(400).json({ error: 'hardwareId is required' });
    }

    const display = await roomOrchestratorService.updateHeartbeat(hardwareId, metrics);
    if (!display) {
      return res.status(404).json({ error: 'Display not found — register first' });
    }

    return res.status(200).json({ acknowledged: true, status: display.status });
  } catch (err: any) {
    logger.error('[DISPLAY-CONTROLLER] heartbeat error:', err);
    return res.status(500).json({ error: 'Heartbeat failed' });
  }
};

/** POST /api/displays/:lectureId/command */
export const sendCommand = async (req: Request, res: Response) => {
  try {
    const lectureId = req.params.lectureId as string;
    const { screenIndex, command, params } = req.body as Record<string, any>;

    if (!command) {
      return res.status(400).json({ error: 'command is required' });
    }

    if (screenIndex !== undefined && screenIndex !== null) {
      await roomOrchestratorService.sendCommand(lectureId, Number(screenIndex), String(command), params);
    } else {
      await roomOrchestratorService.broadcastCommand(lectureId, String(command), params);
    }

    return res.status(200).json({ sent: true, command, screenIndex: screenIndex ?? 'all' });
  } catch (err: any) {
    logger.error('[DISPLAY-CONTROLLER] sendCommand error:', err);
    return res.status(500).json({ error: 'Failed to send command' });
  }
};
