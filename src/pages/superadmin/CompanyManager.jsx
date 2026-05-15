import React, { useState, useEffect } from 'react';
import { db, auth } from '../../firebase/config';
import { collection, getDocs, addDoc, updateDoc, setDoc, doc, serverTimestamp } from 'firebase/firestore';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { initializeApp, deleteApp, getApp } from 'firebase/app';
import { useToast } from '../../components/ui/ToastContext';
import Modal from '../../components/ui/Modal';
import StatusModal from '../../components/ui/StatusModal';
import { FiPlus, FiToggleLeft, FiToggleRight, FiBriefcase, FiUser, FiMail, FiLock, FiSearch } from 'react-icons/fi';

/* ---- shared inline style helpers ---- */
const thStyle = {
  padding: '12px 16px', fontSize: 11, fontWeight: 600,
  textTransform: 'uppercase', letterSpacing: 0.5, color: '#64748b',
  background: '#fafbfd', borderBottom: '1px solid #f1f5f9', textAlign: 'left',
};
const tdStyle = { padding: '14px 16px', fontSize: 13, borderBottom: '1px solid #f1f5f9' };
const inputStyle = {
  width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0',
  borderRadius: 8, fontSize: 13, color: '#1e293b', outline: 'none',
  transition: 'border-color 0.2s', background: '#fff',
  fontFamily: 'inherit',
};
const labelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 };
const badgeStyle = (active) => ({
  display: 'inline-flex', alignItems: 'center', padding: '3px 10px',
  borderRadius: 20, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3,
  background: active ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
  color: active ? '#10b981' : '#ef4444',
});

