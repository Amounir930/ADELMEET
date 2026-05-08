import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const checkUser = async () => {
  try {
    const uri = process.env.MONGODB_URI || '';
    if (!uri) throw new Error('MONGODB_URI not found');

    await mongoose.connect(uri);
    console.log('Connected to DB...');

    const userSchema = new mongoose.Schema({}, { strict: false });
    const User = mongoose.model('User', userSchema, 'users');

    const emailToCheck = 'adel@gmail.com';
    const user = await User.findOne({ email: emailToCheck });

    if (user) {
      console.log('USER_FOUND:', JSON.stringify(user, null, 2));
    } else {
      console.log('USER_NOT_FOUND:', emailToCheck);
      
      // List all users to see what we have
      const allUsers = await User.find({}, { email: 1, role: 1 });
      console.log('EXISTING_USERS:', JSON.stringify(allUsers, null, 2));
    }

    process.exit(0);
  } catch (err) {
    console.error('Check failed:', err);
    process.exit(1);
  }
};

checkUser();
