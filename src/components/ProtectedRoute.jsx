import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const LoadingSkeleton = () => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    background: 'var(--bg)',
    flexDirection: 'column',
    gap: '16px'
  }}>
    <span className="spinner spinner-lg" />
    <p style={{ color: 'var(--text)', fontSize: '14px', fontWeight: 500 }}>Loading...</p>
  </div>
);

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { currentUser, userRole, loading } = useAuth();

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(userRole)) {
    // Redirect based on their role
    if (userRole === 'superadmin') return <Navigate to="/superadmin/dashboard" replace />;
    if (userRole === 'company_admin') return <Navigate to="/tenant/dashboard" replace />;
    if (userRole === 'staff') return <Navigate to="/tenant/attendance" replace />;
    
    // Fallback
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoute;
