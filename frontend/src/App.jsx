import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import ProjectsModule from './modules/ProjectsModule';
import DoorsModule from './modules/DoorsModule';
import MaterialsModule from './modules/MaterialsModule';
import './App.css';

const API_BASE = 'http://127.0.0.1:8080/api';

function App() {
  const [currentView, setCurrentView] = useState('projects'); // 'projects', 'templates', 'materials'

  return (
    <div className="app-container">
      {/* Navigation Sidebar */}
      <Sidebar currentView={currentView} setCurrentView={setCurrentView} />

      {/* Main Content Area */}
      <main className="main-content">
        
        {/* Module 1: Projects Management */}
        {(currentView === 'projects' || currentView === 'project-detail') && (
          <ProjectsModule apiBase={API_BASE} currentView={currentView} setCurrentView={setCurrentView} />
        )}

        {/* Module 2: Door Templates & Formulas Management */}
        {currentView === 'templates' && (
          <DoorsModule apiBase={API_BASE} />
        )}

        {/* Module 3: Materials Catalog & Pricing */}
        {currentView === 'materials' && (
          <MaterialsModule apiBase={API_BASE} />
        )}
        
      </main>
    </div>
  );
}

export default App;
