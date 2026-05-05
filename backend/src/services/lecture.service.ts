
import mongoose from 'mongoose';
import { Lecture } from '../models/Lecture';
import { User } from '../models/User';
import { AppError } from '../infra/errors';
import { liveKitService } from './livekit.service';
import { socketService } from './socket.service';

/**
 * MISSION 12: SOVEREIGN BACKEND ORCHESTRATOR
 * This service encapsulates all lecture business logic.
 * Scale Mandate: High-Concurrency, Error Isolation, Entity-Agnostic functions.
 */
export class LectureService {
  
  async createLecture(title: string, teacherId: string, scheduledAt?: Date, visibility?: string) {
    const teacher = await User.findById(teacherId);
    if (!teacher) throw new AppError(404, 'Teacher not found', 'TEACHER_MISSING');

    // SOVEREIGN UNIQUENESS: Prevent duplicate active titles
    const existing = await Lecture.findOne({ title: { $regex: new RegExp('^' + title.trim() + '$', 'i') }, status: 'active' });
    if (existing) throw new AppError(400, 'An active lecture with this name already exists', 'DUPLICATE_LECTURE');

    const roomName = `room-${Math.random().toString(36).substring(7)}`;

    const lecture = new Lecture({
      title,
      teacher: teacherId,
      teacherName: teacher.name,
      roomName,
      scheduledAt: scheduledAt || new Date(),
      status: 'active',
      visibility: visibility || 'public'
    });

    await lecture.save();
    console.log(`[ORCHESTRA] Lecture Created: ${lecture.roomName}`);
    return lecture;
  }

  async getAvailableLectures(userId: string, userRole: string) {
    let query: any = { status: { $ne: 'completed' } };

    // Point 5: Role-based logic handled in Orchestrator
    if (userRole === 'teacher') {
      query.teacher = userId;
    } else {
      query.visibility = 'public';
    }

    return await Lecture.find(query).sort({ scheduledAt: 1 }).lean();
  }

  async generateAccessSession(lectureIdOrTitle: string, userId: string, userRole: string, screen?: string) {
    const searchId = lectureIdOrTitle.trim();
    const lecture = await Lecture.findOne({
      $or: [
        { _id: mongoose.isValidObjectId(searchId) ? searchId : new mongoose.Types.ObjectId() },
        { roomName: searchId },
        { title: { $regex: new RegExp('^' + searchId + '$', 'i') } }
      ],
      status: 'active'
    });

    if (!lecture) throw new AppError(404, 'Lecture not found', 'LECTURE_MISSING');

    // SOVEREIGN SECURITY: Block banned users
    if (lecture.bannedUsers && (lecture.bannedUsers as any).includes(userId)) {
      throw new AppError(403, 'You have been banned from this session', 'USER_BANNED');
    }

    const user = await User.findById(userId);
    if (!user) throw new AppError(404, 'User not found', 'USER_MISSING');

    // MISSION 12 - POINT 8: METADATA LAYER (Reverted to JSON for debugging)
    const rawMetadata = {
      role: userRole,
      initialMuted: userRole === 'student',
      userId: user._id,
      lectureId: lecture._id,
      timestamp: Date.now(),
      screen
    };

    let identity = userRole === 'teacher' ? `${user._id}_teacher` : `${user._id}_student`;
    if (screen) identity = `${identity}_screen_${screen}`;

    const token = await liveKitService.generateToken({
      roomName: lecture.roomName,
      identity,
      name: userRole === 'teacher' ? (screen ? `${user.name} (Screen ${screen})` : `${user.name} (Teacher)`) : user.name,
      isTeacher: userRole === 'teacher',
      metadata: JSON.stringify(rawMetadata)
    });

    return {
      token,
      serverUrl: process.env.LIVEKIT_URL,
      lecture
    };
  }

  async completeLecture(idOrRoom: string, teacherId: string) {
    const lecture = await Lecture.findOne({ 
      $or: [
        { _id: mongoose.isValidObjectId(idOrRoom) ? idOrRoom : new mongoose.Types.ObjectId() },
        { roomName: idOrRoom }
      ],
      teacher: teacherId 
    });
    
    if (!lecture) throw new AppError(404, 'Unauthorized or missing lecture', 'LECTURE_FORBIDDEN');

    lecture.status = 'completed';
    await lecture.save();

    // POINT 6: Targeted DB Sync (Room-specific)
    socketService.emitToRoom(lecture.roomName, 'db_sync', { 
      collection: 'lectures', 
      id: lecture._id,
      status: 'completed',
      target: 'room_only' 
    });

    return lecture;
  }

  async updateStatus(lectureId: string, status: string, teacherId: string) {
    const lecture = await Lecture.findOne({ _id: lectureId, teacher: teacherId });
    if (!lecture) throw new AppError(404, 'Lecture not found or unauthorized', 'LECTURE_MISSING');

    lecture.status = status as any;
    await lecture.save();
    
    // Broadcast status change
    socketService.emitToRoom(lecture.roomName, 'session_ended', { lectureId }); 
    
    // MISSION 13: FORCE TEARDOWN - Kill the LiveKit room to force all clients to disconnect hardware
    liveKitService.deleteRoom(lecture.roomName).catch(e => console.error('Failed to teardown LK room', e));

    return lecture;
  }

  async banUser(lectureId: string, studentId: string, teacherId: string) {
    const lecture = await Lecture.findOne({ _id: lectureId, teacher: teacherId });
    if (!lecture) throw new AppError(404, 'Lecture not found or unauthorized', 'LECTURE_MISSING');

    // Add to banned list if not already there
    if (!lecture.bannedUsers.includes(studentId as any)) {
      lecture.bannedUsers.push(studentId as any);
      await lecture.save();
    }

    // Return room name so controller can emit kick event
    socketService.emitToRoom(lecture.roomName, 'kick_participant', { studentId });
    return { roomName: lecture.roomName, studentId };
  }
}

export const lectureService = new LectureService();
