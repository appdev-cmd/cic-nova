import React from 'react';
import { Folder, Layers, Package } from 'lucide-react';

function Sidebar({ currentView, setCurrentView }) {
  return (
    <aside className="sidebar">
      {/* Novaland Navy brand header */}
      <div className="logo-section" style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        {/* Official Novaland Cubes Logo in SVG */}
        <svg viewBox="0 0 32 32" width="36" height="36" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
          {/* Top Face (Green) */}
          <path d="M 16 2 L 28 8.5 L 16 15 L 4 8.5 Z" fill="#2db34b" />
          {/* Left Face (Blue) */}
          <path d="M 4 8.5 L 16 15 L 16 29 L 4 22.5 Z" fill="#253c78" />
          {/* Right Face (Brown/Gold) */}
          <path d="M 16 15 L 28 8.5 L 28 22.5 L 16 29 Z" fill="#a17549" />
        </svg>
        <div>
          <div style={{ fontSize: '16px', fontWeight: '900', letterSpacing: '1px', lineHeight: '1.2' }}>
            <span style={{ color: '#ffffff' }}>NOVA</span>
            <span style={{ color: '#2db34b' }}>LAND</span>
          </div>
          <div style={{ fontSize: '9px', fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.5px' }}>CIC ESTIMATION</div>
        </div>
      </div>
      
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '20px' }}>
        <button 
          className={`btn btn-secondary ${currentView === 'projects' || currentView === 'project-detail' ? 'active' : ''}`}
          onClick={() => setCurrentView('projects')}
          style={{ 
            justifyContent: 'flex-start',
            textAlign: 'left',
            padding: '12px 16px',
            fontSize: '14px',
            fontWeight: '500'
          }}
        >
          <Folder size={18} style={{ marginRight: '8px' }} /> Quản lý Dự án
        </button>
        
        <button 
          className={`btn btn-secondary ${currentView === 'templates' ? 'active' : ''}`}
          onClick={() => setCurrentView('templates')}
          style={{ 
            justifyContent: 'flex-start',
            textAlign: 'left',
            padding: '12px 16px',
            fontSize: '14px',
            fontWeight: '500'
          }}
        >
          <Layers size={18} style={{ marginRight: '8px' }} /> Quản lý Cửa mẫu
        </button>

        <button 
          className={`btn btn-secondary ${currentView === 'materials' ? 'active' : ''}`}
          onClick={() => setCurrentView('materials')}
          style={{ 
            justifyContent: 'flex-start',
            textAlign: 'left',
            padding: '12px 16px',
            fontSize: '14px',
            fontWeight: '500'
          }}
        >
          <Package size={18} style={{ marginRight: '8px' }} /> Danh mục Vật tư
        </button>
      </nav>
      
      <div style={{ marginTop: 'auto', fontSize: '11px', color: 'rgba(255,255,255,0.3)', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px' }}>
        <div>Phiên bản: 1.2.0 (Supabase)</div>
        <div style={{ marginTop: '4px', fontSize: '10px' }}>© 2026 Novaland CIC</div>
      </div>
    </aside>
  );
}

export default Sidebar;
