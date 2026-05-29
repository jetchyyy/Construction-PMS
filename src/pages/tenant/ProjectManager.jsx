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
  const [selectedProjectForWorkers, setSelectedProjectForWorkers] = useState(null);
  const [projectWorkersList, setProjectWorkersList] = useState([]);
  const [loadingWorkersList, setLoadingWorkersList] = useState(false);

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

  const openAdd = () => { setEditing(null); setForm({ projectName: '', location: '', status: 'active' }); setShowModal(true); };
  const openEdit = (p) => { setEditing(p); setForm({ projectName: p.projectName, location: p.location, status: p.status || 'active' }); setShowModal(true); };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await updateDoc(doc(db, 'projects', editing.id), { 
          projectName: form.projectName, 
          location: form.location,
          status: form.status
        });
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

  const updateProjectStatus = async (p, newStatus) => {
    try {
      await updateDoc(doc(db, 'projects', p.id), { status: newStatus });
      addToast(`Project "${p.projectName}" status is now ${newStatus}`, 'success');
      fetchData();
    } catch (err) {
      addToast('Error updating status: ' + err.message, 'error');
    }
  };

  const viewWorkers = async (project) => {
    setSelectedProjectForWorkers(project);
    setLoadingWorkersList(true);
    try {
      const snap = await getDocs(query(
        collection(db, 'employees'),
        where('companyId', '==', companyId),
        where('currentProjectId', '==', project.id)
      ));
      setProjectWorkersList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      addToast('Failed to load workers: ' + err.message, 'error');
    } finally {
      setLoadingWorkersList(false);
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
                  <button 
                    onClick={() => viewWorkers(p)}
                    className="role-badge" 
                    style={{ 
                      background: 'var(--primary-light)', 
                      color: 'var(--primary)', 
                      borderColor: 'transparent', 
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      border: 'none',
                      fontFamily: 'inherit',
                      fontSize: '12px'
                    }}
                    title="Click to view assigned workers"
                  >
                    <FiUsers size={14} />
                    <span>{workerCounts[p.id] || 0} active workers</span>
                  </button>
                </td>
                <td>
                  <span className={`status-badge ${p.status}`}>
                    {p.status === 'active' && <span className="pulse-dot" style={{ width: 6, height: 6, marginRight: 4 }}></span>}
                    {p.status}
                  </span>
                </td>
                <td className="actions" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <select
                    className="btn btn-sm btn-secondary"
                    value={p.status || 'active'}
                    onChange={(e) => updateProjectStatus(p, e.target.value)}
                    style={{ 
                      cursor: 'pointer',
                      paddingRight: '22px',
                      textTransform: 'capitalize',
                      backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23475569' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 6px center',
                      backgroundSize: '12px',
                      appearance: 'none',
                      WebkitAppearance: 'none',
                      height: '30px',
                      paddingTop: '2px',
                      paddingBottom: '2px'
                    }}
                  >
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                    <option value="completed">Completed</option>
                    <option value="inactive">Inactive</option>
                  </select>
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
          {editing && (
            <div className="form-group">
              <label>Status</label>
              <select className="form-input" value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="completed">Completed</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          )}
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

      <Modal 
        show={!!selectedProjectForWorkers} 
        onClose={() => setSelectedProjectForWorkers(null)} 
        title={`Assigned Workers: ${selectedProjectForWorkers?.projectName}`}
        size="md"
      >
        {loadingWorkersList ? (
          <div style={{ textAlign: 'center', padding: 32 }}>
            <span className="spinner" />
            <div style={{ marginTop: 8 }}>Loading workers...</div>
          </div>
        ) : projectWorkersList.length === 0 ? (
          <EmptyState 
            icon={<FiUsers />} 
            title="No workers assigned" 
            description="Assign workers to this project in the Workforce Directory." 
          />
        ) : (
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            <table className="data-table" style={{ fontSize: 13 }}>
              <thead>
                <tr>
                  <th>Worker Name</th>
                  <th>Role</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {projectWorkersList.map((worker, idx) => (
                  <tr key={worker.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-heading)' }}>
                        {worker.fullName}
                      </div>
                    </td>
                    <td>
                      <span style={{ textTransform: 'capitalize', fontSize: 12 }}>
                        {worker.role}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${worker.status}`}>
                        {worker.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ProjectManager;
