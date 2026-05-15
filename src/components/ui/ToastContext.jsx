import React, { createContext, useContext, useState, useCallback } from 'react';
import { FiCheckCircle, FiAlertCircle, FiAlertTriangle, FiInfo, FiX } from 'react-icons/fi';

const ToastContext = createContext();
export const useToast = () => useContext(ToastContext);

let toastId = 0;

const ICONS = {
  success: <FiCheckCircle style={{ color: 'var(--success)' }} />,
  error: <FiAlertCircle style={{ color: 'var(--danger)' }} />,
  warning: <FiAlertTriangle style={{ color: 'var(--warning)' }} />,
  info: <FiInfo style={{ color: 'var(--info)' }} />,
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'success', duration = 4000) => {
    const id = ++toastId;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.map(t => t.id === id ? { ...t, removing: true } : t));
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 300);
    }, duration);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, removing: true } : t));
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 300);
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast-item ${t.type} ${t.removing ? 'removing' : ''}`}>
            <span className="toast-icon">{ICONS[t.type]}</span>
            <span>{t.message}</span>
            <button className="toast-close" onClick={() => removeToast(t.id)}><FiX /></button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
