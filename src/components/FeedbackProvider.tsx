import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

type FeedbackKind = 'success' | 'error' | 'info';
type Toast = { id: number; message: string; kind: FeedbackKind };
type ConfirmRequest = {
  message: string;
  title?: string;
  confirmLabel?: string;
  danger?: boolean;
  resolve: (result: boolean) => void;
};

type FeedbackValue = {
  notify: (message: string, kind?: FeedbackKind) => void;
  confirmAction: (message: string, options?: Omit<ConfirmRequest, 'message' | 'resolve'>) => Promise<boolean>;
};

const FeedbackContext = createContext<FeedbackValue | null>(null);

function inferKind(message: string): FeedbackKind {
  const normalized = message.toLocaleLowerCase('vi-VN');
  if (normalized.includes('lỗi') || normalized.includes('không thể') || normalized.includes('vui lòng')) return 'error';
  if (normalized.includes('thành công') || normalized.startsWith('đã ')) return 'success';
  return 'info';
}

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmation, setConfirmation] = useState<ConfirmRequest | null>(null);
  const nextId = useRef(1);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  const dismiss = useCallback((id: number) => {
    setToasts(current => current.filter(toast => toast.id !== id));
  }, []);

  const notify = useCallback((message: string, kind?: FeedbackKind) => {
    const id = nextId.current++;
    setToasts(current => [...current.slice(-3), { id, message, kind: kind || inferKind(message) }]);
    window.setTimeout(() => dismiss(id), 4500);
  }, [dismiss]);

  const confirmAction = useCallback((message: string, options: Omit<ConfirmRequest, 'message' | 'resolve'> = {}) => (
    new Promise<boolean>(resolve => setConfirmation({ message, resolve, ...options }))
  ), []);

  const finishConfirmation = useCallback((result: boolean) => {
    setConfirmation(current => {
      current?.resolve(result);
      return null;
    });
  }, []);

  useEffect(() => {
    if (!confirmation) return;
    cancelButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') finishConfirmation(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [confirmation, finishConfirmation]);

  return (
    <FeedbackContext.Provider value={{ notify, confirmAction }}>
      {children}

      <div className="toast-region" aria-live="polite" aria-atomic="false">
        {toasts.map(toast => {
          const Icon = toast.kind === 'success' ? CheckCircle2 : toast.kind === 'error' ? AlertCircle : Info;
          return (
            <div key={toast.id} className={`toast toast-${toast.kind}`} role={toast.kind === 'error' ? 'alert' : 'status'}>
              <Icon size={19} aria-hidden="true" />
              <span>{toast.message}</span>
              <button type="button" onClick={() => dismiss(toast.id)} aria-label="Đóng thông báo"><X size={16} /></button>
            </div>
          );
        })}
      </div>

      {confirmation && (
        <div className="modal-backdrop feedback-backdrop" role="presentation" onMouseDown={event => {
          if (event.target === event.currentTarget) finishConfirmation(false);
        }}>
          <div className="modal-content confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-message">
            <div className="confirm-icon" aria-hidden="true"><AlertCircle size={24} /></div>
            <h3 id="confirm-title">{confirmation.title || 'Xác nhận thao tác'}</h3>
            <p id="confirm-message">{confirmation.message}</p>
            <div className="confirm-actions">
              <button ref={cancelButtonRef} type="button" className="btn btn-secondary" onClick={() => finishConfirmation(false)}>Hủy bỏ</button>
              <button type="button" className={`btn ${confirmation.danger === false ? 'btn-primary' : 'btn-danger'}`} onClick={() => finishConfirmation(true)}>
                {confirmation.confirmLabel || 'Xác nhận'}
              </button>
            </div>
          </div>
        </div>
      )}
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  const context = useContext(FeedbackContext);
  if (!context) throw new Error('useFeedback must be used inside FeedbackProvider');
  return context;
}
