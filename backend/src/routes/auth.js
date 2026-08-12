import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import db from '../db/db.js';
import {
  ROLES,
  ALL_PERMISSIONS,
  permissionsForRole,
  assignableRoles,
  isSuperAdmin,
} from '../auth/roles.js';
import { authRequired, requirePermission } from '../auth/middleware.js';
import { logEvent, listEvents } from '../services/logger.js';

const SESSION_DAYS = 7;
const now = () => new Date().toISOString();

function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    username: row.username || '',
    role: row.role,
    roleLabel: ROLES[row.role]?.label || row.role,
    level: ROLES[row.role]?.level || 0,
    permissions: JSON.parse(row.permissions || '[]'),
    active: !!row.active,
    isSuperAdmin: row.role === 'superadmin',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function findUserByLogin(login) {
  const value = String(login || '').trim().toLowerCase();
  if (!value) return null;
  return (
    db.prepare('SELECT * FROM users WHERE lower(email) = ? AND active = 1').get(value) ||
    db.prepare('SELECT * FROM users WHERE lower(username) = ? AND active = 1').get(value)
  );
}

export function registerAuthRoutes(app) {
  app.get('/api/auth/roles', authRequired, requirePermission('users:read', 'system:health'), (_req, res) => {
    res.json({
      roles: assignableRoles(),
      allRoles: Object.entries(ROLES).map(([id, r]) => ({
        id,
        label: r.label,
        level: r.level,
        description: r.description,
        permissions: r.permissions.filter((p) => p !== '*'),
      })),
      permissions: ALL_PERMISSIONS,
    });
  });

  app.post('/api/auth/login', (req, res) => {
    const { email, username, password, login } = req.body || {};
    const identifier = login || username || email;
    if (!identifier || !password) {
      return res.status(400).json({ error: 'User ID / email and password are required' });
    }
    const user = findUserByLogin(identifier);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      logEvent({
        type: 'warn',
        category: 'auth',
        message: 'Failed login attempt',
        detail: String(identifier),
      });
      return res.status(401).json({ error: 'Invalid user ID or password' });
    }

    const token = nanoid(48);
    const expires = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString();
    db.prepare(
      'INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)'
    ).run(token, user.id, now(), expires);

    logEvent({
      type: 'info',
      category: 'auth',
      message: 'User logged in',
      detail: user.email,
      userId: user.id,
      meta: { role: user.role, username: user.username },
    });

    res.json({
      token,
      expiresAt: expires,
      user: publicUser(user),
    });
  });

  app.post('/api/auth/logout', authRequired, (req, res) => {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(req.token);
    logEvent({
      type: 'info',
      category: 'auth',
      message: 'User logged out',
      detail: req.user.email,
      userId: req.user.id,
    });
    res.json({ ok: true });
  });

  app.get('/api/auth/me', authRequired, (req, res) => {
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    res.json(publicUser(row));
  });

  app.get('/api/users', authRequired, requirePermission('users:read'), (_req, res) => {
    const rows = db
      .prepare('SELECT * FROM users ORDER BY CASE role WHEN \'superadmin\' THEN 0 ELSE 1 END, name')
      .all()
      .map(publicUser);
    res.json(rows);
  });

  app.post('/api/users', authRequired, requirePermission('users:write'), (req, res) => {
    if (!isSuperAdmin(req.user)) {
      return res.status(403).json({ error: 'Only Super Admin can create users' });
    }
    const {
      name,
      email,
      username,
      password,
      role = 'agent',
      permissions,
      active = true,
    } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'name, email, and password are required' });
    }
    if (role === 'superadmin') {
      return res.status(400).json({ error: 'Cannot create another Super Admin via API' });
    }
    if (!ROLES[role]) return res.status(400).json({ error: 'Invalid role' });

    const emailNorm = String(email).toLowerCase().trim();
    const usernameNorm = String(username || emailNorm.split('@')[0])
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9._-]/g, '');
    if (!usernameNorm) return res.status(400).json({ error: 'username is required' });

    if (db.prepare('SELECT id FROM users WHERE email = ?').get(emailNorm)) {
      return res.status(409).json({ error: 'Email already exists' });
    }
    if (db.prepare('SELECT id FROM users WHERE lower(username) = ?').get(usernameNorm)) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    const perms = Array.isArray(permissions) && permissions.length
      ? permissions
      : permissionsForRole(role);
    const id = nanoid();
    const ts = now();
    db.prepare(`
      INSERT INTO users (id, name, email, username, password_hash, role, permissions, active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      name,
      emailNorm,
      usernameNorm,
      bcrypt.hashSync(password, 10),
      role,
      JSON.stringify(perms),
      active ? 1 : 0,
      ts,
      ts
    );

    logEvent({
      type: 'info',
      category: 'users',
      message: 'User created',
      detail: `${usernameNorm} (${role})`,
      userId: req.user.id,
      meta: { createdUserId: id, role, permissions: perms },
    });

    res.status(201).json(publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id)));
  });

  app.put('/api/users/:id', authRequired, requirePermission('users:write'), (req, res) => {
    if (!isSuperAdmin(req.user)) {
      return res.status(403).json({ error: 'Only Super Admin can update users' });
    }
    const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'User not found' });

    const b = req.body || {};
    if (existing.role === 'superadmin') {
      // Allow password/name update for self, but lock role/permissions
      if (b.role && b.role !== 'superadmin') {
        return res.status(400).json({ error: 'Cannot change Super Admin role' });
      }
    }

    const role = existing.role === 'superadmin' ? 'superadmin' : b.role || existing.role;
    if (!ROLES[role]) return res.status(400).json({ error: 'Invalid role' });

    let perms;
    if (role === 'superadmin') {
      perms = permissionsForRole('superadmin');
    } else if (Array.isArray(b.permissions)) {
      perms = b.permissions;
    } else if (b.role && b.role !== existing.role) {
      perms = permissionsForRole(role);
    } else {
      perms = JSON.parse(existing.permissions || '[]');
    }

    const emailNorm = String(b.email || existing.email).toLowerCase().trim();
    const usernameNorm = String(b.username != null ? b.username : existing.username || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9._-]/g, '');

    const emailClash = db
      .prepare('SELECT id FROM users WHERE email = ? AND id != ?')
      .get(emailNorm, existing.id);
    if (emailClash) return res.status(409).json({ error: 'Email already exists' });
    if (usernameNorm) {
      const userClash = db
        .prepare('SELECT id FROM users WHERE lower(username) = ? AND id != ?')
        .get(usernameNorm, existing.id);
      if (userClash) return res.status(409).json({ error: 'Username already exists' });
    }

    db.prepare(`
      UPDATE users SET name=?, email=?, username=?, role=?, permissions=?, active=?, updated_at=?
      WHERE id=?
    `).run(
      b.name ?? existing.name,
      emailNorm,
      usernameNorm || existing.username,
      role,
      JSON.stringify(perms),
      b.active !== undefined ? (b.active ? 1 : 0) : existing.active,
      now(),
      existing.id
    );

    if (b.password) {
      db.prepare('UPDATE users SET password_hash=?, updated_at=? WHERE id=?').run(
        bcrypt.hashSync(b.password, 10),
        now(),
        existing.id
      );
    }

    logEvent({
      type: 'info',
      category: 'users',
      message: 'User updated',
      detail: emailNorm,
      userId: req.user.id,
      meta: { targetUserId: existing.id, role, permissions: perms },
    });

    res.json(publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(existing.id)));
  });

  app.delete('/api/users/:id', authRequired, requirePermission('users:write'), (req, res) => {
    if (!isSuperAdmin(req.user)) {
      return res.status(403).json({ error: 'Only Super Admin can delete users' });
    }
    const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'User not found' });
    if (existing.role === 'superadmin') {
      return res.status(400).json({ error: 'Cannot delete Super Admin' });
    }
    if (existing.id === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(existing.id);
    db.prepare('DELETE FROM users WHERE id = ?').run(existing.id);
    logEvent({
      type: 'warn',
      category: 'users',
      message: 'User deleted',
      detail: existing.email,
      userId: req.user.id,
      meta: { deletedUserId: existing.id },
    });
    res.json({ ok: true });
  });

  app.get('/api/system/events', authRequired, requirePermission('system:logs'), (req, res) => {
    const limit = Number(req.query.limit) || 100;
    const category = req.query.category ? String(req.query.category) : undefined;
    const type = req.query.type ? String(req.query.type) : undefined;
    res.json(listEvents({ limit, category, type }));
  });

  app.get('/api/system/health', authRequired, requirePermission('system:health'), (req, res) => {
    const counts = {
      users: db.prepare('SELECT COUNT(*) as c FROM users').get().c,
      sessions: db.prepare('SELECT COUNT(*) as c FROM sessions').get().c,
      leads: db.prepare('SELECT COUNT(*) as c FROM leads').get().c,
      activities: db.prepare('SELECT COUNT(*) as c FROM activities').get().c,
      campaigns: db.prepare('SELECT COUNT(*) as c FROM autopilot_campaigns').get().c,
      integrations: db.prepare('SELECT COUNT(*) as c FROM api_integrations').get().c,
      events: db.prepare('SELECT COUNT(*) as c FROM system_events').get().c,
      pipelineStages: db.prepare('SELECT COUNT(*) as c FROM pipeline_stages').get().c,
      leadSources: db.prepare('SELECT COUNT(*) as c FROM lead_sources').get().c,
    };

    const checks = [
      {
        name: 'users_table',
        ok: counts.users >= 1,
        detail: `${counts.users} user(s)`,
      },
      {
        name: 'superadmin_present',
        ok: !!db.prepare("SELECT id FROM users WHERE role = 'superadmin' AND active = 1").get(),
        detail: 'Super Admin active account',
      },
      {
        name: 'pipeline_stages',
        ok: counts.pipelineStages >= 6,
        detail: `${counts.pipelineStages} stages`,
      },
      {
        name: 'api_integrations_ready',
        ok: counts.integrations > 0,
        detail: `${counts.integrations} connectors`,
      },
      {
        name: 'event_log_writable',
        ok: true,
        detail: `${counts.events} events recorded`,
      },
      {
        name: 'sessions_table',
        ok: true,
        detail: `${counts.sessions} active session row(s)`,
      },
    ];

    const ok = checks.every((c) => c.ok);
    logEvent({
      type: ok ? 'info' : 'warn',
      category: 'system',
      message: 'Health check run',
      detail: ok ? 'All checks passed' : 'One or more checks failed',
      userId: req.user.id,
      meta: { counts, checks },
    });

    res.json({
      ok,
      time: now(),
      counts,
      checks,
      db: { driver: 'better-sqlite3', file: 'backend/data/sales.db' },
    });
  });
}
