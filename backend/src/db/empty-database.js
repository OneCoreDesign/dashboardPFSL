const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

function emptyDatabase(dbPath, mode = 'activities_only') {
  const targetDbPath = path.resolve(dbPath);
  console.log(`\n========================================`);
  console.log(`Emptying database: ${targetDbPath}`);
  console.log(`Mode: ${mode}`);
  console.log(`========================================`);

  if (!fs.existsSync(targetDbPath)) {
    throw new Error(`Database file not found at: ${targetDbPath}`);
  }

  // Create timestamped safety backup
  const backupCopy = targetDbPath + '.pre-empty-' + Date.now() + '.bak';
  fs.copyFileSync(targetDbPath, backupCopy);
  console.log(`[Backup] Created safety copy of existing DB: ${backupCopy}`);

  const db = new DatabaseSync(targetDbPath);

  // WAL mode and foreign keys
  db.prepare('PRAGMA journal_mode = WAL').run();
  db.prepare('PRAGMA foreign_keys = OFF').run();

  // Truncate activity and message tables
  console.log('[Cleanup] Deleting activities...');
  db.exec('DELETE FROM activities');

  console.log('[Cleanup] Deleting notices...');
  db.exec('DELETE FROM notices');

  console.log('[Cleanup] Deleting old_reports...');
  db.exec('DELETE FROM old_reports');

  if (mode === 'admin_only') {
    console.log('[Cleanup] Keeping only admin user...');
    db.exec("DELETE FROM users WHERE username != 'admin'");
    db.exec("DELETE FROM sqlite_sequence WHERE name = 'users'");
    db.exec("INSERT INTO sqlite_sequence (name, seq) VALUES ('users', 1)");

    console.log('[Cleanup] Resetting lenders to default 20 banks...');
    db.exec("DELETE FROM lenders");
    db.exec("DELETE FROM sqlite_sequence WHERE name = 'lenders'");
    const defaultLenders = [
      'HDFC Bank', 'ICICI Bank', 'State Bank of India (SBI)', 'Axis Bank',
      'Kotak Mahindra Bank', 'Punjab National Bank', 'Bank of Baroda', 'Canara Bank',
      'Union Bank of India', 'IndusInd Bank', 'Yes Bank', 'IDFC First Bank',
      'Bajaj Finserv', 'Tata Capital', 'L&T Finance', 'Aditya Birla Finance',
      'Piramal Finance', 'Muthoot Finance', 'Manappuram Finance', 'Home First Finance'
    ];
    const insLender = db.prepare('INSERT OR IGNORE INTO lenders (name) VALUES (?)');
    for (const l of defaultLenders) {
      insLender.run(l);
    }
  } else if (mode === 'complete') {
    console.log('[Cleanup] Deleting all users and lenders...');
    db.exec('DELETE FROM users');
    db.exec('DELETE FROM lenders');
    db.exec("DELETE FROM sqlite_sequence WHERE name IN ('users', 'lenders')");
  }

  // Reset sqlite_sequence for autoincrement
  db.exec("DELETE FROM sqlite_sequence WHERE name IN ('activities', 'notices', 'old_reports')");
  console.log('[Sequence] Reset autoincrement sequence for activities, notices, old_reports');

  // Checkpoint WAL and vacuum
  db.prepare('PRAGMA foreign_keys = ON').run();
  db.prepare('PRAGMA wal_checkpoint(TRUNCATE)').run();
  db.exec('VACUUM');

  // Verify counts
  const check = db.prepare('PRAGMA integrity_check').get();
  console.log(`[Integrity Check] ${check.integrity_check}`);

  const uCount = db.prepare('SELECT count(*) as c FROM users').get().c;
  const aCount = db.prepare('SELECT count(*) as c FROM activities').get().c;
  const nCount = db.prepare('SELECT count(*) as c FROM notices').get().c;
  const rCount = db.prepare('SELECT count(*) as c FROM old_reports').get().c;
  const lCount = db.prepare('SELECT count(*) as c FROM lenders').get().c;

  console.log(`[Verification] Database stats:`);
  console.log(`  Users:        ${uCount}`);
  console.log(`  Activities:   ${aCount}`);
  console.log(`  Notices:      ${nCount}`);
  console.log(`  Old Reports:  ${rCount}`);
  console.log(`  Lenders:      ${lCount}\n`);

  db.close();

  return { usersCount: uCount, activitiesCount: aCount, noticesCount: nCount, reportsCount: rCount, lendersCount: lCount };
}

if (require.main === module) {
  const mode = process.argv[2] || 'activities_only';
  const prodDb = path.resolve(__dirname, '../../data/crm_prod.sqlite');
  const devDb = path.resolve(__dirname, '../../data/crm_dev.sqlite');

  console.log('Starting database clearing process...');
  emptyDatabase(prodDb, mode);
  emptyDatabase(devDb, mode);
  console.log('Database empty operation completed successfully!');
}

module.exports = { emptyDatabase };
