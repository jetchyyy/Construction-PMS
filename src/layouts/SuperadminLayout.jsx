import React, { useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { auth } from '../firebase/config';
import { signOut } from 'firebase/auth';
import { FiGrid, FiBriefcase, FiLogOut, FiMenu, FiX } from 'react-icons/fi';

const NAV_ITEMS = [
  { label: 'Dashboard', path: '/superadmin/dashboard', icon: <FiGrid /> },
  { label: 'Companies', path: '/superadmin/companies', icon: <FiBriefcase /> },
];

const SuperadminLayout = () => {
  const { userData } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  const initials = (userData?.fullName || 'SA').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', position: 'relative' }}>
      {/* Mobile overlay */}
      {sidebarOpen && <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 999 }} onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar */}
      <aside style={{
        position: 'fixed', top: 0, left: 0, bottom: 0,
        width: 264, background: '#1e1b4b', color: '#a5b4fc',
        display: 'flex', flexDirection: 'column', zIndex: 1000,
        boxShadow: '2px 0 8px rgba(0,0,0,0.1)', overflowY: 'auto',
        transform: sidebarOpen ? 'translateX(0)' : undefined,
      }} className={`odc-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 2 }}>⬡ ODC SaaS</div>
          <div style={{ fontSize: 11, color: '#a5b4fc', opacity: 0.7 }}>System Administration</div>
        </div>
        <nav style={{ flex: 1, padding: '12px 0' }}>
          <div style={{ padding: '12px 20px 6px', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, color: 'rgba(165,180,252,0.4)' }}>Navigation</div>
          {NAV_ITEMS.map(item => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 16px', margin: '1px 8px', borderRadius: 8,
                  color: isActive ? '#fff' : '#a5b4fc',
                  background: isActive ? 'rgba(79,70,229,0.25)' : 'transparent',
                  fontWeight: isActive ? 500 : 400, fontSize: 13,
                  textDecoration: 'none', transition: 'all 0.15s',
                  position: 'relative',
                }}
              >
                {isActive && <span style={{ position: 'absolute', left: -8, top: '50%', transform: 'translateY(-50%)', width: 3, height: 20, background: '#818cf8', borderRadius: '0 3px 3px 0' }} />}
                <span style={{ fontSize: 16, width: 20, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', opacity: isActive ? 1 : 0.8 }}>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(79,70,229,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600, color: '#fff', flexShrink: 0 }}>{initials}</div>
            <div style={{ overflow: 'hidden', flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{userData?.fullName || 'Superadmin'}</div>
              <div style={{ fontSize: 11, color: '#a5b4fc', opacity: 0.7 }}>Superadmin</div>
            </div>
            <button onClick={handleLogout} title="Logout" style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: 6, borderRadius: 6, fontSize: 16, display: 'flex', alignItems: 'center' }}><FiLogOut /></button>
          </div>
        </div>
      </aside>

      {/* Top Navbar */}
      <div style={{
        position: 'fixed', top: 0, left: 264, right: 0, height: 64,
        background: '#fff', borderBottom: '1px solid #f1f5f9',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px', zIndex: 900, boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
      }} className="odc-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button className="mobile-toggle" onClick={() => setSidebarOpen(!sidebarOpen)} style={{ display: 'none', background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', padding: 6, color: '#1e293b', borderRadius: 6 }}>
            {sidebarOpen ? <FiX /> : <FiMenu />}
          </button>
          <span style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>
            {NAV_ITEMS.find(i => location.pathname.startsWith(i.path))?.label || 'Dashboard'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 8, cursor: 'pointer' }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#4f46e5', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600 }}>{initials}</div>
            <span style={{ fontSize: 13, fontWeight: 500, color: '#1e293b' }}>{userData?.fullName || 'Admin'}</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ marginLeft: 264, paddingTop: 64, minHeight: '100vh', flex: 1, background: '#f7f8fc', width: 'calc(100% - 264px)' }}>
        <div style={{ padding: 28 }}>
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default SuperadminLayout;
