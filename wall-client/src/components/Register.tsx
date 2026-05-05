import React, { useState } from 'react';
import axios from 'axios';
import { UserPlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_URL_BASE || 'http://localhost:5000/api';

export const Register: React.FC<{ onToggle?: () => void }> = ({ onToggle }) => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await axios.post(`${API_BASE}/auth/register`, { name, email, password, role: 'teacher' });
      alert('Teacher account created! Please login.');
      navigate('/login');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass fade-in" style={{ padding: '40px', maxWidth: '400px', margin: '100px auto' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '24px' }}>Teacher Registration</h2>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '8px', opacity: 0.7 }}>Full Name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="input" required />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '8px', opacity: 0.7 }}>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" required />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '8px', opacity: 0.7 }}>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="input" required />
        </div>
        {error && <p style={{ color: '#ef4444', fontSize: '14px' }}>{error}</p>}
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Processing...' : <><UserPlus size={18} /> Register</>}
        </button>
      </form>
      <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '14px', opacity: 0.7 }}>
        Already have an account? <span onClick={onToggle} style={{ color: 'var(--accent-color)', cursor: 'pointer', fontWeight: 'bold' }}>Login</span>
      </p>
    </div>
  );
};
