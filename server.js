const path = require('path');
const fs = require('fs');

// Ensure module resolution finds modules in backend/node_modules if present
const backendModules = path.resolve(__dirname, 'backend/node_modules');
if (fs.existsSync(backendModules)) {
  process.env.NODE_PATH = (process.env.NODE_PATH ? process.env.NODE_PATH + path.delimiter : '') + backendModules;
  require('module').Module._initPaths();
}

// Default to production environment
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

// Ensure required runtime directories exist
const requiredDirs = [
  path.resolve(__dirname, 'backend/data'),
  path.resolve(__dirname, 'backend/data/uploads'),
  path.resolve(__dirname, 'backend/data/reports'),
  path.resolve(__dirname, 'backend/logs')
];

for (const dir of requiredDirs) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Auto-seed initial accounts if users table is empty
try {
  const envFile = path.resolve(__dirname, 'backend', '.env.' + process.env.NODE_ENV);
  if (fs.existsSync(envFile)) {
    require('dotenv').config({ path: envFile });
  }
  const db = require('./backend/src/db/database');
  const userCount = db.prepare('SELECT count(*) as c FROM users').get();
  if (!userCount || userCount.c === 0) {
    const { findBackupFile, importBackup } = require('./backend/src/db/import-backup');
    const backupFile = findBackupFile();
    if (backupFile) {
      console.log('[Auto-Seed] Initializing database from backup file: ' + backupFile);
      const rawFile = process.env.DB_FILE || './backend/data/crm_prod.sqlite';
      const resolvedPath = path.isAbsolute(rawFile) ? rawFile : path.resolve(__dirname, rawFile);
      importBackup(resolvedPath, backupFile);
    } else {
      console.log('[Auto-Seed] Initializing database with default users...');
      require('./backend/src/db/seed');
    }
  }
} catch (err) {
  console.warn('[Auto-Seed] Note:', err.message);
}

// Start backend Express server
require('./backend/src/app.js');
