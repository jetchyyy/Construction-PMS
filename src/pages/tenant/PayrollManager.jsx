import React, { useState, useEffect } from 'react';
import { db } from '../../firebase/config';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, serverTimestamp, getDoc } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/ui/ToastContext';
import Modal from '../../components/ui/Modal';
import EmptyState from '../../components/ui/EmptyState';
import { SkeletonTable } from '../../components/ui/SkeletonLoader';
import { format, subDays, eachDayOfInterval, parseISO } from 'date-fns';
import { FiPlus, FiEye, FiCheck, FiDollarSign, FiFileText, FiClock, FiUsers } from 'react-icons/fi';

const PayrollManager = () => {
  const { companyId } = useAuth();
  const { addToast } = useToast();
  const [payrolls, setPayrolls] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  // Wizard state
  const [showWizard, setShowWizard] = useState(false);
  const [step, setStep] = useState(1);
  const [projectId, setProjectId] = useState('');
  const [payrollType, setPayrollType] = useState('weekly');
  const [periodStart, setPeriodStart] = useState(format(subDays(new Date(), 6), 'yyyy-MM-dd'));
  const [periodEnd, setPeriodEnd] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [computedLines, setComputedLines] = useState([]);
  const [computing, setComputing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Detail view
  const [showDetail, setShowDetail] = useState(null);
  const [detailLines, setDetailLines] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchData = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [pSnap, prSnap] = await Promise.all([
        getDocs(query(collection(db, 'projects'), where('companyId', '==', companyId))),
        getDocs(query(collection(db, 'payrolls'), where('companyId', '==', companyId))),
      ]);
      setProjects(pSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setPayrolls(prSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => {
        const da = a.createdAt?.toDate?.() || new Date(0);
        const db2 = b.createdAt?.toDate?.() || new Date(0);
        return db2 - da;
      }));
    } catch (err) {
      addToast('Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [companyId]);

  const getProjectName = (id) => projects.find(p => p.id === id)?.projectName || 'All Projects';

  const computePayroll = async () => {
    setComputing(true);
    try {
      let otMultiplier = 1.25;
      try {
        const compDoc = await getDoc(doc(db, 'companies', companyId));
        if (compDoc.exists() && compDoc.data().settings?.otRateMultiplier) {
          otMultiplier = compDoc.data().settings.otRateMultiplier;
        }
      } catch (e) { }

      const empQuery = projectId
        ? query(collection(db, 'employees'), where('companyId', '==', companyId), where('currentProjectId', '==', projectId))
        : query(collection(db, 'employees'), where('companyId', '==', companyId));
      const empSnap = await getDocs(empQuery);
      const employees = empSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        .filter(e => e.payrollType === payrollType);

      if (employees.length === 0) {
        addToast('No employees found for this payroll type', 'warning');
        setComputing(false);
        return;
      }

      const days = eachDayOfInterval({ start: parseISO(periodStart), end: parseISO(periodEnd) });
      const lines = [];

      for (const emp of employees) {
        let daysPresent = 0, daysHalf = 0, totalOT = 0;
        const pid = projectId || emp.currentProjectId;
        if (!pid) continue;
        for (const day of days) {
          const dateStr = format(day, 'yyyy-MM-dd');
          try {
            const attSnap = await getDocs(collection(db, 'attendance', companyId, 'projects', pid, 'dates', dateStr, 'records'));
            const attDoc = attSnap.docs.find(d => d.id === emp.id);
            if (attDoc) {
              const data = attDoc.data();
              if (data.status === 'present') daysPresent++;
              else if (data.status === 'half-day') daysHalf++;
              totalOT += data.overtimeHours || 0;
            }
          } catch (e) { }
        }

        let caDeduction = 0;
        try {
          const caSnap = await getDocs(query(
            collection(db, 'cashAdvances'),
            where('companyId', '==', companyId),
            where('employeeId', '==', emp.id),
            where('status', '==', 'active')
          ));
          caSnap.docs.forEach(d => { caDeduction += d.data().remainingBalance || 0; });
        } catch (e) { }

        const dailyRate = emp.dailyRate || 0;
        const hourlyRate = dailyRate / 8;
        const regularPay = (daysPresent * dailyRate) + (daysHalf * dailyRate * 0.5);
        const otPay = totalOT * hourlyRate * otMultiplier;
        const grossPay = regularPay + otPay;
        const netPay = Math.max(0, grossPay - caDeduction);

        lines.push({
          employeeId: emp.id,
          employeeName: emp.fullName,
          role: emp.role,
          dailyRate,
          daysPresent,
          daysHalf,
          totalOT,
          regularPay,
          otPay,
          caDeduction,
          grossPay,
          netPay,
        });
      }

      setComputedLines(lines);
      setStep(3);
      addToast(`Computed payroll for ${lines.length} employees`, 'success');
    } catch (err) {
      addToast('Computation error: ' + err.message, 'error');
    } finally {
      setComputing(false);
    }
  };

  const savePayroll = async () => {
    setSaving(true);
    try {
      const totalGross = computedLines.reduce((s, l) => s + l.grossPay, 0);
      const totalNet = computedLines.reduce((s, l) => s + l.netPay, 0);
      const payrollRef = await addDoc(collection(db, 'payrolls'), {
        companyId, projectId, payrollType, periodStart, periodEnd,
        status: 'draft', totalGross, totalNet,
        employeeCount: computedLines.length,
        createdAt: serverTimestamp()
      });
      for (const line of computedLines) {
        await addDoc(collection(db, 'payrollDetails'), { payrollId: payrollRef.id, companyId, ...line });
      }
      addToast('Payroll saved as draft!', 'success');
      setShowWizard(false);
      setStep(1);
      setComputedLines([]);
      fetchData();
    } catch (err) {
      addToast('Error saving: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const viewDetails = async (payroll) => {
    setShowDetail(payroll);
    setDetailLoading(true);
    try {
      const snap = await getDocs(query(collection(db, 'payrollDetails'), where('payrollId', '==', payroll.id)));
      setDetailLines(snap.docs.map(d => d.data()));
    } catch (err) {
      addToast('Failed to load details', 'error');
    } finally {
      setDetailLoading(false);
    }
  };

  const lockAndPay = async (payroll) => {
    try {
      await updateDoc(doc(db, 'payrolls', payroll.id), { status: 'paid', paidAt: serverTimestamp() });
      const detSnap = await getDocs(query(collection(db, 'payrollDetails'), where('payrollId', '==', payroll.id)));
      for (const d of detSnap.docs) {
        const line = d.data();
        if (line.caDeduction > 0) {
          const caSnap = await getDocs(query(
            collection(db, 'cashAdvances'),
            where('companyId', '==', companyId),
            where('employeeId', '==', line.employeeId),
            where('status', '==', 'active')
          ));
          for (const ca of caSnap.docs) {
            const caData = ca.data();
            const newBal = Math.max(0, (caData.remainingBalance || 0) - line.caDeduction);
            await updateDoc(ca.ref, {
              remainingBalance: newBal,
              status: newBal <= 0 ? 'fully-deducted' : 'active'
            });
          }
        }
      }
      addToast('Payroll locked and marked as paid!', 'success');
      fetchData();
    } catch (err) {
      addToast('Error: ' + err.message, 'error');
    }
  };

  const fmt = (n) => '₱' + Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2 });
  const getInitials = (name) => (name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  // Summary stats
  const totalPaid = payrolls.filter(p => p.status === 'paid').reduce((acc, p) => acc + p.totalNet, 0);
  const totalDraft = payrolls.filter(p => p.status === 'draft').reduce((acc, p) => acc + p.totalNet, 0);

  return (
    <div className="animate-in">
      <div className="page-header">
        <div>
          <h1>Payroll Management</h1>
          <p style={{ color: 'var(--text)', fontSize: 13, marginTop: 4 }}>Generate and track employee salary payouts</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => { setStep(1); setComputedLines([]); setShowWizard(true); }}><FiPlus /> Generate Payroll</button>
        </div>
      </div>

      <div className="kpi-grid-3">
        <div className="kpi-card gradient-kpi kpi-indigo card-shine">
          <div className="kpi-icon"><FiFileText /></div>
          <div className="kpi-value">{payrolls.length}</div>
          <div className="kpi-label">Total Payrolls Generated</div>
        </div>
        <div className="kpi-card gradient-kpi kpi-emerald card-shine">
          <div className="kpi-icon"><FiDollarSign /></div>
          <div className="kpi-value">{fmt(totalPaid)}</div>
          <div className="kpi-label">Total Amount Disbursed</div>
        </div>
        <div className="kpi-card gradient-kpi kpi-amber card-shine">
          <div className="kpi-icon"><FiClock /></div>
          <div className="kpi-value">{fmt(totalDraft)}</div>
          <div className="kpi-label">Pending Draft Amount</div>
        </div>
      </div>

      <div className="data-card">
        <div className="data-card-header"><h3>Payroll Records</h3></div>
        <table className="data-table">
          <thead><tr><th>Project</th><th>Type</th><th>Period</th><th>Employees</th><th>Total Net</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {loading ? <SkeletonTable cols={7} rows={4} /> : payrolls.length === 0 ? (
              <tr><td colSpan="7"><EmptyState icon={<FiDollarSign />} title="No payrolls" description="Generate your first payroll from attendance data." /></td></tr>
            ) : payrolls.map((pr, i) => (
              <tr key={pr.id} className="animate-in" style={{ animationDelay: `${i * 0.05}s` }}>
                <td style={{ fontWeight: 500 }}>{getProjectName(pr.projectId)}</td>
                <td>
                  <span className="role-badge" style={{ textTransform: 'capitalize' }}>{pr.payrollType}</span>
                </td>
                <td>
                  <div style={{ fontSize: 12, fontWeight: 500 }}>{pr.periodStart}</div>
                  <div style={{ fontSize: 11, color: 'var(--text)' }}>to {pr.periodEnd}</div>
                </td>
                <td><FiUsers style={{ marginRight: 6, opacity: 0.5 }} />{pr.employeeCount || '—'}</td>
                <td style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-heading)' }}>{fmt(pr.totalNet)}</td>
                <td>
                  <span className={`status-badge ${pr.status === 'draft' ? 'draft' : 'paid'}`}>
                    {pr.status === 'draft' && <span className="pulse-dot" style={{ width: 6, height: 6, marginRight: 4, background: 'var(--warning)' }}></span>}
                    {pr.status}
                  </span>
                </td>
                <td className="actions">
                  <button className="btn btn-sm btn-ghost" onClick={() => viewDetails(pr)}><FiEye /> View</button>
                  {pr.status === 'draft' && <button className="btn btn-sm btn-success" onClick={() => lockAndPay(pr)}><FiCheck /> Pay</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal show={showWizard} onClose={() => setShowWizard(false)} title="Generate Payroll" size="lg" footer={
        step === 1 ? <>
          <button className="btn btn-secondary" onClick={() => setShowWizard(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={() => { computePayroll(); setStep(2); }} disabled={computing}>
            {computing ? 'Computing...' : 'Compute Payroll →'}
          </button>
        </> : step === 2 ? <><span className="spinner" /> Computing...</> : <>
          <button className="btn btn-secondary" onClick={() => setStep(1)}>← Back</button>
          <button className="btn btn-primary" onClick={savePayroll} disabled={saving}>
            {saving ? 'Saving...' : 'Save as Draft'}
          </button>
        </>
      }>
        <div className="wizard-steps" style={{ marginBottom: 32 }}>
          <div className={`wizard-step ${step >= 1 ? (step > 1 ? 'completed' : 'active') : ''}`}><span className="wizard-step-label">Configuration</span></div>
          <div className={`wizard-step ${step >= 2 ? (step > 2 ? 'completed' : 'active') : ''}`}><span className="wizard-step-label">Processing</span></div>
          <div className={`wizard-step ${step >= 3 ? 'active' : ''}`}><span className="wizard-step-label">Review & Save</span></div>
        </div>

        {step === 1 && (
          <div style={{ background: '#fafbfd', padding: 24, borderRadius: 12, border: '1px solid var(--border-light)' }}>
            <div className="form-group">
              <label>Target Project</label>
              <select className="form-input" value={projectId} onChange={e => setProjectId(e.target.value)}>
                <option value="">All Projects (Global)</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.projectName}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Payroll Type / Schedule</label>
              <select className="form-input" value={payrollType} onChange={e => setPayrollType(e.target.value)}>
                <option value="weekly">Weekly (Weekly paid workers)</option>
                <option value="kinsenas">Kinsenas (15/30 paid workers)</option>
              </select>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Period Start Date</label><input type="date" className="form-input" value={periodStart} onChange={e => setPeriodStart(e.target.value)} /></div>
              <div className="form-group"><label>Period End Date</label><input type="date" className="form-input" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} /></div>
            </div>
          </div>
        )}
        {step === 2 && (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <span className="spinner spinner-lg" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--primary)', marginBottom: 20 }} />
            <h3 style={{ fontSize: 18 }}>Aggregating Attendance Data</h3>
            <p style={{ color: 'var(--text)' }}>Computing regular hours, overtime, and applying cash advance deductions...</p>
          </div>
        )}
        {step === 3 && (
          <div>
            <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
              <div style={{ flex: 1, background: 'var(--success-light)', color: 'var(--success)', padding: 16, borderRadius: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase' }}>Total Net Payout</div>
                <div style={{ fontSize: 24, fontWeight: 700 }}>{fmt(computedLines.reduce((s, l) => s + l.netPay, 0))}</div>
              </div>
              <div style={{ flex: 1, background: 'var(--bg)', padding: 16, borderRadius: 12, border: '1px solid var(--border-light)' }}>
                <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text)' }}>Workers Included</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-heading)' }}>{computedLines.length}</div>
              </div>
            </div>
            <div style={{ maxHeight: 350, overflowY: 'auto', border: '1px solid var(--border-light)', borderRadius: 12 }}>
              <table className="data-table" style={{ fontSize: 12 }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}><tr><th>Employee</th><th>Attendance</th><th>OT</th><th>Gross Pay</th><th>Deductions</th><th>Net Pay</th></tr></thead>
                <tbody>
                  {computedLines.map((l, i) => (
                    <tr key={i}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div className={`avatar btn-sm ${['indigo', 'emerald', 'rose', 'amber', 'cyan'][i % 5]}`}>{getInitials(l.employeeName)}</div>
                          <span style={{ fontWeight: 600 }}>{l.employeeName}</span>
                        </div>
                      </td>
                      <td>{l.daysPresent}{l.daysHalf > 0 && `+${l.daysHalf}½`} <span style={{ opacity: 0.5 }}>days</span></td>
                      <td>{l.totalOT} <span style={{ opacity: 0.5 }}>hrs</span></td>
                      <td>{fmt(l.grossPay)}</td>
                      <td style={{ color: 'var(--danger)', fontWeight: 500 }}>{l.caDeduction > 0 ? `-${fmt(l.caDeduction)}` : '—'}</td>
                      <td style={{ fontWeight: 700, color: 'var(--success)', fontSize: 14 }}>{fmt(l.netPay)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>

      <Modal show={!!showDetail} onClose={() => setShowDetail(null)} title={`Payroll Summary: ${showDetail?.periodStart} to ${showDetail?.periodEnd}`} size="lg">
        {detailLoading ? <div style={{ textAlign: 'center', padding: 60 }}><span className="spinner spinner-lg" /></div> : (
          <div>
            <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
              <div style={{ flex: 1, background: 'var(--primary-light)', color: 'var(--primary)', padding: 16, borderRadius: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase' }}>Total Distributed</div>
                <div style={{ fontSize: 24, fontWeight: 700 }}>{fmt(showDetail?.totalNet)}</div>
              </div>
              <div style={{ flex: 1, background: 'var(--bg)', padding: 16, borderRadius: 12, border: '1px solid var(--border-light)' }}>
                <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text)' }}>Status</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-heading)', textTransform: 'capitalize' }}>{showDetail?.status}</div>
              </div>
            </div>
            <div style={{ maxHeight: 400, overflowY: 'auto', border: '1px solid var(--border-light)', borderRadius: 12 }}>
              <table className="data-table" style={{ fontSize: 12 }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}><tr><th>Employee</th><th>Attendance</th><th>OT</th><th>Gross Pay</th><th>Deductions</th><th>Net Pay</th></tr></thead>
                <tbody>
                  {detailLines.length === 0 ? (
                    <tr><td colSpan="6" style={{ textAlign: 'center', padding: 32 }}>No details available</td></tr>
                  ) : detailLines.map((l, i) => (
                    <tr key={i}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div className={`avatar btn-sm ${['indigo', 'emerald', 'rose', 'amber', 'cyan'][i % 5]}`}>{getInitials(l.employeeName)}</div>
                          <span style={{ fontWeight: 600 }}>{l.employeeName}</span>
                        </div>
                      </td>
                      <td>{l.daysPresent}{l.daysHalf > 0 && `+${l.daysHalf}½`} <span style={{ opacity: 0.5 }}>days</span></td>
                      <td>{l.totalOT} <span style={{ opacity: 0.5 }}>hrs</span></td>
                      <td>{fmt(l.grossPay)}</td>
                      <td style={{ color: 'var(--danger)', fontWeight: 500 }}>{l.caDeduction > 0 ? `-${fmt(l.caDeduction)}` : '—'}</td>
                      <td style={{ fontWeight: 700, color: showDetail?.status === 'paid' ? 'var(--success)' : 'var(--text-heading)', fontSize: 14 }}>{fmt(l.netPay)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default PayrollManager;
