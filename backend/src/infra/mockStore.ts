// Simple in-memory store for testing without MongoDB
export const mockUsers: any[] = [];
export const mockLectures: any[] = [];

// Helper to check if DB is connected
import mongoose from 'mongoose';
export const isDbConnected = () => mongoose.connection.readyState === 1;
