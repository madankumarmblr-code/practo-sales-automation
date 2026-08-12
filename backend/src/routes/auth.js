import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import db from '../db/db.js';
import { ROLES, permissionsForRole } from '../auth/roles.js';
import { authRequired, requirePermission } from '../auth/middleware.js';

const SESSION_DAYS = 7;
const now = () => new Date().toISOString();

function publicUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    roleLabel: ROLES[row.role]?.label || row.role,
    level: ROLES[row.role]?.level || 0,
    permissions: JSON.parse(row.permissions || '[]'),
    active: !!row.active,
  };
}

export function registerAuthRoutes(app) {
  app.get('/api/auth/roles', (_req, res) => {
    res.json(
      Object.entries(ROLES).map(([id, r]) => ({
        id,
        label: r.label,
        level: r.level,
        description: r.description,
        permissions: r.permissions,
      }))
    );
  });

  app.post('/api/auth/login', (req, res) => {
    const { email, password, role } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    const user = db.prepare('SELECT * FROM users WHERE email = ? AND active = 1').get(String(email).toLowerCase());
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    if (role && role !== user.role) {
      return res.status(403).json({
        error: `This account is role "${ROLES[user.role]?.label || user.role}". Select the matching permission level.`,
      });
    }

    const token = nanoid(48);
    const expires = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString();
    db.prepare(
      'INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)'
    ).run(token, user.id, now(), expires);

    res.json({
      token,
      expiresAt: expires,
      user: publicUser(user),
    });
  });

  app.post('/api/auth/logout', authRequired, (req, res) => {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(req.token);
    res.json({ ok: true });
  });

  app.get('/api/auth/me', authRequired, (req, res) => {
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    res.json(publicUser(row));
  });

  app.get('/api/users', authRequired, requirePermission('users:read'), (_req, res) => {
    const rows = db.prepare('SELECT * FROM users ORDER BY role, name').all().map(publicUser);
    res.json(rows);
  });

  app.post('/api/users', authRequired, requirePermission('users:write'), (req, res) => {
    const { name, email, password, role = 'agent' } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'name, email, and password are required' });
    }
    if (!ROLES[role]) return res.status(400).json({ error: 'Invalid role' });
    const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(String(email).toLowerCase());
    if (exists) return res.status(409).json({ error: 'Email already exists' });
    const id = nanoid();
    const ts = now();
    db.prepare(`
      INSERT INTO users (id, name, email, password_hash, role, permissions, active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
    `).run(
      id,
      name,
      String(email).toLowerCase(),
      bcrypt.hashSync(password, 10),
      role,
      JSON.stringify(permissionsForRole(role)),
      ts,
      ts
    );
    res.status(201).json(publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id)));
  });

  app.put('/api/users/:id', authRequired, requirePermission('users:write'), (req, res) => {
    const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'User not found' });
    const b = req.body || {};
    const role = b.role || existing.role;
    if (!ROLES[role]) return res.status(400).json({ error: 'Invalid role' });
    const permissions = b.permissions
      ? JSON.stringify(b.permissions)
      : JSON.stringify(permissionsForRole(role));
    db.prepare(`
      UPDATE users SET name=?, email=?, role=?, permissions=?, active=?, updated_at=?
      WHERE id=?
    `).run(
      b.name ?? existing.name,
      (b.email || existing.email).toLowerCase(),
      role,
      permissions,
      b.active !== undefined ? (b.active ? 1 : 0) : existing.active,
      now(),
      req.params.id
    );
    if (b.password) {
      db.prepare('UPDATE users SET password_hash=?, updated_at=? WHERE id=?').run(
        bcrypt.hashSync(b.password, 10),
        now(),
        req.params.id
      );
    }
    res.json(publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id)));
  });
}
