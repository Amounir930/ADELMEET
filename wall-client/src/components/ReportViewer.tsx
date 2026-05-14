import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { ArrowLeft, FileText, Search, Clock } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL_BASE || 'http://localhost:5000/api';

interface ReportViewerProps {
  lectureId: string;
  token: string;
  onClose: () => void;
}

export const ReportViewer: React.FC<ReportViewerProps> = ({ lectureId, token, onClose }) => {
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/lectures/${lectureId}/report`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setReportData(res.data);
    } catch (err) {
      console.error('Failed to fetch report', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (lectureId) fetchReport();
  }, [lectureId]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  if (loading) {
    return (
      <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(30px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
        <div className="glass" style={{ padding: '40px', borderRadius: '32px' }}>
          <p style={{ fontWeight: 'bold', color: '#6366f1' }}>GENERATING REPORT...</p>
        </div>
      </div>
    );
  }

  if (!reportData) return null;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(30px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
      <div className="glass" style={{ width: '90%', maxWidth: '1000px', height: '85vh', padding: '40px', borderRadius: '40px', display: 'flex', flexDirection: 'column' }}>
        
        {/* HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', padding: '10px', borderRadius: '12px', color: '#fff', cursor: 'pointer' }}>
              <ArrowLeft size={20} />
            </button>
            <div>
              <h2 style={{ fontSize: '24px', fontWeight: '900', margin: 0 }}>SESSION ANALYTICS</h2>
              <p style={{ fontSize: '14px', color: '#6366f1', margin: 0 }}>{reportData.lecture.title}</p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
            {/* SEARCH */}
            <div style={{ position: 'relative', width: '300px' }}>
              <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input 
                type="text" 
                placeholder="Search participants..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ 
                  width: '100%', padding: '10px 15px 10px 40px', borderRadius: '12px', 
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', 
                  color: '#fff', outline: 'none', fontSize: '13px'
                }}
              />
            </div>
            <div style={{ padding: '10px 20px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' }}>
              ARCHIVED
            </div>
          </div>
        </div>

        {/* CONTENT */}
        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '10px' }}>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 10px' }}>
            <thead>
              <tr style={{ color: '#94a3b8', fontSize: '12px', textAlign: 'left' }}>
                <th style={{ padding: '0 20px' }}>PARTICIPANT</th>
                <th>ROLE</th>
                <th>TOTAL TIME</th>
                <th>SESSION LOGS</th>
              </tr>
            </thead>
            <tbody>
              {reportData.attendance
                .filter((row: any) => row.userName.toLowerCase().includes(searchTerm.toLowerCase()))
                .map((row: any) => (
                <tr key={row.userId} className="glass" style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <td style={{ padding: '20px', borderRadius: '15px 0 0 15px', fontWeight: 'bold' }}>{row.userName}</td>
                  <td style={{ color: row.userRole === 'teacher' ? '#6366f1' : '#94a3b8', textTransform: 'capitalize' }}>{row.userRole}</td>
                  <td style={{ fontWeight: '900', color: '#10b981' }}>{formatDuration(row.totalDuration)}</td>
                  <td style={{ borderRadius: '0 15px 15px 0' }}>
                    <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                      {row.sessions.map((s: any, idx: number) => (
                        <div key={idx} style={{ fontSize: '10px', padding: '4px 8px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px' }}>
                          <Clock size={10} style={{ display: 'inline', marginRight: '4px' }} />
                          {new Date(s.join).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({formatDuration(s.duration)})
                        </div>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {reportData.attendance.length === 0 && (
            <div style={{ padding: '100px', textAlign: 'center', opacity: 0.5 }}>
              <FileText size={48} style={{ marginBottom: '20px', margin: '0 auto' }} />
              <p>No attendance records found for this command session.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
