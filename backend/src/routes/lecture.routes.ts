import { Router } from 'express';
import { createLecture, getLectures, joinLecture, deleteLecture, updateLectureStatus, completeLectureByRoom, kickStudent, getLectureReport, bulkDeleteLectures } from '../controllers/lecture.controller';
import { asyncHandler } from '../middleware/asyncHandler';
import { authMiddleware, teacherOnly } from '../middleware/auth';

const router = Router();

router.get('/', authMiddleware, asyncHandler(getLectures));
router.post('/', authMiddleware, teacherOnly, asyncHandler(createLecture));
router.post('/:lectureId/join', authMiddleware, asyncHandler(joinLecture));
router.delete('/:lectureId', authMiddleware, teacherOnly, asyncHandler(deleteLecture));
router.patch('/:lectureId/status', authMiddleware, teacherOnly, asyncHandler(updateLectureStatus));
router.patch('/complete-by-room/:roomName', authMiddleware, teacherOnly, asyncHandler(completeLectureByRoom));
router.delete('/:lectureId/kick/:studentId', authMiddleware, teacherOnly, asyncHandler(kickStudent));
router.get('/:lectureId/report', authMiddleware, teacherOnly, asyncHandler(getLectureReport));
router.post('/bulk-delete', authMiddleware, teacherOnly, asyncHandler(bulkDeleteLectures));

// DIAGNOSTIC ROUTE
router.get('/:lectureId/debug-attendance', authMiddleware, teacherOnly, asyncHandler(async (req, res) => {
  const { lectureId } = req.params;
  const logs = await Attendance.find({ lecture: lectureId });
  res.json({ count: logs.length, logs });
}));


export default router;
