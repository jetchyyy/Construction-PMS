import React, { useState, useEffect } from 'react';
import { db } from '../../firebase/config';
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/ui/ToastContext';
import Modal from '../../components/ui/Modal';
import EmptyState from '../../components/ui/EmptyState';
import { SkeletonTable } from '../../components/ui/SkeletonLoader';
import { FiPlus, FiEdit2, FiTrash2, FiFolder, FiUsers, FiMapPin } from 'react-icons/fi';

const ProjectManager = () => {
  const { companyId } = useAuth();
  const { addToast } = useToast();
  const [projects, setProjects] = useState([]);
  const [workerCounts, setWorkerCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ projectName: '', location: '' });
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const fetchData = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, 'projects'), where('companyId', '==', companyId)));
      const projs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setProjects(projs);
      
      const counts = {};
      await Promise.all(projs.map(async (p) => {
        const wSnap = await getDocs(collection(db, 'projectWorkers', p.id, 'workers'));
        counts[p.id] = wSnap.size;
      }));
      setWorkerCounts(counts);
    } catch (err) {
      addToast('Failed to load projects', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [companyId]);

  const openAdd = () => { setEditing(null); setForm({ projectName: '', location: '' }); setShowModal(true); };
  const openEdit = (p) => { setEditing(p); setForm({ projectName: p.projectName, location: p.location }); setShowModal(true); };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await updateDoc(doc(db, 'projects', editing.id), { projectName: form.projectName, location: form.location });
        addToast('Project updated', 'success');
      } else {
        await addDoc(collection(db, 'projects'), {
          companyId, projectName: form.projectName, location: form.location,
          status: 'active', startDate: new Date().toISOString(),
        });
        addToast('Project created', 'success');
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
      await deleteDoc(doc(db, 'projects', deleteConfirm.id));
      addToast('Project deleted', 'success');
      setDeleteConfirm(null);
      fetchData();
    } catch (err) {
      addToast('Error: ' + err.message, 'error');
    }
  };

  return (
    <div className="animate-in">
      <div className="page-header">
        <div>
          <h1>Construction Projects</h1>
          <p style={{ color: 'var(--text)', fontSize: 13, marginTop: 4 }}>Manage active sites and worker distribution</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={openAdd}><FiPlus /> Add Project</button>
        </div>
      </div>

      <div className="data-card">
        <div className="data-card-header">
          <h3>Active Sites ({projects.length})</h3>
        </div>
        <table className="data-table">
          <thead><tr><th>Project Name</th><th>Location</th><th>Workers Assigned</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {loading ? <SkeletonTable cols={5} rows={4} /> : projects.length === 0 ? (
              <tr><td colSpan="5"><EmptyState icon={<FiFolder />} title="No projects" description="Create your first project to start assigning workers." /></td></tr>
            ) : projects.map((p, i) => (
              <tr key={p.id} className="animate-in" style={{ animationDelay: `${i * 0.05}s` }}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div className={`avatar ${['indigo', 'emerald', 'rose', 'amber', 'cyan'][i % 5]}`} style={{ borderRadius: 8 }}>
                      <FiFolder size={18} />
                    </div>
                    <div style={{ fontWeight: 600, color: 'var(--text-heading)' }}>{p.projectName}</div>
                  </div>
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text)' }}>
                    <FiMapPin size={14} style={{ opacity: 0.6 }} />
                    <span>{p.location}</span>
                  </div>
                </td>
                <td>
                  <span className="role-badge" style={{ background: 'var(--primary-light)', color: 'var(--primary)', borderColor: 'transparent' }}>
                    <FiUsers size={14} />
                    <span>{workerCounts[p.id] || 0} active workers</span>
                  </span>
                </td>
                <td>
                  <span className={`status-badge ${p.status}`}>
                    {p.status === 'active' && <span className="pulse-dot" style={{ width: 6, height: 6, marginRight: 4 }}></span>}
                    {p.status}
                  </span>
                </td>
                <td className="actions">
                  <button className="btn btn-sm btn-ghost" onClick={() => openEdit(p)} title="Edit"><FiEdit2 /></button>
                  <button className="btn btn-sm btn-ghost" onClick={() => setDeleteConfirm(p)} title="Delete" style={{ color: 'var(--danger)' }}><FiTrash2 /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal show={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Project' : 'New Project'} footer={
        <>
          <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
          <button className="btn btn-primary" form="projForm" type="submit" disabled={saving}>
            {saving ? 'Saving...' : editing ? 'Update Project' : 'Save Project'}
          </button>
        </>
      }>
        <form id="projForm" onSubmit={handleSave}>
          <div className="form-group">
            <label>Project Name</label>
            <input className="form-input" value={form.projectName} onChange={e => setForm({...form, projectName: e.target.value})} required placeholder="e.g. Tower A Construction" />
          </div>
          <div className="form-group">
            <label>Location</label>
            <input className="form-input" value={form.location} onChange={e => setForm({...form, location: e.target.value})} required placeholder="e.g. Makati City" />
          </div>
        </form>
      </Modal>

      <Modal show={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Delete Project" footer={
        <>
          <button className="btn btn-secondary" onClick={() => setDeleteConfirm(null)}>Cancel</button>
          <button className="btn btn-danger" onClick={handleDelete}>Yes, Delete</button>
        </>
      }>
        <p>Delete <strong>{deleteConfirm?.projectName}</strong>? All workers assigned to this project will become unassigned. This cannot be undone.</p>
      </Modal>
    </div>
  );
};

export default ProjectManager;
