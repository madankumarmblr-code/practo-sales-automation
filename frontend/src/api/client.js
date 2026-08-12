const BASE = '';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

export const api = {
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
  importLeads: (leads) =>
    request('/api/lead-generator/import', { method: 'POST', body: JSON.stringify({ leads }) }),
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
};
