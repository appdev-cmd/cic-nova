import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import ProjectsModule from './modules/ProjectsModule';
import DoorsModule from './modules/DoorsModule';
import MaterialsModule from './modules/MaterialsModule';
import UserManagementModule from './modules/UserManagementModule';
import AluminumOrderModule from './modules/AluminumOrderModule';
import Login from './components/Login';
import './App.css';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8080/api').replace(/\/$/, '');

function App() {
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<any>(null);
  const [currentView, setCurrentView] = useState('projects'); // 'projects', 'templates', 'materials', 'users'
  const [authLoading, setAuthLoading] = useState(true);

  // Check auth state on mount
  useEffect(() => {
    const checkAuth = async () => {
      const storedToken = localStorage.getItem('nova_token');
      const storedUser = localStorage.getItem('nova_user');

      if (storedToken && storedUser) {
        try {
          // Verify token with backend
          const res = await fetch(`${API_BASE}/auth/me`, {
            headers: {
              'Authorization': `Bearer ${storedToken}`
            }
          });
          
          if (res.ok) {
            const userData = await res.json();
            setUser(userData);
            setToken(storedToken);
            // Sync local storage in case name/role changed
            localStorage.setItem('nova_user', JSON.stringify(userData));
          } else {
            // Token expired or invalid
            handleLogout();
          }
        } catch (e) {
          console.error("Auth check failed:", e);
          // Fail closed when the backend cannot verify the session.
          handleLogout();
        }
      }
      setAuthLoading(false);
    };

    checkAuth();
  }, []);

  const handleLogin = (loggedInUser, userToken) => {
    setUser(loggedInUser);
    setToken(userToken);
    setCurrentView('projects');
  };

  const handleLogout = () => {
    localStorage.removeItem('nova_token');
    localStorage.removeItem('nova_user');
    setUser(null);
    setToken(null);
    setCurrentView('projects');
  };

  if (authLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(circle at 50% 0%, #edf2f9 0%, #f8fafc 100%)',
        fontSize: '16px',
        fontWeight: '600',
        color: 'var(--primary)'
      }}>
        Đang khởi động hệ thống...
      </div>
    );
  }

  // If not logged in, show Login Screen
  if (!user || !token) {
    return <Login apiBase={API_BASE} onLogin={handleLogin} />;
  }

  return (
    <div className="app-container">
      {/* Navigation Sidebar */}
      <Sidebar 
        currentView={currentView} 
        setCurrentView={setCurrentView} 
        user={user} 
        onLogout={handleLogout} 
      />

      {/* Main Content Area */}
      <main className="main-content">
        
        {/* Module 1: Projects Management */}
        {(currentView === 'projects' || currentView === 'project-detail') && (
          <ProjectsModule 
            apiBase={API_BASE} 
            token={token}
            user={user}
            currentView={currentView} 
            setCurrentView={setCurrentView} 
          />
        )}

        {/* Module 2: Door Templates & Formulas Management */}
        {currentView === 'templates' && (
          <DoorsModule 
            apiBase={API_BASE} 
            token={token}
            user={user}
          />
        )}

        {/* Module 3: Materials Catalog & Pricing */}
        {currentView === 'materials' && (
          <MaterialsModule 
            apiBase={API_BASE} 
            token={token}
            user={user}
          />
        )}

        {/* Module 4: Users Management (Admin Only) */}
        {currentView === 'users' && user.role === 'admin' && (
          <UserManagementModule 
            apiBase={API_BASE} 
            token={token}
            currentUser={user}
          />
        )}

        {/* Module 5: Aluminum Order Consolidation */}
        {currentView === 'aluminum-order' && (
          <AluminumOrderModule 
            apiBase={API_BASE} 
            token={token}
            user={user}
          />
        )}
        
      </main>
    </div>
  );
}

export default App;
