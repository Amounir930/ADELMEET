import mongoose from 'mongoose';
import { Lecture } from '../models/Lecture';
import { Attendance } from '../models/Attendance';
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
    let query: any = {};
    if (userRole === 'teacher') {
      query.teacher = userId;
    } else {
      query.status = { $ne: 'completed' };
      query.visibility = 'public';
    }
    return await Lecture.find(query).sort({ scheduledAt: -1 }).lean();
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

    // ROOM LOCK: Block new students from getting a token if room is locked (teachers always bypass)
    if (userRole === 'student') {
      const { stateService } = await import('./state.service');
      const roomState = await stateService.getRoomState(lecture.roomName);
      if (roomState?.isRoomLocked) {
        throw new AppError(423, 'المحاضرة مغلقة من قِبَل المعلم', 'ROOM_LOCKED');
      }
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

    // MISSION 12: Clean up previous active sessions for this identity
    // to prevent race conditions with 'participant_left' webhooks.
    const now = new Date();
    const existingActive = await Attendance.find({ identity, lecture: lecture._id, status: 'active' });
    for (const oldAtt of existingActive) {
      oldAtt.leaveTime = now;
      oldAtt.status = 'completed';
      oldAtt.duration = Math.max(1, Math.floor((now.getTime() - oldAtt.joinTime.getTime()) / 1000));
      await oldAtt.save();
    }

    // MISSION 12: PROACTIVE ATTENDANCE (WEBHOOK FALLBACK)
    await Attendance.create({
      lecture: lecture._id,
      user: userId,
      userName: userRole === 'teacher' ? (screen ? `${user.name} (Screen ${screen})` : `${user.name}`) : user.name,
      userRole: userRole,
      identity: identity,
      joinTime: new Date(),
      status: 'active'
    }).catch(err => console.error('[LECTURE-SERVICE] Proactive attendance failed:', err));

    (lecture.participantsMetadata as any).push(rawMetadata);
    
    // Background save to avoid blocking the join response
    lecture.save().catch(err => {
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
    lecture.endedAt = new Date();
    await lecture.save();

    // MISSION 12: AUTO-CLOSE ATTENDANCE
    // If some participants are still 'active', close them now
    const now = new Date();
    const activeAttendances = await Attendance.find({ lecture: lecture._id, status: 'active' });
    
    console.log(`[LECTURE-SERVICE] Finalizing lecture ${lecture._id}. Closing ${activeAttendances.length} active sessions.`);

    for (const att of activeAttendances) {
      att.leaveTime = now;
      att.status = 'completed';
      // Ensure at least 1s duration if they were active
      att.duration = Math.max(1, Math.floor((now.getTime() - att.joinTime.getTime()) / 1000));
      await att.save();
    }

    socketService.emitToRoom(lecture.roomName, 'db_sync', { 
      collection: 'lectures', 
      id: lecture._id,
      status: 'completed',
      target: 'room_only' 
    });

    return lecture;
  }

  async deleteLecture(id: string, teacherId: string) {
    const lecture = await Lecture.findOne({ _id: id, teacher: teacherId });
    if (!lecture) throw new AppError(404, 'Lecture not found or unauthorized', 'LECTURE_MISSING');

    await Lecture.deleteOne({ _id: id });
    // Proactively cleanup attendance logs for this session to keep DB lean
    await Attendance.deleteMany({ lecture: id });
    
    // Notify room if active
    socketService.emitToRoom(lecture.roomName, 'session_ended', { lectureId: id, deleted: true });
    liveKitService.deleteRoom(lecture.roomName).catch(e => console.error('Failed to teardown LK room', e));

    return { id, success: true };
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

    // MISSION 12: Stable Identity
    // We use userId + role + screen to keep it stable during re-renders
    // but unique enough for different devices/roles.
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

  async getLectureAttendance(lectureId: string, teacherId: string) {
    const lecture = await Lecture.findOne({ _id: lectureId, teacher: teacherId });
    if (!lecture) throw new AppError(404, 'Lecture not found or unauthorized', 'LECTURE_MISSING');

    const queryId = mongoose.isValidObjectId(lectureId) ? new mongoose.Types.ObjectId(lectureId) : lectureId;
    const logs = await Attendance.find({ lecture: queryId as any }).sort({ joinTime: 1 }).lean();

    console.log(`[LECTURE-REPORT] Found ${logs.length} attendance logs for lecture ${lectureId}`);

    // Group by user to show total duration
    const summaryMap: Record<string, any> = {};
    logs.forEach(log => {
      const key = log.user.toString();
      if (!summaryMap[key]) {
        summaryMap[key] = {
          userId: log.user,
          userName: log.userName,
          userRole: log.userRole,
          totalDuration: 0,
          sessions: []
        };
      }
      summaryMap[key].totalDuration += log.duration || 0;
      summaryMap[key].sessions.push({
        join: log.joinTime,
        leave: log.leaveTime,
        duration: log.duration
      });
    });

    return {
      lecture: {
        title: lecture.title,
        status: lecture.status,
        roomName: lecture.roomName
      },
      attendance: Object.values(summaryMap)
    };
  }
}

export const lectureService = new LectureService();