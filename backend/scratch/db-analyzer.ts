import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const analyzeDB = async () => {
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      console.error('❌ MONGODB_URI not found in .env');
      return;
    }

    console.log('🔍 Connecting to database...');
    await mongoose.connect(uri);
    console.log('✅ Connected successfully.');

    const db = mongoose.connection.db;
    if (!db) return;

    console.log('\n--- DATA SAMPLES ---');

    const users = await db.collection('users').find().limit(3).toArray();
    console.log('\n👤 Users Sample:');
    users.forEach(u => {
      const { password, ...rest } = u;
      console.log(JSON.stringify(rest, null, 2));
    });

    const lectures = await db.collection('lectures').find().limit(3).toArray();
    console.log('\n📚 Lectures Sample:');
    lectures.forEach(l => {
      console.log(JSON.stringify(l, null, 2));
    });

    // Check for empty strings or invalid data
    const emptyNames = await db.collection('users').countDocuments({ name: '' });
    if (emptyNames > 0) console.warn(`⚠️ Warning: ${emptyNames} users have empty names.`);

    await mongoose.disconnect();
    console.log('\n✅ Detailed analysis complete.');
  } catch (error) {
    console.error('❌ Error during analysis:', error);
  }
};

analyzeDB();
