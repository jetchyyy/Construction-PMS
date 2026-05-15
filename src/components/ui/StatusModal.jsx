import React, { useEffect, useState } from 'react';
import { FiCheckCircle, FiAlertTriangle, FiX } from 'react-icons/fi';

/**
 * Reusable StatusModal for success/error feedback.
 *
 * Props:
 *  - show       {boolean}  — whether to display
 *  - onClose    {function} — called when dismissed
 *  - type       {'success'|'error'} — determines icon/color
 *  - title      {string}   — heading text
 *  - message    {string}   — body text
 *  - details    {string}   — optional secondary detail line
 *  - autoClose  {number|false} — ms before auto-dismiss (default 4000, false to disable)
 */
const StatusModal = ({
  show,
  onClose,
  type = 'success',
  title,
  message,
  details,
  autoClose = 4000,
}) => {
  const [closing, setClosing] = useState(false);

  // Auto-close timer
  useEffect(() => {
    if (!show || autoClose === false) return;
    const timer = setTimeout(() => handleClose(), autoClose);
    return () => clearTimeout(timer);
  }, [show, autoClose]);

  // Lock body scroll
  useEffect(() => {
    if (!show) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [show]);

  // ESC key
  useEffect(() => {
    if (!show) return;
    const handleEsc = (e) => { if (e.key === 'Escape') handleClose(); };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [show]);

  const handleClose = () => {
    setClosing(true);
    setTimeout(() => {
      setClosing(false);
      onClose();
    }, 250);
  };

  if (!show) return null;

  const isSuccess = type === 'success';
  const accentColor = isSuccess ? '#10b981' : '#ef4444';
  const accentBg = isSuccess ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)';
  const accentRing = isSuccess ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)';
  const IconComponent = isSuccess ? FiCheckCircle : FiAlertTriangle;

  return (
    <div
      onClick={handleClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,42,0.45)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 6000,
        padding: 20,
        animation: closing ? 'statusFadeOut 0.25s ease forwards' : 'statusFadeIn 0.25s ease forwards',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 20,
          width: '100%',
          maxWidth: 420,
          padding: '40px 32px 32px',
          textAlign: 'center',
          position: 'relative',
          boxShadow: '0 25px 60px rgba(0,0,0,0.18)',
          animation: closing ? 'statusSlideOut 0.25s ease forwards' : 'statusSlideIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        }}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          style={{
            position: 'absolute',
            top: 14,
            right: 14,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 6,
            borderRadius: 8,
            color: '#94a3b8',
            fontSize: 18,
            display: 'flex',
            alignItems: 'center',
            transition: 'background 0.15s, color 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#f1f5f9';
            e.currentTarget.style.color = '#475569';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'none';
            e.currentTarget.style.color = '#94a3b8';
          }}
        >
          <FiX />
        </button>

        {/* Animated icon ring */}
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            background: accentBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            boxShadow: `0 0 0 8px ${accentRing}`,
            animation: 'statusIconPop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.15s both',
          }}
        >
          <IconComponent size={36} color={accentColor} strokeWidth={2} />
        </div>

        {/* Title */}
        <h3
          style={{
            fontSize: '1.25rem',
            fontWeight: 700,
            color: '#1e293b',
            margin: '0 0 8px',
            animation: 'statusTextIn 0.4s ease 0.2s both',
          }}
        >
          {title || (isSuccess ? 'Success!' : 'Something went wrong')}
        </h3>

        {/* Message */}
        <p
          style={{
            fontSize: 14,
            color: '#64748b',
            lineHeight: 1.6,
            margin: '0 0 4px',
            animation: 'statusTextIn 0.4s ease 0.3s both',
          }}
        >
          {message}
        </p>

        {/* Details (optional) */}
        {details && (
          <div
            style={{
              marginTop: 12,
              padding: '10px 14px',
              background: type === 'error' ? 'rgba(239,68,68,0.05)' : '#f8fafc',
              borderRadius: 10,
              fontSize: 12,
              color: type === 'error' ? '#b91c1c' : '#64748b',
              fontFamily: type === 'error' ? "'JetBrains Mono', monospace" : 'inherit',
              lineHeight: 1.5,
              wordBreak: 'break-word',
              textAlign: 'left',
              animation: 'statusTextIn 0.4s ease 0.35s both',
            }}
          >
            {details}
          </div>
        )}

        {/* Action button */}
        <button
          onClick={handleClose}
          style={{
            marginTop: 24,
            padding: '11px 32px',
            background: accentColor,
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'transform 0.15s, box-shadow 0.15s',
            boxShadow: `0 4px 14px ${accentRing}`,
            animation: 'statusTextIn 0.4s ease 0.4s both',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = `0 6px 20px ${accentRing}`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = `0 4px 14px ${accentRing}`;
          }}
        >
          {isSuccess ? 'Continue' : 'Try Again'}
        </button>

        {/* Auto-close progress bar */}
        {autoClose !== false && (
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              height: 3,
              borderRadius: '0 0 20px 20px',
              background: `linear-gradient(90deg, ${accentColor}, ${isSuccess ? '#34d399' : '#f87171'})`,
              animation: `statusProgress ${autoClose}ms linear forwards`,
            }}
          />
        )}
      </div>

      {/* Injected keyframes */}
      <style>{`
        @keyframes statusFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes statusFadeOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }
        @keyframes statusSlideIn {
          from { opacity: 0; transform: scale(0.85) translateY(20px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes statusSlideOut {
          from { opacity: 1; transform: scale(1) translateY(0); }
          to { opacity: 0; transform: scale(0.9) translateY(10px); }
        }
        @keyframes statusIconPop {
          from { opacity: 0; transform: scale(0.3); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes statusTextIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes statusProgress {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
};

export default StatusModal;
