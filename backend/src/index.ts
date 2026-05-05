import dotenv from 'dotenv';
import logger from './infra/logger';
dotenv.config();

import express from 'express';
import mongoose from 'mongoose';
import helmet from 'helmet';

import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import { connectDB } from './infra/db';
import roomRoutes from './routes/room.routes';
import authRoutes from './routes/auth.routes';
import lectureRoutes from './routes/lecture.routes';
import displayRoutes from './routes/display.routes';
import { errorHandler } from './middleware/errorHandler';

import { dbCheckMiddleware } from './middleware/auth';

import http from 'http';
import { socketService } from './services/socket.service';

const app = express();
const port = process.env.PORT || 5000;
const server = http.createServer(app);

// Initialize Socket.io
socketService.init(server);


// Security & Global Middleware
// ... (rest of the middleware)
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(dbCheckMiddleware);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/lectures', lectureRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/displays', displayRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Detailed DB status
app.get('/api/db-status', (req, res) => {
  const status = mongoose.connection.readyState;
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  res.json({ 
    status: states[status], 
    connected: status === 1,
    timestamp: new Date()
  });
});


// Error handling - MUST be last
app.use(errorHandler);

// Connect to Database and start server
const startServer = async () => {
  try {
    await connectDB();
    server.listen(port, () => {
      logger.info(`[SERVER] Backend running on port ${port} (Socket.io Active)`);
    });
  } catch (err) {
    logger.error(err as any, 'Failed to start server:');
    process.exit(1);
  }
};

startServer();


