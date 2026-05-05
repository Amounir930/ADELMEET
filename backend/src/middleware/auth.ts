import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from '../infra/errors';
import mongoose from 'mongoose';
import { User } from '../models/User';

const JWT_SECRET = process.env.JWT_SECRET || 'your_fallback_secret';

// Middleware to ensure DB is connected
export const dbCheckMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (mongoose.connection.readyState !== 1) {
    return next(new AppError(503, 'Database not ready', 'DB_NOT_CONNECTED'));
  }
  next();
};

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return next(new AppError(401, 'No token provided', 'UNAUTHORIZED'));
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    // Verify user still exists in DB
    const userExists = await User.exists({ _id: decoded.id });
    if (!userExists) {
      return next(new AppError(401, 'User no longer exists', 'AUTH_REVOKED'));
    }

    (req as any).user = decoded;
    next();
  } catch (err) {
    next(new AppError(401, 'Invalid token', 'AUTH_EXPIRED'));
  }
};

export const teacherOnly = (req: Request, res: Response, next: NextFunction) => {
  if ((req as any).user?.role !== 'teacher') {
    return next(new AppError(403, 'Teachers only', 'FORBIDDEN'));
  }
  next();
};
