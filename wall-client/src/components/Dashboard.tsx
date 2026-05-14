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
  ChevronRight,
  ClipboardList,
  ArrowLeft,
  FileText,
  Search,
  Trash2,
  CheckSquare,
  Square
} from 'lucide-react';
import { ReportViewer } from './ReportViewer';

const API_BASE = import.meta.env.VITE_API_URL_BASE || 'http://localhost:5000/api';

export const Dashboard: React.FC<{ onJoin: (lectureId: string, config: any) => void }> = ({ onJoin }) => {
  const { user, token, logout } = useAuth();
  const [lectures, setLectures] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'error' | 'success' } | null>(null);
  
  // Launch config states
  const [launchingLecture, setLaunchingLecture] = useState<string | null>(null);
  const [hallNumber, setHallNumber] = useState('101');
  const [allowChat, setAllowChat] = useState(true);
  const [allowRecord, setAllowRecord] = useState(false);
  const [allowScreenShare, setAllowScreenShare] = useState(false);
  const [viewMode, setViewMode] = useState<'active' | 'reports'>('active');
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const showToast = (msg: string, type: 'error' | 'success' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const [initialLoading, setInitialLoading] = useState(true);

  const fetchLectures = async (isInitial = false) => {
    if (document.hidden && !isInitial) return; 
    try {
      const res = await axios.get(`${API_BASE}/lectures`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (Array.isArray(res.data)) {
        setLectures(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch lectures', err);
    } finally {
      setInitialLoading(false);
    }
  };

  useEffect(() => {
    fetchLectures(true); // Force initial fetch
    const interval = setInterval(() => fetchLectures(false), 10000);
    return () => clearInterval(interval);
  }, [token]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${API_BASE}/lectures`, { title, scheduledAt: null }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTitle('');
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
    if (launchingLecture) {
      onJoin(launchingLecture, {
        hallNumber,
        chat: allowChat,
        record: allowRecord,
        share: allowScreenShare
      });
    }
    setLaunchingLecture(null);
  };

  const fetchReport = async (lectureId: string) => {
    setReportLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/lectures/${lectureId}/report`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setReportData(res.data);
      setSelectedReport(lectureId);
    } catch (err) {
      showToast('Failed to fetch report', 'error');
    } finally {
      setReportLoading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this session?')) return;
    
    // OPTIMISTIC UI: Remove from list immediately
    const originalLectures = [...lectures];
    setLectures(prev => prev.filter(l => l._id !== id));
    
    try {
      await axios.delete(`${API_BASE}/lectures/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      showToast('Session deleted', 'success');
    } catch (err) {
      setLectures(originalLectures); // Rollback on error
      showToast('Delete failed', 'error');
    }
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Delete ${selectedIds.length} selected sessions?`)) return;
    
    // OPTIMISTIC UI
    const originalLectures = [...lectures];
    const idsToRemove = [...selectedIds];
    setLectures(prev => prev.filter(l => !idsToRemove.includes(l._id)));
    setSelectedIds([]);

    try {
      await axios.post(`${API_BASE}/lectures/bulk-delete`, { ids: idsToRemove }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      showToast('Selected sessions deleted', 'success');
    } catch (err) {
      setLectures(originalLectures);
      showToast('Bulk delete failed', 'error');
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const filteredLectures = (lectures || []).filter(l => 
    (l.title || '').toLowerCase().includes((searchTerm || '').toLowerCase())
  );

  const activeFiltered = filteredLectures.filter(l => l.status !== 'completed');
  const reportsFiltered = filteredLectures.filter(l => l.status === 'completed');

  const handleSelectAll = () => {
    const currentList = viewMode === 'active' ? activeFiltered : reportsFiltered;
    if (selectedIds.length === currentList.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(currentList.map(l => l._id));
    }
  };

  return (
    <div style={{ 
      flex: 1, 
      background: '#0a0a0c',
      color: '#fff', 
      fontFamily: 'Outfit, sans-serif',
      padding: '60px 40px',
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {initialLoading && lectures.length === 0 && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Activity className="animate-spin" size={40} color="#6366f1" />
        </div>
      )}
      {!initialLoading && (
        <>
          <div style={{ maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
        
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
            {/* TAB SWITCHER */}
            <div style={{ display: 'flex', gap: '20px', marginBottom: '30px' }}>
              <button 
                onClick={() => setViewMode('active')}
                style={{ 
                  background: 'transparent', border: 'none', borderBottom: viewMode === 'active' ? '3px solid #6366f1' : '3px solid transparent',
                  color: viewMode === 'active' ? '#fff' : '#94a3b8', padding: '10px 20px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.3s'
                }}
              >
                ACTIVE SESSIONS
              </button>
              <button 
                onClick={() => setViewMode('reports')}
                style={{ 
                  background: 'transparent', border: 'none', borderBottom: viewMode === 'reports' ? '3px solid #6366f1' : '3px solid transparent',
                  color: viewMode === 'reports' ? '#fff' : '#94a3b8', padding: '10px 20px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.3s'
                }}
              >
                SESSION REPORTS
              </button>
            </div>

            {/* SEARCH & ACTIONS */}
            <div style={{ display: 'flex', gap: '15px', marginBottom: '25px', alignItems: 'center' }}>
              <div 
                onClick={handleSelectAll}
                style={{ 
                  cursor: 'pointer', color: selectedIds.length > 0 ? '#6366f1' : '#475569', 
                  display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 'bold' 
                }}
              >
                {selectedIds.length > 0 && selectedIds.length === (viewMode === 'active' ? activeFiltered.length : reportsFiltered.length) 
                  ? <CheckSquare size={22} /> : <Square size={22} />}
                {selectedIds.length > 0 ? 'DESELECT ALL' : 'SELECT ALL'}
              </div>

              <div style={{ flex: 1, position: 'relative' }}>
                <Search size={18} color="#94a3b8" style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)' }} />
                <input 
                  type="text" 
                  placeholder={`Search ${viewMode === 'active' ? 'active' : 'archived'} sessions...`} 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{ 
                    width: '100%', padding: '12px 15px 12px 45px', borderRadius: '15px', 
                    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', 
                    color: '#fff', outline: 'none' 
                  }}
                />
              </div>
              {selectedIds.length > 0 && (
                <button 
                  onClick={handleBulkDelete}
                  style={{ 
                    background: '#ef4444', color: '#fff', border: 'none', 
                    padding: '12px 25px', borderRadius: '15px', fontWeight: '900', cursor: 'pointer', 
                    display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 10px 20px rgba(239, 68, 68, 0.2)'
                  }}
                >
                  <Trash2 size={18} /> DELETE {selectedIds.length}
                </button>
              )}
            </div>

            {viewMode === 'active' ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '25px' }}>
                  <Activity color="#6366f1" size={24} />
                  <h2 style={{ fontSize: '22px', fontWeight: '800' }}>Active Command Logs</h2>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '15px' }}>
                  {filteredLectures.filter(l => l.status !== 'completed').map((lecture) => (
                    <div key={lecture._id} className="glass" style={{ 
                      padding: '25px', 
                      borderRadius: '24px', 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      background: selectedIds.includes(lecture._id) ? 'rgba(99, 102, 241, 0.05)' : 'rgba(255,255,255,0.02)',
                      border: selectedIds.includes(lecture._id) ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid rgba(255,255,255,0.05)',
                      transition: 'all 0.3s ease'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        <div onClick={() => toggleSelect(lecture._id)} style={{ cursor: 'pointer', color: selectedIds.includes(lecture._id) ? '#6366f1' : '#475569' }}>
                          {selectedIds.includes(lecture._id) ? <CheckSquare size={22} /> : <Square size={22} />}
                        </div>
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
                        <button onClick={() => handleDelete(lecture._id)} style={{ padding: '10px', borderRadius: '12px', background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', opacity: 0.5 }}>
                          <Trash2 size={18} />
                        </button>
                        <button onClick={() => setLaunchingLecture(lecture.roomName)} style={{ background: '#6366f1', color: 'white', border: 'none', padding: '10px 25px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          LAUNCH <ChevronRight size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {filteredLectures.filter(l => l.status !== 'completed').length === 0 && (
                    <div style={{ padding: '60px', textAlign: 'center', background: 'rgba(255,255,255,0.01)', borderRadius: '24px', border: '1px dashed rgba(255,255,255,0.1)' }}>
                      <p style={{ color: '#94a3b8' }}>No matching active sessions found.</p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '25px' }}>
                  <ClipboardList color="#6366f1" size={24} />
                  <h2 style={{ fontSize: '22px', fontWeight: '800' }}>Archived Reports</h2>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '15px' }}>
                  {filteredLectures.filter(l => l.status === 'completed').map((lecture) => (
                    <div key={lecture._id} className="glass" style={{ 
                      padding: '25px', 
                      borderRadius: '24px', 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      background: selectedIds.includes(lecture._id) ? 'rgba(99, 102, 241, 0.05)' : 'rgba(255,255,255,0.02)',
                      border: selectedIds.includes(lecture._id) ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid rgba(255,255,255,0.05)',
                      transition: 'all 0.3s ease'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        <div onClick={() => toggleSelect(lecture._id)} style={{ cursor: 'pointer', color: selectedIds.includes(lecture._id) ? '#6366f1' : '#475569' }}>
                          {selectedIds.includes(lecture._id) ? <CheckSquare size={22} /> : <Square size={22} />}
                        </div>
                        <div style={{ width: '50px', height: '50px', borderRadius: '15px', background: 'rgba(148, 163, 184, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <FileText color="#94a3b8" size={24} />
                        </div>
                        <div>
                          <h3 style={{ fontSize: '18px', fontWeight: '800', margin: '0 0 5px 0' }}>{lecture.title}</h3>
                          <div style={{ display: 'flex', gap: '15px', fontSize: '12px', color: '#94a3b8' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><Clock size={14} /> Completed {new Date(lecture.updatedAt || lecture.scheduledAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <button onClick={() => handleDelete(lecture._id)} style={{ padding: '10px', borderRadius: '12px', background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', opacity: 0.5 }}>
                          <Trash2 size={18} />
                        </button>
                        <button onClick={() => setSelectedReportId(lecture._id)} style={{ background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', padding: '10px 25px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
                          VIEW REPORT
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
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

      {/* INITIALIZE CLASSROOM MODAL */}
      {launchingLecture && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass" style={{ width: '100%', maxWidth: '450px', padding: '40px', borderRadius: '32px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: '900', marginBottom: '10px' }}>INITIALIZE CLASSROOM</h2>
            <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '25px' }}>Configure the room environment and target display hall before launching.</p>
            
            <form onSubmit={executeLaunch} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '12px', color: '#6366f1', fontWeight: 'bold' }}>TARGET HALL NUMBER</label>
                <input 
                  type="text" 
                  placeholder="e.g. 101, 120" 
                  value={hallNumber} 
                  onChange={(e) => setHallNumber(e.target.value)} 
                  required 
                  style={{ padding: '15px 20px', borderRadius: '15px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', outline: 'none', fontSize: '18px', fontWeight: 'bold', textAlign: 'center' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <label style={{ fontSize: '12px', color: '#6366f1', fontWeight: 'bold' }}>PRESET PERMISSIONS</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                  <button 
                    type="button"
                    onClick={() => setAllowChat(!allowChat)}
                    style={{ 
                      padding: '12px', borderRadius: '12px', cursor: 'pointer', border: 'none', fontWeight: 'bold', fontSize: '11px',
                      background: allowChat ? '#10b981' : '#ef4444', color: '#fff', transition: 'all 0.3s'
                    }}
                  >
                    CHAT: {allowChat ? 'ON' : 'OFF'}
                  </button>
                  <button 
                    type="button"
                    onClick={() => setAllowRecord(!allowRecord)}
                    style={{ 
                      padding: '12px', borderRadius: '12px', cursor: 'pointer', border: 'none', fontWeight: 'bold', fontSize: '11px',
                      background: allowRecord ? '#10b981' : '#ef4444', color: '#fff', transition: 'all 0.3s'
                    }}
                  >
                    REC: {allowRecord ? 'ON' : 'OFF'}
                  </button>
                  <button 
                    type="button"
                    onClick={() => setAllowScreenShare(!allowScreenShare)}
                    style={{ 
                      padding: '12px', borderRadius: '12px', cursor: 'pointer', border: 'none', fontWeight: 'bold', fontSize: '11px',
                      background: allowScreenShare ? '#10b981' : '#ef4444', color: '#fff', transition: 'all 0.3s'
                    }}
                  >
                    SHARE: {allowScreenShare ? 'ON' : 'OFF'}
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '15px', marginTop: '10px' }}>
                <button type="button" onClick={() => setLaunchingLecture(null)} style={{ flex: 1, padding: '15px', borderRadius: '15px', background: 'rgba(255,255,255,0.05)', border: 'none', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}>CANCEL</button>
                <button type="submit" style={{ flex: 1, padding: '15px', borderRadius: '15px', background: '#6366f1', border: 'none', color: '#fff', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 10px 20px rgba(99, 102, 241, 0.3)' }}>
                  LAUNCH CLASS
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REPORT VIEWER MODAL */}
      {selectedReportId && (
        <ReportViewer 
          lectureId={selectedReportId} 
          token={token!} 
          onClose={() => setSelectedReportId(null)} 
        />
      )}
      </>
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
