import mongoose from 'mongoose';
import logger from './logger';
import { socketService } from '../services/socket.service';

export const connectDB = async (retryCount = 0) => {
  try {
    const connStr = process.env.MONGODB_URI || '';
    if (!connStr) {
      logger.error('MONGODB_URI is not defined in environment variables');
      process.exit(1);
    }

    // Connect to MongoDB with a timeout
    await mongoose.connect(connStr, { 
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000
    });

    logger.info('🚀 MongoDB Connected successfully (LIVE MODE)');

    // MISSION 10: REAL-TIME SYNC LAYER
    const lectureCollection = mongoose.connection.collection('lectures');
    const changeStream = lectureCollection.watch([], {
      fullDocument: 'updateLookup'
    });

    changeStream.on('change', (change: any) => {
      if (change.operationType === 'update' || change.operationType === 'replace') {
        const lectureId = change.documentKey._id;
        const fullDoc = change.fullDocument;
        const roomName = fullDoc?.roomName;

        if (roomName) {
          logger.info(`[DB-WATCH] Targeted sync for room: ${roomName} (Lecture: ${lectureId})`);
          socketService.emitToRoom(roomName, 'db_sync', { 
            collection: 'lectures', 
            id: lectureId,
            status: fullDoc.status 
          });
        }
      }
    });

    changeStream.on('error', (err: any) => {
      logger.error(err, '[DB-WATCH] Change Stream Error:');
    });

  } catch (error: any) {
    logger.error(`❌ MongoDB Connection Error (Attempt ${retryCount + 1}): ${error.message}`);
    
    // Retry instead of exiting
    setTimeout(() => {
      connectDB(retryCount + 1);
    }, 5000);
  }
};

