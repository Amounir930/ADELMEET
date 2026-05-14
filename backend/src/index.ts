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
import { connectRedis } from './infra/redis';

const app = express();
const port = process.env.PORT || 5000;
const server = http.createServer(app);

// Security & Global Middleware
app.use(cors({
  origin: ['https://meet.60sec.shop', 'https://wall.60sec.shop', 'https://api.60sec.shop'],
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false
}));

import webhookRoutes from './routes/webhook.routes';
app.use('/api/webhooks', webhookRoutes);

app.use(express.json({ limit: '40mb' }));
app.use(dbCheckMiddleware);

import wallRoutes from './routes/wall.routes';

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/lectures', lectureRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/displays', displayRoutes);
app.use('/api/wall', wallRoutes); // PUBLIC — no auth (wall display screens)


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
    // Start DB connection in background (it will retry on its own)
    connectDB(); 
    
    await connectRedis(); // MISSION 07: Distributed State
    
    // Initialize Socket.io AFTER infra is ready
    await socketService.init(server);
    
    server.listen(Number(port), '0.0.0.0', () => {
      logger.info(`[SERVER] Backend running on port ${port} (Socket.io & Redis Active)`);
    });
  } catch (err) {
    logger.error(err as any, 'Failed to start server:');
    process.exit(1);
  }
};

startServer();


