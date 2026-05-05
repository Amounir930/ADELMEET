import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { LogIn } from 'lucide-react';

const joinSchema = z.object({
  roomName: z.string().min(1, 'Room name is required'),
  identity: z.string().min(1, 'Name is required'),
});

type JoinData = z.infer<typeof joinSchema>;

interface JoinRoomProps {
  onJoin: (data: JoinData) => void;
  isLoading: boolean;
}

export const JoinRoom: React.FC<JoinRoomProps> = ({ onJoin, isLoading }) => {
  const { register, handleSubmit, formState: { errors } } = useForm<JoinData>({
    resolver: zodResolver(joinSchema)
  });

  return (
    <div className="fade-in" style={{ maxWidth: '400px', margin: '100px auto' }}>
      <div className="glass" style={{ padding: '40px' }}>
        <h1 style={{ marginBottom: '24px', textAlign: 'center' }}>Join Classroom</h1>
        <form onSubmit={handleSubmit(onJoin)} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Room ID</label>
            <input 
              {...register('roomName')} 
              className="input" 
              placeholder="e.g. math-101"
            />
            {errors.roomName && <p style={{ color: 'var(--error-color)', fontSize: '12px', marginTop: '4px' }}>{errors.roomName.message}</p>}
          </div>
          
          <div>
            <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Your Name</label>
            <input 
              {...register('identity')} 
              className="input" 
              placeholder="e.g. John Doe"
            />
            {errors.identity && <p style={{ color: 'var(--error-color)', fontSize: '12px', marginTop: '4px' }}>{errors.identity.message}</p>}
          </div>

          <button type="submit" className="btn btn-primary" disabled={isLoading} style={{ marginTop: '10px' }}>
            {isLoading ? 'Connecting...' : <><LogIn size={18} /> Join Room</>}
          </button>
        </form>
      </div>
    </div>
  );
};
