/**
 * Database backup & recovery (REQ-034).
 *
 *  - A complete dump of the database (every table's structure and rows) written by the app itself,
 *    so it works on hosting without the mysqldump tool. Files are gzip-compressed SQL that the
 *    standard `mysql` client can also load.
 *  - A daily automatic backup (after 03:00 restaurant time), keeping the newest BACKUP_KEEP
 *    (default 7). Manual backups on demand. Super Admin can download any backup.
 *  - Restore: the file is checked first (our format, complete, only table / row statements), a
 *    safety backup of the current data is taken, then the backup is loaded.
 *
 * Environment: BACKUP_DIR (folder for backup files), BACKUP_KEEP (daily copies to keep),
 * AUTO_BACKUP=false switches the daily backup off. Backup files contain everything in the
 * database (password hashes, payment keys): keep downloaded copies private.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const readline = require('readline');
const mysql = require('mysql2/promise');
const { getDbConnectionConfig } = require('../config/db');
const { businessDate, offsetMinutes } = require('../utils/businessTime');

const FORMAT = '-- Hotel app database backup v1';
const END = '-- end of backup';
const BACKUP_DIR = path.resolve(process.env.BACKUP_DIR || path.join(__dirname, '..', 'backups'));
const KEEP = Math.max(1, parseInt(process.env.BACKUP_KEEP || '7', 10) || 7);
const KEEP_MANUAL = 20;
const NAME = /^backup-\d{8}-\d{6}-(daily|manual|pre-restore|uploaded)\.sql\.gz$/;
const ROWS_PER_INSERT = 200;
const MAX_STATEMENT_BYTES = 1024 * 1024;

let busy = null; // one backup / restore at a time

function backupDir() {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  return BACKUP_DIR;
}

async function openConnection() {
  const cfg = { ...getDbConnectionConfig() };
  delete cfg.waitForConnections;
  delete cfg.connectionLimit;
  delete cfg.queueLimit;
  delete cfg.multipleStatements;
  return mysql.createConnection({
    ...cfg,
    // Values exactly as stored: no timezone shifts for dates, JSON kept as text.
    dateStrings: true,
    supportBigNumbers: true,
    bigNumberStrings: true,
    typeCast: (field, next) => (field.type === 'JSON' ? field.string('utf8') : next())
  });
}

const stamp = (d = new Date()) => {
  const l = new Date(d.getTime() + offsetMinutes() * 60000).toISOString();
  return `${l.slice(0, 10).replace(/-/g, '')}-${l.slice(11, 19).replace(/:/g, '')}`;
};

function write(out, text) {
  if (out.write(text)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const onError = (err) => { out.off('drain', onDrain); reject(err); };
    const onDrain = () => { out.off('error', onError); resolve(); };
    out.once('drain', onDrain);
    out.once('error', onError);
  });
}

/**
 * Writes the whole database to `out` (a writable stream), one statement per line.
 * Values are escaped by the driver, so no value ever contains a raw line break.
 */
async function dumpTo(out) {
  const conn = await openConnection();
  let rowsTotal = 0;
  try {
    const [[{ db }]] = await conn.query('SELECT DATABASE() AS db');
    const [tables] = await conn.query(
      `SELECT TABLE_NAME AS t FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME`
    );
    await write(out, `${FORMAT}\n-- created ${new Date().toISOString()} · database ${db} · ${tables.length} tables\n`);
    await write(out, 'SET NAMES utf8mb4;\nSET FOREIGN_KEY_CHECKS=0;\nSET UNIQUE_CHECKS=0;\n');
    for (const { t } of tables) {
      const [[create]] = await conn.query(`SHOW CREATE TABLE \`${t}\``);
      await write(out, `DROP TABLE IF EXISTS \`${t}\`;\n${String(create['Create Table']).replace(/\r?\n/g, ' ')};\n`);
      const [cols] = await conn.query(
        `SELECT COLUMN_NAME AS c, COLUMN_KEY AS k FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND EXTRA NOT LIKE '%VIRTUAL GENERATED%' AND EXTRA NOT LIKE '%STORED GENERATED%' ORDER BY ORDINAL_POSITION`, [t]
      );
      if (!cols.length) continue;
      const colList = cols.map((c) => `\`${c.c}\``).join(',');
      const pk = cols.filter((c) => c.k === 'PRI').map((c) => `\`${c.c}\``);
      const order = pk.length ? ` ORDER BY ${pk.join(',')}` : '';
      for (let offset = 0; ; offset += 1000) {
        const [rows] = await conn.query({ sql: `SELECT ${colList} FROM \`${t}\`${order} LIMIT 1000 OFFSET ${offset}`, rowsAsArray: true });
        if (!rows.length) break;
        let batch = [];
        let bytes = 0;
        const flush = async () => {
          if (!batch.length) return;
          await write(out, `INSERT INTO \`${t}\` (${colList}) VALUES ${batch.join(',')};\n`);
          batch = [];
          bytes = 0;
        };
        for (const row of rows) {
          const tuple = `(${row.map((v) => conn.escape(v)).join(',')})`;
          if (batch.length >= ROWS_PER_INSERT || bytes + tuple.length > MAX_STATEMENT_BYTES) await flush();
          batch.push(tuple);
          bytes += tuple.length;
        }
        await flush();
        rowsTotal += rows.length;
        if (rows.length < 1000) break;
      }
    }
    await write(out, 'SET UNIQUE_CHECKS=1;\nSET FOREIGN_KEY_CHECKS=1;\n');
    await write(out, `${END} (${tables.length} tables, ${rowsTotal} rows)\n`);
    return { tables: tables.length, rows: rowsTotal };
  } finally {
    await conn.end().catch(() => {});
  }
}

