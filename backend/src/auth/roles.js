/**
 * Permission roles for Practo Sales Automation.
 * Higher level includes broader access; permissions are explicit lists.
 */
export const ROLES = {
  admin: {
    label: 'Admin',
    level: 100,
    description: 'Full access — users, integrations, export, and all modules',
    permissions: [
      'dashboard:read',
      'contacts:read',
      'contacts:write',
      'leads:read',
      'leads:write',
      'lead_generator:read',
      'lead_generator:write',
      'autopilot:read',
      'autopilot:write',
      'lead_settings:read',
      'lead_settings:write',
      'settings:read',
      'settings:write',
      'api_integrations:read',
      'api_integrations:write',
      'export:read',
      'users:read',
      'users:write',
    ],
  },
  manager: {
    label: 'Manager',
    level: 70,
    description: 'Manage leads, campaigns, lead settings, and exports',
    permissions: [
      'dashboard:read',
      'contacts:read',
      'contacts:write',
      'leads:read',
      'leads:write',
      'lead_generator:read',
      'lead_generator:write',
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
    description: 'Work contacts, leads, generator, and autopilot run',
    permissions: [
      'dashboard:read',
      'contacts:read',
      'contacts:write',
      'leads:read',
      'leads:write',
      'lead_generator:read',
      'lead_generator:write',
      'autopilot:read',
      'autopilot:write',
      'settings:read',
      'export:read',
    ],
  },
  viewer: {
    label: 'Viewer',
    level: 10,
    description: 'Read-only access to dashboard, contacts, and leads',
    permissions: [
      'dashboard:read',
      'contacts:read',
      'leads:read',
      'lead_generator:read',
      'autopilot:read',
      'settings:read',
    ],
  },
};

export function permissionsForRole(role) {
  return ROLES[role]?.permissions || [];
}

export function hasPermission(user, permission) {
  if (!user) return false;
  const perms = Array.isArray(user.permissions)
    ? user.permissions
    : JSON.parse(user.permissions || '[]');
  return perms.includes(permission) || perms.includes('*');
}
