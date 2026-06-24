import React, { useEffect, useState, useRef } from 'react';
import { X } from 'lucide-react';

function SlidePanel({ isOpen, onClose, title, subtitle, children }) {
  const [width, setWidth] = useState(850); // Mặc định rộng 850px để các cột định mức vừa vặn
  const isResizing = useRef(false);

  // Listen for Escape key to close the panel
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll when panel is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const startResize = (e) => {
    isResizing.current = true;
    document.addEventListener('mousemove', handleResize);
    document.addEventListener('mouseup', stopResize);
    document.body.style.userSelect = 'none'; // Ngăn bôi đen text khi kéo
  };

  const handleResize = (e) => {
    if (!isResizing.current) return;
    // Slide panel trượt từ bên phải, vì vậy width = window.innerWidth - e.clientX
    const newWidth = window.innerWidth - e.clientX;
    if (newWidth >= 450 && newWidth <= window.innerWidth - 80) {
      setWidth(newWidth);
    }
  };

  const stopResize = () => {
    isResizing.current = false;
    document.removeEventListener('mousemove', handleResize);
    document.removeEventListener('mouseup', stopResize);
    document.body.style.userSelect = '';
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`slide-panel-backdrop ${isOpen ? 'open' : ''}`} 
        onClick={onClose}
      />
      
      {/* Sliding Panel */}
      <div 
        className={`slide-panel ${isOpen ? 'open' : ''}`} 
        style={{ width: `${width}px`, maxWidth: '100%' }}
        role="dialog" 
        aria-modal="true"
      >
        {/* Resize Handle */}
        <div 
          className="slide-panel-resize-handle"
          onMouseDown={startResize}
          title="Kéo để thay đổi kích thước"
        />

        <div className="slide-panel-header">
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-main)' }}>{title}</h3>
            {subtitle && <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{subtitle}</p>}
          </div>
          <button 
            className="btn btn-secondary" 
            style={{ padding: '6px', borderRadius: '50%' }}
            onClick={onClose}
            aria-label="Đóng panel"
            title="Đóng (Esc)"
          >
            <X size={18} />
          </button>
        </div>
        
        <div className="slide-panel-body">
          {isOpen && children}
        </div>
      </div>
    </>
  );
}

export default SlidePanel;
