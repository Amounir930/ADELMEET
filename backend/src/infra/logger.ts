import pino from 'pino';

// Validate LOG_LEVEL
if (!process.env.LOG_LEVEL && process.env.NODE_ENV === 'production') {
  console.warn('[LOGGER] WARNING: LOG_LEVEL is not set. Defaulting to "info".');
}


const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss Z',
      ignore: 'pid,hostname',
    },
  } : undefined,
});

export default logger;
