import { Router } from 'express';
import { createLecture, getLectures, joinLecture, deleteLecture, updateLectureStatus, completeLectureByRoom, kickStudent } from '../controllers/lecture.controller';
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


export default router;
