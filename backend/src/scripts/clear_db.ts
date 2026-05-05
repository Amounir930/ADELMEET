import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const clearDB = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI not found');
    process.exit(1);
  }

  try {
    await mongoose.connect(uri);
    console.log('Connected to MongoDB');

    const collections = await mongoose.connection.db?.collections();
    if (collections) {
      for (const collection of collections) {
        await collection.deleteMany({});
        console.log(`Cleared collection: ${collection.collectionName}`);
      }
    }

    console.log('Database cleared successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error clearing database:', error);
    process.exit(1);
  }
};

clearDB();
