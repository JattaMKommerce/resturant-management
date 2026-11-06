const pool = require('../../config/database');
const { sendSuccess, sendError } = require('../../utils/response');
const { ensureAuditSchema } = require('../../utils/audit');

/**
 * GET /api/audit-logs?q=&user_id=&from=YYYY-MM-DD&to=YYYY-MM-DD&before_id=&limit=
 * Audit trail (REQ-035). Restaurant admins see their own restaurant's entries; Super Admin sees
 * every restaurant (optionally ?restaurant_id=).
 */
async function getAuditLogs(req, res, next) {
  try {
    await ensureAuditSchema();
    const where = [];
    const params = [];
    const role = String(req.user?.role || '').toUpperCase();

    if (role === 'SUPER_ADMIN') {
      if (req.query.restaurant_id) { where.push('a.restaurant_id = ?'); params.push(parseInt(req.query.restaurant_id, 10)); }
    } else {
      const restId = req.user?.restaurant_id;
      if (!restId) return sendError(res, 'No restaurant assigned.', 403);
      where.push('a.restaurant_id = ?');
      params.push(restId);
    }
    if (req.query.q) {
      where.push('(a.action LIKE ? OR a.entity LIKE ? OR a.metadata_json LIKE ?)');
      const like = `%${String(req.query.q).slice(0, 80)}%`;
      params.push(like, like, like);
    }
    if (req.query.user_id) { where.push('a.user_id = ?'); params.push(parseInt(req.query.user_id, 10)); }
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(req.query.from || ''))) {
      where.push('a.created_at >= ?');
      params.push(require('../../utils/businessTime').businessDayRange(req.query.from).start);
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(req.query.to || ''))) {
      where.push('a.created_at < ?');
      params.push(require('../../utils/businessTime').businessDayRange(req.query.to).end);
    }
    if (req.query.before_id) { where.push('a.id < ?'); params.push(parseInt(req.query.before_id, 10)); }
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit, 10) || 200));

    const [logs] = await pool.query(
      `SELECT a.*, u.name as user_name, u.email as user_email
       FROM audit_logs a
       LEFT JOIN users u ON a.user_id = u.id
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY a.id DESC
       LIMIT ${limit}`,
      params
    );
    return sendSuccess(res, logs, 'Audit logs fetched');
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAuditLogs
};
