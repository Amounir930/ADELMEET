import mongoose from 'mongoose';

/**
 * MISSION 04: SOVEREIGN DISPLAY MODEL
 * Tracks the persistent state of each physical screen in the classroom.
 */
const displaySchema = new mongoose.Schema({
  hardwareId: { type: String, required: true, unique: true }, // e.g., "PC-A1-001" or socket ID
  roomId:     { type: String, required: true },               // physical classroom ID
  lectureId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Lecture', default: null },
  displayIndex: { type: Number, required: true },             // 0-based screen number
  ipAddress:    { type: String, default: '' },
  status:       { type: String, enum: ['online', 'offline', 'error'], default: 'online' },
  assignedStudents: [{ type: String }],                       // LiveKit identities
  lastHeartbeat: { type: Date, default: Date.now },
  config: {
    quality:    { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    gridLayout: { type: String, default: 'auto' },
  }
}, { timestamps: true });

// Auto-mark display offline if heartbeat is > 30s old
displaySchema.methods.isAlive = function () {
  return (Date.now() - this.lastHeartbeat.getTime()) < 30_000;
};

export const Display = mongoose.model('Display', displaySchema);
export type DisplayDoc = mongoose.InferSchemaType<typeof displaySchema>;
