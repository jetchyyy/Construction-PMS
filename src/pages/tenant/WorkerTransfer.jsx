import React, { useState, useEffect } from 'react';
import { db } from '../../firebase/config';
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, setDoc, doc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/ui/ToastContext';
import Modal from '../../components/ui/Modal';
import EmptyState from '../../components/ui/EmptyState';
import { SkeletonLine } from '../../components/ui/SkeletonLoader';
import { FiRepeat, FiArrowRight, FiMapPin, FiCalendar } from 'react-icons/fi';

const WorkerTransfer = () => {
  const { companyId } = useAuth();
  const { addToast } = useToast();
  const [employees, setEmployees] = useState([]);
  const [projects, setProjects] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState('');
  const [toProjectId, setToProjectId] = useState('');

  const fetchData = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [empSnap, projSnap, trSnap] = await Promise.all([
        getDocs(query(collection(db, 'employees'), where('companyId', '==', companyId))),
        getDocs(query(collection(db, 'projects'), where('companyId', '==', companyId))),
        getDocs(query(collection(db, 'employeeTransfers'), where('companyId', '==', companyId))),
      ]);
      setEmployees(empSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setProjects(projSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setTransfers(trSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => {
        const da = a.transferDate?.toDate?.() || new Date(a.transferDate || 0);
        const db2 = b.transferDate?.toDate?.() || new Date(b.transferDate || 0);
        return db2 - da;
      }));
    } catch (err) {
      addToast('Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [companyId]);

  const currentEmp = employees.find(e => e.id === selectedEmp);
  const getProjectName = (id) => projects.find(p => p.id === id)?.projectName || 'Unassigned';
  const getProjectLocation = (id) => projects.find(p => p.id === id)?.location || '';
  const getInitials = (name) => (name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const handleTransfer = async (e) => {
    e.preventDefault();
    if (!selectedEmp || !toProjectId) return;
    if (currentEmp?.currentProjectId === toProjectId) {
      addToast('Employee is already assigned to this project', 'warning');
      return;
    }
    setSaving(true);
    try {
      const fromProjectId = currentEmp?.currentProjectId || '';
      const fromProjectName = getProjectName(fromProjectId);
      const toProjectName = getProjectName(toProjectId);

      await updateDoc(doc(db, 'employees', selectedEmp), {
        currentProjectId: toProjectId,
        currentProjectName: toProjectName,
      });

      if (fromProjectId) {
        await deleteDoc(doc(db, 'projectWorkers', fromProjectId, 'workers', selectedEmp)).catch(() => {});
      }
      await setDoc(doc(db, 'projectWorkers', toProjectId, 'workers', selectedEmp), { active: true });

      await addDoc(collection(db, 'employeeTransfers'), {
        companyId,
        employeeId: selectedEmp,
        employeeName: currentEmp?.fullName,
        fromProjectId,
        fromProjectName,
        toProjectId,
        toProjectName,
        transferDate: serverTimestamp(),
      });

      addToast(`${currentEmp?.fullName} transferred to ${toProjectName}`, 'success');
      setShowModal(false);
      setSelectedEmp('');
      setToProjectId('');
      fetchData();
    } catch (err) {
      addToast('Transfer failed: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="animate-in">
      <div className="page-header">
        <div>
          <h1>Worker Transfers</h1>
          <p style={{ color: 'var(--text)', fontSize: 13, marginTop: 4 }}>Log and manage employee relocations between project sites</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => setShowModal(true)}><FiRepeat /> Transfer Worker</button>
        </div>
      </div>

      <div className="data-card">
        <div className="data-card-header">
          <h3>Transfer History</h3>
        </div>
        
        <div style={{ padding: '24px 32px' }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {[1, 2, 3].map(i => (
                <div key={i} style={{ display: 'flex', gap: 16 }}>
                  <SkeletonLine width="40px" height="40px" style={{ borderRadius: '50%' }} />
                  <div style={{ flex: 1 }}>
                    <SkeletonLine width="150px" height="16px" style={{ marginBottom: 8 }} />
                    <SkeletonLine width="100%" height="60px" style={{ borderRadius: 8 }} />
                  </div>
                </div>
              ))}
            </div>
          ) : transfers.length === 0 ? (
            <EmptyState icon={<FiRepeat />} title="No transfers yet" description="Start transferring workers between projects." />
          ) : (
            <div className="timeline" style={{ marginLeft: 8 }}>
              {transfers.map((t, i) => (
                <div className="timeline-item animate-in" key={t.id} style={{ animationDelay: `${i * 0.05}s` }}>
                  <div className="timeline-dot" style={{ left: -32, top: 0, width: 16, height: 16 }}></div>
                  
                  <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div className={`avatar ${['indigo', 'emerald', 'rose', 'amber', 'cyan'][i % 5]}`}>{getInitials(t.employeeName)}</div>
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text-heading)', fontSize: 15 }}>{t.employeeName}</div>
                      <div style={{ fontSize: 12, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <FiCalendar style={{ opacity: 0.7 }} /> 
                        {t.transferDate?.toDate ? t.transferDate.toDate().toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }) : 'Recently'}
                      </div>
                    </div>
                  </div>

                  <div className="timeline-content" style={{ display: 'flex', alignItems: 'center', padding: '16px 24px', background: '#fafbfd' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text)', fontWeight: 600, marginBottom: 4 }}>From Project</div>
                      <div style={{ fontWeight: 500, color: 'var(--text-heading)' }}>{t.fromProjectName || 'Unassigned'}</div>
                    </div>
                    
                    <div style={{ padding: '0 24px', color: 'var(--primary)', opacity: 0.6, fontSize: 24 }}>
                      <FiArrowRight />
                    </div>
                    
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text)', fontWeight: 600, marginBottom: 4 }}>To Project</div>
                      <div style={{ fontWeight: 600, color: 'var(--success)' }}>{t.toProjectName}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Modal show={showModal} onClose={() => setShowModal(false)} title="Transfer Worker" footer={
        <>
          <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
          <button className="btn btn-primary" form="transferForm" type="submit" disabled={saving}>{saving ? 'Processing...' : 'Confirm Transfer'}</button>
        </>
      }>
        <form id="transferForm" onSubmit={handleTransfer}>
          <div className="form-group">
            <label>Select Employee</label>
            <select className="form-input" value={selectedEmp} onChange={e => setSelectedEmp(e.target.value)} required>
              <option value="">Choose employee...</option>
              {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.fullName}</option>)}
            </select>
          </div>

          {currentEmp && (
            <div className="animate-in" style={{ padding: '16px', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', marginBottom: 20, border: '1px solid var(--border-light)' }}>
              <div style={{ fontSize: 12, color: 'var(--text)', marginBottom: 4 }}>Current Assignment</div>
              <div style={{ fontWeight: 600, color: 'var(--text-heading)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <FiMapPin style={{ color: 'var(--primary)' }} />
                {currentEmp.currentProjectName || 'Unassigned'}
              </div>
            </div>
          )}

          <div className="form-group">
            <label>Transfer To Destination</label>
            <select className="form-input" value={toProjectId} onChange={e => setToProjectId(e.target.value)} required disabled={!selectedEmp}>
              <option value="">Select new project site...</option>
              {projects.filter(p => p.id !== currentEmp?.currentProjectId).map(p => (
                <option key={p.id} value={p.id}>{p.projectName} — {p.location}</option>
              ))}
            </select>
          </div>

          {toProjectId && (
            <div className="animate-in" style={{ padding: '16px', background: 'var(--success-light)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
              <div style={{ fontSize: 13, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 500 }}>
                <FiArrowRight /> Employee will be moved to {getProjectName(toProjectId)}
              </div>
            </div>
          )}
        </form>
      </Modal>
    </div>
  );
};

export default WorkerTransfer;
