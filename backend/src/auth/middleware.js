import db from '../db/db.js';
import { hasPermission } from './roles.js';

export function getUserFromToken(token) {
  if (!token) return null;
  const session = db.prepare('SELECT * FROM sessions WHERE token = ?').get(token);
  if (!session) return null;
  if (new Date(session.expires_at).getTime() < Date.now()) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return null;
  }
  const user = db.prepare('SELECT * FROM users WHERE id = ? AND active = 1').get(session.user_id);
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    username: user.username || '',
    role: user.role,
    permissions: JSON.parse(user.permissions || '[]'),
  };
}

export function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : req.headers['x-auth-token'];
  const user = getUserFromToken(token);
  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  req.user = user;
  req.token = token;
  next();
}

export function requirePermission(...perms) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    const ok = perms.some((p) => hasPermission(req.user, p));
    if (!ok) {
      return res.status(403).json({ error: 'Insufficient permissions', required: perms });
    }
    next();
  };
}
