import { useEffect, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Contacts from './pages/Contacts';
import LeadGenerator from './pages/LeadGenerator';
import LeadManagement from './pages/LeadManagement';
import Autopilot from './pages/Autopilot';
import LeadSettings from './pages/LeadSettings';
import Settings from './pages/Settings';
import { ToastContext } from './hooks/useToast';

export default function App() {
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(''), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <ToastContext.Provider value={setToast}>
      <Routes>
        <Route element={<Layout toast={toast} />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/contacts" element={<Contacts />} />
          <Route path="/lead-generator" element={<LeadGenerator />} />
          <Route path="/leads" element={<LeadManagement />} />
          <Route path="/autopilot" element={<Autopilot />} />
          <Route path="/lead-settings" element={<LeadSettings />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </ToastContext.Provider>
  );
}
