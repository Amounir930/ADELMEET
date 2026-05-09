import { Request, Response, NextFunction } from 'express';
import { extractErrorCode, formatErrorMessage, AppError } from '../infra/errors';
import logger from '../infra/logger';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  const statusCode = extractErrorCode(err);
  const message = formatErrorMessage(err);

  logger.error({
    method: req.method,
    path: req.path,
    statusCode,
    message,
    stack: err.stack
  }, `[ERROR] ${req.method} ${req.path}`);

  // Sanitize message for production if it's a 500 error
  const isProduction = process.env.NODE_ENV === 'production';
  const displayMessage = (statusCode === 500 && isProduction) 
    ? 'Internal Server Error' 
    : message;

  res.status(statusCode).json({
    error: displayMessage,
    code: (err as AppError).code || 'INTERNAL_ERROR'
  });
};

