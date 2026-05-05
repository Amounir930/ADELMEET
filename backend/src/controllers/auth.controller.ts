import { Request, Response } from 'express';
import { User } from '../models/User';
import jwt from 'jsonwebtoken';
import { AppError } from '../infra/errors';
import { isDbConnected, mockUsers } from '../infra/mockStore';
import bcrypt from 'bcryptjs';

const JWT_SECRET = process.env.JWT_SECRET || 'your_fallback_secret';

export const register = async (req: Request, res: Response) => {
  const { name, email, password, role } = req.body;

  const existingUser = await User.findOne({ email, role });
  if (existingUser) {
    throw new AppError(400, `Email is already registered as a ${role}`, 'USER_EXISTS');
  }

  const user = new User({ name, email, password, role });
  await user.save();

  const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

  res.status(201).json({
    token,
    user: { 
      id: user._id, 
      name: user.name, 
      email: user.email, 
      role: user.role, 
      stats: user.stats 
    }
  });
};

export const login = async (req: Request, res: Response) => {
  const { email, password, role } = req.body;
  console.log(`[AUTH] Login attempt: ${email} (${role})`);

  const user: any = await User.findOne({ email, role });
  if (!user) {
    console.warn(`[AUTH] User not found: ${email}`);
    throw new AppError(401, 'Invalid credentials', 'AUTH_FAILED');
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    console.warn(`[AUTH] Password mismatch for: ${email}`);
    throw new AppError(401, 'Invalid credentials', 'AUTH_FAILED');
  }

  console.log(`[AUTH] Success: ${email}`);
  const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

  res.json({
    token,
    user: { 
      id: user._id, 
      name: user.name, 
      email: user.email, 
      role: user.role, 
      stats: user.stats 
    }
  });
};
