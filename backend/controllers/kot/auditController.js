const pool = require('../../config/database');
const { sendSuccess, sendError } = require('../../utils/response');

async function getAuditLogs(req, res, next) {
  try {
    const [logs] = await pool.query(
      `SELECT a.*, u.name as user_name, u.email as user_email
       FROM audit_logs a
       LEFT JOIN users u ON a.user_id = u.id
       ORDER BY a.created_at DESC
       LIMIT 100`
    );
    return sendSuccess(res, logs, 'Audit logs fetched');
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAuditLogs
};
