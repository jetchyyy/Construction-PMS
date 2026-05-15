import React, { useState, useEffect } from 'react';
import { db } from '../../firebase/config';
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, setDoc } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/ui/ToastContext';
import Modal from '../../components/ui/Modal';
import EmptyState from '../../components/ui/EmptyState';
import { SkeletonTable } from '../../components/ui/SkeletonLoader';
import { FiPlus, FiEdit2, FiTrash2, FiSearch, FiUsers, FiTool, FiUser, FiBriefcase } from 'react-icons/fi';

const EmployeeManager = () => {
  const { companyId } = useAuth();
  const { addToast } = useToast();
  const [employees, setEmployees] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ fullName: '', role: 'worker', dailyRate: '', payrollType: 'weekly', currentProjectId: '' });
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const fetchData = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [pSnap, eSnap] = await Promise.all([
        getDocs(query(collection(db, 'projects'), where('companyId', '==', companyId))),
        getDocs(query(collection(db, 'employees'), where('companyId', '==', companyId))),
      ]);
      setProjects(pSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setEmployees(eSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      addToast('Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [companyId]);

  const openAdd = () => {
    setEditing(null);
    setForm({ fullName: '', role: 'worker', dailyRate: '', payrollType: 'weekly', currentProjectId: '' });
    setShowModal(true);
  };

  const openEdit = (emp) => {
    setEditing(emp);
    setForm({ fullName: emp.fullName, role: emp.role, dailyRate: emp.dailyRate, payrollType: emp.payrollType, currentProjectId: emp.currentProjectId || '' });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const projName = projects.find(p => p.id === form.currentProjectId)?.projectName || '';
      const data = {
        companyId,
        fullName: form.fullName,
        role: form.role,
        dailyRate: Number(form.dailyRate),
        payrollType: form.payrollType,
        currentProjectId: form.currentProjectId,
        currentProjectName: projName,
        status: 'active',
      };
      if (editing) {
        await updateDoc(doc(db, 'employees', editing.id), data);
        if (editing.currentProjectId && editing.currentProjectId !== form.currentProjectId) {
          await deleteDoc(doc(db, 'projectWorkers', editing.currentProjectId, 'workers', editing.id)).catch(() => {});
        }
        if (form.currentProjectId) {
          await setDoc(doc(db, 'projectWorkers', form.currentProjectId, 'workers', editing.id), { active: true });
        }
        addToast('Employee updated', 'success');
      } else {
        const empRef = await addDoc(collection(db, 'employees'), data);
        if (form.currentProjectId) {
          await setDoc(doc(db, 'projectWorkers', form.currentProjectId, 'workers', empRef.id), { active: true });
        }
        addToast('Employee added', 'success');
      }
      setShowModal(false);
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
      if (deleteConfirm.currentProjectId) {
        await deleteDoc(doc(db, 'projectWorkers', deleteConfirm.currentProjectId, 'workers', deleteConfirm.id)).catch(() => {});
      }
      await deleteDoc(doc(db, 'employees', deleteConfirm.id));
      addToast('Employee deleted', 'success');
      setDeleteConfirm(null);
      fetchData();
    } catch (err) {
      addToast('Error deleting: ' + err.message, 'error');
    }
  };

  const filtered = employees.filter(e => e.fullName?.toLowerCase().includes(search.toLowerCase()));
  const getInitials = (name) => (name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="animate-in">
      <div className="page-header">
        <div>
          <h1>Workforce Directory</h1>
          <p style={{ color: 'var(--text)', fontSize: 13, marginTop: 4 }}>Manage all {employees.length} employees and their assignments</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={openAdd}><FiPlus /> Add Employee</button>
        </div>
      </div>

      <div className="data-card">
        <div className="data-card-header">
          <h3>Active Workforce</h3>
          <div className="search-box">
            <FiSearch className="search-icon" />
            <input placeholder="Search employees..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        <table className="data-table">
          <thead><tr><th>Employee</th><th>Role</th><th>Daily Rate</th><th>Assignment</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {loading ? <SkeletonTable cols={6} rows={5} /> : filtered.length === 0 ? (
              <tr><td colSpan="6"><EmptyState icon={<FiUsers />} title="No employees" description={search ? 'No matches found.' : 'Add your first employee.'} /></td></tr>
            ) : filtered.map((emp, i) => (
              <tr key={emp.id} className="animate-in" style={{ animationDelay: `${i * 0.03}s` }}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div className={`avatar ${['indigo', 'emerald', 'rose', 'amber', 'cyan'][i % 5]}`}>{getInitials(emp.fullName)}</div>
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text-heading)' }}>{emp.fullName}</div>
                      <div style={{ fontSize: 11, color: 'var(--text)', textTransform: 'capitalize' }}>{emp.payrollType} Payroll</div>
                    </div>
                  </div>
                </td>
                <td>
                  <span className="role-badge">
                    {emp.role === 'worker' ? <FiTool /> : emp.role === 'foreman' ? <FiUser /> : <FiBriefcase />}
                    <span style={{ textTransform: 'capitalize' }}>{emp.role}</span>
                  </span>
                </td>
                <td style={{ fontWeight: 500 }}>₱{Number(emp.dailyRate).toLocaleString()}</td>
                <td>{emp.currentProjectName ? <span style={{ background: 'var(--bg)', padding: '4px 10px', borderRadius: 6, fontSize: 12, border: '1px solid var(--border-light)' }}>{emp.currentProjectName}</span> : <span style={{ color: 'var(--text)', opacity: 0.5, fontSize: 12 }}>Unassigned</span>}</td>
                <td>
                  <span className={`status-badge ${emp.status}`}>
                    {emp.status === 'active' && <span className="pulse-dot" style={{ width: 6, height: 6, marginRight: 4 }}></span>}
                    {emp.status}
                  </span>
                </td>
                <td className="actions">
                  <button className="btn btn-sm btn-ghost" onClick={() => openEdit(emp)} title="Edit"><FiEdit2 /></button>
                  <button className="btn btn-sm btn-ghost" onClick={() => setDeleteConfirm(emp)} title="Delete" style={{ color: 'var(--danger)' }}><FiTrash2 /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal show={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Employee' : 'New Employee'} footer={
        <>
          <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
          <button className="btn btn-primary" form="empForm" type="submit" disabled={saving}>
            {saving ? 'Saving...' : editing ? 'Update Employee' : 'Add Employee'}
          </button>
        </>
      }>
        <form id="empForm" onSubmit={handleSave}>
          <div className="form-group">
            <label>Full Name</label>
            <input className="form-input" value={form.fullName} onChange={e => setForm({...form, fullName: e.target.value})} required placeholder="e.g. Juan Dela Cruz" />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Role</label>
              <select className="form-input" value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
                <option value="worker">Worker</option>
                <option value="foreman">Foreman</option>
                <option value="engineer">Engineer</option>
              </select>
            </div>
            <div className="form-group">
              <label>Payroll Type</label>
              <select className="form-input" value={form.payrollType} onChange={e => setForm({...form, payrollType: e.target.value})}>
                <option value="weekly">Weekly</option>
                <option value="kinsenas">Kinsenas</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>Daily Rate (₱)</label>
            <input type="number" className="form-input" value={form.dailyRate} onChange={e => setForm({...form, dailyRate: e.target.value})} required min="1" placeholder="0.00" />
          </div>
          <div className="form-group">
            <label>Project Assignment</label>
            <select className="form-input" value={form.currentProjectId} onChange={e => setForm({...form, currentProjectId: e.target.value})}>
              <option value="">Unassigned</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.projectName}</option>)}
            </select>
            <span style={{ fontSize: 11, color: 'var(--text)', display: 'block', marginTop: 4 }}>You can change this later using Worker Transfers.</span>
          </div>
        </form>
      </Modal>

      <Modal show={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Delete Employee" footer={
        <>
          <button className="btn btn-secondary" onClick={() => setDeleteConfirm(null)}>Cancel</button>
          <button className="btn btn-danger" onClick={handleDelete}>Yes, Delete</button>
        </>
      }>
        <p>Are you sure you want to delete <strong>{deleteConfirm?.fullName}</strong>? This will remove them from their current project. This action cannot be undone.</p>
      </Modal>
    </div>
  );
};

export default EmployeeManager;
