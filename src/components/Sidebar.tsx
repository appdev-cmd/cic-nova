import React from 'react';
import { Folder, Layers, Package, Users, LogOut, Shield, User as UserIcon, FileSpreadsheet } from 'lucide-react';
import { User } from '../types';

interface SidebarProps {
  currentView: string;
  setCurrentView: (view: string) => void;
  user: User | null;
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, setCurrentView, user, onLogout }) => {
  const getRoleText = (role: string) => {
    switch(role) {
      case 'admin': return 'Quản trị viên';
      case 'editor': return 'Biên tập viên';
      default: return 'Người xem';
    }
  };

  return (
    <aside className="sidebar">
      {/* Novaland Navy brand header */}
      <div className="logo-section" style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        {/* Official Novaland Cubes Logo in SVG */}
        <svg viewBox="0 0 32 32" width="36" height="36" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }} aria-hidden="true">
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
            <span style={{ color: '#4ade80' }}>LAND</span>
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

        <button 
          className={`btn btn-secondary ${currentView === 'aluminum-order' ? 'active' : ''}`}
          onClick={() => setCurrentView('aluminum-order')}
          style={{ 
            justifyContent: 'flex-start',
            textAlign: 'left',
            padding: '12px 16px',
            fontSize: '14px',
            fontWeight: '500'
          }}
        >
          <FileSpreadsheet size={18} style={{ marginRight: '8px' }} /> Đặt hàng Nhôm
        </button>

        {/* User Management tab visible only to Admins */}
        {user && user.role === 'admin' && (
          <button 
            className={`btn btn-secondary ${currentView === 'users' ? 'active' : ''}`}
            onClick={() => setCurrentView('users')}
            style={{ 
              justifyContent: 'flex-start',
              textAlign: 'left',
              padding: '12px 16px',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            <Users size={18} style={{ marginRight: '8px' }} /> Quản lý Tài khoản
          </button>
        )}
      </nav>
      
      {/* Logged in User Section & Logout */}
      <div className="account-section" style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        
        {/* User Badge Info */}
        {user && (
          <div className="account-card" style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '10px', 
            background: 'rgba(255,255,255,0.04)', 
            padding: '10px 12px', 
            borderRadius: '10px',
            border: '1px solid rgba(255,255,255,0.06)'
          }}>
            <div style={{ 
              background: 'rgba(45, 179, 75, 0.15)', 
              color: '#2db34b', 
              width: '32px', 
              height: '32px', 
              borderRadius: '50%', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              fontWeight: 'bold',
              fontSize: '14px',
              flexShrink: 0
            }}>
              {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#ffffff', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                {user.name}
              </div>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                {user.role === 'admin' ? <Shield size={10} style={{ color: '#2db34b' }} /> : <UserIcon size={10} />}
                {getRoleText(user.role)}
              </div>
            </div>
          </div>
        )}

        {/* Logout Button */}
        <button 
          className="btn btn-secondary" 
          onClick={onLogout}
          style={{ 
            justifyContent: 'flex-start',
            textAlign: 'left',
            padding: '10px 16px',
            fontSize: '13px',
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.15)',
            color: '#ef4444',
            fontWeight: '600'
          }}
        >
          <LogOut size={16} style={{ marginRight: '8px' }} /> Đăng xuất
        </button>

        {/* Footer info */}
        <div className="app-footer" style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px' }}>
          <div>Phiên bản: 1.3.0 (Supabase)</div>
          <div style={{ marginTop: '4px', fontSize: '10px' }}>© 2026 Novaland CIC</div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
