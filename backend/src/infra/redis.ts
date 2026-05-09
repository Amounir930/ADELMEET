import { createClient } from 'redis';
import logger from './logger';

/**
 * MISSION 07: SOVEREIGN REDIS LAYER
 * Distributed State Management for High-Scale Orchestration.
 */
const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  socket: {
    keepAlive: true,
    connectTimeout: 10000,
  }

});

// Add event listener for reconnect
redisClient.on('reconnect', () => {
  logger.info('[REDIS] Reconnecting to Sovereign State Engine');
});

redisClient.on('error', (err) => logger.error(`Redis Error: ${err.message || err}`));
redisClient.on('connect', () => logger.info('[REDIS] Connected to Sovereign State Engine'));

// Add event listener for end
redisClient.on('end', () => {
  logger.info('[REDIS] Connection to Sovereign State Engine ended');
});


const connectRedis = async () => {
  try {
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }
  } catch (err: any) {
    logger.error(`Failed to connect to Redis: ${err.message || err}`);
  }

};

export { redisClient, connectRedis };
export default redisClient;
