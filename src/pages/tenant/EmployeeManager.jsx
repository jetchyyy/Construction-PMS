import React, { useState, useEffect } from 'react';
import { db } from '../../firebase/config';
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, setDoc, collectionGroup } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/ui/ToastContext';
import Modal from '../../components/ui/Modal';
import EmptyState from '../../components/ui/EmptyState';
import { SkeletonTable } from '../../components/ui/SkeletonLoader';
import { FiPlus, FiEdit2, FiTrash2, FiSearch, FiUsers, FiTool, FiUser, FiBriefcase, FiPower, FiEye } from 'react-icons/fi';

const capitalizeWords = (str) => (str || '').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

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
  const [form, setForm] = useState({ fullName: '', role: 'worker', rateType: 'daily', dailyRate: '', hourlyRate: '', payrollType: 'weekly', currentProjectId: '' });
  const [isCustomRole, setIsCustomRole] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [viewingEmployee, setViewingEmployee] = useState(null);
  const [viewingLogs, setViewingLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [viewingTransfers, setViewingTransfers] = useState([]);
  const [activeViewTab, setActiveViewTab] = useState('attendance');
  const [showClearTransfersConfirm, setShowClearTransfersConfirm] = useState(false);

  const availableRoles = React.useMemo(() => {
    const defaultRoles = ['worker', 'foreman', 'engineer'];
    const existingRoles = employees.map(e => e.role?.toLowerCase()?.trim()).filter(Boolean);
    const all = Array.from(new Set([...defaultRoles, ...existingRoles]));
    return all.sort();
  }, [employees]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

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
    setForm({ fullName: '', role: 'worker', rateType: 'daily', dailyRate: '', hourlyRate: '', payrollType: 'weekly', currentProjectId: '', status: 'active' });
    setIsCustomRole(false);
    setShowModal(true);
  };

  const openEdit = (emp) => {
    setEditing(emp);
    setIsCustomRole(false);
    setForm({
      fullName: emp.fullName,
      role: emp.role,
      rateType: emp.rateType || 'daily',
      dailyRate: emp.rateType === 'hourly' ? '' : emp.dailyRate || '',
      hourlyRate: emp.rateType === 'hourly' ? emp.hourlyRate || '' : '',
      payrollType: emp.payrollType,
      currentProjectId: emp.currentProjectId || '',
      status: emp.status || 'active'
    });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const projName = projects.find(p => p.id === form.currentProjectId)?.projectName || '';
      const isDaily = form.rateType === 'daily';
      const dailyRateVal = isDaily ? Number(form.dailyRate) : Number(form.hourlyRate) * 8;
      const hourlyRateVal = isDaily ? Number(form.dailyRate) / 8 : Number(form.hourlyRate);

      const data = {
        companyId,
        fullName: form.fullName,
        role: (form.role || '').trim().toLowerCase(),
        rateType: form.rateType,
        dailyRate: dailyRateVal,
        hourlyRate: hourlyRateVal,
        payrollType: form.payrollType,
        currentProjectId: form.currentProjectId,
        currentProjectName: projName,
        status: editing ? form.status : 'active',
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

  const handleViewDetails = async (emp) => {
    setViewingEmployee(emp);
    setViewingLogs([]);
    setViewingTransfers([]);
    setActiveViewTab('attendance');
    setLoadingLogs(true);
    try {
      const [recordsSnap, transfersSnap] = await Promise.all([
        getDocs(query(
          collectionGroup(db, 'records'),
          where('companyId', '==', companyId),
          where('employeeId', '==', emp.id)
        )),
        getDocs(query(
          collection(db, 'employeeTransfers'),
          where('companyId', '==', companyId),
          where('employeeId', '==', emp.id)
        ))
      ]);
      
      const logs = recordsSnap.docs.map(docSnap => {
        const data = docSnap.data();
        const parts = docSnap.ref.path.split('/');
        const projectId = data.projectId || parts[3];
        const date = data.date || parts[5];
        return {
          id: docSnap.id,
          ...data,
          projectId,
          date
        };
      });
      logs.sort((a, b) => b.date.localeCompare(a.date));
      setViewingLogs(logs);

      const transfersList = transfersSnap.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data
        };
      }).sort((a, b) => {
        const da = a.transferDate?.toDate?.() || new Date(a.transferDate || 0);
        const db2 = b.transferDate?.toDate?.() || new Date(b.transferDate || 0);
        return db2 - da;
      });
      setViewingTransfers(transfersList);

    } catch (err) {
      console.error('Error in handleViewDetails:', err);
      addToast('Failed to load employee details', 'error');
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleClearTransfers = async () => {
    if (!viewingEmployee) return;
    try {
      const q = query(
        collection(db, 'employeeTransfers'),
        where('companyId', '==', companyId),
        where('employeeId', '==', viewingEmployee.id)
      );
      const snap = await getDocs(q);
      const promises = snap.docs.map(docSnap => deleteDoc(docSnap.ref));
      await Promise.all(promises);
      setViewingTransfers([]);
      setShowClearTransfersConfirm(false);
      addToast('Project transfer history cleared', 'success');
    } catch (err) {
      addToast('Failed to clear history: ' + err.message, 'error');
    }
  };

  const stats = React.useMemo(() => {
    if (!viewingLogs.length) {
      return {
        week: { present: 0, halfDay: 0, absent: 0, hours: 0, ot: 0 },
        month: { present: 0, halfDay: 0, absent: 0, hours: 0, ot: 0 },
        kinsenas: { present: 0, halfDay: 0, absent: 0, hours: 0, ot: 0 },
        total: { present: 0, halfDay: 0, absent: 0, hours: 0, ot: 0 },
        ranges: { week: '', month: '', kinsenas: '' }
      };
    }
    const today = new Date();
    
    const formatDateToISO = (d) => {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    };
    
    const getWeekRange = (dateInput) => {
      const d = new Date(dateInput);
      const day = d.getDay();
      const diff = d.getDate() - day;
      const start = new Date(d.setDate(diff));
      start.setHours(0,0,0,0);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23,59,59,999);
      return { start, end };
    };
    
    const getMonthRange = (dateInput) => {
      const d = new Date(dateInput);
      return {
        start: new Date(d.getFullYear(), d.getMonth(), 1),
        end: new Date(d.getFullYear(), d.getMonth() + 1, 0)
      };
    };
    
    const getKinsenasRange = (d) => {
      const year = d.getFullYear();
      const month = d.getMonth();
      const date = d.getDate();
      if (date <= 15) {
        return {
          start: new Date(year, month, 1),
          end: new Date(year, month, 15)
        };
      } else {
        return {
          start: new Date(year, month, 16),
          end: new Date(year, month + 1, 0)
        };
      }
    };

    const week = getWeekRange(today);
    const month = getMonthRange(today);
    const kinsenas = getKinsenasRange(today);

    const weekStart = formatDateToISO(week.start);
    const weekEnd = formatDateToISO(week.end);
    const monthStart = formatDateToISO(month.start);
    const monthEnd = formatDateToISO(month.end);
    const kinsenasStart = formatDateToISO(kinsenas.start);
    const kinsenasEnd = formatDateToISO(kinsenas.end);

    const s = {
      week: { present: 0, halfDay: 0, absent: 0, hours: 0, ot: 0 },
      month: { present: 0, halfDay: 0, absent: 0, hours: 0, ot: 0 },
      kinsenas: { present: 0, halfDay: 0, absent: 0, hours: 0, ot: 0 },
      total: { present: 0, halfDay: 0, absent: 0, hours: 0, ot: 0 }
    };

    viewingLogs.forEach(log => {
      const status = log.status || 'present';
      const hours = Number(log.hoursWorked || 0);
      const ot = Number(log.overtimeHours || 0);
      const d = log.date;

      const addLog = (period) => {
        if (status === 'present') period.present++;
        else if (status === 'half-day') period.halfDay++;
        else if (status === 'absent') period.absent++;
        period.hours += hours;
        period.ot += ot;
      };

      addLog(s.total);

      if (d >= weekStart && d <= weekEnd) {
        addLog(s.week);
      }
      if (d >= monthStart && d <= monthEnd) {
        addLog(s.month);
      }
      if (d >= kinsenasStart && d <= kinsenasEnd) {
        addLog(s.kinsenas);
      }
    });

    const formatRangeLabel = (start, end) => {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const parse = (str) => {
        const [y, m, d] = str.split('-').map(Number);
        return { year: y, month: months[m-1], day: d };
      };
      const sP = parse(start);
      const eP = parse(end);
      if (sP.year === eP.year) {
        if (sP.month === eP.month) {
          return `${sP.month} ${sP.day}-${eP.day}, ${sP.year}`;
        }
        return `${sP.month} ${sP.day} - ${eP.month} ${eP.day}, ${sP.year}`;
      }
      return `${sP.month} ${sP.day}, ${sP.year} - ${eP.month} ${eP.day}, ${eP.year}`;
    };

    return {
      ...s,
      ranges: {
        week: formatRangeLabel(weekStart, weekEnd),
        month: formatRangeLabel(monthStart, monthEnd),
        kinsenas: formatRangeLabel(kinsenasStart, kinsenasEnd)
      }
    };
  }, [viewingLogs]);

  const toggleStatus = async (emp) => {
    try {
      const newStatus = emp.status === 'active' ? 'inactive' : 'active';
      await updateDoc(doc(db, 'employees', emp.id), { status: newStatus });
      addToast(`Employee "${emp.fullName}" status updated to ${newStatus}`, 'success');
      fetchData();
    } catch (err) {
      addToast('Error updating status: ' + err.message, 'error');
    }
  };

  const filtered = employees.filter(e => e.fullName?.toLowerCase().includes(search.toLowerCase()));
  const getInitials = (name) => (name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginatedEmployees = React.useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filtered.slice(start, start + itemsPerPage);
  }, [filtered, currentPage]);

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
          <thead><tr><th>Employee</th><th>Role</th><th>Rate</th><th>Assignment</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {loading ? <SkeletonTable cols={6} rows={5} /> : paginatedEmployees.length === 0 ? (
              <tr><td colSpan="6"><EmptyState icon={<FiUsers />} title="No employees" description={search ? 'No matches found.' : 'Add your first employee.'} /></td></tr>
            ) : paginatedEmployees.map((emp, i) => (
              <tr key={emp.id} className="animate-in" style={{ animationDelay: `${(i % itemsPerPage) * 0.03}s` }}>
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
                 <td style={{ fontWeight: 500 }}>
                  {emp.rateType === 'hourly' ? (
                    <span>₱{Number(emp.hourlyRate || 0).toLocaleString()}<span style={{ fontSize: 11, color: 'var(--text-light)', fontWeight: 400 }}>/hr</span></span>
                  ) : (
                    <span>₱{Number(emp.dailyRate || 0).toLocaleString()}<span style={{ fontSize: 11, color: 'var(--text-light)', fontWeight: 400 }}>/day</span></span>
                  )}
                </td>
                <td>{emp.currentProjectName ? <span style={{ background: 'var(--bg)', padding: '4px 10px', borderRadius: 6, fontSize: 12, border: '1px solid var(--border-light)' }}>{emp.currentProjectName}</span> : <span style={{ color: 'var(--text)', opacity: 0.5, fontSize: 12 }}>Unassigned</span>}</td>
                <td>
                  <span className={`status-badge ${emp.status}`}>
                    {emp.status === 'active' && <span className="pulse-dot" style={{ width: 6, height: 6, marginRight: 4 }}></span>}
                    {emp.status}
                  </span>
                </td>
                <td className="actions">
                  <button className="btn btn-sm btn-ghost" onClick={() => handleViewDetails(emp)} title="View Details" style={{ color: 'var(--primary)' }}><FiEye /></button>
                  <button 
                    className="btn btn-sm btn-ghost" 
                    onClick={() => toggleStatus(emp)} 
                    title={emp.status === 'active' ? 'Deactivate Employee' : 'Activate Employee'}
                    style={{ color: emp.status === 'active' ? 'var(--success)' : 'var(--text-light)' }}
                  >
                    <FiPower />
                  </button>
                  <button className="btn btn-sm btn-ghost" onClick={() => openEdit(emp)} title="Edit"><FiEdit2 /></button>
                  <button className="btn btn-sm btn-ghost" onClick={() => setDeleteConfirm(emp)} title="Delete" style={{ color: 'var(--danger)' }}><FiTrash2 /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {totalPages > 1 && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px 24px', borderTop: '1px solid var(--border-light)',
            flexWrap: 'wrap', gap: 12
          }}>
            <div style={{ fontSize: 13, color: 'var(--text)' }}>
              Showing <strong style={{ color: 'var(--text-heading)' }}>{((currentPage - 1) * itemsPerPage) + 1}</strong> to <strong style={{ color: 'var(--text-heading)' }}>{Math.min(currentPage * itemsPerPage, filtered.length)}</strong> of <strong style={{ color: 'var(--text-heading)' }}>{filtered.length}</strong> employees
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
              {isCustomRole ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  <input 
                    className="form-input" 
                    value={form.role} 
                    onChange={e => setForm({...form, role: e.target.value})} 
                    required 
                    placeholder="Enter custom role (e.g. Carpenter)" 
                  />
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    onClick={() => {
                      setIsCustomRole(false);
                      setForm({...form, role: 'worker'});
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
                  value={form.role} 
                  onChange={e => {
                    if (e.target.value === 'ADD_CUSTOM') {
                      setIsCustomRole(true);
                      setForm({...form, role: ''});
                    } else {
                      setForm({...form, role: e.target.value});
                    }
                  }}
                >
                  {availableRoles.map(role => (
                    <option key={role} value={role} style={{ textTransform: 'capitalize' }}>
                      {capitalizeWords(role)}
                    </option>
                  ))}
                  <option value="ADD_CUSTOM" style={{ color: 'var(--primary)', fontWeight: 600 }}>+ Add Custom Role...</option>
                </select>
              )}
            </div>
            <div className="form-group">
              <label>Payroll Type</label>
              <select className="form-input" value={form.payrollType} onChange={e => setForm({...form, payrollType: e.target.value})}>
                <option value="weekly">Weekly</option>
                <option value="kinsenas">Kinsenas</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Rate Type</label>
              <select className="form-input" value={form.rateType} onChange={e => setForm({...form, rateType: e.target.value})}>
                <option value="daily">Daily Rate</option>
                <option value="hourly">Hourly Rate</option>
              </select>
            </div>
            {form.rateType === 'hourly' ? (
              <div className="form-group">
                <label>Hourly Rate (₱)</label>
                <input type="number" className="form-input" value={form.hourlyRate} onChange={e => setForm({...form, hourlyRate: e.target.value})} required min="0.01" step="any" placeholder="0.00" />
              </div>
            ) : (
              <div className="form-group">
                <label>Daily Rate (₱)</label>
                <input type="number" className="form-input" value={form.dailyRate} onChange={e => setForm({...form, dailyRate: e.target.value})} required min="0.01" step="any" placeholder="0.00" />
              </div>
            )}
          </div>
          <div className="form-group">
            <label>Project Assignment</label>
            <select className="form-input" value={form.currentProjectId} onChange={e => setForm({...form, currentProjectId: e.target.value})}>
              <option value="">Unassigned</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.projectName}</option>)}
            </select>
            <span style={{ fontSize: 11, color: 'var(--text)', display: 'block', marginTop: 4 }}>You can change this later using Worker Transfers.</span>
          </div>
          {editing && (
            <div className="form-group">
              <label>Status</label>
              <select className="form-input" value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          )}
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

      <Modal 
        show={!!viewingEmployee} 
        onClose={() => setViewingEmployee(null)} 
        title="Employee Work Profile & History" 
        size="lg"
        footer={<button className="btn btn-secondary" onClick={() => setViewingEmployee(null)}>Close Profile</button>}
      >
        {viewingEmployee && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Employee Quick Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, background: 'var(--bg)', padding: '16px 20px', borderRadius: 12, border: '1px solid var(--border-light)' }}>
              <div className="avatar emerald" style={{ width: 56, height: 56, fontSize: 20 }}>{getInitials(viewingEmployee.fullName)}</div>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-heading)', margin: 0 }}>{viewingEmployee.fullName}</h3>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
                  <span className="role-badge" style={{ margin: 0 }}>
                    {viewingEmployee.role === 'worker' ? <FiTool /> : viewingEmployee.role === 'foreman' ? <FiUser /> : <FiBriefcase />}
                    <span style={{ textTransform: 'capitalize' }}>{viewingEmployee.role}</span>
                  </span>
                  <span style={{ fontSize: 13, color: 'var(--text)' }}>
                    Payroll: <strong style={{ textTransform: 'capitalize' }}>{viewingEmployee.payrollType}</strong>
                  </span>
                  <span style={{ fontSize: 13, color: 'var(--text)' }}>
                    Rate: <strong>₱{Number(viewingEmployee.rateType === 'hourly' ? viewingEmployee.hourlyRate : viewingEmployee.dailyRate).toLocaleString()}/{viewingEmployee.rateType === 'hourly' ? 'hr' : 'day'}</strong>
                  </span>
                  <span style={{ fontSize: 13, color: 'var(--text)' }}>
                    Current Site: <strong>{viewingEmployee.currentProjectName || 'Unassigned'}</strong>
                  </span>
                </div>
              </div>
            </div>

            {/* Tab Navigation */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-light)', gap: 16 }}>
              <button 
                onClick={() => setActiveViewTab('attendance')} 
                style={{
                  padding: '8px 16px',
                  background: 'none',
                  border: 'none',
                  borderBottom: activeViewTab === 'attendance' ? '2px solid var(--primary)' : '2px solid transparent',
                  color: activeViewTab === 'attendance' ? 'var(--primary)' : 'var(--text)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                Attendance & Stats
              </button>
              <button 
                onClick={() => setActiveViewTab('transfers')} 
                style={{
                  padding: '8px 16px',
                  background: 'none',
                  border: 'none',
                  borderBottom: activeViewTab === 'transfers' ? '2px solid var(--primary)' : '2px solid transparent',
                  color: activeViewTab === 'transfers' ? 'var(--primary)' : 'var(--text)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                Project Assignment History
              </button>
            </div>

            {/* Tab 1: Attendance Logs & Stats */}
            {activeViewTab === 'attendance' && (
              <>
                {/* Quick Stats Grid */}
                <div>
                  <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-heading)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Attendance Summary</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                    
                    {/* This Week */}
                    <div className="summary-box present" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: 16, height: 'auto', gap: 6, background: '#f8fafc', border: '1px solid var(--border-light)' }}>
                      <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text)' }}>This Week</div>
                      <div style={{ fontSize: 10, color: 'var(--text-light)', marginTop: -4 }}>{stats.ranges.week}</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-heading)', marginTop: 4 }}>
                        {stats.week.present + stats.week.halfDay} <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>days worked</span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text)' }}>
                        Hours: <strong>{stats.week.hours} hrs</strong> {stats.week.ot > 0 && <span style={{ color: 'var(--success)' }}>(+{stats.week.ot} hrs OT)</span>}
                      </div>
                      {stats.week.absent > 0 && (
                        <div style={{ fontSize: 11, color: 'var(--danger)' }}>{stats.week.absent} day(s) absent</div>
                      )}
                    </div>

                    {/* This Month */}
                    <div className="summary-box present" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: 16, height: 'auto', gap: 6, background: '#f8fafc', border: '1px solid var(--border-light)' }}>
                      <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text)' }}>This Month</div>
                      <div style={{ fontSize: 10, color: 'var(--text-light)', marginTop: -4 }}>{stats.ranges.month}</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-heading)', marginTop: 4 }}>
                        {stats.month.present + stats.month.halfDay} <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>days worked</span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text)' }}>
                        Hours: <strong>{stats.month.hours} hrs</strong> {stats.month.ot > 0 && <span style={{ color: 'var(--success)' }}>(+{stats.month.ot} hrs OT)</span>}
                      </div>
                      {stats.month.absent > 0 && (
                        <div style={{ fontSize: 11, color: 'var(--danger)' }}>{stats.month.absent} day(s) absent</div>
                      )}
                    </div>

                    {/* This Kinsenas */}
                    <div className="summary-box present" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: 16, height: 'auto', gap: 6, background: '#f8fafc', border: '1px solid var(--border-light)' }}>
                      <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text)' }}>This Kinsenas</div>
                      <div style={{ fontSize: 10, color: 'var(--text-light)', marginTop: -4 }}>{stats.ranges.kinsenas}</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-heading)', marginTop: 4 }}>
                        {stats.kinsenas.present + stats.kinsenas.halfDay} <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>days worked</span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text)' }}>
                        Hours: <strong>{stats.kinsenas.hours} hrs</strong> {stats.kinsenas.ot > 0 && <span style={{ color: 'var(--success)' }}>(+{stats.kinsenas.ot} hrs OT)</span>}
                      </div>
                      {stats.kinsenas.absent > 0 && (
                        <div style={{ fontSize: 11, color: 'var(--danger)' }}>{stats.kinsenas.absent} day(s) absent</div>
                      )}
                    </div>

                    {/* All Time */}
                    <div className="summary-box present" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: 16, height: 'auto', gap: 6, background: '#f8fafc', border: '1px solid var(--border-light)' }}>
                      <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text)' }}>Total All-Time</div>
                      <div style={{ fontSize: 10, color: 'var(--text-light)', marginTop: -4 }}>Across all records</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-heading)', marginTop: 4 }}>
                        {stats.total.present + stats.total.halfDay} <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>days worked</span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text)' }}>
                        Hours: <strong>{stats.total.hours} hrs</strong> {stats.total.ot > 0 && <span style={{ color: 'var(--success)' }}>(+{stats.total.ot} hrs OT)</span>}
                      </div>
                      {stats.total.absent > 0 && (
                        <div style={{ fontSize: 11, color: 'var(--danger)' }}>{stats.total.absent} day(s) absent</div>
                      )}
                    </div>

                  </div>
                </div>

                {/* Recent Work Logs */}
                <div>
                  <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-heading)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Recent Work Logs ({viewingLogs.length})</h4>
                  <div style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid var(--border-light)', borderRadius: 12 }}>
                    {loadingLogs ? (
                      <div style={{ textAlign: 'center', padding: '40px 0' }}>
                        <span className="spinner spinner-md" />
                        <p style={{ color: 'var(--text)', marginTop: 8, fontSize: 13 }}>Loading work logs...</p>
                      </div>
                    ) : viewingLogs.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text)' }}>
                        No work history recorded yet.
                      </div>
                    ) : (
                      <table className="data-table" style={{ fontSize: 12 }}>
                        <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                          <tr>
                            <th>Date</th>
                            <th>Project Site</th>
                            <th>Status</th>
                            <th>Hours Worked</th>
                            <th>OT (Hrs)</th>
                            <th>Remarks</th>
                          </tr>
                        </thead>
                        <tbody>
                          {viewingLogs.map((log) => {
                            const projName = projects.find(p => p.id === log.projectId)?.projectName || 'Unknown Site';
                            return (
                              <tr key={log.id}>
                                <td style={{ fontWeight: 600 }}>{log.date}</td>
                                <td>{projName}</td>
                                <td>
                                  <span className={`status-badge ${log.status === 'present' ? 'active' : log.status === 'half-day' ? 'draft' : 'inactive'}`} style={{ textTransform: 'capitalize' }}>
                                    {log.status}
                                  </span>
                                </td>
                                <td style={{ fontWeight: 600 }}>{log.hoursWorked || 0} hrs</td>
                                <td style={{ fontWeight: 600 }}>{log.overtimeHours || 0} hrs</td>
                                <td style={{ color: log.status === 'absent' ? 'var(--danger)' : 'var(--text)' }}>{log.remarks || '—'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Tab 2: Project Transfer History */}
            {activeViewTab === 'transfers' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-heading)', margin: 0, textTransform: 'uppercase', letterSpacing: 0.5 }}>Assigned Project History ({viewingTransfers.length})</h4>
                  {viewingTransfers.length > 0 && (
                    <button 
                      className="btn btn-sm btn-ghost" 
                      style={{ color: 'var(--danger)', fontSize: 12, padding: '4px 8px' }} 
                      onClick={() => setShowClearTransfersConfirm(true)}
                    >
                      Clear Transfer History
                    </button>
                  )}
                </div>

                <div style={{ maxHeight: 350, overflowY: 'auto', border: '1px solid var(--border-light)', borderRadius: 12, padding: 20, background: '#fafbfd' }}>
                  {loadingLogs ? (
                    <div style={{ textAlign: 'center', padding: '40px 0' }}>
                      <span className="spinner spinner-md" />
                      <p style={{ color: 'var(--text)', marginTop: 8, fontSize: 13 }}>Loading transfer history...</p>
                    </div>
                  ) : viewingTransfers.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text)' }}>
                      No assignment transfers recorded yet. Current project is: <strong>{viewingEmployee.currentProjectName || 'Unassigned'}</strong>.
                    </div>
                  ) : (
                    <div className="timeline" style={{ marginLeft: 8 }}>
                      {viewingTransfers.map((t, idx) => (
                        <div className="timeline-item" key={t.id} style={{ borderLeft: '2px solid var(--border-light)', paddingLeft: 20, pb: 20, position: 'relative', marginBottom: 20 }}>
                          <div 
                            className="timeline-dot" 
                            style={{ 
                              position: 'absolute', 
                              left: -9, 
                              top: 2, 
                              width: 16, 
                              height: 16, 
                              borderRadius: '50%', 
                              background: 'var(--primary)',
                              border: '4px solid #fff',
                              boxShadow: '0 0 0 1px var(--border-light)'
                            }}
                          />
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600 }}>
                              {t.transferDate?.toDate ? t.transferDate.toDate().toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Recently'}
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 16px', background: '#fff', borderRadius: 8, border: '1px solid var(--border-light)' }}>
                            <div style={{ flex: 1 }}>
                              <span style={{ fontSize: 10, color: 'var(--text-light)', textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>From</span>
                              <span style={{ fontWeight: 500, color: 'var(--text-heading)', fontSize: 13 }}>{t.fromProjectName || 'Unassigned'}</span>
                            </div>
                            <FiArrowRight style={{ color: 'var(--primary)', opacity: 0.6, fontSize: 16 }} />
                            <div style={{ flex: 1 }}>
                              <span style={{ fontSize: 10, color: 'var(--text-light)', textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>To</span>
                              <span style={{ fontWeight: 600, color: 'var(--success)', fontSize: 13 }}>{t.toProjectName}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>
        )}
      </Modal>

      <Modal
        show={showClearTransfersConfirm}
        onClose={() => setShowClearTransfersConfirm(false)}
        title="Clear Transfer History"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowClearTransfersConfirm(false)}>Cancel</button>
            <button className="btn btn-danger" onClick={handleClearTransfers}>Yes, Clear All</button>
          </>
        }
      >
        <p>Are you sure you want to clear all project transfer logs for <strong>{viewingEmployee?.fullName}</strong>? This action cannot be undone.</p>
      </Modal>
    </div>
  );
};

export default EmployeeManager;
