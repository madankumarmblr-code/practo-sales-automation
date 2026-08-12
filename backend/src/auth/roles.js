/**
 * Permission roles for Practo Sales Automation.
 * Super Admin manages users & permissions; other roles are assigned by Super Admin.
 */
export const ALL_PERMISSIONS = [
  { id: 'dashboard:read', label: 'Dashboard', group: 'Modules' },
  { id: 'leads:read', label: 'Lead Management (view)', group: 'Modules' },
  { id: 'leads:write', label: 'Lead Management (edit)', group: 'Modules' },
  { id: 'lead_generator:read', label: 'Lead Generator (view)', group: 'Modules' },
  { id: 'lead_generator:write', label: 'Lead Generator (run/import)', group: 'Modules' },
  { id: 'commercial_suite:read', label: 'Commercial Suite (view)', group: 'Modules' },
  { id: 'commercial_suite:write', label: 'Commercial Suite (edit proposals)', group: 'Modules' },
  { id: 'autopilot:read', label: 'Autopilot (view)', group: 'Modules' },
  { id: 'autopilot:write', label: 'Autopilot (edit/run)', group: 'Modules' },
  { id: 'lead_settings:read', label: 'Lead Settings (view)', group: 'Modules' },
  { id: 'lead_settings:write', label: 'Lead Settings (edit)', group: 'Modules' },
  { id: 'settings:read', label: 'Settings (view)', group: 'Modules' },
  { id: 'settings:write', label: 'Settings (edit)', group: 'Modules' },
  { id: 'api_integrations:read', label: 'API Integrations (view)', group: 'Modules' },
  { id: 'api_integrations:write', label: 'API Integrations (edit)', group: 'Modules' },
  { id: 'export:read', label: 'Export data', group: 'Modules' },
  { id: 'users:read', label: 'View users', group: 'Super Admin' },
  { id: 'users:write', label: 'Manage users & permissions', group: 'Super Admin' },
  { id: 'system:logs', label: 'System logs & events', group: 'Super Admin' },
  { id: 'system:health', label: 'Database health checks', group: 'Super Admin' },
];

export const ROLES = {
  superadmin: {
    label: 'Super Admin',
    level: 1000,
    description: 'Full control — users, permissions, logs, and every module',
    permissions: ['*', ...ALL_PERMISSIONS.map((p) => p.id)],
  },
  admin: {
    label: 'Admin',
    level: 100,
    description: 'Full module access without user/system administration',
    permissions: [
      'dashboard:read',
      'leads:read',
      'leads:write',
      'lead_generator:read',
      'lead_generator:write',
      'commercial_suite:read',
      'commercial_suite:write',
      'autopilot:read',
      'autopilot:write',
      'lead_settings:read',
      'lead_settings:write',
      'settings:read',
      'settings:write',
      'api_integrations:read',
      'api_integrations:write',
      'export:read',
    ],
  },
  manager: {
    label: 'Manager',
    level: 70,
    description: 'Manage leads, campaigns, lead settings, and exports',
    permissions: [
      'dashboard:read',
      'leads:read',
      'leads:write',
      'lead_generator:read',
      'lead_generator:write',
      'commercial_suite:read',
      'commercial_suite:write',
      'autopilot:read',
      'autopilot:write',
      'lead_settings:read',
      'lead_settings:write',
      'settings:read',
      'api_integrations:read',
      'export:read',
    ],
  },
  agent: {
    label: 'Sales Agent',
    level: 40,
    description: 'Work leads, generator, and autopilot',
    permissions: [
      'dashboard:read',
      'leads:read',
      'leads:write',
      'lead_generator:read',
      'lead_generator:write',
      'commercial_suite:read',
      'commercial_suite:write',
      'autopilot:read',
      'autopilot:write',
      'settings:read',
      'export:read',
    ],
  },
  viewer: {
    label: 'Viewer',
    level: 10,
    description: 'Read-only access to dashboard and leads',
    permissions: [
      'dashboard:read',
      'leads:read',
      'lead_generator:read',
      'commercial_suite:read',
      'autopilot:read',
      'settings:read',
    ],
  },
};

export function permissionsForRole(role) {
  const list = ROLES[role]?.permissions || [];
  return [...new Set(list)];
}

export function hasPermission(user, permission) {
  if (!user) return false;
  const perms = Array.isArray(user.permissions)
    ? user.permissions
    : JSON.parse(user.permissions || '[]');
  return perms.includes('*') || perms.includes(permission);
}

export function isSuperAdmin(user) {
  if (!user) return false;
  return user.role === 'superadmin' || hasPermission(user, '*');
}

export function assignableRoles() {
  return Object.entries(ROLES)
    .filter(([id]) => id !== 'superadmin')
    .map(([id, r]) => ({
      id,
      label: r.label,
      level: r.level,
      description: r.description,
      permissions: r.permissions,
    }));
}