async function exclusive(label, fn) {
  if (busy) {
    const err = new Error(`A ${busy} is already running. Try again in a minute.`);
    err.statusCode = 409;
    throw err;
  }
  busy = label;
  try {
    return await fn();
  } finally {
    busy = null;
  }
}

async function createBackupUnlocked(kind) {
  const name = `backup-${stamp()}-${kind}.sql.gz`;
  const file = path.join(backupDir(), name);
  const tmp = `${file}.part`;
  const gzip = zlib.createGzip({ level: 6 });
  const sink = fs.createWriteStream(tmp);
  const done = new Promise((resolve, reject) => { sink.on('finish', resolve); sink.on('error', reject); gzip.on('error', reject); });
  gzip.pipe(sink);
  try {
    const info = await dumpTo(gzip);
    gzip.end();
    await done;
    fs.renameSync(tmp, file);
    prune();
    return { name, size: fs.statSync(file).size, ...info };
  } catch (err) {
    gzip.destroy();
    sink.destroy();
    fs.rmSync(tmp, { force: true });
    throw err;
  }
}

function createBackup(kind = 'manual') {
  return exclusive('backup', () => createBackupUnlocked(kind));
}

function listBackups() {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  return fs.readdirSync(BACKUP_DIR)
    .filter((n) => NAME.test(n))
    .map((n) => {
      const st = fs.statSync(path.join(BACKUP_DIR, n));
      return { name: n, size: st.size, created_at: st.mtime.toISOString(), kind: n.match(NAME)[1] };
    })
    .sort((a, b) => b.name.localeCompare(a.name));
}

function prune() {
  const all = listBackups();
  const limits = { daily: KEEP, manual: KEEP_MANUAL, 'pre-restore': 5, uploaded: 5 };
  for (const kind of Object.keys(limits)) {
    all.filter((b) => b.kind === kind).slice(limits[kind]).forEach((b) => fs.rmSync(path.join(BACKUP_DIR, b.name), { force: true }));
  }
}

/** Path of a backup by name; null for anything that isn't one of ours. */
function backupPath(name) {
  if (!NAME.test(String(name || ''))) return null;
  const file = path.join(BACKUP_DIR, name);
  return fs.existsSync(file) ? file : null;
}

function deleteBackup(name) {
  const file = backupPath(name);
  if (!file) return false;
  fs.rmSync(file, { force: true });
  return true;
}

