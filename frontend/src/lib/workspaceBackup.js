/**
 * Browser-side workspace backup.
 *
 * On Vercel, SQLite under /tmp is ephemeral. Until Blob durable storage is
 * configured, we keep Settings / Lead Settings / API Integration credentials
 * in localStorage and rehydrate the server after each cold start.
 */
const BACKUP_KEY = 'practo_workspace_backup_v1';

export function readWorkspaceBackup() {
  try {
    const raw = localStorage.getItem(BACKUP_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function writeWorkspaceBackup(patch) {
  try {
    const current = readWorkspaceBackup() || {};
    const next = {
      ...current,
      ...patch,
      integrations: {
        ...(current.integrations || {}),
        ...(patch.integrations || {}),
      },
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(BACKUP_KEY, JSON.stringify(next));
    return next;
  } catch {
    return null;
  }
}

export function backupAppSettings(settings) {
  if (!settings || typeof settings !== 'object') return;
  writeWorkspaceBackup({ settings });
}

export function backupLeadSettings(leadSettings) {
  if (!leadSettings || typeof leadSettings !== 'object') return;
  writeWorkspaceBackup({ leadSettings });
}

/** Store one integration by provider (IDs change after /tmp resets). */
export function backupIntegration(provider, payload) {
  if (!provider || !payload) return;
  const current = readWorkspaceBackup();
  const prev = current?.integrations?.[provider] || {};

  // Merge secrets — blank fields mean "unchanged", not "clear backup"
  const secrets = { ...(prev.secrets || {}) };
  for (const [k, v] of Object.entries(payload.secrets || {})) {
    if (String(v || '').trim() && v !== '••••••••') secrets[k] = String(v).trim();
  }

  writeWorkspaceBackup({
    integrations: {
      [provider]: {
        enabled: payload.enabled !== undefined ? !!payload.enabled : !!prev.enabled,
        status: payload.status || prev.status || undefined,
        notes: payload.notes !== undefined ? payload.notes : prev.notes,
        is_default:
          payload.is_default !== undefined ? payload.is_default : prev.is_default,
        config:
          payload.config && typeof payload.config === 'object'
            ? { ...(prev.config || {}), ...payload.config }
            : prev.config || {},
        secrets,
      },
    },
  });
}
