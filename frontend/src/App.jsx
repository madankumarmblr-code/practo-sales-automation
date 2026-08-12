import { useEffect, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { SpeedInsights } from '@vercel/speed-insights/react';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import LeadGenerator from './pages/LeadGenerator';
import CommercialSuite from './pages/CommercialSuite';
import LeadManagement from './pages/LeadManagement';
import Autopilot from './pages/Autopilot';
import LeadSettings from './pages/LeadSettings';
import ApiIntegrations from './pages/ApiIntegrations';
import Settings from './pages/Settings';
import SuperAdmin from './pages/SuperAdmin';
import Login from './pages/Login';
import { ToastContext } from './hooks/useToast';
import { AuthProvider } from './hooks/useAuth';

export default function App() {
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(''), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <AuthProvider>
      <ToastContext.Provider value={setToast}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<Layout toast={toast} />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/lead-generator" element={<LeadGenerator />} />
            <Route path="/commercial-suite" element={<CommercialSuite />} />
            <Route path="/leads" element={<LeadManagement />} />
            <Route path="/autopilot" element={<Autopilot />} />
            <Route path="/lead-settings" element={<LeadSettings />} />
            <Route path="/api-integrations" element={<ApiIntegrations />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/super-admin" element={<SuperAdmin />} />
          </Route>
        </Routes>
        <SpeedInsights />
      </ToastContext.Provider>
    </AuthProvider>
  );
}
