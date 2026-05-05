import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { 
  Video, 
  LogOut, 
  User as UserIcon, 
  Trophy, 
  Bell,
  Activity,
  Loader2,
  Shield,
  ChevronRight,
  Target,
  Award,
  Zap,
  Calendar,
  Settings
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL_BASE || 'http://localhost:5000/api';

export const Dashboard: React.FC<{ onJoin: (roomName: string) => void }> = ({ onJoin }) => {
  const { user, token, logout } = useAuth();
  const [lectures, setLectures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [joinId, setJoinId] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [toast, setToast] = useState<{msg: string, type: 'success' | 'error'} | null>(null);

  useEffect(() => {
    const fetchLectures = async () => {
      try {
        const res = await axios.get(`${API_BASE}/lectures`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        // SOVEREIGN SECURITY: Show only ACTIVE and PUBLIC lectures to students
        setLectures(res.data.filter((l: any) => l.status === 'active' && l.visibility === 'public'));
      } catch (err) {
        console.error('Failed to fetch lectures');
      } finally {
        setLoading(false);
      }
    };
    fetchLectures();
    // MISSION 17: AUTO-REFRESH (Every 5 seconds to keep sessions live)
    const interval = setInterval(fetchLectures, 5000);
    return () => clearInterval(interval);
  }, [token]);

  const handleJoinById = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!joinId.trim()) return;

    setIsVerifying(true);
    setHasError(false);
    try {
      const res = await axios.post(`${API_BASE}/lectures/${joinId}/join`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      onJoin(res.data.lecture.roomName);
    } catch (err: any) {
      setHasError(true);
      setToast({ 
        msg: err.response?.data?.message || 'Invalid Session Number', 
        type: 'error' 
      });
      setTimeout(() => setToast(null), 3000);
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: 'radial-gradient(circle at top right, #0f172a 0%, #020617 100%)', 
      color: '#fff', 
      fontFamily: 'Outfit, sans-serif',
      padding: '40px 20px',
      overflowX: 'hidden'
    }}>
      <div className="container" style={{ maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* HEADER: PROFILE TOP BAR */}
        <header style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '50px',
          padding: '20px',
          background: 'rgba(255,255,255,0.02)',
          borderRadius: '24px',
          border: '1px solid rgba(255,255,255,0.05)',
          backdropFilter: 'blur(10px)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ 
              width: '70px', 
              height: '70px', 
              borderRadius: '20px', 
              background: 'var(--accent-gradient)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              boxShadow: '0 10px 30px rgba(99, 102, 241, 0.3)',
              position: 'relative'
            }}>
              <UserIcon size={35} color="white" />
              <div style={{ 
                position: 'absolute', 
                bottom: '-5px', 
                right: '-5px', 
                width: '20px', 
                height: '20px', 
                background: '#10b981', 
                borderRadius: '50%', 
                border: '3px solid #0f172a' 
              }}></div>
            </div>
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: '900', margin: 0 }}>{(user as any)?.username || 'Student Profile'}</h1>
              <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
                <span style={{ fontSize: '12px', background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1', padding: '2px 10px', borderRadius: '20px', fontWeight: 'bold' }}>Level 4 Student</span>
                <span style={{ fontSize: '12px', background: 'rgba(255,255,255,0.05)', color: '#94a3b8', padding: '2px 10px', borderRadius: '20px' }}>ID: {(user as any)?._id?.slice(-6).toUpperCase()}</span>
              </div>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '15px' }}>
            <button style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px', borderRadius: '15px', color: '#fff', cursor: 'pointer' }}>
              <Bell size={20} />
            </button>
            <button onClick={logout} style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '12px', borderRadius: '15px', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}>
              <LogOut size={20} />
              <span className="nav-hide-mobile">Logout</span>
            </button>
          </div>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '30px' }}>
          
          {/* LEFT COLUMN: CORE ACTIONS */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
            
            {/* SESSION ENTRANCE CARD */}
            <div className="glass" style={{ padding: '40px', borderRadius: '32px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: '-20px', right: '-20px', opacity: 0.03 }}>
                <Zap size={150} color="#6366f1" />
              </div>
              
              <h2 style={{ fontSize: '20px', fontWeight: '900', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Activity color="#6366f1" size={24} />
                ENTER CLASSROOM
              </h2>
              <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '30px' }}>Connect to your live media session using the session number.</p>

              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder="e.g. room-12345"
                  value={joinId}
                  onChange={(e) => { setJoinId(e.target.value); setHasError(false); }}
                  className={hasError ? 'pulse-red' : ''}
                  style={{
                    width: '100%',
                    padding: '18px 25px',
                    borderRadius: '16px',
                    background: 'rgba(0,0,0,0.3)',
                    border: hasError ? '2px solid #ef4444' : '2px solid rgba(99, 102, 241, 0.2)',
                    color: '#fff',
                    fontSize: '18px',
                    outline: 'none',
                    transition: 'all 0.3s ease',
                    fontWeight: 'bold'
                  }}
                />
                <button
                  onClick={() => handleJoinById()}
                  disabled={isVerifying}
                  className="btn btn-primary"
                  style={{ width: '100%', marginTop: '15px', padding: '18px', borderRadius: '16px', fontWeight: '900', fontSize: '16px' }}
                >
                  {isVerifying ? <Loader2 className="animate-spin" /> : <ChevronRight />}
                  {isVerifying ? 'Verifying...' : 'Join Private Session'}
                </button>
              </div>
            </div>

            {/* MISSION 15: LIVE SESSIONS LIST (QUICK JOIN) */}
            <div className="glass" style={{ padding: '30px', borderRadius: '32px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Video color="#ef4444" size={20} />
                  LIVE NOW
                </h3>
                {lectures.length > 0 && <div className="pulse-dot" style={{ width: '10px', height: '10px', background: '#ef4444', borderRadius: '50%' }}></div>}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {loading ? (
                   <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}>
                     <Loader2 className="animate-spin" color="#6366f1" />
                   </div>
                ) : lectures.length > 0 ? (
                  lectures.map(lecture => (
                    <div key={lecture._id} style={{ 
                      padding: '15px 20px', 
                      background: 'rgba(255,255,255,0.03)', 
                      borderRadius: '20px', 
                      border: '1px solid rgba(255,255,255,0.05)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      transition: 'transform 0.2s ease'
                    }}
                    className="card-hover"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Activity color="#10b981" size={18} />
                        </div>
                        <div>
                          <p style={{ fontSize: '14px', fontWeight: 'bold', margin: 0 }}>{lecture.title}</p>
                          <p style={{ fontSize: '11px', color: '#94a3b8', margin: 0 }}>ID: {lecture.roomName}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => onJoin(lecture.roomName)}
                        style={{ background: '#6366f1', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '10px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
                      >
                        JOIN
                      </button>
                    </div>
                  ))
                ) : (
                  <p style={{ fontSize: '13px', color: '#94a3b8', textAlign: 'center', padding: '20px', background: 'rgba(0,0,0,0.1)', borderRadius: '15px' }}>
                    No active sessions at the moment.
                  </p>
                )}
              </div>
            </div>

            {/* QUICK STATS GRID */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div className="glass" style={{ padding: '25px', borderRadius: '24px', textAlign: 'center' }}>
                <Trophy color="#fbbf24" size={30} style={{ marginBottom: '10px' }} />
                <h4 style={{ fontSize: '24px', fontWeight: '900', margin: 0 }}>12</h4>
                <p style={{ fontSize: '11px', color: '#94a3b8', margin: 0, fontWeight: 'bold', letterSpacing: '1px' }}>COMPLETED</p>
              </div>
              <div className="glass" style={{ padding: '25px', borderRadius: '24px', textAlign: 'center' }}>
                <Target color="#10b981" size={30} style={{ marginBottom: '10px' }} />
                <h4 style={{ fontSize: '24px', fontWeight: '900', margin: 0 }}>98%</h4>
                <p style={{ fontSize: '11px', color: '#94a3b8', margin: 0, fontWeight: 'bold', letterSpacing: '1px' }}>ATTENDANCE</p>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: ACADEMIC PROGRESS */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
            
            <div className="glass" style={{ padding: '30px', borderRadius: '32px', flex: 1 }}>
              <h2 style={{ fontSize: '20px', fontWeight: '900', marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Award color="#6366f1" size={24} />
                ACADEMIC TRACK
              </h2>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ padding: '20px', borderRadius: '20px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 'bold' }}>Active Learning</span>
                    <span style={{ fontSize: '14px', color: '#6366f1', fontWeight: 'bold' }}>75%</span>
                  </div>
                  <div style={{ height: '8px', width: '100%', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: '75%', height: '100%', background: 'var(--accent-gradient)', borderRadius: '4px' }}></div>
                  </div>
                </div>

                <div style={{ padding: '20px', borderRadius: '20px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <h4 style={{ fontSize: '15px', fontWeight: 'bold', marginBottom: '15px' }}>Upcoming Milestones</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {[
                      { label: 'Physics Final Exam', date: 'May 12' },
                      { label: 'Laboratory Submission', date: 'May 15' }
                    ].map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#6366f1' }}></div>
                          <span style={{ fontSize: '13px', color: '#e2e8f0' }}>{item.label}</span>
                        </div>
                        <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'bold' }}>{item.date}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* ACCOUNT QUICK LINKS */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
              <div style={{ padding: '15px', borderRadius: '20px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <Calendar size={20} color="#94a3b8" />
                <span style={{ fontSize: '10px', fontWeight: 'bold' }}>SCHEDULE</span>
              </div>
              <div style={{ padding: '15px', borderRadius: '20px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <Settings size={20} color="#94a3b8" />
                <span style={{ fontSize: '10px', fontWeight: 'bold' }}>SETTINGS</span>
              </div>
              <div style={{ padding: '15px', borderRadius: '20px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <Shield size={20} color="#94a3b8" />
                <span style={{ fontSize: '10px', fontWeight: 'bold' }}>SECURITY</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SOVEREIGN TOAST NOTIFICATION */}
      {toast && (
        <div style={{
          position: 'fixed',
          bottom: '40px',
          right: '40px',
          padding: '16px 32px',
          background: toast.type === 'error' ? 'rgba(239, 68, 68, 0.9)' : 'rgba(16, 185, 129, 0.9)',
          backdropFilter: 'blur(10px)',
          borderRadius: '16px',
          color: 'white',
          fontWeight: '800',
          fontSize: '14px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
          zIndex: 100000,
          animation: 'slideUp 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
        }}>
          {toast.msg}
        </div>
      )}

      <style>{`
        @keyframes slideUp { from { transform: translateY(50px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .pulse-red { border-color: #ef4444 !important; animation: pulse-red-border 0.5s ease-in-out infinite; }
        @keyframes pulse-red-border { 0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); } 70% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); } 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); } }
        .glass { background: rgba(255,255,255,0.03); backdrop-filter: blur(15px); border: 1px solid rgba(255,255,255,0.08); }
        .glass:hover { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.15); transition: all 0.3s ease; }
      `}</style>
    </div>
  );
};
