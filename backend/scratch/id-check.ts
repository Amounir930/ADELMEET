import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const checkIds = async () => {
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) return;
    await mongoose.connect(uri);
    const db = mongoose.connection.db;
    if (!db) return;

    console.log('🔍 Checking for ID anomalies...');

    const lectures = await db.collection('lectures').find().toArray();
    for (const l of lectures) {
      if (l._id.toString() === l.teacher.toString()) {
        console.warn(`⚠️ Lecture ${l.title} has _id same as teacher ID: ${l._id}`);
      }
    }

    const users = await db.collection('users').find().toArray();
    console.log(`\n👥 Total Users: ${users.length}`);
    users.forEach(u => console.log(`- ${u.name} (${u.role}): ${u._id}`));

    await mongoose.disconnect();
  } catch (error) {
    console.error(error);
  }
};

checkIds();
