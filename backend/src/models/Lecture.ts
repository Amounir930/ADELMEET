import mongoose from 'mongoose';
import { User } from './User';

const lectureSchema = new mongoose.Schema({
  title: { type: String, required: true },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  teacherName: { type: String, required: true },
  roomName: { type: String, required: true, unique: true },
  scheduledAt: { type: Date, default: Date.now },
  status: { type: String, enum: ['active', 'completed', 'scheduled'], default: 'scheduled' },
  visibility: { type: String, enum: ['public', 'private'], default: 'public' },
  bannedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
}, { timestamps: true });

// Pre-save hook to update teacher stats
lectureSchema.pre('save', async function() {
  if (this.isModified('status') && this.status === 'completed') {
    try {
      await User.findByIdAndUpdate(this.teacher, {
        $inc: { 'stats.totalClasses': 1 }
      });
      console.log(`[DB] Updated stats for teacher: ${this.teacherName}`);
    } catch (err) {
      console.error('[DB] Failed to update teacher stats:', err);
    }
  }
});


export const Lecture = mongoose.model('Lecture', lectureSchema);

