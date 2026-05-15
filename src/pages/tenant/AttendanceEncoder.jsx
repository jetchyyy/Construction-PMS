import React, { useState, useEffect } from 'react';
import { db } from '../../firebase/config';
import { collection, query, where, getDocs, setDoc, doc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/ui/ToastContext';
import { format } from 'date-fns';
import { FiCalendar, FiCheck, FiX, FiClock } from 'react-icons/fi';

const AttendanceEncoder = () => {
  const { companyId, currentUser } = useAuth();
  const { addToast } = useToast();
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState('');
  const [employees, setEmployees] = useState([]);
  const [attendanceData, setAttendanceData] = useState({});
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingWorkers, setLoadingWorkers] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!companyId) return;
    const fetchProjects = async () => {
      setLoadingProjects(true);
      try {
        const q = query(collection(db, 'projects'), where('companyId', '==', companyId));
        const snap = await getDocs(q);
        setProjects(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        addToast('Failed to load projects', 'error');
      } finally {
        setLoadingProjects(false);
      }
    };
    fetchProjects();
  }, [companyId]);

  const handleLoadWorkers = async () => {
    if (!projectId) return addToast('Select a project first', 'warning');
    setLoadingWorkers(true);
    try {
      const pwSnap = await getDocs(collection(db, 'projectWorkers', projectId, 'workers'));
      const empIds = pwSnap.docs.map(d => d.id);
      if (empIds.length === 0) {
        setEmployees([]);
        setAttendanceData({});
        addToast('No workers assigned to this project', 'warning');
        return;
      }
      
      const allEmps = [];
      for (let i = 0; i < empIds.length; i += 10) {
        const chunk = empIds.slice(i, i + 10);
        const empSnap = await getDocs(query(collection(db, 'employees'), where('__name__', 'in', chunk)));
        allEmps.push(...empSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
      setEmployees(allEmps);
      
      const initData = {};
      for (const emp of allEmps) {
        try {
          const attDoc = await getDocs(collection(db, 'attendance', companyId, 'projects', projectId, 'dates', date, 'records'));
          const existing = attDoc.docs.find(d => d.id === emp.id);
          if (existing) {
            initData[emp.id] = existing.data();
          } else {
            initData[emp.id] = { status: 'present', overtimeHours: 0, remarks: '' };
          }
        } catch {
          initData[emp.id] = { status: 'present', overtimeHours: 0, remarks: '' };
        }
      }
      setAttendanceData(initData);
      addToast(`Loaded ${allEmps.length} workers`, 'success');
    } catch (err) {
      addToast('Error loading workers', 'error');
    } finally {
      setLoadingWorkers(false);
    }
  };

  const handleStatusChange = (empId, status) => {
    setAttendanceData(prev => ({ ...prev, [empId]: { ...prev[empId], status } }));
  };

  const handleOTChange = (empId, ot) => {
    setAttendanceData(prev => ({ ...prev, [empId]: { ...prev[empId], overtimeHours: Number(ot) } }));
  };

  const handleRemarksChange = (empId, remarks) => {
    setAttendanceData(prev => ({ ...prev, [empId]: { ...prev[empId], remarks } }));
  };

  const handleBatchSave = async () => {
    if (employees.length === 0) return;
    setSaving(true);
    try {
      const promises = employees.map(emp => {
        const att = attendanceData[emp.id];
        const docRef = doc(db, 'attendance', companyId, 'projects', projectId, 'dates', date, 'records', emp.id);
        return setDoc(docRef, {
          status: att.status,
          overtimeHours: att.overtimeHours,
          remarks: att.remarks || '',
          encodedBy: currentUser?.uid || 'system',
          timestamp: serverTimestamp()
        });
      });
      await Promise.all(promises);
      addToast('Attendance saved successfully!', 'success');
    } catch (err) {
      addToast('Error saving attendance', 'error');
    } finally {
      setSaving(false);
    }
  };

  const getToggleClass = (empId, status) => {
    const current = attendanceData[empId]?.status;
    if (current === status) {
      if (status === 'present') return 'toggle-btn present-active';
      if (status === 'half-day') return 'toggle-btn halfday-active';
      if (status === 'absent') return 'toggle-btn absent-active';
    }
    return 'toggle-btn';
  };

  const getInitials = (name) => (name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  // Calculate summary
  const summary = { present: 0, half: 0, absent: 0 };
  Object.values(attendanceData).forEach(att => {
    if (att.status === 'present') summary.present++;
    else if (att.status === 'half-day') summary.half++;
    else if (att.status === 'absent') summary.absent++;
  });

  return (
    <div className="animate-in">
      <div className="page-header">
        <div>
          <h1>Attendance Encoder</h1>
          <p style={{ color: 'var(--text)', fontSize: 13, marginTop: 4 }}>Record daily time and overtime for your workers</p>
        </div>
      </div>

      <div className="data-card" style={{ marginBottom: 24, padding: 24 }}>
        <div className="form-row" style={{ gridTemplateColumns: '1fr 2fr auto', gap: 16, alignItems: 'end' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label><FiCalendar style={{ marginRight: 6 }} />Date</label>
            <input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Project Site</label>
            <select className="form-input" value={projectId} onChange={e => setProjectId(e.target.value)} disabled={loadingProjects}>
              <option value="">{loadingProjects ? 'Loading projects...' : 'Select a project'}</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.projectName} — {p.location}</option>)}
            </select>
          </div>
          <button className="btn btn-primary" onClick={handleLoadWorkers} disabled={loadingWorkers} style={{ height: 42 }}>
            {loadingWorkers ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Loading...</> : 'Load Workers'}
          </button>
        </div>
      </div>

      {employees.length > 0 && (
        <div className="attendance-summary animate-in">
          <div className="summary-box present">
            <div>
              <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600, textTransform: 'uppercase' }}>Present</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-heading)' }}>{summary.present}</div>
            </div>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--success-light)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
              <FiCheck />
            </div>
          </div>
          <div className="summary-box half">
            <div>
              <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600, textTransform: 'uppercase' }}>Half-day</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-heading)' }}>{summary.half}</div>
            </div>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--warning-light)', color: 'var(--warning)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
              <span style={{ fontWeight: 600 }}>½</span>
            </div>
          </div>
          <div className="summary-box absent">
            <div>
              <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600, textTransform: 'uppercase' }}>Absent</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-heading)' }}>{summary.absent}</div>
            </div>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--danger-light)', color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
              <FiX />
            </div>
          </div>
        </div>
      )}

      <div className="data-card">
        <div className="data-card-header">
          <h3>Attendance Sheet</h3>
          {employees.length > 0 && <span className="status-badge active">{employees.length} workers loaded</span>}
        </div>
        <table className="data-table">
          <thead><tr><th>Employee</th><th>Attendance Status</th><th>OT (Hrs)</th><th>Remarks</th></tr></thead>
          <tbody>
            {employees.length === 0 ? (
              <tr><td colSpan="4" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text)' }}>
                <div style={{ fontSize: 40, opacity: 0.2, marginBottom: 16 }}><FiClock /></div>
                Select a project and click "Load Workers" to begin encoding attendance for {new Date(date).toLocaleDateString()}.
              </td></tr>
            ) : employees.map((emp, i) => (
              <tr key={emp.id} className="animate-in" style={{ animationDelay: `${i * 0.03}s` }}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div className={`avatar ${['indigo', 'emerald', 'rose', 'amber', 'cyan'][i % 5]}`}>{getInitials(emp.fullName)}</div>
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text-heading)' }}>{emp.fullName}</div>
                      <div style={{ fontSize: 11, color: 'var(--text)', textTransform: 'capitalize' }}>{emp.role}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <div className="toggle-group">
                    <button className={getToggleClass(emp.id, 'present')} onClick={() => handleStatusChange(emp.id, 'present')}><FiCheck style={{ marginRight: 4 }}/>Present</button>
                    <button className={getToggleClass(emp.id, 'half-day')} onClick={() => handleStatusChange(emp.id, 'half-day')}>½ Half-day</button>
                    <button className={getToggleClass(emp.id, 'absent')} onClick={() => handleStatusChange(emp.id, 'absent')}><FiX style={{ marginRight: 4 }}/>Absent</button>
                  </div>
                </td>
                <td>
                  <input
                    type="number"
                    className="form-input"
                    style={{ width: 80, padding: '8px 12px', background: attendanceData[emp.id]?.status === 'absent' ? 'var(--bg)' : '#fff' }}
                    value={attendanceData[emp.id]?.overtimeHours || ''}
                    onChange={e => handleOTChange(emp.id, e.target.value)}
                    disabled={attendanceData[emp.id]?.status === 'absent'}
                    min="0"
                    step="0.5"
                    placeholder="0"
                  />
                </td>
                <td>
                  <input
                    type="text"
                    className="form-input"
                    style={{ minWidth: 150, padding: '8px 12px' }}
                    placeholder="Notes or reason..."
                    value={attendanceData[emp.id]?.remarks || ''}
                    onChange={e => handleRemarksChange(emp.id, e.target.value)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {employees.length > 0 && (
          <div style={{ padding: '20px 24px', borderTop: '1px solid var(--border-light)', display: 'flex', justifyContent: 'flex-end', background: '#fafbfd' }}>
            <button className="btn btn-success btn-lg" onClick={handleBatchSave} disabled={saving} style={{ padding: '12px 32px' }}>
              {saving ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Saving Sheet...</> : <><FiCheck /> Save Attendance</>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AttendanceEncoder;
