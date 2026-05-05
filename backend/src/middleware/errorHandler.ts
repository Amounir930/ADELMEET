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

  res.status(statusCode).json({
    error: message,
    code: (err as AppError).code || 'INTERNAL_ERROR'
  });
};
