import mongoose from 'mongoose';
import logger from './logger';
import { socketService } from '../services/socket.service';

export const connectDB = async () => {
  try {
    const connStr = process.env.MONGODB_URI || '';
    if (!connStr) {
      logger.error('MONGODB_URI is not defined in environment variables');
      process.exit(1);
    }

    await mongoose.connect(connStr);
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
        } else {
          // Fallback if roomName is missing (shouldn't happen with updateLookup)
          logger.warn(`[DB-WATCH] RoomName missing for lecture: ${lectureId}, fallback to global sync`);
          socketService.getIO()?.emit('db_sync', { collection: 'lectures', id: lectureId });
        }
      }
    });

    changeStream.on('error', (err: any) => {
      logger.error(err, '[DB-WATCH] Change Stream Error:');
    });

  } catch (error: any) {
    logger.error('❌ MongoDB Connection Error Detail:');
    console.error(error);
    process.exit(1);
  }
};

