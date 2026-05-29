import React, { useState, useEffect } from 'react';
import { db } from '../../firebase/config';
import { collection, query, where, getDocs, collectionGroup, updateDoc, doc } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/ui/ToastContext';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths, isSameDay, parseISO } from 'date-fns';
import { FiCalendar, FiClock, FiPrinter, FiCheck, FiX, FiInfo, FiChevronLeft, FiChevronRight, FiUser, FiArrowRight } from 'react-icons/fi';

const AttendanceTracker = () => {
  const { companyId } = useAuth();
  const { addToast } = useToast();

  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  
  const [employees, setEmployees] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState({});
  const [hasAttendance, setHasAttendance] = useState(false);

  // Fetch projects
  useEffect(() => {
    if (!companyId) return;
    const fetchProjects = async () => {
      setLoadingProjects(true);
      try {
        const q = query(collection(db, 'projects'), where('companyId', '==', companyId));
        const snap = await getDocs(q);
        const projs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setProjects(projs);
        if (projs.length > 0) {
          setProjectId(projs[0].id);
        }
      } catch (err) {
        addToast('Failed to load projects', 'error');
      } finally {
        setLoadingProjects(false);
      }
    };
    fetchProjects();
  }, [companyId]);

  // Fetch attendance records for selected project and selected date
  const fetchAttendanceForDate = async (targetDate) => {
    if (!projectId) return;
    setLoadingData(true);
    const dateStr = format(targetDate, 'yyyy-MM-dd');
    try {
      // 1. Get project workers
      const pwSnap = await getDocs(collection(db, 'projectWorkers', projectId, 'workers'));
      const empIds = pwSnap.docs.map(d => d.id);
      
      if (empIds.length === 0) {
        setEmployees([]);
        setAttendanceRecords({});
        setHasAttendance(false);
        return;
      }

      // 2. Fetch employee details
      const allEmps = [];
      for (let i = 0; i < empIds.length; i += 10) {
        const chunk = empIds.slice(i, i + 10);
        const empSnap = await getDocs(query(collection(db, 'employees'), where('__name__', 'in', chunk)));
        allEmps.push(...empSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
      setEmployees(allEmps);

      // 3. Fetch attendance records
      const attSnap = await getDocs(collection(db, 'attendance', companyId, 'projects', projectId, 'dates', dateStr, 'records'));
      const records = {};
      
      if (!attSnap.empty) {
        setHasAttendance(true);
        for (const docSnap of attSnap.docs) {
          const data = docSnap.data();
          records[docSnap.id] = data;
          
          // Auto-healing migration
          if (!data.companyId || !data.employeeId || !data.projectId || !data.date) {
            await updateDoc(docSnap.ref, {
              companyId,
              employeeId: docSnap.id,
              projectId,
              date: dateStr
            }).catch(e => console.error("Auto-healing error:", e));
          }
        }
      } else {
        setHasAttendance(false);
      }
      setAttendanceRecords(records);
    } catch (err) {
      addToast('Error loading attendance logs', 'error');
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (projectId && selectedDate) {
      fetchAttendanceForDate(selectedDate);
    }
  }, [projectId, selectedDate]);

  // Calendar Helpers
  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth)
  });
  
  const startDayOfWeek = getDay(daysInMonth[0]);
  const blankDays = Array(startDayOfWeek).fill(null);

  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  const activeMonthStr = format(currentMonth, 'yyyy-MM');
  const monthLogs = React.useMemo(() => {
    return employeeRecords.filter(r => r.date.startsWith(activeMonthStr));
  }, [employeeRecords, activeMonthStr]);

  const monthlyStats = React.useMemo(() => {
    const stats = { present: 0, halfDay: 0, absent: 0, hours: 0, ot: 0 };
    monthLogs.forEach(r => {
      if (r.status === 'present') stats.present++;
      else if (r.status === 'half-day') stats.halfDay++;
      else if (r.status === 'absent') stats.absent++;
      stats.hours += Number(r.hoursWorked || 0);
      stats.ot += Number(r.overtimeHours || 0);
    });
    return stats;
  }, [monthLogs]);

  const selectedEmployee = allCompanyEmployees.find(e => e.id === selectedEmployeeId);

  // Organize workers by status
  const presentWorkers = [];
  const absentWorkers = [];
  const notEncodedWorkers = [];

  employees.forEach(emp => {
    const record = attendanceRecords[emp.id];
    if (!hasAttendance) {
      notEncodedWorkers.push(emp);
    } else if (!record) {
      notEncodedWorkers.push(emp);
    } else if (record.status === 'present' || record.status === 'half-day') {
      presentWorkers.push({ ...emp, attendance: record });
    } else if (record.status === 'absent') {
      absentWorkers.push({ ...emp, attendance: record });
    }
  });

  const selectedProject = projects.find(p => p.id === projectId);

  const handlePrintReceipt = () => {
    const printWindow = window.open('', '_blank');
    const dateFormatted = format(selectedDate, 'MMMM dd, yyyy');
    
    const renderedHtml = `
      <div style="font-family: 'Inter', sans-serif; padding: 40px; color: #1e293b; max-width: 800px; margin: auto; border: 1px solid #e2e8f0; background: white; border-radius: 12px;">
        <div style="text-align: center; border-bottom: 2px solid #4f46e5; padding-bottom: 16px; margin-bottom: 24px;">
          <h1 style="margin: 0; font-size: 24px; color: #1e293b;">${selectedProject?.projectName || 'Project Site'}</h1>
          <p style="margin: 4px 0 0; color: #64748b; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Daily Attendance Receipt</p>
          <div style="margin-top: 8px; font-weight: 600; font-size: 16px; color: #4f46e5;">${dateFormatted}</div>
        </div>

        <div style="margin-bottom: 24px; font-size: 14px;">
          <strong>Location:</strong> ${selectedProject?.location || 'N/A'}<br/>
          <strong>Generated On:</strong> ${format(new Date(), 'PP p')}
        </div>

        <div style="margin-bottom: 24px;">
          <h3 style="border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; color: #16a34a; font-size: 16px; margin-bottom: 12px;">Present Workers (${presentWorkers.length})</h3>
          ${presentWorkers.length === 0 ? '<p style="color: #64748b; font-size: 13px; italic">No present workers recorded.</p>' : `
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
              <thead>
                <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0; text-align: left;">
                  <th style="padding: 8px;">Worker Name</th>
                  <th style="padding: 8px;">Role</th>
                  <th style="padding: 8px;">Time In</th>
                  <th style="padding: 8px;">Time Out</th>
                  <th style="padding: 8px; text-align: right;">Regular Hrs</th>
                  <th style="padding: 8px; text-align: right;">OT Hrs</th>
                </tr>
              </thead>
              <tbody>
                ${presentWorkers.map(w => `
                  <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 8px; font-weight: 600;">${w.fullName}</td>
                    <td style="padding: 8px; text-transform: capitalize; color: #475569;">${w.role}</td>
                    <td style="padding: 8px; color: #475569;">${w.attendance.timeIn || '—'}</td>
                    <td style="padding: 8px; color: #475569;">${w.attendance.timeOut || '—'}</td>
                    <td style="padding: 8px; text-align: right; font-weight: 500;">${w.attendance.hoursWorked || 0}</td>
                    <td style="padding: 8px; text-align: right; font-weight: 500;">${w.attendance.overtimeHours || 0}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `}
        </div>

        <div style="margin-bottom: 40px;">
          <h3 style="border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; color: #dc2626; font-size: 16px; margin-bottom: 12px;">Absent Workers (${absentWorkers.length})</h3>
          ${absentWorkers.length === 0 ? '<p style="color: #64748b; font-size: 13px; italic">No absent workers recorded.</p>' : `
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
              <thead>
                <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0; text-align: left;">
                  <th style="padding: 8px;">Worker Name</th>
                  <th style="padding: 8px;">Role</th>
                  <th style="padding: 8px;">Reason / Remarks</th>
                </tr>
              </thead>
              <tbody>
                ${absentWorkers.map(w => `
                  <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 8px; font-weight: 600;">${w.fullName}</td>
                    <td style="padding: 8px; text-transform: capitalize; color: #475569;">${w.role}</td>
                    <td style="padding: 8px; color: #dc2626;">${w.attendance.remarks || 'No remarks provided.'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `}
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 40px; margin-top: 60px; font-size: 13px; border-top: 1px solid #e2e8f0; padding-top: 24px;">
          <div style="text-align: center;">
            <div style="margin-bottom: 48px; color: #64748b; text-transform: uppercase; font-size: 10px; font-weight: 600;">Prepared By</div>
            <div style="border-bottom: 1px solid #cbd5e1; width: 80%; margin: auto;"></div>
            <div style="margin-top: 4px; color: #475569;">Encoder / Timekeeper</div>
          </div>
          <div style="text-align: center;">
            <div style="margin-bottom: 48px; color: #64748b; text-transform: uppercase; font-size: 10px; font-weight: 600;">Verified By</div>
            <div style="border-bottom: 1px solid #cbd5e1; width: 80%; margin: auto;"></div>
            <div style="margin-top: 4px; color: #475569;">Foreman / Site Supervisor</div>
          </div>
          <div style="text-align: center;">
            <div style="margin-bottom: 48px; color: #64748b; text-transform: uppercase; font-size: 10px; font-weight: 600;">Approved By</div>
            <div style="border-bottom: 1px solid #cbd5e1; width: 80%; margin: auto;"></div>
            <div style="margin-top: 4px; color: #475569;">Project Engineer / Admin</div>
          </div>
        </div>
      </div>
    `;

    printWindow.document.write(`
      <html>
        <head>
          <title>Attendance Receipt - ${dateFormatted}</title>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
          <style>
            body { margin: 0; padding: 20px; background: #f8fafc; }
            @media print {
              body { padding: 0; background: white; }
            }
          </style>
        </head>
        <body>
          ${renderedHtml}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  };

  return (
    <div className="animate-in">
      <div className="page-header">
        <div>
          <h1>Attendance Tracker & Logs</h1>
          <p style={{ color: 'var(--text)', fontSize: 13, marginTop: 4 }}>Daily attendance dashboards, absent summaries, and print slips</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-light)', gap: 16, marginBottom: 24 }}>
        <button 
          onClick={() => setActiveTab('daily')} 
          style={{
            padding: '8px 16px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'daily' ? '2px solid var(--primary)' : '2px solid transparent',
            color: activeTab === 'daily' ? 'var(--primary)' : 'var(--text)',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          Daily Project Logs
        </button>
        <button 
          onClick={() => setActiveTab('employee')} 
          style={{
            padding: '8px 16px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'employee' ? '2px solid var(--primary)' : '2px solid transparent',
            color: activeTab === 'employee' ? 'var(--primary)' : 'var(--text)',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          Employee Attendance Explorer
        </button>
      </div>

      <div className="form-row" style={{ gridTemplateColumns: '2fr 1fr', gap: 24, alignItems: 'start' }}>
        {/* Left Column: Logs dashboard */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {activeTab === 'daily' ? (
            <>
              {/* Controls Card */}
              <div className="data-card" style={{ padding: 24 }}>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'end', justifyContent: 'space-between' }}>
                  <div className="form-group" style={{ marginBottom: 0, minWidth: 260 }}>
                    <label>Select Project Site</label>
                    <select className="form-input" value={projectId} onChange={e => setProjectId(e.target.value)} disabled={loadingProjects}>
                      <option value="">{loadingProjects ? 'Loading projects...' : 'Select a project'}</option>
                      {projects.map(p => <option key={p.id} value={p.id}>{p.projectName} — {p.location}</option>)}
                    </select>
                  </div>

                  {hasAttendance && (
                    <button className="btn btn-primary" onClick={handlePrintReceipt} disabled={loadingData}>
                      <FiPrinter style={{ marginRight: 6 }} /> Print Daily Receipt
                    </button>
                  )}
                </div>
              </div>

              {/* Status Display Card */}
              {loadingData ? (
                <div className="data-card" style={{ padding: 60, textAlign: 'center' }}>
                  <span className="spinner spinner-lg" />
                  <p style={{ color: 'var(--text)', marginTop: 12 }}>Loading attendance logs for {format(selectedDate, 'PP')}...</p>
                </div>
              ) : (
                <>
                  {!hasAttendance ? (
                    <div className="data-card" style={{ padding: '40px 24px', textAlign: 'center' }}>
                      <div style={{ fontSize: 48, color: 'var(--warning)', marginBottom: 16 }}><FiInfo /></div>
                      <h3 style={{ fontSize: 18, color: 'var(--text-heading)', fontWeight: 600 }}>No Logs Found</h3>
                      <p style={{ color: 'var(--text)', fontSize: 14, maxWidth: 400, margin: '8px auto 0' }}>
                        Attendance records for <strong>{format(selectedDate, 'MMMM dd, yyyy')}</strong> have not been encoded yet for this project.
                      </p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                      {/* Summary Counters */}
                      <div className="attendance-summary">
                        <div className="summary-box present">
                          <div>
                            <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600, textTransform: 'uppercase' }}>Present Workers</div>
                            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-heading)' }}>{presentWorkers.length}</div>
                          </div>
                          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--success-light)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                            <FiCheck />
                          </div>
                        </div>
                        <div className="summary-box absent">
                          <div>
                            <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600, textTransform: 'uppercase' }}>Absent Workers</div>
                            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-heading)' }}>{absentWorkers.length}</div>
                          </div>
                          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--danger-light)', color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                            <FiX />
                          </div>
                        </div>
                      </div>

                      {/* List of Present Workers */}
                      <div className="data-card">
                        <div className="data-card-header" style={{ borderBottom: '1px solid var(--border-light)' }}>
                          <h3 style={{ color: 'var(--success)', fontWeight: 600 }}>Present Payout Logs</h3>
                        </div>
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>Employee</th>
                              <th>Role</th>
                              <th>Time In</th>
                              <th>Time Out</th>
                              <th style={{ textAlign: 'right' }}>Reg Hours</th>
                              <th style={{ textAlign: 'right' }}>OT Hours</th>
                            </tr>
                          </thead>
                          <tbody>
                            {presentWorkers.length === 0 ? (
                              <tr><td colSpan="6" style={{ textAlign: 'center', padding: 24, color: 'var(--text)' }}>No present workers recorded.</td></tr>
                            ) : presentWorkers.map((w, idx) => (
                              <tr key={w.id}>
                                <td><span style={{ fontWeight: 600 }}>{w.fullName}</span></td>
                                <td><span style={{ textTransform: 'capitalize' }}>{w.role}</span></td>
                                <td>{w.attendance.timeIn || '—'}</td>
                                <td>{w.attendance.timeOut || '—'}</td>
                                <td style={{ textAlign: 'right', fontWeight: 600 }}>{w.attendance.hoursWorked || 0} hrs</td>
                                <td style={{ textAlign: 'right', fontWeight: 600 }}>{w.attendance.overtimeHours || 0} hrs</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* List of Absent Workers */}
                      <div className="data-card">
                        <div className="data-card-header" style={{ borderBottom: '1px solid var(--border-light)' }}>
                          <h3 style={{ color: 'var(--danger)', fontWeight: 600 }}>Absent Payout Logs (Receipt Reference)</h3>
                        </div>
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>Employee</th>
                              <th>Role</th>
                              <th>Remarks / Reason</th>
                            </tr>
                          </thead>
                          <tbody>
                            {absentWorkers.length === 0 ? (
                              <tr><td colSpan="3" style={{ textAlign: 'center', padding: 24, color: 'var(--text)' }}>No absent workers recorded.</td></tr>
                            ) : absentWorkers.map((w, idx) => (
                              <tr key={w.id}>
                                <td><span style={{ fontWeight: 600 }}>{w.fullName}</span></td>
                                <td><span style={{ textTransform: 'capitalize' }}>{w.role}</span></td>
                                <td style={{ color: 'var(--danger)' }}>{w.attendance.remarks || 'No remarks provided.'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          ) : (
            <>
              {/* Employee Explorer Tab View */}
              {/* Explorer Controls Card */}
              <div className="data-card" style={{ padding: 24 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label><FiUser style={{ marginRight: 6 }} />Select Employee</label>
                  <select 
                    className="form-input" 
                    value={selectedEmployeeId} 
                    onChange={e => setSelectedEmployeeId(e.target.value)}
                  >
                    <option value="">Select a worker to explore...</option>
                    {allCompanyEmployees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.fullName} ({emp.role})</option>
                    ))}
                  </select>
                </div>
              </div>

              {loadingEmployeeLogs ? (
                <div className="data-card" style={{ padding: 60, textAlign: 'center' }}>
                  <span className="spinner spinner-lg" />
                  <p style={{ color: 'var(--text)', marginTop: 12 }}>Loading work logs for employee...</p>
                </div>
              ) : !selectedEmployeeId ? (
                <div className="data-card" style={{ padding: '40px 24px', textAlign: 'center' }}>
                  <div style={{ fontSize: 48, color: 'var(--primary)', marginBottom: 16 }}><FiUser /></div>
                  <h3 style={{ fontSize: 18, color: 'var(--text-heading)', fontWeight: 600 }}>No Worker Selected</h3>
                  <p style={{ color: 'var(--text)', fontSize: 14, maxWidth: 400, margin: '8px auto 0' }}>
                    Select an employee above to analyze their attendance logs, work history, and active project assignments for <strong>{format(currentMonth, 'MMMM yyyy')}</strong>.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                  {/* Explorer Summary Counters */}
                  <div className="attendance-summary">
                    <div className="summary-box present" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '16px 20px', height: 'auto', gap: 4 }}>
                      <div style={{ fontSize: 11, color: 'var(--text)', fontWeight: 600, textTransform: 'uppercase' }}>Days Present</div>
                      <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--success)' }}>{monthlyStats.present}</div>
                    </div>
                    <div className="summary-box half" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '16px 20px', height: 'auto', gap: 4 }}>
                      <div style={{ fontSize: 11, color: 'var(--text)', fontWeight: 600, textTransform: 'uppercase' }}>Half-Days</div>
                      <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--warning)' }}>{monthlyStats.halfDay}</div>
                    </div>
                    <div className="summary-box absent" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '16px 20px', height: 'auto', gap: 4 }}>
                      <div style={{ fontSize: 11, color: 'var(--text)', fontWeight: 600, textTransform: 'uppercase' }}>Days Absent</div>
                      <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--danger)' }}>{monthlyStats.absent}</div>
                    </div>
                    <div className="summary-box present" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '16px 20px', height: 'auto', gap: 4, background: 'var(--bg)', border: '1px solid var(--border-light)' }}>
                      <div style={{ fontSize: 11, color: 'var(--text)', fontWeight: 600, textTransform: 'uppercase' }}>Total Hours</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-heading)' }}>
                        {monthlyStats.hours} hrs <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--success)' }}>{monthlyStats.ot > 0 ? `(+${monthlyStats.ot}h OT)` : ''}</span>
                      </div>
                    </div>
                  </div>

                  {/* Monthly Attendance Details Table */}
                  <div className="data-card">
                    <div className="data-card-header" style={{ borderBottom: '1px solid var(--border-light)' }}>
                      <h3 style={{ color: 'var(--text-heading)', fontWeight: 600 }}>Work Logs for {format(currentMonth, 'MMMM yyyy')}</h3>
                      {selectedEmployee && <span className="status-badge active">{selectedEmployee.fullName}</span>}
                    </div>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Project Site</th>
                          <th>Status</th>
                          <th>Time In</th>
                          <th>Time Out</th>
                          <th style={{ textAlign: 'right' }}>Hours</th>
                          <th style={{ textAlign: 'right' }}>OT (Hrs)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthLogs.length === 0 ? (
                          <tr><td colSpan="7" style={{ textAlign: 'center', padding: 24, color: 'var(--text)' }}>No attendance logs found for this worker in {format(currentMonth, 'MMMM yyyy')}.</td></tr>
                        ) : monthLogs.map((log) => {
                          const proj = projects.find(p => p.id === log.projectId);
                          return (
                            <tr key={log.id}>
                              <td style={{ fontWeight: 600 }}>{log.date}</td>
                              <td>
                                <div style={{ fontSize: 13, fontWeight: 500 }}>{proj?.projectName || 'Unknown Site'}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-light)' }}>{proj?.location || ''}</div>
                              </td>
                              <td>
                                <span className={`status-badge ${log.status === 'present' ? 'active' : log.status === 'half-day' ? 'draft' : 'inactive'}`} style={{ textTransform: 'capitalize' }}>
                                  {log.status}
                                </span>
                              </td>
                              <td>{log.timeIn || '—'}</td>
                              <td>{log.timeOut || '—'}</td>
                              <td style={{ textAlign: 'right', fontWeight: 600 }}>{log.hoursWorked || 0} hrs</td>
                              <td style={{ textAlign: 'right', fontWeight: 600 }}>{log.overtimeHours || 0} hrs</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Right Column: Calendar Navigator */}
        <div className="data-card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h4 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{format(currentMonth, 'MMMM yyyy')}</h4>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn btn-sm btn-secondary" onClick={handlePrevMonth} style={{ padding: '4px 8px' }}><FiChevronLeft /></button>
              <button className="btn btn-sm btn-secondary" onClick={handleNextMonth} style={{ padding: '4px 8px' }}><FiChevronRight /></button>
            </div>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: 4,
            textAlign: 'center',
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--text)',
            marginBottom: 8
          }}>
            <div>Su</div><div>Mo</div><div>Tu</div><div>We</div><div>Th</div><div>Fr</div><div>Sa</div>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: 4
          }}>
            {blankDays.map((_, idx) => <div key={`blank-${idx}`}></div>)}
            {daysInMonth.map((day, idx) => {
              const isSelected = isSameDay(day, selectedDate);
              const isTodayDay = isSameDay(day, new Date());
              const dateStr = format(day, 'yyyy-MM-dd');
              
              const record = activeTab === 'employee' && selectedEmployeeId
                ? employeeRecords.find(r => r.date === dateStr)
                : null;

              let bg = 'transparent';
              let textCol = 'var(--text-heading)';
              
              if (activeTab === 'employee' && selectedEmployeeId && record) {
                if (record.status === 'present') {
                  bg = 'var(--success-light)';
                  textCol = 'var(--success)';
                } else if (record.status === 'half-day') {
                  bg = 'var(--warning-light)';
                  textCol = 'var(--warning)';
                } else if (record.status === 'absent') {
                  bg = 'var(--danger-light)';
                  textCol = 'var(--danger)';
                }
              } else {
                bg = isSelected ? 'var(--primary)' : isTodayDay ? 'var(--primary-light)' : 'transparent';
                textCol = isSelected ? '#fff' : isTodayDay ? 'var(--primary)' : 'var(--text-heading)';
              }

              return (
                <button
                  key={idx}
                  onClick={() => setSelectedDate(day)}
                  style={{
                    border: isSelected ? '2px solid var(--primary)' : 'none',
                    borderRadius: 8,
                    height: 36,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontWeight: isSelected || isTodayDay || record ? 700 : 500,
                    cursor: 'pointer',
                    background: bg,
                    color: textCol,
                    transition: 'all 0.15s'
                  }}
                  className={isSelected && !record ? 'text-white' : ''}
                >
                  {format(day, 'd')}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AttendanceTracker;
