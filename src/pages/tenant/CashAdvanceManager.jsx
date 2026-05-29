import React, { useState, useEffect } from 'react';
import { db } from '../../firebase/config';
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/ui/ToastContext';
import Modal from '../../components/ui/Modal';
import EmptyState from '../../components/ui/EmptyState';
import { SkeletonTable } from '../../components/ui/SkeletonLoader';
import { FiPlus, FiCreditCard, FiTrash2, FiTrendingUp, FiActivity, FiCheckCircle } from 'react-icons/fi';
import { format } from 'date-fns';

const capitalizeWords = (str) => (str || '').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

const CashAdvanceManager = () => {
  const { companyId } = useAuth();
  const { addToast } = useToast();
  const [advances, setAdvances] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ employeeId: '', amount: '', category: 'emergency', reason: '', deductionPerPayroll: '' });
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [isCustomCategory, setIsCustomCategory] = useState(false);

  const availableCategories = React.useMemo(() => {
    const defaults = ['emergency', 'medical', 'personal', 'salary loan', 'equipment'];
    const existing = advances.map(a => (a.category || a.reason)?.toLowerCase()?.trim()).filter(Boolean);
    const all = Array.from(new Set([...defaults, ...existing]));
    return all.sort();
  }, [advances]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const fetchData = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [caSnap, empSnap] = await Promise.all([
        getDocs(query(collection(db, 'cashAdvances'), where('companyId', '==', companyId))),
        getDocs(query(collection(db, 'employees'), where('companyId', '==', companyId))),
      ]);
      setAdvances(caSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => {
        const da = a.createdAt?.toDate?.() || new Date(0);
        const db2 = b.createdAt?.toDate?.() || new Date(0);
        return db2 - da;
      }));
      setEmployees(empSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      addToast('Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [companyId]);

  const getEmpName = (id) => employees.find(e => e.id === id)?.fullName || id;

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const amount = Number(form.amount);
      const deductionPerPayroll = Number(form.deductionPerPayroll) || 0;
      const empName = getEmpName(form.employeeId);
      const categoryVal = (form.category || '').trim().toLowerCase();
      await addDoc(collection(db, 'cashAdvances'), {
        companyId,
        employeeId: form.employeeId,
        employeeName: empName,
        amount,
        remainingBalance: amount,
        deductionPerPayroll,
        category: categoryVal,
        reason: (form.reason || '').trim(), // reason is optional comments
        status: 'active',
        date: format(new Date(), 'yyyy-MM-dd'),
        createdAt: serverTimestamp(),
      });
      addToast(`Cash advance of ₱${amount.toLocaleString()} created for ${empName}`, 'success');
      setShowModal(false);
      setIsCustomCategory(false);
      setForm({ employeeId: '', amount: '', category: 'emergency', reason: '', deductionPerPayroll: '' });
      fetchData();
    } catch (err) {
      addToast('Error: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await deleteDoc(doc(db, 'cashAdvances', deleteConfirm.id));
      addToast('Cash advance deleted', 'success');
      setDeleteConfirm(null);
      fetchData();
    } catch (err) {
      addToast('Error: ' + err.message, 'error');
    }
  };

  const fmt = (n) => '₱' + Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2 });
  const getInitials = (name) => (name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  // Summary stats
  const activeAdvances = advances.filter(a => a.status === 'active');
  const totalOutstanding = activeAdvances.reduce((acc, a) => acc + (a.remainingBalance || 0), 0);
  const fullyDeductedCount = advances.length - activeAdvances.length;

  const totalPages = Math.ceil(advances.length / itemsPerPage);
  const paginatedAdvances = React.useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return advances.slice(start, start + itemsPerPage);
  }, [advances, currentPage]);

  return (
    <div className="animate-in">
      <div className="page-header">
        <div>
          <h1>Cash Advances</h1>
          <p style={{ color: 'var(--text)', fontSize: 13, marginTop: 4 }}>Manage and track employee financial assistance</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => { setIsCustomCategory(false); setForm({ employeeId: '', amount: '', category: 'emergency', reason: '', deductionPerPayroll: '' }); setShowModal(true); }}><FiPlus /> New Advance</button>
        </div>
      </div>

      <div className="kpi-grid-3">
        <div className="kpi-card gradient-kpi kpi-rose card-shine">
          <div className="kpi-icon"><FiTrendingUp /></div>
          <div className="kpi-value">{fmt(totalOutstanding)}</div>
          <div className="kpi-label">Total Outstanding Balance</div>
        </div>
        <div className="kpi-card gradient-kpi kpi-amber card-shine">
          <div className="kpi-icon"><FiActivity /></div>
          <div className="kpi-value">{activeAdvances.length}</div>
          <div className="kpi-label">Active Advances</div>
        </div>
        <div className="kpi-card gradient-kpi kpi-emerald card-shine">
          <div className="kpi-icon"><FiCheckCircle /></div>
          <div className="kpi-value">{fullyDeductedCount}</div>
          <div className="kpi-label">Fully Deducted</div>
        </div>
      </div>

      <div className="data-card">
        <div className="data-card-header">
          <h3>Advance Records</h3>
        </div>
        <table className="data-table">
          <thead><tr><th>Employee</th><th>Date / Category</th><th>Original Amount</th><th>Deduction Progress</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {loading ? <SkeletonTable cols={6} rows={4} /> : paginatedAdvances.length === 0 ? (
              <tr><td colSpan="6"><EmptyState icon={<FiCreditCard />} title="No cash advances" description="Create a new cash advance for an employee." /></td></tr>
            ) : paginatedAdvances.map((ca, i) => {
              const progressPercentage = Math.max(0, Math.min(100, ((ca.amount - ca.remainingBalance) / ca.amount) * 100));
              return (
                <tr key={ca.id} className="animate-in" style={{ animationDelay: `${(i % itemsPerPage) * 0.05}s` }}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div className={`avatar ${['indigo', 'emerald', 'rose', 'amber', 'cyan'][i % 5]}`}>{getInitials(ca.employeeName)}</div>
                      <div style={{ fontWeight: 600, color: 'var(--text-heading)' }}>{ca.employeeName}</div>
                    </div>
                  </td>
                  <td>
                    <div style={{ fontSize: 12, fontWeight: 500 }}>{ca.date}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-heading)', fontWeight: 500, textTransform: 'capitalize' }}>
                      {ca.category || 'No Category'}
                    </div>
                    {ca.reason && (
                      <div 
                        style={{ fontSize: 10, color: 'var(--text)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} 
                        title={ca.reason}
                      >
                        {ca.reason}
                      </div>
                    )}
                  </td>
                  <td style={{ fontWeight: 500 }}>
                    <div>{fmt(ca.amount)}</div>
                    {ca.deductionPerPayroll > 0 && (
                      <div style={{ fontSize: 11, color: 'var(--text)', fontWeight: 400, marginTop: 2 }}>
                        {fmt(ca.deductionPerPayroll)} / payroll
                      </div>
                    )}
                  </td>
                  <td style={{ width: 220 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                      <span style={{ color: 'var(--text)' }}>Bal: <strong style={{ color: ca.remainingBalance > 0 ? 'var(--danger)' : 'var(--success)' }}>{fmt(ca.remainingBalance)}</strong></span>
                      <span style={{ color: 'var(--success)' }}>{progressPercentage.toFixed(0)}% paid</span>
                    </div>
                    <div className="progress-container">
                      <div className={`progress-bar ${ca.remainingBalance > 0 ? 'warning' : 'success'}`} style={{ width: `${progressPercentage}%` }}></div>
                    </div>
                  </td>
                  <td>
                    <span className={`status-badge ${ca.status === 'active' ? 'pending' : 'paid'}`}>
                      {ca.status === 'active' && <span className="pulse-dot" style={{ width: 6, height: 6, marginRight: 4, background: 'var(--info)' }}></span>}
                      {ca.status === 'active' ? 'Active' : 'Deducted'}
                    </span>
                  </td>
                  <td className="actions">
                    <button className="btn btn-sm btn-ghost" onClick={() => setDeleteConfirm(ca)} style={{ color: 'var(--danger)' }}><FiTrash2 /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {totalPages > 1 && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px 24px', borderTop: '1px solid var(--border-light)',
            flexWrap: 'wrap', gap: 12
          }}>
            <div style={{ fontSize: 13, color: 'var(--text)' }}>
              Showing <strong style={{ color: 'var(--text-heading)' }}>{((currentPage - 1) * itemsPerPage) + 1}</strong> to <strong style={{ color: 'var(--text-heading)' }}>{Math.min(currentPage * itemsPerPage, advances.length)}</strong> of <strong style={{ color: 'var(--text-heading)' }}>{advances.length}</strong> records
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </button>
              {Array.from({ length: totalPages }).map((_, idx) => {
                const pageNum = idx + 1;
                if (totalPages > 5 && pageNum !== 1 && pageNum !== totalPages && Math.abs(pageNum - currentPage) > 1) {
                  if (pageNum === 2 || pageNum === totalPages - 1) {
                    return <span key={pageNum} style={{ padding: '4px 8px', color: 'var(--text-light)', display: 'inline-block' }}>...</span>;
                  }
                  return null;
                }
                return (
                  <button
                    key={pageNum}
                    className={`btn btn-sm ${currentPage === pageNum ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setCurrentPage(pageNum)}
                    style={{ minWidth: 32 }}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      <Modal show={showModal} onClose={() => { setShowModal(false); setIsCustomCategory(false); }} title="New Cash Advance" footer={
        <>
          <button className="btn btn-secondary" onClick={() => { setShowModal(false); setIsCustomCategory(false); }}>Cancel</button>
          <button className="btn btn-primary" form="caForm" type="submit" disabled={saving}>{saving ? 'Creating...' : 'Create Advance'}</button>
        </>
      }>
        <form id="caForm" onSubmit={handleCreate}>
          <div className="form-group">
            <label>Employee</label>
            <select className="form-input" value={form.employeeId} onChange={e => setForm({...form, employeeId: e.target.value})} required>
              <option value="">Select Employee</option>
              {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.fullName}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Amount (₱)</label>
            <input type="number" className="form-input" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} required min="0.01" step="any" placeholder="0.00" />
            <span style={{ fontSize: 11, color: 'var(--text)', display: 'block', marginTop: 4 }}>This amount will be deducted from future payrolls.</span>
          </div>
          <div className="form-group">
            <label>Deduction per Payroll (Optional)</label>
            <input type="number" className="form-input" value={form.deductionPerPayroll} onChange={e => setForm({...form, deductionPerPayroll: e.target.value})} min="0" step="any" placeholder="e.g. 500.00" />
            <span style={{ fontSize: 11, color: 'var(--text)', display: 'block', marginTop: 4 }}>Specify a fixed deduction amount per payroll cycle. If empty, the full amount will be deducted in the next payroll.</span>
          </div>
          <div className="form-group">
            <label>Category</label>
            {isCustomCategory ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <input 
                  className="form-input" 
                  value={form.category} 
                  onChange={e => setForm({...form, category: e.target.value})} 
                  required 
                  placeholder="Enter custom category (e.g. Travel)" 
                />
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => {
                    setIsCustomCategory(false);
                    setForm({...form, category: 'emergency'});
                  }}
                  style={{ padding: '0 12px' }}
                  title="Select from list"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <select 
                className="form-input" 
                value={form.category} 
                onChange={e => {
                  if (e.target.value === 'ADD_CUSTOM') {
                    setIsCustomCategory(true);
                    setForm({...form, category: ''});
                  } else {
                    setForm({...form, category: e.target.value});
                  }
                }}
              >
                {availableCategories.map(cat => (
                  <option key={cat} value={cat} style={{ textTransform: 'capitalize' }}>
                    {capitalizeWords(cat)}
                  </option>
                ))}
                <option value="ADD_CUSTOM" style={{ color: 'var(--primary)', fontWeight: 600 }}>+ Add Custom Category...</option>
              </select>
            )}
          </div>
          <div className="form-group">
            <label>Reason / Remarks (Optional)</label>
            <input className="form-input" value={form.reason} onChange={e => setForm({...form, reason: e.target.value})} placeholder="e.g. Medical emergency, School tuition, etc." />
          </div>
        </form>
      </Modal>

      <Modal show={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Delete Cash Advance" footer={
        <>
          <button className="btn btn-secondary" onClick={() => setDeleteConfirm(null)}>Cancel</button>
          <button className="btn btn-danger" onClick={handleDelete}>Yes, Delete</button>
        </>
      }>
        <p>Delete cash advance of <strong>{fmt(deleteConfirm?.amount)}</strong> for <strong>{deleteConfirm?.employeeName}</strong>? This action cannot be undone.</p>
      </Modal>
    </div>
  );
};

export default CashAdvanceManager;
