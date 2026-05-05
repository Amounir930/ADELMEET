import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Monitor, Play, Settings } from 'lucide-react';

export const ScreenLauncher: React.FC = () => {
  const [lectureId, setLectureId] = useState('');
  const [numScreens, setNumScreens] = useState(15);
  const navigate = useNavigate();

  const handleLaunch = () => {
    if (!lectureId) {
      alert('Please enter a Lecture ID');
      return;
    }

    for (let i = 0; i < numScreens; i++) {
      const screenIndex = i;

      // Construct the dynamic URL
      const url = `/grid?lecture=${lectureId}&totalScreens=${numScreens}&screen=${screenIndex}`;
      
      // Open in a new window with some offsets so they don't stack exactly on top of each other
      const windowFeatures = `width=800,height=600,left=${i * 50},top=${i * 50}`;
      window.open(url, `screen_${screenIndex}`, windowFeatures);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0c',
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Inter, sans-serif'
    }}>
      <div style={{
        background: '#111827',
        padding: '40px',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '500px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        border: '1px solid rgba(255, 255, 255, 0.05)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '30px' }}>
          <div style={{ background: 'rgba(99, 102, 241, 0.1)', padding: '12px', borderRadius: '12px' }}>
            <Settings size={28} color="#6366f1" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>Screen Launcher</h1>
            <p style={{ margin: '5px 0 0 0', color: '#94a3b8', fontSize: '14px' }}>Multi-Display Orchestration</p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', color: '#cbd5e1', fontSize: '14px', fontWeight: '500' }}>Lecture ID</label>
            <input 
              type="text" 
              value={lectureId}
              onChange={(e) => setLectureId(e.target.value)}
              placeholder="e.g. 64a7c9..."
              style={{
                width: '100%',
                padding: '12px 16px',
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '8px',
                color: 'white',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '15px' }}>
            
            <div>
              <label style={{ display: 'block', marginBottom: '8px', color: '#cbd5e1', fontSize: '14px', fontWeight: '500' }}>
                <Monitor size={14} style={{ display: 'inline', marginRight: '5px', verticalAlign: 'text-bottom' }}/> 
                Number of Screens
              </label>
              <input 
                type="number" 
                value={numScreens}
                onChange={(e) => setNumScreens(parseInt(e.target.value) || 0)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  color: 'white',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          <div style={{ 
            background: 'rgba(16, 185, 129, 0.1)', 
            border: '1px solid rgba(16, 185, 129, 0.2)', 
            padding: '15px', 
            borderRadius: '8px',
            marginTop: '10px'
          }}>
            <p style={{ margin: 0, color: '#10b981', fontSize: '13px', display: 'flex', justifyContent: 'space-between' }}>
              <span>Distribution Mode:</span>
              <strong>Dynamic Auto-Balancing</strong>
            </p>
          </div>

          <button 
            onClick={handleLaunch}
            style={{
              width: '100%',
              padding: '14px',
              background: '#6366f1',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 'bold',
              fontSize: '16px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              marginTop: '10px',
              transition: 'background 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.background = '#4f46e5'}
            onMouseOut={(e) => e.currentTarget.style.background = '#6366f1'}
          >
            <Play size={18} />
            Launch All Screens
          </button>
          
          <button 
            onClick={() => navigate('/')}
            style={{
              width: '100%',
              padding: '14px',
              background: 'transparent',
              color: '#94a3b8',
              border: '1px solid #334155',
              borderRadius: '8px',
              fontWeight: 'bold',
              fontSize: '14px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = '#1e293b';
              e.currentTarget.style.color = '#fff';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = '#94a3b8';
            }}
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};