// Only these statements may appear in a backup being restored.
const ALLOWED = [
  /^SET (NAMES utf8mb4|FOREIGN_KEY_CHECKS=[01]|UNIQUE_CHECKS=[01]);$/,
  /^DROP TABLE IF EXISTS `[A-Za-z0-9_]+`;$/,
  /^CREATE TABLE `[A-Za-z0-9_]+` \(.*;$/,
  /^INSERT INTO `[A-Za-z0-9_]+` \(.*;$/
];

function lines(file) {
  return readline.createInterface({ input: fs.createReadStream(file).pipe(zlib.createGunzip()), crlfDelay: Infinity });
}

/** Reads the whole file and checks it is a complete backup made by this app. */
async function inspectBackup(file) {
  let first = true;
  let complete = false;
  let statements = 0;
  const tables = new Set();
  try {
    for await (const line of lines(file)) {
      if (first) {
        if (line !== FORMAT) return { ok: false, error: 'This is not a backup made by this app.' };
        first = false;
        continue;
      }
      if (!line.trim()) continue;
      if (line.startsWith('--')) {
        if (line.startsWith(END)) complete = true;
        continue;
      }
      if (complete) return { ok: false, error: 'The file has data after its end marker.' };
      if (!ALLOWED.some((re) => re.test(line))) return { ok: false, error: `Unexpected statement in the backup (line ${statements + 3}).` };
      const m = line.match(/^CREATE TABLE `([A-Za-z0-9_]+)`/);
      if (m) tables.add(m[1]);
      statements += 1;
    }
  } catch (err) {
    return { ok: false, error: 'The file is damaged or not a .sql.gz backup.' };
  }
  if (first) return { ok: false, error: 'The file is empty.' };
  if (!complete) return { ok: false, error: 'The backup is incomplete (it was cut off).' };
  if (!tables.size) return { ok: false, error: 'The backup has no tables.' };
  return { ok: true, statements, tables: tables.size };
}

/** Loads a backup into the database after checking it and saving the current data first. */
function restoreBackup(name) {
  return exclusive('restore', async () => {
    const file = backupPath(name);
    if (!file) {
      const err = new Error('Backup not found.');
      err.statusCode = 404;
      throw err;
    }
    const check = await inspectBackup(file);
    if (!check.ok) {
      const err = new Error(check.error);
      err.statusCode = 400;
      throw err;
    }
    const safety = await createBackupUnlocked('pre-restore');
    const conn = await openConnection();
    let done = 0;
    try {
      let first = true;
      for await (const line of lines(file)) {
        if (first) { first = false; continue; }
        if (!line.trim() || line.startsWith('--')) continue;
        await conn.query(line);
        done += 1;
      }
      await conn.query('SET FOREIGN_KEY_CHECKS=1');
    } catch (err) {
      const e = new Error(`Restore stopped at statement ${done + 1}: ${err.message}. Your data from before the restore is saved as ${safety.name}.`);
      e.statusCode = 500;
      throw e;
    } finally {
      await conn.end().catch(() => {});
    }
    return { restored: name, statements: done, tables: check.tables, safety_backup: safety.name };
  });
}

/** Saves an uploaded backup (buffer) into the backup folder after checking it. */
async function saveUploadedBackup(buffer) {
  const name = `backup-${stamp()}-uploaded.sql.gz`;
  const file = path.join(backupDir(), name);
  fs.writeFileSync(file, buffer);
  const check = await inspectBackup(file);
  if (!check.ok) {
    fs.rmSync(file, { force: true });
    const err = new Error(check.error);
    err.statusCode = 400;
    throw err;
  }
  prune();
  return { name, size: buffer.length, tables: check.tables, statements: check.statements };
}

/** Daily backup after 03:00 restaurant time, once per day. */
function startBackupSchedule() {
  if (String(process.env.AUTO_BACKUP || '').toLowerCase() === 'false') return;
  const tick = async () => {
    try {
      const today = businessDate();
      const hour = new Date(Date.now() + offsetMinutes() * 60000).getUTCHours();
      const tag = `backup-${today.replace(/-/g, '')}-`;
      if (hour < 3 || listBackups().some((b) => b.kind === 'daily' && b.name.startsWith(tag))) return;
      const info = await createBackup('daily');
      console.log(`💾 Daily database backup saved: ${info.name} (${Math.round(info.size / 1024)} KB)`);
    } catch (err) {
      if (err.statusCode !== 409) console.warn('Daily backup warning:', err.message);
    }
  };
  setTimeout(tick, 10 * 60 * 1000).unref();
  setInterval(tick, 30 * 60 * 1000).unref();
}

function status() {
  const list = listBackups();
  return {
    folder: BACKUP_DIR,
    keep_daily: KEEP,
    auto_backup: String(process.env.AUTO_BACKUP || '').toLowerCase() !== 'false',
    running: busy,
    last_daily: list.find((b) => b.kind === 'daily') || null,
    backups: list
  };
}

module.exports = { createBackup, listBackups, backupPath, deleteBackup, restoreBackup, saveUploadedBackup, inspectBackup, startBackupSchedule, status, dumpTo };
