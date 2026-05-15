import React, { useState, useEffect } from 'react';
import { db } from '../../firebase/config';
import { collection, getDocs } from 'firebase/firestore';
import { FiBriefcase, FiUsers, FiCheckCircle, FiXCircle } from 'react-icons/fi';

const KPICard = ({ icon, label, value, color, loading }) => {
  const colors = {
    indigo: { bg: 'rgba(79,70,229,0.08)', fg: '#4f46e5' },
    green: { bg: 'rgba(16,185,129,0.1)', fg: '#10b981' },
    red: { bg: 'rgba(239,68,68,0.1)', fg: '#ef4444' },
    blue: { bg: 'rgba(59,130,246,0.1)', fg: '#3b82f6' },
  };
  const c = colors[color] || colors.indigo;
  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: 24,
      boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
      transition: 'transform 0.2s, box-shadow 0.2s',
    }}>
      <div style={{ width: 44, height: 44, borderRadius: 10, background: c.bg, color: c.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, marginBottom: 16 }}>
        {icon}
      </div>
      {loading ? (
        <>
          <div style={{ width: 60, height: 28, background: '#e2e8f0', borderRadius: 6, marginBottom: 8 }} />
          <div style={{ width: 100, height: 14, background: '#e2e8f0', borderRadius: 6 }} />
        </>
      ) : (
        <>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#1e293b', lineHeight: 1, marginBottom: 4 }}>{value}</div>
          <div style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>{label}</div>
        </>
      )}
    </div>
  );
};

const SuperadminDashboard = () => {
  const [stats, setStats] = useState({ total: 0, active: 0, suspended: 0, users: 0 });
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const compSnap = await getDocs(collection(db, 'companies'));
        const compList = compSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const userSnap = await getDocs(collection(db, 'users'));
        setCompanies(compList.slice(0, 5));
        setStats({
          total: compList.length,
          active: compList.filter(c => c.status === 'active').length,
          suspended: compList.filter(c => c.status !== 'active').length,
          users: userSnap.size,
        });
      } catch (err) {
        console.error('Error fetching stats:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1e293b' }}>System Overview</h1>
      </div>

      {/* KPI Grid - using inline grid to avoid Bootstrap conflicts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, marginBottom: 24 }}>
        <KPICard icon={<FiBriefcase />} label="Total Companies" value={stats.total} color="indigo" loading={loading} />
        <KPICard icon={<FiCheckCircle />} label="Active Companies" value={stats.active} color="green" loading={loading} />
        <KPICard icon={<FiXCircle />} label="Suspended" value={stats.suspended} color="red" loading={loading} />
        <KPICard icon={<FiUsers />} label="Total Users" value={stats.users} color="blue" loading={loading} />
      </div>

      {/* Recent Companies Table */}
      <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: '1px solid #f1f5f9' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#1e293b', margin: 0 }}>Recent Companies</h3>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ padding: '12px 16px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: '#64748b', background: '#fafbfd', borderBottom: '1px solid #f1f5f9', textAlign: 'left' }}>Company Name</th>
              <th style={{ padding: '12px 16px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: '#64748b', background: '#fafbfd', borderBottom: '1px solid #f1f5f9', textAlign: 'left' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="2" style={{ textAlign: 'center', padding: 32 }}><span className="spinner" /></td></tr>
            ) : companies.length === 0 ? (
              <tr><td colSpan="2" style={{ textAlign: 'center', padding: 32, color: '#64748b' }}>No companies registered yet</td></tr>
            ) : (
              companies.map(c => (
                <tr key={c.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '14px 16px', fontSize: 13, color: '#1e293b', fontWeight: 500 }}>{c.name}</td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', padding: '3px 10px',
                      borderRadius: 20, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3,
                      background: c.status === 'active' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                      color: c.status === 'active' ? '#10b981' : '#ef4444',
                    }}>{c.status}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SuperadminDashboard;
