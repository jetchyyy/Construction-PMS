import React, { useState, useEffect } from 'react';
import { db } from '../../firebase/config';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/ui/ToastContext';
import { format, subDays, startOfMonth, endOfMonth, eachDayOfInterval, parseISO } from 'date-fns';
import { 
  FiTrendingUp, FiAlertCircle, FiClock, FiUsers, FiCalendar, 
  FiBriefcase, FiArrowUpRight, FiSearch, FiDollarSign, FiPercent, FiTrendingDown 
} from 'react-icons/fi';

const Analytics = () => {
  const { companyId } = useAuth();
  const { addToast } = useToast();

  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState('all');
  const [dateRange, setDateRange] = useState('30'); // '7', '30', 'month', 'custom'
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState({});
  const [analyticsData, setAnalyticsData] = useState({
    absentLeaderboard: [],
    otLeaderboard: [],
    presentLeaderboard: [],
    projectComparison: [],
    totals: { present: 0, absent: 0, halfDay: 0, totalOt: 0 },
    financials: {
      totalNetPaid: 0,
      totalGrossPaid: 0,
      totalRegularPay: 0,
      totalOtPay: 0,
      totalCaDeductions: 0,
      totalPendingDraft: 0,
      avgPayoutPerWorker: 0,
      projectCosts: []
    }
  });

  const fmt = (val) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(val || 0);

  // Handle Date Range Preset Changes
  useEffect(() => {
    const today = new Date();
    if (dateRange === '7') {
      setStartDate(format(subDays(today, 7), 'yyyy-MM-dd'));
      setEndDate(format(today, 'yyyy-MM-dd'));
    } else if (dateRange === '30') {
      setStartDate(format(subDays(today, 30), 'yyyy-MM-dd'));
      setEndDate(format(today, 'yyyy-MM-dd'));
    } else if (dateRange === 'month') {
      setStartDate(format(startOfMonth(today), 'yyyy-MM-dd'));
      setEndDate(format(endOfMonth(today), 'yyyy-MM-dd'));
    }
  }, [dateRange]);

  // Fetch initial projects & employees
  useEffect(() => {
    if (!companyId) return;
    const fetchData = async () => {
      try {
        const [projSnap, empSnap] = await Promise.all([
          getDocs(query(collection(db, 'projects'), where('companyId', '==', companyId))),
          getDocs(query(collection(db, 'employees'), where('companyId', '==', companyId)))
        ]);
        
        setProjects(projSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        
        const empMap = {};
        empSnap.docs.forEach(d => {
          empMap[d.id] = { id: d.id, ...d.data() };
        });
        setEmployees(empMap);
      } catch (err) {
        addToast('Failed to load initial data', 'error');
      }
    };
    fetchData();
  }, [companyId]);

  const loadAnalytics = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const targetProjects = projectId === 'all' 
        ? projects.map(p => p.id) 
        : [projectId];

      const start = parseISO(startDate);
      const end = parseISO(endDate);
      const days = eachDayOfInterval({ start, end });

      const aggregates = {};
      const projAggregates = {};
      
      let totalPresent = 0;
      let totalAbsent = 0;
      let totalHalfDay = 0;
      let totalOt = 0;

      // 1. Fetch all attendance logs for the target projects & dates in parallel chunks
      for (const pid of targetProjects) {
        projAggregates[pid] = { present: 0, absent: 0, halfDay: 0, totalRecords: 0 };
        for (const day of days) {
          const dateStr = format(day, 'yyyy-MM-dd');
          const attSnap = await getDocs(collection(db, 'attendance', companyId, 'projects', pid, 'dates', dateStr, 'records'));
          
          attSnap.docs.forEach(doc => {
            const data = doc.data();
            const empId = doc.id;

            if (!aggregates[empId]) {
              aggregates[empId] = { present: 0, absent: 0, halfDay: 0, ot: 0, regularHours: 0 };
            }

            if (data.status === 'present') {
              aggregates[empId].present++;
              projAggregates[pid].present++;
              totalPresent++;
            } else if (data.status === 'half-day') {
              aggregates[empId].halfDay++;
              projAggregates[pid].halfDay++;
              totalHalfDay++;
            } else if (data.status === 'absent') {
              aggregates[empId].absent++;
              projAggregates[pid].absent++;
              totalAbsent++;
            }

            const otVal = Number(data.overtimeHours || 0);
            aggregates[empId].ot += otVal;
            totalOt += otVal;

            aggregates[empId].regularHours += data.hoursWorked !== undefined 
              ? Number(data.hoursWorked) 
              : (data.status === 'present' ? 8 : data.status === 'half-day' ? 4 : 0);

            projAggregates[pid].totalRecords++;
          });
        }
      }

      // 2. Fetch and aggregate Payroll Data
      const payQuery = query(collection(db, 'payrolls'), where('companyId', '==', companyId));
      const paySnap = await getDocs(payQuery);
      
      let totalNetPaid = 0;
      let totalGrossPaid = 0;
      let totalPendingDraft = 0;
      let paidCount = 0;
      const paidPayrollIds = [];
      const projectCostMap = {};

      paySnap.docs.forEach(docDoc => {
        const pr = docDoc.data();
        const prId = docDoc.id;

        // Apply filters
        const isTargetProject = projectId === 'all' || pr.projectId === projectId;
        const isWithinDateRange = pr.periodStart >= startDate && pr.periodEnd <= endDate;

        if (isTargetProject && isWithinDateRange) {
          if (pr.status === 'paid') {
            totalNetPaid += pr.totalNet || 0;
            totalGrossPaid += pr.totalGross || 0;
            paidCount += pr.employeeCount || 0;
            paidPayrollIds.push(prId);

            if (!projectCostMap[pr.projectId]) {
              projectCostMap[pr.projectId] = 0;
            }
            projectCostMap[pr.projectId] += pr.totalNet || 0;
          } else if (pr.status === 'draft') {
            totalPendingDraft += pr.totalNet || 0;
          }
        }
      });

      // 3. Fetch detail breakdowns for paid payrolls
      let totalRegularPay = 0;
      let totalOtPay = 0;
      let totalCaDeductions = 0;

      if (paidPayrollIds.length > 0) {
        const chunks = [];
        for (let i = 0; i < paidPayrollIds.length; i += 30) {
          chunks.push(paidPayrollIds.slice(i, i + 30));
        }

        for (const chunk of chunks) {
          const detailSnap = await getDocs(query(
            collection(db, 'payrollDetails'),
            where('payrollId', 'in', chunk)
          ));
          detailSnap.docs.forEach(lineDoc => {
            const d = lineDoc.data();
            totalRegularPay += d.regularPay || 0;
            totalOtPay += d.otPay || 0;
            totalCaDeductions += d.caDeduction || 0;
          });
        }
      }

      const avgPayoutPerWorker = paidCount > 0 ? totalNetPaid / paidCount : 0;

      const projectCosts = Object.keys(projectCostMap).map(pid => {
        const proj = projects.find(p => p.id === pid);
        return {
          projectName: proj?.projectName || 'Unknown Site',
          location: proj?.location || 'Unknown Location',
          cost: projectCostMap[pid]
        };
      }).sort((a, b) => b.cost - a.cost);

      // Format leaders
      const leaderboard = Object.keys(aggregates).map(empId => {
        const empInfo = employees[empId] || { fullName: 'Unknown Employee', role: 'Worker' };
        return {
          id: empId,
          name: empInfo.fullName,
          role: empInfo.role,
          ...aggregates[empId]
        };
      });

      // Sort segments
      const absentLeaderboard = [...leaderboard]
        .filter(w => w.absent > 0)
        .sort((a, b) => b.absent - a.absent)
        .slice(0, 10);

      const otLeaderboard = [...leaderboard]
        .filter(w => w.ot > 0)
        .sort((a, b) => b.ot - a.ot)
        .slice(0, 10);

      const presentLeaderboard = [...leaderboard]
        .filter(w => w.present > 0 || w.halfDay > 0)
        .sort((a, b) => b.present - a.present)
        .slice(0, 10);

      // Compare projects
      const projectComparison = Object.keys(projAggregates).map(pid => {
        const proj = projects.find(p => p.id === pid);
        const agg = projAggregates[pid];
        const rate = agg.totalRecords > 0 
          ? ((agg.present + 0.5 * agg.halfDay) / agg.totalRecords) * 100
          : 0;
        return {
          projectName: proj?.projectName || 'Unknown Site',
          location: proj?.location || 'Unknown Location',
          rate: parseFloat(rate.toFixed(1)),
          ...agg
        };
      }).sort((a, b) => b.rate - a.rate);

      setAnalyticsData({
        absentLeaderboard,
        otLeaderboard,
        presentLeaderboard,
        projectComparison,
        totals: { present: totalPresent, absent: totalAbsent, halfDay: totalHalfDay, totalOt: totalOt },
        financials: {
          totalNetPaid,
          totalGrossPaid,
          totalRegularPay,
          totalOtPay,
          totalCaDeductions,
          totalPendingDraft,
          avgPayoutPerWorker,
          projectCosts
        }
      });

    } catch (err) {
      addToast('Error computing analytics dashboard', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projects.length > 0 && Object.keys(employees).length > 0) {
      loadAnalytics();
    }
  }, [projects, employees, projectId, startDate, endDate]);

  const getInitials = (name) => (name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="animate-in">
      <div className="page-header">
        <div>
          <h1>Workforce Analytics</h1>
          <p style={{ color: 'var(--text)', fontSize: 13, marginTop: 4 }}>Labor cost breakdowns, company-wide payouts, absent scoreboards, and project analytics</p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="data-card" style={{ padding: '20px 24px', marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, alignItems: 'end' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Project Site</label>
            <select className="form-input" value={projectId} onChange={e => setProjectId(e.target.value)}>
              <option value="all">All Sites / Project Locations</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.projectName}</option>)}
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Date Range Preset</label>
            <select className="form-input" value={dateRange} onChange={e => setDateRange(e.target.value)}>
              <option value="7">Last 7 Days</option>
              <option value="30">Last 30 Days</option>
              <option value="month">This Calendar Month</option>
              <option value="custom">Custom Date Range</option>
            </select>
          </div>

          {dateRange === 'custom' && (
            <>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Start Date</label>
                <input type="date" className="form-input" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>End Date</label>
                <input type="date" className="form-input" value={endDate} onChange={e => setEndDate(e.target.value)} />
              </div>
            </>
          )}

          <button className="btn btn-primary" onClick={loadAnalytics} disabled={loading} style={{ height: 42, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <FiSearch style={{ marginRight: 6 }} /> Refresh Analytics
          </button>
        </div>
      </div>

      {loading ? (
        <div className="data-card" style={{ padding: '80px 0', textAlign: 'center' }}>
          <span className="spinner spinner-lg" />
          <p style={{ color: 'var(--text)', marginTop: 16 }}>Compiling logs and generating attendance scoreboards...</p>
        </div>
      ) : (
        <>
          {/* Section Heading: Financial Analytics */}
          <div className="page-header" style={{ marginBottom: 16, marginTop: 12 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-heading)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <FiDollarSign style={{ color: 'var(--primary)' }} /> Financial Labor Cost Report
            </h2>
          </div>

          {/* Key Financial KPIs */}
          <div className="kpi-grid-4" style={{ marginBottom: 24 }}>
            <div className="kpi-card gradient-kpi kpi-emerald card-shine">
              <div className="kpi-icon"><FiDollarSign /></div>
              <div className="kpi-value" style={{ fontSize: 20 }}>{fmt(analyticsData.financials.totalNetPaid)}</div>
              <div className="kpi-label">Total Paid Out (Net Pay)</div>
            </div>
            <div className="kpi-card gradient-kpi kpi-indigo card-shine">
              <div className="kpi-icon"><FiTrendingUp /></div>
              <div className="kpi-value" style={{ fontSize: 20 }}>{fmt(analyticsData.financials.totalGrossPaid)}</div>
              <div className="kpi-label">Gross Labor Cost</div>
            </div>
            <div className="kpi-card gradient-kpi kpi-rose card-shine">
              <div className="kpi-icon"><FiTrendingDown /></div>
              <div className="kpi-value" style={{ fontSize: 20 }}>{fmt(analyticsData.financials.totalCaDeductions)}</div>
              <div className="kpi-label">Cash Advances Recouped</div>
            </div>
            <div className="kpi-card gradient-kpi kpi-amber card-shine">
              <div className="kpi-icon"><FiClock /></div>
              <div className="kpi-value" style={{ fontSize: 20 }}>{fmt(analyticsData.financials.totalPendingDraft)}</div>
              <div className="kpi-label">Pending Draft Liabilities</div>
            </div>
          </div>

          {/* Financial Details Row */}
          <div className="kpi-grid-2" style={{ marginBottom: 32 }}>
            {/* Left Box: Payment Categories */}
            <div className="data-card" style={{ padding: 20 }}>
              <div className="data-card-header" style={{ padding: '0 0 12px', borderBottom: '1px solid var(--border-light)', marginBottom: 16 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700 }}>Labor Cost Breakdown</h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Average worker payout */}
                <div style={{ background: 'var(--bg)', padding: '12px 16px', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text)', fontWeight: 600 }}>AVERAGE PAYOUT PER WORKER</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-heading)', marginTop: 2 }}>{fmt(analyticsData.financials.avgPayoutPerWorker)}</div>
                  </div>
                  <FiUsers style={{ fontSize: 24, color: 'var(--text)', opacity: 0.3 }} />
                </div>

                {/* Regular vs Overtime ratios */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
                    <span>Regular Hours Payout</span>
                    <span style={{ color: 'var(--text-heading)' }}>{fmt(analyticsData.financials.totalRegularPay)}</span>
                  </div>
                  <div style={{ width: '100%', height: 8, background: 'var(--border-light)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ 
                      width: `${analyticsData.financials.totalGrossPaid > 0 ? (analyticsData.financials.totalRegularPay / analyticsData.financials.totalGrossPaid) * 100 : 0}%`, 
                      height: '100%', 
                      background: 'var(--success)', 
                      borderRadius: 4 
                    }}></div>
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
                    <span>Overtime Payout</span>
                    <span style={{ color: 'var(--text-heading)' }}>{fmt(analyticsData.financials.totalOtPay)}</span>
                  </div>
                  <div style={{ width: '100%', height: 8, background: 'var(--border-light)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ 
                      width: `${analyticsData.financials.totalGrossPaid > 0 ? (analyticsData.financials.totalOtPay / analyticsData.financials.totalGrossPaid) * 100 : 0}%`, 
                      height: '100%', 
                      background: 'var(--primary)', 
                      borderRadius: 4 
                    }}></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Box: Labor Cost by Project site */}
            <div className="data-card" style={{ padding: 20 }}>
              <div className="data-card-header" style={{ padding: '0 0 12px', borderBottom: '1px solid var(--border-light)', marginBottom: 16 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700 }}>Expenditure by Project Site</h3>
              </div>
              <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                {analyticsData.financials.projectCosts.length === 0 ? (
                  <p style={{ color: 'var(--text)', textAlign: 'center', padding: 20 }}>No paid payroll allocations in this range.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {analyticsData.financials.projectCosts.map((item, idx) => {
                      const maxCost = Math.max(...analyticsData.financials.projectCosts.map(i => i.cost));
                      const ratio = maxCost > 0 ? (item.cost / maxCost) * 100 : 0;
                      return (
                        <div key={idx}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, marginBottom: 4 }}>
                            <div>
                              <span style={{ fontWeight: 600, color: 'var(--text-heading)' }}>{item.projectName}</span>
                              <span style={{ color: 'var(--text-light)', marginLeft: 6, fontSize: 10 }}>({item.location})</span>
                            </div>
                            <span style={{ fontWeight: 700, color: 'var(--text-heading)' }}>{fmt(item.cost)}</span>
                          </div>
                          <div style={{ width: '100%', height: 6, background: 'var(--border-light)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ width: `${ratio}%`, height: '100%', background: 'var(--primary)', borderRadius: 3 }}></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section Heading: Attendance Analytics */}
          <div className="page-header" style={{ marginBottom: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-heading)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <FiCalendar style={{ color: 'var(--primary)' }} /> Workforce Attendance Analytics
            </h2>
          </div>

          {/* Key KPI Stats */}
          <div className="kpi-grid-4" style={{ marginBottom: 24 }}>
            <div className="kpi-card gradient-kpi kpi-emerald">
              <div className="kpi-icon"><FiUsers /></div>
              <div className="kpi-value">{analyticsData.totals.present}</div>
              <div className="kpi-label">Days Present Logged</div>
            </div>
            <div className="kpi-card gradient-kpi kpi-amber">
              <div className="kpi-icon"><FiClock /></div>
              <div className="kpi-value">{analyticsData.totals.halfDay}</div>
              <div className="kpi-label">Half-Day Logs</div>
            </div>
            <div className="kpi-card gradient-kpi kpi-rose">
              <div className="kpi-icon"><FiAlertCircle /></div>
              <div className="kpi-value">{analyticsData.totals.absent}</div>
              <div className="kpi-label">Absences Logged</div>
            </div>
            <div className="kpi-card gradient-kpi kpi-indigo">
              <div className="kpi-icon"><FiTrendingUp /></div>
              <div className="kpi-value">{analyticsData.totals.totalOt} hrs</div>
              <div className="kpi-label">Overtime Logged</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 24 }}>
            {/* Leaderboard: Most Absences */}
            <div className="data-card">
              <div className="data-card-header" style={{ borderBottom: '1px solid var(--border-light)' }}>
                <h3 style={{ color: 'var(--danger)', fontWeight: 600 }}>Highest Absences Leaderboard</h3>
              </div>
              <div style={{ padding: 20 }}>
                {analyticsData.absentLeaderboard.length === 0 ? (
                  <p style={{ color: 'var(--text)', textAlign: 'center', padding: 32 }}>No absences logged in this date range.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {analyticsData.absentLeaderboard.map((item, index) => {
                      const totalDays = item.present + item.halfDay + item.absent;
                      const percentage = totalDays > 0 ? (item.absent / totalDays) * 100 : 0;
                      return (
                        <div key={item.id}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-light)', width: 20 }}>#{index + 1}</div>
                              <div className={`avatar btn-sm ${['indigo', 'emerald', 'rose', 'amber', 'cyan'][index % 5]}`}>{getInitials(item.name)}</div>
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-heading)' }}>{item.name}</div>
                                <div style={{ fontSize: 11, color: 'var(--text)' }}>{item.role}</div>
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--danger)' }}>{item.absent}</span>
                              <span style={{ fontSize: 11, color: 'var(--text)', marginLeft: 4 }}>absences</span>
                            </div>
                          </div>
                          <div style={{ width: '100%', height: 6, background: 'var(--border-light)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ width: `${Math.min(100, percentage)}%`, height: '100%', background: 'var(--danger)', borderRadius: 3 }}></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Leaderboard: Most Overtime */}
            <div className="data-card">
              <div className="data-card-header" style={{ borderBottom: '1px solid var(--border-light)' }}>
                <h3 style={{ color: 'var(--primary)', fontWeight: 600 }}>Highest Overtime Leaderboard</h3>
              </div>
              <div style={{ padding: 20 }}>
                {analyticsData.otLeaderboard.length === 0 ? (
                  <p style={{ color: 'var(--text)', textAlign: 'center', padding: 32 }}>No overtime logged in this date range.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {analyticsData.otLeaderboard.map((item, index) => {
                      const maxOT = Math.max(...analyticsData.otLeaderboard.map(i => i.ot));
                      const progress = maxOT > 0 ? (item.ot / maxOT) * 100 : 0;
                      return (
                        <div key={item.id}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-light)', width: 20 }}>#{index + 1}</div>
                              <div className={`avatar btn-sm ${['indigo', 'emerald', 'rose', 'amber', 'cyan'][index % 5]}`}>{getInitials(item.name)}</div>
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-heading)' }}>{item.name}</div>
                                <div style={{ fontSize: 11, color: 'var(--text)' }}>{item.role}</div>
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--primary)' }}>{item.ot}</span>
                              <span style={{ fontSize: 11, color: 'var(--text)', marginLeft: 4 }}>OT hrs</span>
                            </div>
                          </div>
                          <div style={{ width: '100%', height: 6, background: 'var(--border-light)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ width: `${progress}%`, height: '100%', background: 'var(--primary)', borderRadius: 3 }}></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Leaderboard: High Attendance / Most Present */}
            <div className="data-card">
              <div className="data-card-header" style={{ borderBottom: '1px solid var(--border-light)' }}>
                <h3 style={{ color: 'var(--success)', fontWeight: 600 }}>Top Attendance Rank</h3>
              </div>
              <div style={{ padding: 20 }}>
                {analyticsData.presentLeaderboard.length === 0 ? (
                  <p style={{ color: 'var(--text)', textAlign: 'center', padding: 32 }}>No attendance logs found.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {analyticsData.presentLeaderboard.map((item, index) => {
                      const totalDays = item.present + item.halfDay + item.absent;
                      const attendanceRate = totalDays > 0 ? ((item.present + 0.5 * item.halfDay) / totalDays) * 100 : 0;
                      return (
                        <div key={item.id}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-light)', width: 20 }}>#{index + 1}</div>
                              <div className={`avatar btn-sm ${['indigo', 'emerald', 'rose', 'amber', 'cyan'][index % 5]}`}>{getInitials(item.name)}</div>
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-heading)' }}>{item.name}</div>
                                <div style={{ fontSize: 11, color: 'var(--text)' }}>{item.regularHours} reg hrs ({item.present}d Present)</div>
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--success)' }}>{attendanceRate.toFixed(0)}%</span>
                              <span style={{ fontSize: 11, color: 'var(--text)', marginLeft: 4 }}>rate</span>
                            </div>
                          </div>
                          <div style={{ width: '100%', height: 6, background: 'var(--border-light)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ width: `${attendanceRate}%`, height: '100%', background: 'var(--success)', borderRadius: 3 }}></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Project Site Performance Comparison */}
            <div className="data-card">
              <div className="data-card-header" style={{ borderBottom: '1px solid var(--border-light)' }}>
                <h3 style={{ color: 'var(--text-heading)', fontWeight: 600 }}>Project Site Attendance Rates</h3>
              </div>
              <div style={{ padding: 20 }}>
                {analyticsData.projectComparison.length === 0 ? (
                  <p style={{ color: 'var(--text)', textAlign: 'center', padding: 32 }}>No project attendance data in this date range.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {analyticsData.projectComparison.map((item, index) => {
                      return (
                        <div key={index}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-heading)' }}>{item.projectName}</div>
                              <div style={{ fontSize: 11, color: 'var(--text)' }}>{item.location} ({item.totalRecords} entries)</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <span style={{ fontSize: 14, fontWeight: 700, color: item.rate >= 90 ? 'var(--success)' : item.rate >= 75 ? 'var(--primary)' : 'var(--warning)' }}>{item.rate}%</span>
                            </div>
                          </div>
                          <div style={{ width: '100%', height: 6, background: 'var(--border-light)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ 
                              width: `${item.rate}%`, 
                              height: '100%', 
                              background: item.rate >= 90 ? 'var(--success)' : item.rate >= 75 ? 'var(--primary)' : 'var(--warning)', 
                              borderRadius: 3 
                            }}></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Analytics;
