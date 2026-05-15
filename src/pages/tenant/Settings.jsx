import React, { useState, useEffect } from 'react';
import { db } from '../../firebase/config';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/ui/ToastContext';
import { FiSettings, FiSave, FiBriefcase, FiDollarSign, FiClock, FiCheckCircle } from 'react-icons/fi';

const Settings = () => {
  const { companyId } = useAuth();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [company, setCompany] = useState(null);
  const [form, setForm] = useState({
    name: '',
    otRateMultiplier: '1.25',
    restDayOtMultiplier: '1.30',
    currency: 'PHP',
    workHoursPerDay: '8',
  });

  useEffect(() => {
    if (!companyId) return;
    const fetch = async () => {
      setLoading(true);
      try {
        const snap = await getDoc(doc(db, 'companies', companyId));
        if (snap.exists()) {
          const data = snap.data();
          setCompany(data);
          setForm({
            name: data.name || '',
            otRateMultiplier: String(data.settings?.otRateMultiplier || 1.25),
            restDayOtMultiplier: String(data.settings?.restDayOtMultiplier || 1.30),
            currency: data.settings?.currency || 'PHP',
            workHoursPerDay: String(data.settings?.workHoursPerDay || 8),
          });
        }
      } catch (err) {
        addToast('Failed to load settings', 'error');
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [companyId]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);
    try {
      await updateDoc(doc(db, 'companies', companyId), {
        name: form.name,
        settings: {
          otRateMultiplier: parseFloat(form.otRateMultiplier),
          restDayOtMultiplier: parseFloat(form.restDayOtMultiplier),
          currency: form.currency,
          workHoursPerDay: parseInt(form.workHoursPerDay),
        },
        updatedAt: serverTimestamp(),
      });
      addToast('Settings saved successfully', 'success');
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      addToast('Error saving: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-in">
        <div className="page-header">
          <div>
            <h1>Settings</h1>
            <p style={{ color: 'var(--text)', fontSize: 13, marginTop: 4 }}>Configure your company preferences and payroll rules</p>
          </div>
        </div>
        <div className="data-card" style={{ padding: 60, textAlign: 'center' }}>
          <span className="spinner spinner-lg" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--primary)' }} />
          <div style={{ marginTop: 16, color: 'var(--text)' }}>Loading configuration...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in">
      <div className="page-header">
        <div>
          <h1>Settings</h1>
          <p style={{ color: 'var(--text)', fontSize: 13, marginTop: 4 }}>Configure your company preferences and payroll rules</p>
        </div>
      </div>

      <div style={{ maxWidth: 800 }}>
        <form onSubmit={handleSave}>
          {/* Company Profile Section */}
          <div className="data-card animate-in" style={{ marginBottom: 24, animationDelay: '0s' }}>
            <div className="data-card-header" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                <FiBriefcase />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Company Profile</h3>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--text)' }}>Basic information about your construction business</p>
              </div>
            </div>
            <div style={{ padding: 24 }}>
              <div className="form-group" style={{ maxWidth: 400 }}>
                <label>Company Name</label>
                <input className="form-input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required placeholder="Enter your company name" />
                <span style={{ fontSize: 11, color: 'var(--text)', display: 'block', marginTop: 4 }}>This name appears on the sidebar and payroll documents.</span>
              </div>
            </div>
          </div>

          {/* Payroll Configuration Section */}
          <div className="data-card animate-in" style={{ marginBottom: 32, animationDelay: '0.1s' }}>
            <div className="data-card-header" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--emerald-light, rgba(16, 185, 129, 0.1))', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                <FiDollarSign />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Payroll & Rates</h3>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--text)' }}>Global multipliers used for salary computation</p>
              </div>
            </div>
            
            <div style={{ padding: 24 }}>
              <div className="form-row">
                <div className="form-group">
                  <label>Standard Work Hours</label>
                  <div style={{ position: 'relative' }}>
                    <FiClock style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text)' }} />
                    <input type="number" className="form-input" style={{ paddingLeft: 36 }} value={form.workHoursPerDay} onChange={e => setForm({...form, workHoursPerDay: e.target.value})} min="1" max="24" required />
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text)', display: 'block', marginTop: 4 }}>Hours per day before overtime kicks in. Default is 8.</span>
                </div>
                
                <div className="form-group">
                  <label>Currency</label>
                  <select className="form-input" value={form.currency} onChange={e => setForm({...form, currency: e.target.value})}>
                    <option value="PHP">Philippine Peso (₱)</option>
                    <option value="USD">US Dollar ($)</option>
                  </select>
                </div>
              </div>

              <div style={{ height: 1, background: 'var(--border-light)', margin: '24px 0' }}></div>

              <div className="form-row">
                <div className="form-group">
                  <label>Regular OT Multiplier</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <input type="number" className="form-input" value={form.otRateMultiplier} onChange={e => setForm({...form, otRateMultiplier: e.target.value})} step="0.01" min="1" required />
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', background: 'var(--bg)', padding: '8px 12px', borderRadius: 8 }}>{Math.round(form.otRateMultiplier * 100)}%</span>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text)', display: 'block', marginTop: 4 }}>Multiplier for work beyond regular hours (e.g. 1.25).</span>
                </div>
                
                <div className="form-group">
                  <label>Rest Day OT Multiplier</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <input type="number" className="form-input" value={form.restDayOtMultiplier} onChange={e => setForm({...form, restDayOtMultiplier: e.target.value})} step="0.01" min="1" required />
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', background: 'var(--bg)', padding: '8px 12px', borderRadius: 8 }}>{Math.round(form.restDayOtMultiplier * 100)}%</span>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text)', display: 'block', marginTop: 4 }}>Multiplier for work rendered on rest days/holidays (e.g. 1.30).</span>
                </div>
              </div>
            </div>
          </div>

          <div className="animate-in" style={{ display: 'flex', alignItems: 'center', gap: 16, animationDelay: '0.2s' }}>
            <button className="btn btn-primary btn-lg" type="submit" disabled={saving} style={{ padding: '12px 32px' }}>
              {saving ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Saving...</> : <><FiSave /> Save Configuration</>}
            </button>
            
            {saveSuccess && (
              <div className="animate-in" style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--success)', fontWeight: 500, fontSize: 14 }}>
                <FiCheckCircle /> Settings updated successfully
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default Settings;
