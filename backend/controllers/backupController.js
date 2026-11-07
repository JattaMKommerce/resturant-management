/**
 * Super Admin: database backups (REQ-034). List, back up now, download, upload, restore, delete.
 * Restoring replaces every table, so it needs the Super Admin's password and the word RESTORE.
 */
const bcrypt = require('bcryptjs');
const { query } = require('../config/db');
const Backups = require('../services/BackupService');
const { logAudit } = require('../utils/audit');

const fail = (res, err, fallback) => res.status(err.statusCode || 500).json({ success: false, message: err.statusCode ? err.message : fallback });
const audit = (req, action, details) => {
  Promise.resolve(logAudit(req, { action, entity: 'DATABASE_BACKUP', details })).catch(() => {}); // best effort
};

async function listBackups(req, res) {
  try {
    return res.json({ success: true, data: Backups.status() });
  } catch (err) {
    return fail(res, err, 'Could not read the backup folder.');
  }
}

async function createBackup(req, res) {
  try {
    const info = await Backups.createBackup('manual');
    audit(req, 'BACKUP_CREATED', { name: info.name, size: info.size });
    return res.status(201).json({ success: true, message: `Backup saved (${info.tables} tables, ${info.rows} rows)`, data: info });
  } catch (err) {
    console.error('Backup failed:', err);
    return fail(res, err, 'The backup failed. Check the server log.');
  }
}

async function downloadBackup(req, res) {
  const file = Backups.backupPath(req.params.name);
  if (!file) return res.status(404).json({ success: false, message: 'Backup not found.' });
  audit(req, 'BACKUP_DOWNLOADED', { name: req.params.name });
  res.setHeader('Cache-Control', 'no-store');
  return res.download(file, req.params.name);
}

async function deleteBackup(req, res) {
  if (!Backups.deleteBackup(req.params.name)) return res.status(404).json({ success: false, message: 'Backup not found.' });
  audit(req, 'BACKUP_DELETED', { name: req.params.name });
  return res.json({ success: true, message: 'Backup deleted' });
}

async function uploadBackup(req, res) {
  try {
    if (!req.file || !req.file.buffer) return res.status(400).json({ success: false, message: 'Choose a .sql.gz backup file.' });
    const info = await Backups.saveUploadedBackup(req.file.buffer);
    audit(req, 'BACKUP_UPLOADED', { name: info.name, size: info.size });
    return res.status(201).json({ success: true, message: `Backup checked and saved as ${info.name} (${info.tables} tables)`, data: info });
  } catch (err) {
    return fail(res, err, 'Could not save the uploaded backup.');
  }
}

async function restoreBackup(req, res) {
  try {
    const { password, confirm } = req.body || {};
    if (String(confirm || '').trim() !== 'RESTORE') {
      return res.status(400).json({ success: false, message: 'Type RESTORE to confirm. This replaces all current data.' });
    }
    const [user] = await query('SELECT password_hash FROM users WHERE id = ?', [req.user?.id]);
    if (!user || !user.password_hash || !(await bcrypt.compare(String(password || ''), user.password_hash))) {
      return res.status(403).json({ success: false, message: 'Your password is not correct.' });
    }
    audit(req, 'BACKUP_RESTORE_STARTED', { name: req.params.name });
    const result = await Backups.restoreBackup(req.params.name);
    audit(req, 'BACKUP_RESTORED', result);
    return res.json({ success: true, message: `Restored ${result.restored}. Your data from just before is saved as ${result.safety_backup}.`, data: result });
  } catch (err) {
    if (!err.statusCode || err.statusCode >= 500) console.error('Restore failed:', err);
    return fail(res, err, 'The restore failed. Check the server log.');
  }
}

module.exports = { listBackups, createBackup, downloadBackup, deleteBackup, uploadBackup, restoreBackup };
