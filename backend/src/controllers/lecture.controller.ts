import { Request, Response, NextFunction } from 'express';
import { lectureService } from '../services/lecture.service';

/**
 * MISSION 12: LEAN HTTP CONTROLLER
 * Orchestrates incoming requests to the Sovereign Service layer.
 */

export const createLecture = async (req: Request, res: Response, next: NextFunction) => {
  const { title, scheduledAt, visibility } = req.body;
  const teacherId = (req as any).user.id;

  try {
    const lecture = await lectureService.createLecture(title, teacherId, scheduledAt, visibility);
    res.status(201).json(lecture);
  } catch (error) {
    next(error);
  }
};

export const getLectures = async (req: Request, res: Response, next: NextFunction) => {
  const userId = (req as any).user.id;
  const userRole = (req as any).user.role;

  try {
    const lectures = await lectureService.getAvailableLectures(userId, userRole);
    res.json(lectures);
  } catch (error) {
    next(error);
  }
};

export const joinLecture = async (req: Request, res: Response, next: NextFunction) => {
  const { lectureId } = req.params;
  const { screen } = req.query;
  const userId = (req as any).user.id;
  const userRole = (req as any).user.role;

  try {
    const sessionData = await lectureService.generateAccessSession(lectureId as any, userId as any, userRole as any, screen as string);
    res.json(sessionData);
  } catch (error) {
    next(error);
  }
};

export const completeLectureByRoom = async (req: Request, res: Response, next: NextFunction) => {
  const { roomName } = req.params;
  const teacherId = (req as any).user.id;

  try {
    const lecture = await lectureService.completeLecture(roomName as any, teacherId as any);
    res.json({ message: 'Lecture completed successfully', lecture });
  } catch (error) {
    next(error);
  }
};

export const updateLectureStatus = async (req: Request, res: Response, next: NextFunction) => {
  const { lectureId } = req.params;
  const { status } = req.body;
  const teacherId = (req as any).user.id;

  try {
    const lecture = await lectureService.updateStatus(lectureId as any, status as any, teacherId as any);
    res.json(lecture);
  } catch (error) {
    next(error);
  }
};

export const deleteLecture = async (req: Request, res: Response, next: NextFunction) => {
  const { lectureId } = req.params;
  const teacherId = (req as any).user.id;

  try {
    await lectureService.deleteLecture(lectureId as any, teacherId as any); 
    res.json({ message: 'Lecture permanently deleted' });
  } catch (error) {
    next(error);
  }
};

export const bulkDeleteLectures = async (req: Request, res: Response, next: NextFunction) => {
  const { ids } = req.body;
  const teacherId = (req as any).user.id;

  try {
    const results = await Promise.all(ids.map((id: string) => 
      lectureService.deleteLecture(id, teacherId).catch(err => ({ id, error: err.message }))
    ));
    res.json({ message: 'Bulk delete operation completed', results });
  } catch (error) {
    next(error);
  }
};
export const kickStudent = async (req: Request, res: Response, next: NextFunction) => {
  const { lectureId, studentId } = req.params;
  const teacherId = (req as any).user.id;

  try {
    const result = await lectureService.banUser(lectureId as any, studentId as any, teacherId as any);
    res.json({ message: 'Student kicked and banned successfully', result });
  } catch (error) {
    next(error);
  }
};

export const getLectureReport = async (req: Request, res: Response, next: NextFunction) => {
  const { lectureId } = req.params;
  const teacherId = (req as any).user.id;

  try {
    const report = await lectureService.getLectureAttendance(lectureId as any, teacherId as any);
    res.json(report);
  } catch (error) {
    next(error);
  }
};
