import React, { useState, useEffect } from 'react';
import { db } from '../../firebase/config';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { FiUsers, FiFolder, FiDollarSign, FiCreditCard, FiClock, FiRepeat, FiPlusCircle, FiUserPlus, FiArrowRight } from 'react-icons/fi';
import { SkeletonCard } from '../../components/ui/SkeletonLoader';

const TenantDashboard = () => {
  const { companyId, userData } = useAuth();
  const [stats, setStats] = useState({ employees: 0, projects: 0, payrollsDue: 0, cashAdvances: 0 });
  const [recentTransfers, setRecentTransfers] = useState([]);
  const [recentPayrolls, setRecentPayrolls] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) return;
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [empSnap, projSnap, paySnap, caSnap, trSnap, prSnap] = await Promise.all([
          getDocs(query(collection(db, 'employees'), where('companyId', '==', companyId))),
          getDocs(query(collection(db, 'projects'), where('companyId', '==', companyId))),
          getDocs(query(collection(db, 'payrolls'), where('companyId', '==', companyId), where('status', '==', 'draft'))),
          getDocs(query(collection(db, 'cashAdvances'), where('companyId', '==', companyId), where('status', '==', 'active'))),
          getDocs(query(collection(db, 'employeeTransfers'), where('companyId', '==', companyId))),
          getDocs(query(collection(db, 'payrolls'), where('companyId', '==', companyId))),
        ]);
        setStats({
          employees: empSnap.size,
          projects: projSnap.size,
          payrollsDue: paySnap.size,
          cashAdvances: caSnap.size,
        });
        setRecentTransfers(trSnap.docs.slice(-5).reverse().map(d => ({ id: d.id, ...d.data() })));
        setRecentPayrolls(prSnap.docs.slice(-5).reverse().map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error('Dashboard fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [companyId]);

  const kpis = [
    { label: 'Total Employees', value: stats.employees, icon: <FiUsers />, color: 'kpi-indigo' },
    { label: 'Active Projects', value: stats.projects, icon: <FiFolder />, color: 'kpi-emerald' },
    { label: 'Payrolls Due', value: stats.payrollsDue, icon: <FiDollarSign />, color: 'kpi-amber' },
    { label: 'Cash Advances', value: stats.cashAdvances, icon: <FiCreditCard />, color: 'kpi-rose' },
  ];

  const quickActions = [
    { label: 'Add Employee', desc: 'Onboard new worker', icon: <FiUserPlus />, path: '/tenant/employees' },
    { label: 'New Project', desc: 'Setup construction site', icon: <FiPlusCircle />, path: '/tenant/projects' },
    { label: 'Attendance', desc: 'Record daily time', icon: <FiClock />, path: '/tenant/attendance' },
    { label: 'Run Payroll', desc: 'Compute salaries', icon: <FiDollarSign />, path: '/tenant/payroll' },
  ];

  const getInitials = (name) => (name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="animate-in">
      <div className="welcome-banner">
        <h1>Welcome back, {userData?.fullName?.split(' ')[0] || 'Admin'}!</h1>
        <p>Here's what's happening across your projects today. Monitor attendance, manage payroll, and track your workforce efficiently.</p>
        <div className="welcome-date" style={{ marginTop: 16 }}>{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
      </div>

      <div className="kpi-grid-4">
        {loading ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />) :
          kpis.map((k, i) => (
            <div className={`kpi-card gradient-kpi card-shine ${k.color}`} key={i} style={{ animationDelay: `${i * 0.1}s` }}>
              <div className="kpi-icon">{k.icon}</div>
              <div className="kpi-value">{k.value}</div>
              <div className="kpi-label">{k.label}</div>
            </div>
          ))
        }
      </div>

      <div className="page-header" style={{ marginTop: 32, marginBottom: 16 }}>
        <h3 style={{ fontSize: '1.1rem' }}>Quick Actions</h3>
      </div>
      <div className="kpi-grid-4" style={{ marginBottom: 32 }}>
        {quickActions.map((action, i) => (
          <Link to={action.path} key={i} className="quick-action-card" style={{ textDecoration: 'none' }}>
            <div className="quick-action-icon">{action.icon}</div>
            <div className="quick-action-info">
              <h4>{action.label}</h4>
              <p>{action.desc}</p>
            </div>
          </Link>
        ))}
      </div>

      <div className="kpi-grid-2">
        <div className="data-card">
          <div className="data-card-header"><h3><FiDollarSign style={{ marginRight: 8, color: 'var(--primary)' }} />Recent Payrolls</h3></div>
          <table className="data-table">
            <thead><tr><th>Period</th><th>Type</th><th>Status</th></tr></thead>
            <tbody>
              {recentPayrolls.length === 0 ? (
                <tr><td colSpan="3" style={{ textAlign: 'center', padding: '32px', color: 'var(--text)' }}>No payrolls generated yet</td></tr>
              ) : recentPayrolls.map((p, i) => (
                <tr key={p.id} className="animate-in" style={{ animationDelay: `${i * 0.05}s` }}>
                  <td style={{ fontSize: '12px', fontWeight: 500 }}>{p.periodStart} <span style={{ opacity: 0.5, margin: '0 4px' }}>to</span> {p.periodEnd}</td>
                  <td style={{ textTransform: 'capitalize' }}>{p.payrollType}</td>
                  <td><span className={`status-badge ${p.status === 'draft' ? 'draft' : 'paid'}`}>{p.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="data-card">
          <div className="data-card-header"><h3><FiRepeat style={{ marginRight: 8, color: 'var(--primary)' }} />Recent Transfers</h3></div>
          <div style={{ padding: '24px' }}>
            {recentTransfers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text)' }}>No recent transfers</div>
            ) : (
              <div className="timeline">
                {recentTransfers.map((t, i) => (
                  <div className="timeline-item animate-in" key={t.id} style={{ animationDelay: `${i * 0.1}s` }}>
                    <div className="timeline-dot"></div>
                    <div className="timeline-content">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                        <div className={`avatar ${['indigo', 'emerald', 'rose', 'amber', 'cyan'][i % 5]}`}>{getInitials(t.employeeName)}</div>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-heading)', fontSize: 13 }}>{t.employeeName}</div>
                          <div style={{ fontSize: 11, color: 'var(--text)' }}>{t.transferDate?.toDate ? t.transferDate.toDate().toLocaleDateString() : 'Recent'}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, background: 'var(--bg)', padding: '8px 12px', borderRadius: 6 }}>
                        <span style={{ color: 'var(--text)' }}>{t.fromProjectName || 'Unassigned'}</span>
                        <FiArrowRight style={{ color: 'var(--primary)' }} />
                        <span style={{ fontWeight: 600, color: 'var(--success)' }}>{t.toProjectName}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TenantDashboard;
