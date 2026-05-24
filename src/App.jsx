import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './components/ui/ToastContext';
import ProtectedRoute from './components/ProtectedRoute';

// Pages
import Login from './pages/Login';

// Superadmin
import SuperadminDashboard from './pages/superadmin/Dashboard';
import CompanyManager from './pages/superadmin/CompanyManager';
import SuperadminLayout from './layouts/SuperadminLayout';

// Tenant
import TenantDashboard from './pages/tenant/Dashboard';
import TenantLayout from './layouts/TenantLayout';
import AttendanceEncoder from './pages/tenant/AttendanceEncoder';
import EmployeeManager from './pages/tenant/EmployeeManager';
import ProjectManager from './pages/tenant/ProjectManager';
import PayrollManager from './pages/tenant/PayrollManager';
import CashAdvanceManager from './pages/tenant/CashAdvanceManager';
import WorkerTransfer from './pages/tenant/WorkerTransfer';
import Settings from './pages/tenant/Settings';
import AttendanceTracker from './pages/tenant/AttendanceTracker';
import Analytics from './pages/tenant/Analytics';

import 'bootstrap/dist/css/bootstrap.min.css';
import './assets/scss/adminlte.scss';
import './index.css';

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            
            {/* Superadmin Routes */}
            <Route path="/superadmin" element={
              <ProtectedRoute allowedRoles={['superadmin']}>
                <SuperadminLayout />
              </ProtectedRoute>
            }>
              <Route path="dashboard" element={<SuperadminDashboard />} />
              <Route path="companies" element={<CompanyManager />} />
              <Route index element={<Navigate to="dashboard" replace />} />
            </Route>

            {/* Tenant Admin Routes */}
            <Route path="/tenant" element={
              <ProtectedRoute allowedRoles={['company_admin', 'staff']}>
                <TenantLayout />
              </ProtectedRoute>
            }>
              {/* Admin-only pages */}
              <Route path="dashboard" element={
                <ProtectedRoute allowedRoles={['company_admin']}>
                  <TenantDashboard />
                </ProtectedRoute>
              } />
              <Route path="employees" element={
                <ProtectedRoute allowedRoles={['company_admin']}>
                  <EmployeeManager />
                </ProtectedRoute>
              } />
              <Route path="projects" element={
                <ProtectedRoute allowedRoles={['company_admin']}>
                  <ProjectManager />
                </ProtectedRoute>
              } />
              <Route path="payroll" element={
                <ProtectedRoute allowedRoles={['company_admin']}>
                  <PayrollManager />
                </ProtectedRoute>
              } />
              <Route path="cash-advances" element={
                <ProtectedRoute allowedRoles={['company_admin']}>
                  <CashAdvanceManager />
                </ProtectedRoute>
              } />
              <Route path="transfers" element={
                <ProtectedRoute allowedRoles={['company_admin']}>
                  <WorkerTransfer />
                </ProtectedRoute>
              } />
              <Route path="settings" element={
                <ProtectedRoute allowedRoles={['company_admin']}>
                  <Settings />
                </ProtectedRoute>
              } />
              <Route path="analytics" element={
                <ProtectedRoute allowedRoles={['company_admin']}>
                  <Analytics />
                </ProtectedRoute>
              } />
              
              {/* Staff and Admin can see attendance */}
              <Route path="attendance" element={<AttendanceEncoder />} />
              <Route path="tracker" element={<AttendanceTracker />} />
              
              <Route index element={<Navigate to="dashboard" replace />} />
            </Route>

            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
