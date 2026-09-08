const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db/database');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);
router.use(requireRole('admin'));

// GET /api/admin/users
router.get('/users', (req, res) => {
  try {
    const users = db.prepare(`
      SELECT id, username, name, email, role, department, is_active, created_at, photo
      FROM users
      ORDER BY id ASC
    `).all();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/users
router.post('/users', (req, res) => {
  const { username, name, email, password, role, department, photo } = req.body;
  if (!username || !name || !password || !role) {
    return res.status(400).json({ error: 'username, name, password, role are required' });
  }

  const validRoles = ['employee', 'director', 'admin'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: 'Invalid role. Allowed roles: employee, director, admin' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username.trim());
  if (existing) {
    return res.status(409).json({ error: 'Username already exists' });
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const result = db.prepare(`
    INSERT INTO users (username, name, email, password_hash, role, department, photo)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(username.trim(), name, email || '', passwordHash, role, department || '', photo || null);

  const newUser = db.prepare(`
    SELECT id, username, name, email, role, department, is_active, created_at, photo
    FROM users WHERE id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json(newUser);
});

// PUT /api/admin/users/:id
router.put('/users/:id', (req, res) => {
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const { username, name, email, role, department, is_active, password, photo } = req.body;
  const updates = {};

  if (username) updates.username = username.trim();
  if (name) updates.name = name;
  if (email !== undefined) updates.email = email;
  if (role) {
    const validRoles = ['employee', 'director', 'admin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    updates.role = role;
  }
  if (department !== undefined) updates.department = department;
  if (is_active !== undefined) updates.is_active = is_active ? 1 : 0;
  if (photo !== undefined) updates.photo = photo;
  if (password) updates.password_hash = bcrypt.hashSync(password, 10);

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No fields provided for update' });
  }

  const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  const values = [...Object.values(updates), req.params.id];

  db.prepare(`UPDATE users SET ${setClauses}, updated_at = datetime('now') WHERE id = ?`).run(...values);

  const updatedUser = db.prepare(`
    SELECT id, username, name, email, role, department, is_active, created_at, photo
    FROM users WHERE id = ?
  `).get(req.params.id);

  res.json(updatedUser);
});

// DELETE /api/admin/users/:id
router.delete('/users/:id', (req, res) => {
  if (parseInt(req.user.id, 10) === parseInt(req.params.id, 10)) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }

  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ message: 'User deleted successfully' });
});

// GET /api/admin/stats
router.get('/stats', (req, res) => {
  try {
    const stats = {
      totalUsers: db.prepare('SELECT COUNT(*) as c FROM users').get().c,
      activeUsers: db.prepare('SELECT COUNT(*) as c FROM users WHERE is_active = 1').get().c,
      employees: db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'employee'").get().c,
      directors: db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'director'").get().c,
      totalActivities: db.prepare('SELECT COUNT(*) as c FROM activities').get().c,
      activitiesToday: db.prepare("SELECT COUNT(*) as c FROM activities WHERE date = date('now')").get().c,
      departments: db.prepare("SELECT DISTINCT department FROM users WHERE department IS NOT NULL AND department != ''").all().map(r => r.department)
    };
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/backup
router.get('/backup', (req, res) => {
  try {
    const users = db.prepare('SELECT * FROM users').all();
    const activities = db.prepare('SELECT * FROM activities').all();
    const backup = {
      version: 1,
      exported_at: new Date().toISOString(),
      users,
      activities
    };

    const dateStr = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Disposition', `attachment; filename="crm-backup-${dateStr}.json"`);
    res.setHeader('Content-Type', 'application/json');
    res.json(backup);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/restore
router.post('/restore', (req, res) => {
  try {
    const { users, activities, version } = req.body;
    if (!Array.isArray(users) || !Array.isArray(activities)) {
      return res.status(400).json({ error: 'Invalid backup format: users and activities must be arrays.' });
    }

    db.prepare('PRAGMA foreign_keys = OFF').run();
    db.exec('DELETE FROM activities');
    db.exec('DELETE FROM users');

    const insertUser = db.prepare(`
      INSERT INTO users (id, username, name, email, password_hash, role, department, is_active, created_at, updated_at, photo)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let maxUserId = 0;
    for (const u of users) {
      if (u.id > maxUserId) maxUserId = u.id;
      insertUser.run(
        u.id,
        u.username,
        u.name,
        u.email || '',
        u.password_hash,
        u.role,
        u.department || '',
        u.is_active ?? 1,
        u.created_at || new Date().toISOString(),
        u.updated_at || new Date().toISOString(),
        u.photo || null
      );
    }

    const insertActivity = db.prepare(`
      INSERT INTO activities (id, user_id, date, client_name, task_description, status, priority, notes, created_at, updated_at, lender, deal_size, next_action, director_message)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let maxActivityId = 0;
    const uniqueLenders = new Set();
    for (const a of activities) {
      if (a.id > maxActivityId) maxActivityId = a.id;
      if (a.lender && a.lender.trim()) uniqueLenders.add(a.lender.trim());
      insertActivity.run(
        a.id,
        a.user_id,
        a.date,
        a.client_name,
        a.task_description,
        a.status,
        a.priority,
        a.notes || '',
        a.created_at || new Date().toISOString(),
        a.updated_at || new Date().toISOString(),
        a.lender || '',
        a.deal_size || '',
        a.next_action || '',
        a.director_message || ''
      );
    }

    const insertLender = db.prepare('INSERT OR IGNORE INTO lenders (name) VALUES (?)');
    for (const l of uniqueLenders) {
      insertLender.run(l);
    }

    db.prepare('PRAGMA foreign_keys = ON').run();

    try {
      db.exec(`
        DELETE FROM sqlite_sequence WHERE name IN ('users', 'activities');
        INSERT INTO sqlite_sequence (name, seq) VALUES ('users', ${maxUserId});
        INSERT INTO sqlite_sequence (name, seq) VALUES ('activities', ${maxActivityId});
      `);
    } catch (e) {}

    res.json({ message: `Restored ${users.length} users and ${activities.length} activities successfully.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;