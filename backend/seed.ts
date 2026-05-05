import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { User } from './src/models/User';

dotenv.config();

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || '');
    console.log('Connected to DB for seeding...');

    // Clear existing test users if any
    await User.deleteMany({ email: { $in: ['teacher@test.com', 'student@test.com'] } });

    // Create Teacher
    const teacher = new User({
      name: 'Adel',
      email: 'teacher@test.com',
      password: '123456',
      role: 'teacher',
      stats: { totalStudents: 25, totalClasses: 12 }
    });

    // Create Student
    const student = new User({
      name: 'Student 1',
      email: 'student@test.com',
      password: '123456',
      role: 'student',
      stats: { rank: 5, completedLectures: 8, studyHours: 40, progress: 75 }
    });

    await teacher.save();
    await student.save();

    console.log('Seed successful!');
    console.log('Teacher: teacher@test.com / 123456');
    console.log('Student: student@test.com / 123456');
    
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  }
};

seed();
