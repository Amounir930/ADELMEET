const mongoose = require('mongoose');

const uri = "mongodb+srv://adelhub123_db_user:PcoA7xksaViDy687@cluster0.dcyojhn.mongodb.net/meet2?retryWrites=true&w=majority";

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
  await mongoose.connect(uri);
  console.log('Connected to DB');

  const latestLectures = await Lecture.find().sort({ _id: -1 }).limit(10);
  console.log('--- LATEST LECTURES ---');
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

check().catch(console.error);
