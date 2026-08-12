const BASE = '';
const TOKEN_KEY = 'practo_sales_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401 && !path.startsWith('/api/auth/login')) {
    setToken('');
    if (!window.location.pathname.startsWith('/login')) {
      window.location.href = '/login';
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }

  const disposition = res.headers.get('Content-Disposition') || '';
  const contentType = res.headers.get('Content-Type') || '';
  if (disposition.includes('attachment') || contentType.includes('text/csv')) {
    return res;
  }
  return res.json();
}

export async function downloadExport(resource, format = 'json') {
  const res = await request(`/api/export/${resource}?format=${format}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${resource}.${format === 'csv' ? 'csv' : 'json'}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const api = {
  login: (body) => request('/api/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  logout: () => request('/api/auth/logout', { method: 'POST' }),
  me: () => request('/api/auth/me'),
  getRoles: () => request('/api/auth/roles'),
  getUsers: () => request('/api/users'),
  createUser: (body) => request('/api/users', { method: 'POST', body: JSON.stringify(body) }),
  updateUser: (id, body) => request(`/api/users/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteUser: (id) => request(`/api/users/${id}`, { method: 'DELETE' }),
  getSystemEvents: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/api/system/events${qs ? `?${qs}` : ''}`);
  },
  getSystemHealth: () => request('/api/system/health'),
  getDashboard: () => request('/api/dashboard'),
  getContacts: (q = '') => request(`/api/contacts${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  createContact: (body) => request('/api/contacts', { method: 'POST', body: JSON.stringify(body) }),
  updateContact: (id, body) =>
    request(`/api/contacts/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteContact: (id) => request(`/api/contacts/${id}`, { method: 'DELETE' }),
  getLeads: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/api/leads${qs ? `?${qs}` : ''}`);
  },
  getLead: (id) => request(`/api/leads/${id}`),
  createLead: (body) => request('/api/leads', { method: 'POST', body: JSON.stringify(body) }),
  updateLead: (id, body) =>
    request(`/api/leads/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteLead: (id) => request(`/api/leads/${id}`, { method: 'DELETE' }),
  searchLeads: (body) =>
    request('/api/lead-generator/search', { method: 'POST', body: JSON.stringify(body) }),
  getLeadGeneratorMeta: () => request('/api/lead-generator/meta'),
  getLeadGeneratorOptions: (params = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ''))
    ).toString();
    return request(`/api/lead-generator/options${qs ? `?${qs}` : ''}`);
  },
  importLeads: (leads) =>
    request('/api/lead-generator/import', { method: 'POST', body: JSON.stringify({ leads }) }),
  getSheetStatus: () => request('/api/sheet/status'),
  syncSheet: () => request('/api/sheet/sync', { method: 'POST' }),
  getCommercialMeta: () => request('/api/commercial/meta'),
  getCommercialInventory: (params = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ''))
    ).toString();
    return request(`/api/commercial/inventory${qs ? `?${qs}` : ''}`);
  },
  refreshCommercial: () => request('/api/commercial/refresh', { method: 'POST' }),
  getCampaigns: () => request('/api/autopilot/campaigns'),
  getAutopilotStats: () => request('/api/autopilot/stats'),
  createCampaign: (body) =>
    request('/api/autopilot/campaigns', { method: 'POST', body: JSON.stringify(body) }),
  updateCampaign: (id, body) =>
    request(`/api/autopilot/campaigns/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  runCampaign: (id) => request(`/api/autopilot/campaigns/${id}/run`, { method: 'POST' }),
  getLeadSettings: () => request('/api/lead-settings'),
  updateLeadSettings: (body) =>
    request('/api/lead-settings', { method: 'PUT', body: JSON.stringify(body) }),
  updateSource: (id, body) =>
    request(`/api/lead-settings/sources/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  getSettings: () => request('/api/settings'),
  updateSettings: (body) => request('/api/settings', { method: 'PUT', body: JSON.stringify(body) }),
  getStages: () => request('/api/pipeline/stages'),
  getIntegrations: () => request('/api/integrations'),
  updateIntegration: (id, body) =>
    request(`/api/integrations/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  testIntegration: (id) => request(`/api/integrations/${id}/test`, { method: 'POST' }),
  createIntegration: (body) =>
    request('/api/integrations', { method: 'POST', body: JSON.stringify(body) }),
};
