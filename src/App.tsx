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
  const [currentView, setCurrentView] = useState('projects'); // 'projects', 'templates', 'materials', 'users', 'aluminum_order'
  const [authLoading, setAuthLoading] = useState(true);

  // Check auth state on mount
  useEffect(() => {
    const checkAuth = async () => {
      const storedToken = localStorage.getItem('nova_token');
      const storedUser = localStorage.getItem('nova_user');

      if (storedToken && storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          setUser(parsedUser);
          setToken(storedToken);
        } catch (e) {
          console.error("Auth parsing failed:", e);
          handleLogout();
        }
      }
      setAuthLoading(false);
    };

    checkAuth();
  }, []);

  const handleLogin = (loggedInUser: any, userToken: string) => {
    setUser(loggedInUser);
    setToken(userToken);
    localStorage.setItem('nova_token', userToken);
    localStorage.setItem('nova_user', JSON.stringify(loggedInUser));
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
        color: '#253c78'
      }}>
        Đang khởi động hệ thống CIC Nova...
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
        {currentView === 'projects' && <ProjectsModule apiBase={API_BASE} user={user} token={token} />}
        {currentView === 'templates' && <DoorsModule apiBase={API_BASE} user={user} token={token} />}
        {currentView === 'materials' && <MaterialsModule apiBase={API_BASE} user={user} token={token} />}
        {currentView === 'aluminum_order' && <AluminumOrderModule apiBase={API_BASE} user={user} token={token} />}
        {currentView === 'users' && <UserManagementModule apiBase={API_BASE} currentUser={user} token={token} />}
      </main>
    </div>
  );
}

export default App;
