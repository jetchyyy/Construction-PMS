import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FiX } from 'react-icons/fi';

const Modal = ({ show, onClose, title, children, footer, size = 'md' }) => {
  useEffect(() => {
    if (!show) return;
    const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEsc);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [show, onClose]);

  if (!show) return null;

  const maxW = size === 'lg' ? 680 : size === 'xl' ? 860 : 520;

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center',
        justifyContent: 'center', zIndex: 9999, padding: '40px 20px',
        animation: 'fadeIn 0.2s ease',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 16, width: '100%',
          maxWidth: maxW, display: 'flex',
          flexDirection: 'column', boxShadow: '0 25px 50px rgba(0,0,0,0.15)',
          animation: 'slideInUp 0.3s ease',
          maxHeight: 'calc(100vh - 80px)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px', borderBottom: '1px solid #f1f5f9',
        }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#1e293b', margin: 0 }}>{title}</h3>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: 6, borderRadius: 8, color: '#64748b', fontSize: 18,
              display: 'flex', alignItems: 'center', transition: 'background 0.15s',
            }}
            onMouseEnter={e => e.target.style.background = '#f1f5f9'}
            onMouseLeave={e => e.target.style.background = 'none'}
          >
            <FiX />
          </button>
        </div>
        {/* Body */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1, minHeight: 0 }}>
          {children}
        </div>
        {/* Footer */}
        {footer && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
            gap: 8, padding: '16px 24px', borderTop: '1px solid #f1f5f9',
          }}>
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default Modal;
