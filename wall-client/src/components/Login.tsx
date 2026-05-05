import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LogIn, ShieldCheck } from 'lucide-react';

export const Login: React.FC<{ onToggle: () => void }> = ({ onToggle }) => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(email, password, 'teacher');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid credentials for Teacher portal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0c', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div className="glass fade-in" style={{ width: '100%', maxWidth: '400px', padding: '40px', borderRadius: '30px', border: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ textAlign: 'center', marginBottom: '35px' }}>
          <div style={{ background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)', width: '60px', height: '60px', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <ShieldCheck size={30} color="white" />
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: '800', marginBottom: '8px', letterSpacing: '-0.5px' }}>TEACHER WALL</h1>
          <p style={{ opacity: 0.5, fontSize: '14px' }}>Secure access to academic wall management</p>
        </div>

        {error && <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '12px', borderRadius: '12px', fontSize: '13px', marginBottom: '20px', textAlign: 'center', border: '1px solid rgba(239, 68, 68, 0.2)' }}>{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', opacity: 0.6, fontWeight: '600' }}>Email Address</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" placeholder="teacher@academy.com" required style={{ width: '100%' }} />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', opacity: 0.6, fontWeight: '600' }}>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="input" placeholder="••••••••" required style={{ width: '100%' }} />
          </div>
          <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: '100%', padding: '14px', marginTop: '10px' }}>
            {loading ? 'Authenticating...' : <><LogIn size={18} /> Sign In</>}
          </button>
        </form>

        <div style={{ marginTop: '30px', textAlign: 'center', fontSize: '14px', opacity: 0.5 }}>
          Don't have a teacher account? <span onClick={onToggle} style={{ color: '#6366f1', cursor: 'pointer', fontWeight: '600' }}>Create Account</span>
        </div>
      </div>
    </div>
  );
};
