import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { 
    type: String, 
    required: true, 
    unique: true, 
    lowercase: true, 
    trim: true,
    validate: {
      validator: (v: string) => /^\S+@\S+\.\S+$/.test(v),
      message: 'Invalid email format'
    }
  },
  password: { 
    type: String, 
    required: true,
    minlength: [8, 'Password must be at least 8 characters']
  },
  role: { type: String, enum: ['student', 'teacher'], default: 'student' },
  stats: {
    rank: { type: Number, default: 0 },
    completedLectures: { type: Number, default: 0 },
    studyHours: { type: Number, default: 0 },
    progress: { type: Number, default: 0 },
    // Teacher specific
    totalStudents: { type: Number, default: 0 },
    totalClasses: { type: Number, default: 0 }
  }
}, { timestamps: true });

// Compound index: allow same email for different roles
userSchema.index({ email: 1, role: 1 }, { unique: true });

// Hash password before saving
userSchema.pre('save', async function() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12); // Increased to 12
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword: string) {
  return bcrypt.compare(candidatePassword, this.password);
};


export const User = mongoose.model('User', userSchema);
