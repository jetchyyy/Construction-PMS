import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../firebase/config';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, serverTimestamp, getDoc } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/ui/ToastContext';
import Modal from '../../components/ui/Modal';
import EmptyState from '../../components/ui/EmptyState';
import { SkeletonTable } from '../../components/ui/SkeletonLoader';
import { format, subDays, eachDayOfInterval, parseISO } from 'date-fns';
import { FiPlus, FiEye, FiCheck, FiDollarSign, FiFileText, FiClock, FiUsers, FiPrinter, FiFilter, FiXCircle, FiAlertTriangle } from 'react-icons/fi';
import PayrollReceipt from '../../components/tenant/PayrollReceipt';


const PayrollManager = () => {
  const { companyId } = useAuth();
  const { addToast } = useToast();
  const [payrolls, setPayrolls] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filter state
  const [filterProjectId, setFilterProjectId] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  // Main Payroll list pagination state
  const [payrollsPage, setPayrollsPage] = useState(1);
  const payrollsPerPage = 10;

  // Wizard state
  const [showWizard, setShowWizard] = useState(false);
  const [step, setStep] = useState(1);
  const [projectId, setProjectId] = useState('');
  const [payrollType, setPayrollType] = useState('weekly');
  const [periodStart, setPeriodStart] = useState(format(subDays(new Date(), 6), 'yyyy-MM-dd'));
  const [periodEnd, setPeriodEnd] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [computedLines, setComputedLines] = useState([]);
  const [excludedWorkers, setExcludedWorkers] = useState([]);
  const [wizardError, setWizardError] = useState(null);
  const [computing, setComputing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Wizard table pagination state
  const [wizardPage, setWizardPage] = useState(1);
  const wizardPerPage = 10;

  // Detail view
  const [showDetail, setShowDetail] = useState(null);
  const [detailLines, setDetailLines] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [receiptConfig, setReceiptConfig] = useState(null);
  const [companyName, setCompanyName] = useState('');

  // Detail table pagination state
  const [detailsPage, setDetailsPage] = useState(1);
  const detailsPerPage = 10;

  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [selectedForReceipt, setSelectedForReceipt] = useState(null);


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
      const compSnap = await getDoc(doc(db, 'companies', companyId));
      if (compSnap.exists()) {
        const data = compSnap.data();
        setCompanyName(data.name || '');
        setReceiptConfig({
          header: data.settings?.receiptHeader || '',
          subheader: data.settings?.receiptSubheader || '',
          footer: data.settings?.receiptFooter || '',
        });
      }

    } catch (err) {
      addToast('Failed to load data', 'error');
    } finally {
      setLoading(false);
    }

  };

  useEffect(() => { fetchData(); }, [companyId]);

  useEffect(() => {
    setPayrollsPage(1);
  }, [filterProjectId, filterStartDate, filterEndDate]);

  const getProjectName = (id) => projects.find(p => p.id === id)?.projectName || 'All Projects';

  const computePayroll = async () => {
    setComputing(true);
    setExcludedWorkers([]);
    setWizardError(null);
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
        setWizardError('No employees found for this payroll type and project.');
        setComputing(false);
        return;
      }

      // Check overlapping payrolls and find paid employee IDs
      const prQuery = query(collection(db, 'payrolls'), where('companyId', '==', companyId));
      const prSnap = await getDocs(prQuery);
      const overlappingPRs = prSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(pr => pr.periodStart <= periodEnd && periodStart <= pr.periodEnd);

      const paidEmployeeIds = new Set();
      for (const pr of overlappingPRs) {
        const detailsSnap = await getDocs(query(collection(db, 'payrollDetails'), where('payrollId', '==', pr.id)));
        detailsSnap.docs.forEach(docd => {
          paidEmployeeIds.add(docd.data().employeeId);
        });
      }

      const alreadyPaidEmployees = employees.filter(e => paidEmployeeIds.has(e.id));
      const employeesToCompute = employees.filter(e => !paidEmployeeIds.has(e.id));

      if (alreadyPaidEmployees.length > 0) {
        const names = alreadyPaidEmployees.map(e => e.fullName).join(', ');
        addToast(`Workers already paid in overlapping date(s): ${names}. Excluded from computation.`, 'warning');
      }

      if (employeesToCompute.length === 0) {
        addToast('Nothing more to pay. All workers in this selection have already been paid for this period.', 'error');
        setWizardError('Nothing more to pay. All workers in this selection have already been paid for this period.');
        setComputing(false);
        return;
      }

      setExcludedWorkers(alreadyPaidEmployees.map(e => e.fullName));

      const days = eachDayOfInterval({ start: parseISO(periodStart), end: parseISO(periodEnd) });
      const lines = [];

      for (const emp of employeesToCompute) {
        let daysPresent = 0, daysHalf = 0, totalHoursWorked = 0, totalOT = 0;
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
              
              if (data.hoursWorked !== undefined) {
                totalHoursWorked += Number(data.hoursWorked);
              } else {
                if (data.status === 'present') totalHoursWorked += 8;
                else if (data.status === 'half-day') totalHoursWorked += 4;
              }
              totalOT += data.overtimeHours || 0;
            }
          } catch (e) { }
        }

        let caDeduction = 0;
        let totalActiveCABalance = 0;
        try {
          const caSnap = await getDocs(query(
            collection(db, 'cashAdvances'),
            where('companyId', '==', companyId),
            where('employeeId', '==', emp.id),
            where('status', '==', 'active')
          ));
          caSnap.docs.forEach(d => {
            const caData = d.data();
            const bal = caData.remainingBalance || 0;
            totalActiveCABalance += bal;
            if (caData.deductionPerPayroll && caData.deductionPerPayroll > 0) {
              caDeduction += Math.min(caData.deductionPerPayroll, bal);
            } else {
              caDeduction += bal;
            }
          });
        } catch (e) { }

        const dailyRate = emp.dailyRate || 0;
        const hourlyRate = emp.hourlyRate || (dailyRate / 8);
        const regularPay = totalHoursWorked * hourlyRate;
        const otPay = totalOT * hourlyRate * otMultiplier;
        const grossPay = regularPay + otPay;
        
        caDeduction = Math.min(grossPay, caDeduction);
        const netPay = Math.max(0, grossPay - caDeduction);

        lines.push({
          employeeId: emp.id,
          employeeName: emp.fullName,
          role: emp.role,
          dailyRate,
          hourlyRate,
          daysPresent,
          daysHalf,
          totalHoursWorked,
          totalOT,
          regularPay,
          otPay,
          caDeduction,
          caBalance: totalActiveCABalance,
          grossPay,
          netPay,
        });
      }

      setComputedLines(lines);
      setWizardPage(1);
      setStep(3);
      addToast(`Computed payroll for ${lines.length} employees`, 'success');
    } catch (err) {
      addToast('Computation error: ' + err.message, 'error');
      setWizardError('Computation error: ' + err.message);
    } finally {
      setComputing(false);
    }
  };

  const handleDeductionChange = (index, value) => {
    const newLines = [...computedLines];
    const line = newLines[index];
    const valNum = Number(value) || 0;
    const maxAllowed = Math.min(line.grossPay, line.caBalance || 0);
    const amount = Math.max(0, Math.min(maxAllowed, valNum));
    
    line.caDeduction = amount;
    line.netPay = Math.max(0, line.grossPay - amount);
    setComputedLines(newLines);
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
    setDetailsPage(1);
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
          
          let remainingDeduction = line.caDeduction;
          const activeCAs = caSnap.docs.map(caDoc => ({ ref: caDoc.ref, ...caDoc.data() }))
            .sort((a, b) => {
              const da = a.createdAt?.toDate?.() || new Date(0);
              const db2 = b.createdAt?.toDate?.() || new Date(0);
              return da - db2;
            });
          
          for (const ca of activeCAs) {
            if (remainingDeduction <= 0) break;
            const currentBal = ca.remainingBalance || 0;
            const deductAmount = Math.min(currentBal, remainingDeduction);
            const newBal = Math.max(0, currentBal - deductAmount);
            
            await updateDoc(ca.ref, {
              remainingBalance: newBal,
              status: newBal <= 0 ? 'fully-deducted' : 'active'
            });
            
            remainingDeduction -= deductAmount;
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

  // Filtering logic
  const filteredPayrolls = useMemo(() => {
    return payrolls.filter(pr => {
      const matchProject = !filterProjectId || pr.projectId === filterProjectId;
      const matchStart = !filterStartDate || pr.periodStart >= filterStartDate;
      const matchEnd = !filterEndDate || pr.periodEnd <= filterEndDate;
      return matchProject && matchStart && matchEnd;
    });
  }, [payrolls, filterProjectId, filterStartDate, filterEndDate]);

  const totalPayrollsPages = Math.ceil(filteredPayrolls.length / payrollsPerPage);
  const paginatedPayrolls = useMemo(() => {
    const start = (payrollsPage - 1) * payrollsPerPage;
    return filteredPayrolls.slice(start, start + payrollsPerPage);
  }, [filteredPayrolls, payrollsPage]);

  const totalWizardPages = Math.ceil(computedLines.length / wizardPerPage);
  const paginatedWizardLines = useMemo(() => {
    const start = (wizardPage - 1) * wizardPerPage;
    return computedLines.slice(start, start + wizardPerPage);
  }, [computedLines, wizardPage]);

  const totalDetailsPages = Math.ceil(detailLines.length / detailsPerPage);
  const paginatedDetailLines = useMemo(() => {
    const start = (detailsPage - 1) * detailsPerPage;
    return detailLines.slice(start, start + detailsPerPage);
  }, [detailLines, detailsPage]);

  // Summary stats (based on filtered results)
  const totalPaid = filteredPayrolls.filter(p => p.status === 'paid').reduce((acc, p) => acc + p.totalNet, 0);
  const totalDraft = filteredPayrolls.filter(p => p.status === 'draft').reduce((acc, p) => acc + p.totalNet, 0);

  const clearFilters = () => {
    setFilterProjectId('');
    setFilterStartDate('');
    setFilterEndDate('');
  };

  return (
    <div className="animate-in">
      <div className="page-header">
        <div>
          <h1>Payroll Management</h1>
          <p style={{ color: 'var(--text)', fontSize: 13, marginTop: 4 }}>Generate and track employee salary payouts</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => { setStep(1); setComputedLines([]); setExcludedWorkers([]); setWizardError(null); setWizardPage(1); setShowWizard(true); }}><FiPlus /> Generate Payroll</button>
        </div>
      </div>

      <div className="kpi-grid-3">
        <div className="kpi-card gradient-kpi kpi-indigo card-shine">
          <div className="kpi-icon"><FiFileText /></div>
          <div className="kpi-value">{payrolls.length}</div>
          <div className="kpi-label">Filtered Payrolls</div>
        </div>
        <div className="kpi-card gradient-kpi kpi-emerald card-shine">
          <div className="kpi-icon"><FiDollarSign /></div>
          <div className="kpi-value">{fmt(totalPaid)}</div>
          <div className="kpi-label">Filtered Amount Disbursed</div>
        </div>
        <div className="kpi-card gradient-kpi kpi-amber card-shine">
          <div className="kpi-icon"><FiClock /></div>
          <div className="kpi-value">{fmt(totalDraft)}</div>
          <div className="kpi-label">Filtered Pending Draft</div>
        </div>
      </div>

      <div className="filter-bar animate-in">
        <div className="filter-item">
          <label><FiFilter style={{ marginRight: 4 }} /> Filter by Project</label>
          <select 
            className="form-select" 
            value={filterProjectId} 
            onChange={e => setFilterProjectId(e.target.value)}
          >
            <option value="">All Projects</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.projectName}</option>)}
          </select>
        </div>
        <div className="filter-item">
          <label>Start Date</label>
          <input 
            type="date" 
            className="form-input" 
            value={filterStartDate} 
            onChange={e => setFilterStartDate(e.target.value)} 
          />
        </div>
        <div className="filter-item">
          <label>End Date</label>
          <input 
            type="date" 
            className="form-input" 
            value={filterEndDate} 
            onChange={e => setFilterEndDate(e.target.value)} 
          />
        </div>
        <div className="filter-actions">
          {(filterProjectId || filterStartDate || filterEndDate) && (
            <button className="btn btn-secondary" onClick={clearFilters}>
              <FiXCircle /> Clear
            </button>
          )}
        </div>
      </div>

      <div className="data-card">
        <div className="data-card-header"><h3>Payroll Records</h3></div>
        <table className="data-table">
          <thead><tr><th>Project</th><th>Type</th><th>Period</th><th>Employees</th><th>Total Net</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {loading ? <SkeletonTable cols={7} rows={4} /> : paginatedPayrolls.length === 0 ? (
              <tr><td colSpan="7"><EmptyState icon={<FiDollarSign />} title="No payrolls found" description="Adjust your filters or generate a new payroll." /></td></tr>
            ) : paginatedPayrolls.map((pr, i) => (
              <tr key={pr.id} className="animate-in" style={{ animationDelay: `${(i % payrollsPerPage) * 0.05}s` }}>
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
        {totalPayrollsPages > 1 && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px 24px', borderTop: '1px solid var(--border-light)',
            flexWrap: 'wrap', gap: 12
          }}>
            <div style={{ fontSize: 13, color: 'var(--text)' }}>
              Showing <strong style={{ color: 'var(--text-heading)' }}>{((payrollsPage - 1) * payrollsPerPage) + 1}</strong> to <strong style={{ color: 'var(--text-heading)' }}>{Math.min(payrollsPage * payrollsPerPage, filteredPayrolls.length)}</strong> of <strong style={{ color: 'var(--text-heading)' }}>{filteredPayrolls.length}</strong> payrolls
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => setPayrollsPage(p => Math.max(1, p - 1))}
                disabled={payrollsPage === 1}
              >
                Previous
              </button>
              {Array.from({ length: totalPayrollsPages }).map((_, idx) => {
                const pageNum = idx + 1;
                if (totalPayrollsPages > 5 && pageNum !== 1 && pageNum !== totalPayrollsPages && Math.abs(pageNum - payrollsPage) > 1) {
                  if (pageNum === 2 || pageNum === totalPayrollsPages - 1) {
                    return <span key={pageNum} style={{ padding: '4px 8px', color: 'var(--text-light)', display: 'inline-block' }}>...</span>;
                  }
                  return null;
                }
                return (
                  <button
                    key={pageNum}
                    className={`btn btn-sm ${payrollsPage === pageNum ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setPayrollsPage(pageNum)}
                    style={{ minWidth: 32 }}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => setPayrollsPage(p => Math.min(totalPayrollsPages, p + 1))}
                disabled={payrollsPage === totalPayrollsPages}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      <Modal show={showWizard} onClose={() => setShowWizard(false)} title="Generate Payroll" size="lg" footer={
        step === 1 ? <>
          <button className="btn btn-secondary" onClick={() => setShowWizard(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={() => { computePayroll(); setStep(2); }} disabled={computing}>
            {computing ? 'Computing...' : 'Compute Payroll →'}
          </button>
        </> : step === 2 ? (
          wizardError ? (
            <button className="btn btn-secondary" onClick={() => { setStep(1); setWizardError(null); }}>← Go Back</button>
          ) : (
            <><span className="spinner" style={{ marginRight: 8 }} /> Computing...</>
          )
        ) : <>
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
            {wizardError ? (
              <>
                <FiXCircle style={{ fontSize: 48, color: 'var(--danger)', marginBottom: 20 }} />
                <h3 style={{ fontSize: 18, color: 'var(--danger-heading)', fontWeight: 600 }}>Computation Failed</h3>
                <p style={{ color: 'var(--text)', fontSize: 14, marginTop: 8, maxWidth: 400, margin: '8px auto 0' }}>{wizardError}</p>
              </>
            ) : (
              <>
                <span className="spinner spinner-lg" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--primary)', marginBottom: 20 }} />
                <h3 style={{ fontSize: 18 }}>Aggregating Attendance Data</h3>
                <p style={{ color: 'var(--text)' }}>Computing regular hours, overtime, and applying cash advance deductions...</p>
              </>
            )}
          </div>
        )}
        {step === 3 && (
          <div>
            {excludedWorkers.length > 0 && (
              <div style={{
                background: '#fffbeb', color: '#b45309', border: '1px solid #fcd34d',
                padding: '12px 16px', borderRadius: 12, marginBottom: 16,
                fontSize: 13, display: 'flex', alignItems: 'center', gap: 10
              }}>
                <FiAlertTriangle style={{ flexShrink: 0, fontSize: 16 }} />
                <span>
                  <strong>Already Paid:</strong> {excludedWorkers.join(', ')} {excludedWorkers.length === 1 ? 'was' : 'were'} excluded from this period to prevent double payment.
                </span>
              </div>
            )}
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
                  {paginatedWizardLines.map((l, i) => (
                    <tr key={i}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div className={`avatar btn-sm ${['indigo', 'emerald', 'rose', 'amber', 'cyan'][i % 5]}`}>{getInitials(l.employeeName)}</div>
                          <span style={{ fontWeight: 600 }}>{l.employeeName}</span>
                        </div>
                      </td>
                      <td>{l.daysPresent}{l.daysHalf > 0 && `+${l.daysHalf}½`} <span style={{ opacity: 0.5 }}>days</span> <span style={{ display: 'block', fontSize: 10, color: 'var(--text)', marginTop: 2 }}>({l.totalHoursWorked || 0} hrs)</span></td>
                      <td>{l.totalOT} <span style={{ opacity: 0.5 }}>hrs</span></td>
                      <td>{fmt(l.grossPay)}</td>
                      <td>
                        {l.caBalance > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span style={{ color: 'var(--danger)', fontWeight: 500, fontSize: 13 }}>-</span>
                              <input
                                type="number"
                                className="form-input"
                                style={{ width: '90px', padding: '4px 8px', fontSize: 12, height: 'auto', textAlign: 'right', display: 'inline-block' }}
                                value={l.caDeduction === 0 ? '' : l.caDeduction}
                                min="0"
                                max={Math.min(l.grossPay, l.caBalance)}
                                step="any"
                                placeholder="0.00"
                                onChange={(e) => handleDeductionChange((wizardPage - 1) * wizardPerPage + i, e.target.value)}
                              />
                            </div>
                            <span style={{ fontSize: 10, color: 'var(--text)', textAlign: 'right', display: 'block', paddingRight: 4 }}>
                              Bal: {fmt(l.caBalance)}
                            </span>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-light)', opacity: 0.5 }}>—</span>
                        )}
                      </td>
                      <td style={{ fontWeight: 700, color: 'var(--success)', fontSize: 14 }}>{fmt(l.netPay)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalWizardPages > 1 && (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 16px', borderTop: '1px solid var(--border-light)',
                flexWrap: 'wrap', gap: 8
              }}>
                <div style={{ fontSize: 12, color: 'var(--text)' }}>
                  Showing <strong>{((wizardPage - 1) * wizardPerPage) + 1}</strong> to <strong>{Math.min(wizardPage * wizardPerPage, computedLines.length)}</strong> of <strong>{computedLines.length}</strong>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={() => setWizardPage(p => Math.max(1, p - 1))}
                    disabled={wizardPage === 1}
                    style={{ padding: '2px 8px', fontSize: 11 }}
                  >
                    Prev
                  </button>
                  {Array.from({ length: totalWizardPages }).map((_, idx) => {
                    const pageNum = idx + 1;
                    if (totalWizardPages > 5 && pageNum !== 1 && pageNum !== totalWizardPages && Math.abs(pageNum - wizardPage) > 1) {
                      if (pageNum === 2 || pageNum === totalWizardPages - 1) {
                        return <span key={pageNum} style={{ padding: '2px 4px', color: 'var(--text-light)', fontSize: 11 }}>...</span>;
                      }
                      return null;
                    }
                    return (
                      <button
                        key={pageNum}
                        className={`btn btn-sm ${wizardPage === pageNum ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setWizardPage(pageNum)}
                        style={{ minWidth: 24, padding: '2px 6px', fontSize: 11 }}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={() => setWizardPage(p => Math.min(totalWizardPages, p + 1))}
                    disabled={wizardPage === totalWizardPages}
                    style={{ padding: '2px 8px', fontSize: 11 }}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
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
                <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}><tr><th>Employee</th><th>Attendance</th><th>OT</th><th>Gross Pay</th><th>Deductions</th><th>Net Pay</th><th className="no-print">Actions</th></tr></thead>
                <tbody>
                  {paginatedDetailLines.length === 0 ? (
                    <tr><td colSpan="6" style={{ textAlign: 'center', padding: 32 }}>No details available</td></tr>
                  ) : paginatedDetailLines.map((l, i) => (
                    <tr key={i}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div className={`avatar btn-sm ${['indigo', 'emerald', 'rose', 'amber', 'cyan'][i % 5]}`}>{getInitials(l.employeeName)}</div>
                          <span style={{ fontWeight: 600 }}>{l.employeeName}</span>
                        </div>
                      </td>
                      <td>{l.daysPresent}{l.daysHalf > 0 && `+${l.daysHalf}½`} <span style={{ opacity: 0.5 }}>days</span> <span style={{ display: 'block', fontSize: 10, color: 'var(--text)', marginTop: 2 }}>({l.totalHoursWorked || 0} hrs)</span></td>
                      <td>{l.totalOT} <span style={{ opacity: 0.5 }}>hrs</span></td>
                      <td>{fmt(l.grossPay)}</td>
                      <td style={{ color: 'var(--danger)', fontWeight: 500 }}>{l.caDeduction > 0 ? `-${fmt(l.caDeduction)}` : '—'}</td>
                      <td style={{ fontWeight: 700, color: showDetail?.status === 'paid' ? 'var(--success)' : 'var(--text-heading)', fontSize: 14 }}>{fmt(l.netPay)}</td>
                      <td className="no-print">
                        <button 
                          className="btn btn-sm btn-ghost" 
                          style={{ color: 'var(--primary)' }}
                          onClick={() => {
                            setSelectedForReceipt({ ...l, companyName });
                            setShowReceiptModal(true);
                          }}
                        >
                          <FiPrinter /> Receipt
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalDetailsPages > 1 && (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 16px', borderTop: '1px solid var(--border-light)',
                flexWrap: 'wrap', gap: 8, marginTop: 8
              }}>
                <div style={{ fontSize: 12, color: 'var(--text)' }}>
                  Showing <strong>{((detailsPage - 1) * detailsPerPage) + 1}</strong> to <strong>{Math.min(detailsPage * detailsPerPage, detailLines.length)}</strong> of <strong>{detailLines.length}</strong> details
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={() => setDetailsPage(p => Math.max(1, p - 1))}
                    disabled={detailsPage === 1}
                    style={{ padding: '2px 8px', fontSize: 11 }}
                  >
                    Prev
                  </button>
                  {Array.from({ length: totalDetailsPages }).map((_, idx) => {
                    const pageNum = idx + 1;
                    if (totalDetailsPages > 5 && pageNum !== 1 && pageNum !== totalDetailsPages && Math.abs(pageNum - detailsPage) > 1) {
                      if (pageNum === 2 || pageNum === totalDetailsPages - 1) {
                        return <span key={pageNum} style={{ padding: '2px 4px', color: 'var(--text-light)', fontSize: 11 }}>...</span>;
                      }
                      return null;
                    }
                    return (
                      <button
                        key={pageNum}
                        className={`btn btn-sm ${detailsPage === pageNum ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setDetailsPage(pageNum)}
                        style={{ minWidth: 24, padding: '2px 6px', fontSize: 11 }}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={() => setDetailsPage(p => Math.min(totalDetailsPages, p + 1))}
                    disabled={detailsPage === totalDetailsPages}
                    style={{ padding: '2px 8px', fontSize: 11 }}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal 
        show={showReceiptModal} 
        onClose={() => setShowReceiptModal(false)} 
        title="Payroll Receipt Preview"
        size="lg"
      >
        {selectedForReceipt && (
          <PayrollReceipt 
            config={receiptConfig}
            payroll={showDetail}
            employee={selectedForReceipt}
            onClose={() => setShowReceiptModal(false)}
          />

        )}
      </Modal>
    </div>

  );
};

export default PayrollManager;
