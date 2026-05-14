import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Load env from backend
dotenv.config({ path: path.join(__dirname, '../backend/.env') });

const AttendanceSchema = new mongoose.Schema({
  lecture: mongoose.Schema.Types.ObjectId,
  userName: String,
  status: String,
  joinTime: Date
});

const LectureSchema = new mongoose.Schema({
  title: String,
  status: String
});

const Attendance = mongoose.model('Attendance', AttendanceSchema);
const Lecture = mongoose.model('Lecture', LectureSchema);

async function check() {
  await mongoose.connect(process.env.MONGO_URI || '');
  console.log('Connected to DB');

  const latestLectures = await Lecture.find().sort({ _id: -1 }).limit(5);
  for (const l of latestLectures) {
    const attCount = await Attendance.countDocuments({ lecture: l._id });
    console.log(`Lecture: ${l.title} (${l._id}) - Status: ${l.status} - Attendance Records: ${attCount}`);
    
    if (attCount > 0) {
        const samples = await Attendance.find({ lecture: l._id });
        samples.forEach(s => console.log(`  -> Participant: ${s.userName} - Status: ${s.status}`));
    }
  }

  await mongoose.disconnect();
}

check();
