import mongoose, { Schema, Document } from 'mongoose';

export interface IAttendance extends Document {
  lecture: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  userName: string;
  userRole: string;
  identity: string;
  joinTime: Date;
  leaveTime?: Date;
  duration?: number; // In seconds
  status: 'active' | 'completed';
}

const AttendanceSchema: Schema = new Schema({
  lecture: { type: Schema.Types.ObjectId, ref: 'Lecture', required: true, index: true },
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  userName: { type: String, required: true },
  userRole: { type: String, required: true },
  identity: { type: String, required: true, index: true },
  joinTime: { type: Date, default: Date.now },
  leaveTime: { type: Date },
  duration: { type: Number, default: 0 },
  status: { type: String, enum: ['active', 'completed'], default: 'active' }
}, { timestamps: true });

// Ensure we index for report generation
AttendanceSchema.index({ lecture: 1, user: 1 });

export const Attendance = mongoose.model<IAttendance>('Attendance', AttendanceSchema);