const CompanyManager = () => {
  const { addToast } = useToast();
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ name: '', adminEmail: '', adminPassword: '', adminName: '' });

  // StatusModal state
  const [statusModal, setStatusModal] = useState({
    show: false,
    type: 'success',
    title: '',
    message: '',
    details: '',
  });

  const showStatus = (type, title, message, details = '') => {
    setStatusModal({ show: true, type, title, message, details });
  };

  const closeStatus = () => {
    setStatusModal(prev => ({ ...prev, show: false }));
  };

  const fetchCompanies = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'companies'));
      setCompanies(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      addToast('Failed to load companies', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCompanies(); }, []);

  const handleToggleStatus = async (companyId, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
    try {
      await updateDoc(doc(db, 'companies', companyId), { status: newStatus });
      addToast(`Company ${newStatus === 'active' ? 'activated' : 'suspended'}`, 'success');
      fetchCompanies();
    } catch (err) {
      addToast('Failed to update status', 'error');
    }
  };

  const handleCreateCompany = async (e) => {
    e.preventDefault();
    setSaving(true);

    let secondaryApp = null;

    try {
      // Create a secondary Firebase app to avoid signing out the current superadmin.
      // Use a unique name with timestamp to avoid "duplicate-app" errors on retries.
      const secondaryAppName = `SecondaryApp_${Date.now()}`;
      secondaryApp = initializeApp(auth.app.options, secondaryAppName);
      const secondaryAuth = getAuth(secondaryApp);

      // Create the admin user on the secondary auth instance
      const cred = await createUserWithEmailAndPassword(
        secondaryAuth,
        form.adminEmail,
        form.adminPassword
      );

      // Sign out from secondary immediately (does NOT affect primary session)
      await secondaryAuth.signOut();

      // Create company document in Firestore
      const compRef = await addDoc(collection(db, 'companies'), {
        name: form.name,
        ownerUserId: cred.user.uid,
        status: 'active',
        createdAt: serverTimestamp(),
        settings: { otRateMultiplier: 1.25, currency: 'PHP' },
      });

      // Create user document for the new admin
      await setDoc(doc(db, 'users', cred.user.uid), {
        fullName: form.adminName,
        email: form.adminEmail,
        role: 'company_admin',
        companyId: compRef.id,
        createdAt: serverTimestamp(),
      });

      // Clean up secondary app
      await deleteApp(secondaryApp);
      secondaryApp = null;

      // Close form modal and reset
      setShowModal(false);
      setForm({ name: '', adminEmail: '', adminPassword: '', adminName: '' });

      // Show success status modal
      showStatus(
        'success',
        'Client Onboarded!',
        `${form.name} has been registered successfully with an admin account.`,
        `Admin: ${form.adminName} (${form.adminEmail})`
      );

      fetchCompanies();
    } catch (err) {
      console.error('Onboarding error:', err);

      // Clean up secondary app on failure
      if (secondaryApp) {
        try { await deleteApp(secondaryApp); } catch (_) { /* ignore cleanup errors */ }
      }

      // Close form modal and show error status modal
      setShowModal(false);

      // Provide user-friendly error messages
      let friendlyMessage = 'An unexpected error occurred while creating the company.';
      let errorDetails = err.message;

      if (err.code === 'auth/email-already-in-use') {
        friendlyMessage = 'This email address is already registered. Please use a different email for the admin account.';
        errorDetails = '';
      } else if (err.code === 'auth/weak-password') {
        friendlyMessage = 'The password is too weak. Please use at least 6 characters with a mix of letters and numbers.';
        errorDetails = '';
      } else if (err.code === 'auth/invalid-email') {
        friendlyMessage = 'The email address format is invalid. Please check and try again.';
        errorDetails = '';
      } else if (err.code === 'auth/network-request-failed') {
        friendlyMessage = 'Network error. Please check your internet connection and try again.';
        errorDetails = '';
      }

      showStatus('error', 'Onboarding Failed', friendlyMessage, errorDetails);
    } finally {
      setSaving(false);
    }
  };

  const openOnboard = () => {
    setForm({ name: '', adminEmail: '', adminPassword: '', adminName: '' });
    setShowModal(true);
  };

  const filtered = companies.filter(c => c.name?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>Company Management</h1>
        <button
          onClick={openOnboard}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '10px 20px', background: '#4f46e5', color: '#fff',
            border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600,
            cursor: 'pointer', transition: 'background 0.2s', boxShadow: '0 1px 3px rgba(79,70,229,0.3)',
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#4338ca'}
          onMouseLeave={e => e.currentTarget.style.background = '#4f46e5'}
        >
          <FiPlus /> Onboard New Client
        </button>
      </div>

      {/* Table card */}
      <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: '1px solid #f1f5f9', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#1e293b', margin: 0 }}>Registered Companies</h3>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>{filtered.length} of {companies.length} total</span>
          </div>
          <div style={{ position: 'relative' }}>
            <FiSearch style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: 14 }} />
            <input
              placeholder="Search companies..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ ...inputStyle, paddingLeft: 36, width: 240 }}
            />
          </div>
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>Company Name</th>
                <th style={thStyle}>Owner ID</th>
                <th style={thStyle}>Status</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i}>
                    {[1,2,3,4].map(j => (
                      <td key={j} style={tdStyle}>
                        <div style={{ width: j === 1 ? '70%' : '50%', height: 14, background: '#e2e8f0', borderRadius: 6, animation: 'pulse 1.5s ease-in-out infinite' }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', padding: 48, color: '#94a3b8' }}>
                    <FiBriefcase style={{ fontSize: 32, marginBottom: 8, opacity: 0.3 }} />
                    <div style={{ fontSize: 14, fontWeight: 500, color: '#64748b', marginBottom: 4 }}>
                      {search ? 'No matches found' : 'No companies registered yet'}
                    </div>
                    <div style={{ fontSize: 12 }}>
                      {search ? 'Try a different search term.' : 'Click "Onboard New Client" to get started.'}
                    </div>
                  </td>
                </tr>
              ) : filtered.map(c => (
                <tr key={c.id} style={{ transition: 'background 0.15s' }} onMouseEnter={e => e.currentTarget.style.background = '#fafbfd'} onMouseLeave={e => e.currentTarget.style.background = ''}>
                  <td style={{ ...tdStyle, fontWeight: 500, color: '#1e293b' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(79,70,229,0.08)', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>
                        <FiBriefcase />
                      </div>
                      {c.name}
                    </div>
                  </td>
                  <td style={{ ...tdStyle, fontSize: 11, fontFamily: 'monospace', color: '#94a3b8' }}>{c.ownerUserId?.slice(0, 12)}...</td>
                  <td style={tdStyle}>
                    <span style={badgeStyle(c.status === 'active')}>{c.status}</span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <button
                      onClick={() => handleToggleStatus(c.id, c.status)}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '6px 14px', fontSize: 12, fontWeight: 500,
                        border: 'none', borderRadius: 8, cursor: 'pointer',
                        transition: 'all 0.15s',
                        background: c.status === 'active' ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)',
                        color: c.status === 'active' ? '#d97706' : '#059669',
                      }}
                    >
                      {c.status === 'active' ? <><FiToggleRight size={14} /> Suspend</> : <><FiToggleLeft size={14} /> Activate</>}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===== Onboarding Modal ===== */}
      <Modal show={showModal} onClose={() => setShowModal(false)} title="Onboard New Client" size="md" footer={
        <>
          <button
            onClick={() => setShowModal(false)}
            style={{ padding: '10px 20px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
          >Cancel</button>
          <button
            form="onboardForm"
            type="submit"
            disabled={saving}
            style={{
              padding: '10px 24px', background: saving ? '#a5b4fc' : '#4f46e5', color: '#fff',
              border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer', display: 'inline-flex',
              alignItems: 'center', gap: 6, transition: 'background 0.15s',
            }}
          >
            {saving ? <><span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} /> Creating...</> : 'Create Company & Admin'}
          </button>
        </>
      }>
        {/* Onboarding guidance */}
        <div style={{ padding: '14px 16px', background: 'rgba(79,70,229,0.05)', borderRadius: 10, marginBottom: 20, border: '1px solid rgba(79,70,229,0.1)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#4f46e5', marginBottom: 4 }}>🏗️ Client Onboarding</div>
          <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>
            This will create a new company and an admin account. The admin can then log in and manage their own employees, projects, and payroll.
          </div>
        </div>

        <form id="onboardForm" onSubmit={handleCreateCompany}>
          {/* Company Section */}
          <div style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
            Company Details
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Company Name</label>
            <div style={{ position: 'relative' }}>
              <FiBriefcase style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                style={{ ...inputStyle, paddingLeft: 40 }}
                placeholder="e.g. ACME Construction Inc."
                value={form.name}
                onChange={e => setForm({...form, name: e.target.value})}
                required
              />
            </div>
          </div>

          {/* Divider */}
          <div style={{ borderTop: '1px solid #f1f5f9', marginBottom: 20 }} />

          {/* Admin Section */}
          <div style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
            Admin Account
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Admin Full Name</label>
            <div style={{ position: 'relative' }}>
              <FiUser style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                style={{ ...inputStyle, paddingLeft: 40 }}
                placeholder="Juan Dela Cruz"
                value={form.adminName}
                onChange={e => setForm({...form, adminName: e.target.value})}
                required
              />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 4 }}>
            <div>
              <label style={labelStyle}>Email</label>
              <div style={{ position: 'relative' }}>
                <FiMail style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="email"
                  style={{ ...inputStyle, paddingLeft: 40 }}
                  placeholder="admin@company.com"
                  value={form.adminEmail}
                  onChange={e => setForm({...form, adminEmail: e.target.value})}
                  required
                />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Password</label>
              <div style={{ position: 'relative' }}>
                <FiLock style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="password"
                  style={{ ...inputStyle, paddingLeft: 40 }}
                  placeholder="Min 6 characters"
                  value={form.adminPassword}
                  onChange={e => setForm({...form, adminPassword: e.target.value})}
                  required
                  minLength={6}
                />
              </div>
            </div>
          </div>
        </form>
      </Modal>

      {/* ===== Status Modal (Success / Error feedback) ===== */}
      <StatusModal
        show={statusModal.show}
        onClose={closeStatus}
        type={statusModal.type}
        title={statusModal.title}
        message={statusModal.message}
        details={statusModal.details}
        autoClose={statusModal.type === 'success' ? 5000 : false}
      />
    </div>
  );
};

export default CompanyManager;
