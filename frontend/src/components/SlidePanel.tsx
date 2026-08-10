import React, { useEffect, useId, useState, useRef } from 'react';
import { X } from 'lucide-react';

interface SlidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

const SlidePanel: React.FC<SlidePanelProps> = ({ isOpen, onClose, title, subtitle, children }) => {
  const [width, setWidth] = useState<number>(850); // Mặc định rộng 850px để các cột định mức vừa vặn
  const isResizing = useRef<boolean>(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  // Listen for Escape key to close the panel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();

    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !panelRef.current) return;
      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', trapFocus);
    return () => {
      document.removeEventListener('keydown', trapFocus);
      previousFocusRef.current?.focus();
    };
  }, [isOpen]);

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

  const startResize = (e: React.MouseEvent<HTMLDivElement>) => {
    isResizing.current = true;
    document.addEventListener('mousemove', handleResize);
    document.addEventListener('mouseup', stopResize);
    document.body.style.userSelect = 'none'; // Ngăn bôi đen text khi kéo
  };

  const handleResize = (e: MouseEvent) => {
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
        ref={panelRef}
        className={`slide-panel ${isOpen ? 'open' : ''}`} 
        style={{ width: `${width}px`, maxWidth: '100%' }}
        role="dialog" 
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        {/* Resize Handle */}
        <div 
          className="slide-panel-resize-handle"
          onMouseDown={startResize}
          title="Kéo để thay đổi kích thước"
        />

        <div className="slide-panel-header">
          <div>
            <h3 id={titleId} style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-main)' }}>{title}</h3>
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
};

export default SlidePanel;
