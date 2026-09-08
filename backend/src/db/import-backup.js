const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

function findBackupFile() {
  const candidates = [
    path.resolve(__dirname, '../../../CRM-BA_1.JSO'),
    path.resolve(__dirname, '../../../CRM-BA_1.json'),
    path.resolve(__dirname, '../../CRM-BA_1.JSO'),
    path.resolve(__dirname, '../../CRM-BA_1.json'),
    path.resolve(__dirname, '../../data/backup.json')
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

function importBackup(dbPath, backupFilePath) {
  const targetDbPath = path.resolve(dbPath);
  console.log(`\n========================================`);
  console.log(`Importing backup into: ${targetDbPath}`);
  console.log(`Backup source file:   ${backupFilePath}`);
  console.log(`========================================`);

  if (!fs.existsSync(backupFilePath)) {
    throw new Error(`Backup file not found at: ${backupFilePath}`);
  }

  const rawJson = fs.readFileSync(backupFilePath, 'utf8');
  const data = JSON.parse(rawJson);

  if (!Array.isArray(data.users) || !Array.isArray(data.activities)) {
    throw new Error('Invalid backup format: missing "users" or "activities" array.');
  }

  // Ensure target DB directory exists
  const dbDir = path.dirname(targetDbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  // Create a safety backup of existing db file if present
  if (fs.existsSync(targetDbPath)) {
    const backupCopy = targetDbPath + '.pre-import-' + Date.now() + '.bak';
    fs.copyFileSync(targetDbPath, backupCopy);
    console.log(`[Backup] Created safety copy of existing DB: ${backupCopy}`);
  }

  const db = new DatabaseSync(targetDbPath);

  // WAL mode
  db.prepare('PRAGMA journal_mode = WAL').run();
  db.prepare('PRAGMA foreign_keys = OFF').run();

  // Ensure tables and columns exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      email TEXT DEFAULT '',
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('employee', 'director', 'admin')),
      department TEXT DEFAULT '',
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      photo TEXT DEFAULT NULL
    );

    CREATE TABLE IF NOT EXISTS activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      client_name TEXT NOT NULL,
      task_description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'completed')),
      priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high')),
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      lender TEXT DEFAULT '',
      deal_size TEXT DEFAULT '',
      next_action TEXT DEFAULT '',
      director_message TEXT DEFAULT '',
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS lenders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS old_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      file_size INTEGER DEFAULT 0,
      uploaded_by INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (uploaded_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS notices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_by INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );
  `);

  // Ensure migrations / columns exist
  try { db.exec('ALTER TABLE users ADD COLUMN photo TEXT DEFAULT NULL'); } catch (e) {}
  try { db.exec("ALTER TABLE activities ADD COLUMN lender TEXT DEFAULT ''"); } catch (e) {}
  try { db.exec("ALTER TABLE activities ADD COLUMN deal_size TEXT DEFAULT ''"); } catch (e) {}
  try { db.exec("ALTER TABLE activities ADD COLUMN next_action TEXT DEFAULT ''"); } catch (e) {}
  try { db.exec("ALTER TABLE activities ADD COLUMN director_message TEXT DEFAULT ''"); } catch (e) {}

  // Clean existing users and activities to ensure complete replacement with backup data
  db.exec('DELETE FROM activities');
  db.exec('DELETE FROM users');

  // Insert users
  const insertUser = db.prepare(`
    INSERT INTO users (id, username, name, email, password_hash, role, department, is_active, created_at, updated_at, photo)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let maxUserId = 0;
  for (const u of data.users) {
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
  console.log(`[Users] Inserted ${data.users.length} users (max ID: ${maxUserId})`);

  // Insert activities
  const insertActivity = db.prepare(`
    INSERT INTO activities (id, user_id, date, client_name, task_description, status, priority, notes, created_at, updated_at, lender, deal_size, next_action, director_message)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let maxActivityId = 0;
  const uniqueLenders = new Set();

  for (const a of data.activities) {
    if (a.id > maxActivityId) maxActivityId = a.id;
    if (a.lender && a.lender.trim()) {
      uniqueLenders.add(a.lender.trim());
    }
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
  console.log(`[Activities] Inserted ${data.activities.length} activities (max ID: ${maxActivityId})`);

  // Populate lenders table
  const insertLender = db.prepare('INSERT OR IGNORE INTO lenders (name) VALUES (?)');
  const defaultLenders = [
    'HDFC Bank', 'ICICI Bank', 'State Bank of India (SBI)', 'Axis Bank',
    'Kotak Mahindra Bank', 'Punjab National Bank', 'Bank of Baroda', 'Canara Bank',
    'Union Bank of India', 'IndusInd Bank', 'Yes Bank', 'IDFC First Bank',
    'Bajaj Finserv', 'Tata Capital', 'L&T Finance', 'Aditya Birla Finance',
    'Piramal Finance', 'Muthoot Finance', 'Manappuram Finance', 'Home First Finance'
  ];

  for (const l of defaultLenders) {
    insertLender.run(l);
  }
  for (const l of uniqueLenders) {
    insertLender.run(l);
  }
  const totalLenders = db.prepare('SELECT count(*) as c FROM lenders').get().c;
  console.log(`[Lenders] Total unique lenders registered: ${totalLenders}`);

  // Re-enable foreign keys & verify integrity
  db.prepare('PRAGMA foreign_keys = ON').run();

  // Reset sqlite_sequence for autoincrement
  try {
    db.exec(`
      DELETE FROM sqlite_sequence WHERE name IN ('users', 'activities');
      INSERT INTO sqlite_sequence (name, seq) VALUES ('users', ${maxUserId});
      INSERT INTO sqlite_sequence (name, seq) VALUES ('activities', ${maxActivityId});
    `);
    console.log(`[Sequence] Updated sqlite_sequence: users -> ${maxUserId}, activities -> ${maxActivityId}`);
  } catch (e) {
    console.warn(`[Sequence] Note:`, e.message);
  }

  const check = db.prepare('PRAGMA integrity_check').get();
  console.log(`[Integrity Check] ${check.integrity_check}`);

  const uCount = db.prepare('SELECT count(*) as c FROM users').get().c;
  const aCount = db.prepare('SELECT count(*) as c FROM activities').get().c;
  console.log(`[Verification] Database successfully updated. Users: ${uCount}, Activities: ${aCount}\n`);

  return { usersCount: uCount, activitiesCount: aCount, lendersCount: totalLenders };
}

if (require.main === module) {
  const customBackupFile = process.argv[2] || findBackupFile();
  if (!customBackupFile) {
    console.error('Error: No backup file found. Provide path as argument or place CRM-BA_1.JSO in root directory.');
    process.exit(1);
  }

  const prodDb = path.resolve(__dirname, '../../data/crm_prod.sqlite');
  const devDb = path.resolve(__dirname, '../../data/crm_dev.sqlite');

  // Update production database
  importBackup(prodDb, customBackupFile);

  // Update development database for local dev parity
  importBackup(devDb, customBackupFile);

  console.log('Database import completed successfully for both production and development!');
}

module.exports = { importBackup, findBackupFile };
