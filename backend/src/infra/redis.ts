import { createClient } from 'redis';
import logger from './logger';

/**
 * MISSION 07: SOVEREIGN REDIS LAYER
 * Distributed State Management for High-Scale Orchestration.
 */
const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.on('error', (err) => logger.error('Redis Error:', err));
redisClient.on('connect', () => logger.info('[REDIS] Connected to Sovereign State Engine'));

const connectRedis = async () => {
  try {
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }
  } catch (err) {
    logger.error('Failed to connect to Redis:', err);
  }
};

export { redisClient, connectRedis };
export default redisClient;
