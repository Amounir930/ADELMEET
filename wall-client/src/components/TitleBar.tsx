import React from 'react';
import { Minus, Square, X } from 'lucide-react';

const TitleBar: React.FC = () => {
  const isElectron = (window as any).electronAPI?.isElectron;

  if (!isElectron) return null;

  return (
    <div style={{
      height: '38px',
      background: '#050507', // Deeper black than body for subtle depth
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 15px',
      borderBottom: '1px solid rgba(255,255,255,0.03)',
      userSelect: 'none',
      WebkitAppRegion: 'drag' as any,
      position: 'relative',
      zIndex: 10000,
      boxShadow: '0 4px 15px rgba(0,0,0,0.5)'
    } as any}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ 
          width: '8px', 
          height: '8px', 
          background: '#6366f1', 
          borderRadius: '50%',
          boxShadow: '0 0 10px #6366f1' 
        }}></div>
        <span style={{ 
          fontSize: '10px', 
          fontWeight: '900', 
          color: 'rgba(255,255,255,0.4)', 
          letterSpacing: '2px',
          textTransform: 'uppercase'
        }}>Sovereign Command</span>
      </div>

      <div style={{ 
        display: 'flex', 
        height: '100%', 
        WebkitAppRegion: 'no-drag' as any 
      } as any}>
        <button 
          onClick={() => (window as any).electronAPI.minimize()}
          style={buttonStyle}
          onMouseOver={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
          onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <Minus size={14} />
        </button>
        <button 
          onClick={() => (window as any).electronAPI.maximize()}
          style={buttonStyle}
          onMouseOver={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
          onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <Square size={12} />
        </button>
        <button 
          onClick={() => (window as any).electronAPI.close()}
          style={closeButtonStyle}
          onMouseOver={(e) => {
            e.currentTarget.style.background = '#ef4444';
            e.currentTarget.style.color = '#fff';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'rgba(255,255,255,0.6)';
          }}
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

const buttonStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'rgba(255,255,255,0.6)',
  height: '100%',
  width: '45px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
};

const closeButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  width: '50px',
};

export default TitleBar;
