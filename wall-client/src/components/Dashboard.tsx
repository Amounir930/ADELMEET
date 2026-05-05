import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { 
  LogOut, 
  Plus,
  Users, 
  Monitor, 
  Clock,
  Activity,
  ChevronRight
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL_BASE || 'http://localhost:5000/api';

export const Dashboard: React.FC<{ onJoin: (lectureId: string, screens: number) => void }> = ({ onJoin }) => {
  const { user, token, logout } = useAuth();
  const [lectures, setLectures] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'error' | 'success' } | null>(null);
  
  // Launch screens states
  const [launchingLecture, setLaunchingLecture] = useState<string | null>(null);
  const [numScreens, setNumScreens] = useState(10);

  const showToast = (msg: string, type: 'error' | 'success' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchLectures = async () => {
    try {
      const res = await axios.get(`${API_BASE}/lectures`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLectures(res.data);
    } catch (err) {
      console.error('Failed to fetch lectures');
    }
  };

  useEffect(() => {
    fetchLectures();
    const interval = setInterval(fetchLectures, 5000);
    return () => clearInterval(interval);
  }, [token]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${API_BASE}/lectures`, { title, scheduledAt: scheduledAt || null }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTitle('');
      setScheduledAt('');
      setShowCreate(false);
      fetchLectures();
      showToast('New Command Session created!', 'success');
    } catch (err: any) {
      showToast('Failed to create session', 'error');
    } finally {
      setLoading(false);
    }
  };

  const executeLaunch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!launchingLecture) return;

    for (let i = 0; i < numScreens; i++) {
      const url = `/grid?lecture=${launchingLecture}&totalScreens=${numScreens}&screen=${i}`;
      const windowFeatures = `width=800,height=600,left=${i * 50},top=${i * 50}`;
      window.open(url, `screen_${i}`, windowFeatures);
    }

    onJoin(launchingLecture, numScreens);
    setLaunchingLecture(null);
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: '#020617',
      color: '#fff', 
      fontFamily: 'Outfit, sans-serif',
      padding: '40px 20px'
    }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        
        {/* ADMINISTRATIVE HEADER */}
        <header style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '40px',
          padding: '25px',
          background: 'rgba(30, 41, 59, 0.5)',
          borderRadius: '24px',
          border: '1px solid rgba(255,255,255,0.05)',
          backdropFilter: 'blur(20px)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ 
              width: '60px', 
              height: '60px', 
              borderRadius: '18px', 
              background: '#6366f1', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              boxShadow: '0 10px 30px rgba(99, 102, 241, 0.4)'
            }}>
              <Activity size={30} color="white" />
            </div>
            <div>
              <h1 style={{ fontSize: '20px', fontWeight: '900', margin: 0, letterSpacing: '1px' }}>COMMAND CENTER</h1>
              <p style={{ fontSize: '12px', color: '#6366f1', fontWeight: 'bold', margin: 0 }}>Administrator: {(user as any)?.username || user?.name || 'TEACHER'}</p>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '15px' }}>
             <button onClick={() => setShowCreate(true)} style={{ background: '#6366f1', color: 'white', border: 'none', padding: '12px 25px', borderRadius: '15px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Plus size={20} />
              NEW SESSION
            </button>
            <button onClick={logout} style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '12px', borderRadius: '15px', color: '#ef4444', cursor: 'pointer' }}>
              <LogOut size={20} />
            </button>
          </div>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '30px' }}>
          
          {/* MAIN COLUMN: SESSION MANAGEMENT */}
          <main>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '25px' }}>
              <Activity color="#6366f1" size={24} />
              <h2 style={{ fontSize: '22px', fontWeight: '800' }}>Active Command Logs</h2>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '15px' }}>
              {lectures.map((lecture) => (
                <div key={lecture._id} className="glass" style={{ 
                  padding: '25px', 
                  borderRadius: '24px', 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  transition: 'all 0.3s ease'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <div style={{ width: '50px', height: '50px', borderRadius: '15px', background: 'rgba(99, 102, 241, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Monitor color="#6366f1" size={24} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '18px', fontWeight: '800', margin: '0 0 5px 0' }}>{lecture.title}</h3>
                      <div style={{ display: 'flex', gap: '15px', fontSize: '12px', color: '#94a3b8' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><Clock size={14} /> {new Date(lecture.scheduledAt).toLocaleTimeString()}</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><Users size={14} /> 0 Participants</span>
                      </div>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button onClick={() => setLaunchingLecture(lecture.roomName)} style={{ background: '#6366f1', color: 'white', border: 'none', padding: '10px 25px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      LAUNCH <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              ))}
              {lectures.length === 0 && (
                <div style={{ padding: '60px', textAlign: 'center', background: 'rgba(255,255,255,0.01)', borderRadius: '24px', border: '1px dashed rgba(255,255,255,0.1)' }}>
                  <p style={{ color: '#94a3b8' }}>No active command sessions found.</p>
                </div>
              )}
            </div>
          </main>

          {/* SIDEBAR: ADMIN ANALYTICS */}
          <aside style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
            <div className="glass" style={{ padding: '30px', borderRadius: '32px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Activity size={20} color="#6366f1" />
                SYSTEM INSIGHTS
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div style={{ padding: '15px', background: 'rgba(99, 102, 241, 0.05)', borderRadius: '15px' }}>
                  <p style={{ fontSize: '11px', color: '#94a3b8', margin: '0 0 5px 0' }}>TOTAL SESSIONS</p>
                  <p style={{ fontSize: '20px', fontWeight: '900', margin: 0 }}>{lectures.length}</p>
                </div>
                <div style={{ padding: '15px', background: 'rgba(16, 185, 129, 0.05)', borderRadius: '15px' }}>
                  <p style={{ fontSize: '11px', color: '#94a3b8', margin: '0 0 5px 0' }}>SYSTEM HEALTH</p>
                  <p style={{ fontSize: '20px', fontWeight: '900', margin: 0, color: '#10b981' }}>OPTIMAL</p>
                </div>
              </div>
            </div>

            <div className="glass" style={{ padding: '30px', borderRadius: '32px', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(168, 85, 247, 0.1) 100%)' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '15px' }}>COMMAND TOOLS</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <button style={{ padding: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff', fontSize: '11px', fontWeight: 'bold' }}>LOGS</button>
                <button style={{ padding: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff', fontSize: '11px', fontWeight: 'bold' }}>FILES</button>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* CREATE SESSION MODAL */}
      {showCreate && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass" style={{ width: '100%', maxWidth: '500px', padding: '40px', borderRadius: '32px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: '900', marginBottom: '30px' }}>INITIALIZE SESSION</h2>
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <input 
                type="text" 
                placeholder="Session Title" 
                value={title} 
                onChange={(e) => setTitle(e.target.value)} 
                required 
                style={{ padding: '15px 20px', borderRadius: '15px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', outline: 'none' }}
              />
              <input 
                type="datetime-local" 
                value={scheduledAt} 
                onChange={(e) => setScheduledAt(e.target.value)} 
                style={{ padding: '15px 20px', borderRadius: '15px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', outline: 'none' }}
              />
              <div style={{ display: 'flex', gap: '15px', marginTop: '10px' }}>
                <button type="button" onClick={() => setShowCreate(false)} style={{ flex: 1, padding: '15px', borderRadius: '15px', background: 'rgba(255,255,255,0.05)', border: 'none', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}>CANCEL</button>
                <button type="submit" disabled={loading} style={{ flex: 1, padding: '15px', borderRadius: '15px', background: '#6366f1', border: 'none', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}>
                  {loading ? 'LAUNCHING...' : 'CONFIRM'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LAUNCH SESSION MODAL */}
      {launchingLecture && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass" style={{ width: '100%', maxWidth: '400px', padding: '40px', borderRadius: '32px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: '900', marginBottom: '20px' }}>LAUNCH SCREENS</h2>
            <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '25px' }}>Enter the number of physical monitors/screens to open. The system will auto-balance students.</p>
            <form onSubmit={executeLaunch} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <input 
                type="number" 
                placeholder="Number of Screens" 
                value={numScreens} 
                onChange={(e) => setNumScreens(parseInt(e.target.value) || 0)} 
                required 
                min="1"
                max="50"
                style={{ padding: '15px 20px', borderRadius: '15px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', outline: 'none', fontSize: '18px', fontWeight: 'bold', textAlign: 'center' }}
              />
              <div style={{ display: 'flex', gap: '15px', marginTop: '10px' }}>
                <button type="button" onClick={() => setLaunchingLecture(null)} style={{ flex: 1, padding: '15px', borderRadius: '15px', background: 'rgba(255,255,255,0.05)', border: 'none', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}>CANCEL</button>
                <button type="submit" style={{ flex: 1, padding: '15px', borderRadius: '15px', background: '#10b981', border: 'none', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}>
                  CONFIRM & LAUNCH
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TOAST */}
      {toast && (
        <div style={{ position: 'fixed', bottom: '40px', right: '40px', padding: '15px 30px', background: toast.type === 'success' ? '#10b981' : '#ef4444', borderRadius: '15px', color: '#fff', fontWeight: 'bold', zIndex: 10000, boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
          {toast.msg}
        </div>
      )}

      <style>{`
        .glass { background: rgba(255,255,255,0.03); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.08); }
        .glass:hover { border-color: rgba(99, 102, 241, 0.3); transform: translateY(-2px); transition: all 0.3s ease; }
      `}</style>
    </div>
  );
};
