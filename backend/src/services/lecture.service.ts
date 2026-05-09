import mongoose from 'mongoose';
import { Lecture } from '../models/Lecture';
import { User } from '../models/User';
import { AppError } from '../infra/errors';
import { liveKitService } from './livekit.service';
import { socketService } from './socket.service';

/**
 * MISSION 12: SOVEREIGN BACKEND ORCHESTRATOR
 * This service encapsulates all lecture business logic.
 */
export class LectureService {
  
  async createLecture(title: string, teacherId: string, scheduledAt?: Date, visibility?: string) {
    const teacher = await User.findById(teacherId);
    if (!teacher) throw new AppError(404, 'Teacher not found', 'TEACHER_MISSING');

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
      visibility: visibility || 'public',
      participantsMetadata: []
    });

    await lecture.save();
    return lecture;
  }

  async getAvailableLectures(userId: string, userRole: string) {
    let query: any = { status: { $ne: 'completed' } };
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

    if (lecture.bannedUsers && (lecture.bannedUsers as any).includes(userId)) {
      throw new AppError(403, 'You have been banned from this session', 'USER_BANNED');
    }

    const user = await User.findById(userId);
    if (!user) throw new AppError(404, 'User not found', 'USER_MISSING');

    const rawMetadata = {
      role: userRole,
      initialMuted: userRole === 'student',
      userId: user._id,
      lectureId: lecture._id,
      timestamp: Date.now(),
      screen,
      customAttributes: {} as any
    };

    let identity = userRole === 'teacher' ? `${user._id}_teacher` : `${user._id}_student`;
    if (screen) identity = `${identity}_screen_${screen}`;
    
    // ROOT SOLUTION: Proactively kick existing session to prevent Reason 2
    try {
      console.log(`[LECTURE-SERVICE] Checking for existing participant: ${identity} in room: ${lecture.roomName}`);
      await Promise.race([
        liveKitService.removeParticipant(lecture.roomName, identity),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Removal timeout')), 2000))
      ]).catch(e => console.log(`[LECTURE-SERVICE] Participant removal skipped or timed out: ${e.message}`));
      
      await new Promise(resolve => setTimeout(resolve, 100)); // Minimal delay for propagation
    } catch (e) {
      console.log(`[LECTURE-SERVICE] Error during participant removal cleanup: ${e}`);
    }

    const token = await liveKitService.generateToken({
      roomName: lecture.roomName,
      identity,
      name: userRole === 'teacher' ? (screen ? `${user.name} (Screen ${screen})` : `${user.name} (Teacher)`) : user.name,
      isTeacher: userRole === 'teacher',
      metadata: JSON.stringify(rawMetadata)
    });

    (lecture.participantsMetadata as any).push(rawMetadata);
    
    // Background save to avoid blocking the join response
    lecture.save().then(() => {
      console.log(`[LECTURE-SERVICE] DB Save completed in background`);
    }).catch(err => {
      console.error(`[LECTURE-SERVICE] DB Save failed:`, err);
    });

    return {
      token,
      serverUrl: process.env.LIVEKIT_URL,
      lecture: {
        _id: lecture._id,
        roomName: lecture.roomName,
        title: lecture.title,
        status: lecture.status,
        visibility: lecture.visibility,
        teacherId: (lecture as any).teacher
      }
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
    
    socketService.emitToRoom(lecture.roomName, 'session_ended', { lectureId }); 
    liveKitService.deleteRoom(lecture.roomName).catch(e => console.error('Failed to teardown LK room', e));

    return lecture;
  }

  async banUser(lectureId: string, studentId: string, teacherId: string) {
    const lecture = await Lecture.findOne({ _id: lectureId, teacher: teacherId });
    if (!lecture) throw new AppError(404, 'Lecture not found or unauthorized', 'LECTURE_MISSING');

    if (!lecture.bannedUsers.includes(studentId as any)) {
      lecture.bannedUsers.push(studentId as any);
      await lecture.save();
    }

    const identity = `${studentId}_student`;
    await liveKitService.removeParticipant(lecture.roomName, identity).catch(e => console.error('LK Eject Failed', e));
    
    socketService.emitToRoom(lecture.roomName, 'kick_participant', { studentId });
    return { roomName: lecture.roomName, studentId };
  }

  async muteParticipant(lectureId: string, participantId: string, teacherId: string, trackSid: string) {
    const lecture = await Lecture.findOne({ _id: lectureId, teacher: teacherId });
    if (!lecture) throw new AppError(404, 'Lecture not found or unauthorized', 'LECTURE_MISSING');

    const identity = `${participantId}_student`;
    await liveKitService.muteParticipant(lecture.roomName, identity, trackSid, true);
    
    socketService.emitToRoom(lecture.roomName, 'mute_participant', { participantId });
    return { roomName: lecture.roomName, participantId };
  }

  async grantAudio(lectureId: string, participantId: string, teacherId: string) {
    const lecture = await Lecture.findOne({ _id: lectureId, teacher: teacherId });
    if (!lecture) throw new AppError(404, 'Lecture not found or unauthorized', 'LECTURE_MISSING');

    const identity = `${participantId}_student`;
    await liveKitService.updateParticipant(lecture.roomName, identity, { metadata: JSON.stringify({ role: 'student', hasAudioPriority: true }) });

    socketService.emitToRoom(lecture.roomName, 'grant_audio', { participantId });
    return { roomName: lecture.roomName, participantId };
  }
}

export const lectureService = new LectureService();