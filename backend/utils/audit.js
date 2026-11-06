/**
 * Audit trail (REQ-035): who did what, when, to which record, for which restaurant.
 *
 * - logAudit(): explicit entries (logins, logouts, password changes…).
 * - auditMiddleware: records every successful create/update/delete made by a signed-in user,
 *   with the request fields (passwords, secrets, codes and tokens removed).
 * Writing an audit entry must never break the request it describes, so errors are swallowed.
 */
const { query } = require('../config/db');

const SENSITIVE = /pass(word)?|secret|token|otp|code_hash|^code$|signature|cvv|card_number/i;
const MAX_META = 4000;

let schemaPromise = null;
function ensureAuditSchema() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await query(`CREATE TABLE IF NOT EXISTS audit_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NULL,
        action VARCHAR(100) NOT NULL,
        entity VARCHAR(100) NULL,
        entity_id VARCHAR(64) NULL,
        metadata_json TEXT NULL,
        ip_address VARCHAR(64) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);
      const cols = await query(
        `SELECT COLUMN_NAME AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'audit_logs'`
      );
      const have = new Set(cols.map((r) => r.c));
      if (!have.has('restaurant_id')) await query('ALTER TABLE audit_logs ADD COLUMN restaurant_id INT NULL DEFAULT NULL');
      if (!have.has('user_role')) await query('ALTER TABLE audit_logs ADD COLUMN user_role VARCHAR(40) NULL DEFAULT NULL');
      if (!have.has('status_code')) await query('ALTER TABLE audit_logs ADD COLUMN status_code SMALLINT NULL DEFAULT NULL');
      const idx = await query(
        `SELECT COUNT(*) AS n FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'audit_logs' AND INDEX_NAME = 'idx_audit_restaurant_time'`
      );
      if (!Number(idx[0]?.n)) await query('ALTER TABLE audit_logs ADD INDEX idx_audit_restaurant_time (restaurant_id, created_at)');
    })().catch((err) => { schemaPromise = null; throw err; });
  }
  return schemaPromise;
}

function scrub(value, depth = 0) {
  if (value === null || value === undefined) return value;
  if (depth > 4) return '[…]';
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => scrub(v, depth + 1));
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = SENSITIVE.test(k) ? '[hidden]' : scrub(v, depth + 1);
    }
    return out;
  }
  if (typeof value === 'string' && value.length > 300) return `${value.slice(0, 300)}…`;
  return value;
}

function clientIp(req) {
  const fwd = req?.headers?.['x-forwarded-for'];
  return (typeof fwd === 'string' && fwd.split(',')[0].trim()) || req?.socket?.remoteAddress || null;
}

async function logAudit(req, { action, entity = null, entityId = null, restaurantId, userId, userRole, details = null, statusCode = null }) {
  try {
    await ensureAuditSchema();
    let meta = details ? JSON.stringify(scrub(details)) : null;
    if (meta && meta.length > MAX_META) meta = `${meta.slice(0, MAX_META)}…`;
    await query(
      `INSERT INTO audit_logs (user_id, user_role, restaurant_id, action, entity, entity_id, metadata_json, ip_address, status_code)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId !== undefined ? userId : (req?.user?.id || null),
        (userRole !== undefined ? userRole : req?.user?.role) || null,
        restaurantId !== undefined ? restaurantId : (req?.adminRestaurantId || req?.user?.restaurant_id || null),
        String(action).slice(0, 100),
        entity ? String(entity).slice(0, 100) : null,
        entityId !== null && entityId !== undefined ? String(entityId).slice(0, 64) : null,
        meta,
        clientIp(req),
        statusCode
      ]
    );
  } catch (err) {
    console.warn('[audit] could not write audit entry:', err.message);
  }
}

// Requests that change nothing important or happen constantly (location pings, chat, reads)
const SKIP = [
  /\/location\b/, /\/heartbeat/, /\/notifications\/.*read/, /\/ai\//, /\/push\//, /\/guest\//,
  /\/payments\/(verify|failed|initiate)/, /\/auth\/(login|logout|forgot-password|reset-password|customer)/,
  /\/orders\/checkout/, /\/coupons\/validate/, /\/wallet\/checkout\/(quote|reserve|release)/
];

function describePath(path) {
  // /api/admin/menu/12/availability -> entity "menu", entity id "12"
  const parts = path.replace(/^\/api(\/v1)?\//, '').split('/').filter(Boolean);
  const idIndex = parts.findIndex((p) => /^\d+$/.test(p));
  const entityParts = parts.filter((p) => !/^\d+$/.test(p) && p !== 'admin' && p !== 'restaurant');
  return { entity: entityParts[0] || parts[0] || null, entityId: idIndex >= 0 ? parts[idIndex] : null };
}

/** Records successful changes (POST/PUT/PATCH/DELETE) made by a signed-in user. */
function auditMiddleware(req, res, next) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) || !req.originalUrl.startsWith('/api')) return next();
  const path = req.originalUrl.split('?')[0];
  if (SKIP.some((re) => re.test(path))) return next();
  res.on('finish', () => {
    if (!req.user || res.statusCode >= 400) return;
    if (String(req.user.role || '').toUpperCase() === 'CUSTOMER') return;
    const { entity, entityId } = describePath(path);
    logAudit(req, {
      action: `${req.method} ${path.replace(/^\/api(\/v1)?/, '')}`,
      entity,
      entityId,
      details: req.body && Object.keys(req.body).length ? req.body : null,
      statusCode: res.statusCode
    });
  });
  next();
}

module.exports = { logAudit, auditMiddleware, ensureAuditSchema, scrub };
