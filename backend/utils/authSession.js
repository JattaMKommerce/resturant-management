/**
 * authSession.js
 * Single source of truth for login tokens and server-side session state.
 *
 * - Tokens are signed and verified with ONE secret (JWT_SECRET). The old code also accepted
 *   tokens signed with hard-coded fallback secrets that are visible in the source, which let
 *   anyone forge a Super Admin token.
 * - Sessions can be revoked on the server: logout stores the token's hash in revoked_tokens,
 *   and a password reset moves users.tokens_valid_after_ms forward so older tokens stop working.
 * - Deactivated / disabled users are rejected on every request, not only at login.
 */
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { query } = require('../config/db');
require('dotenv').config();

// Secrets that have appeared in this repository's source code and therefore protect nothing.
const PUBLISHED_SECRETS = [
  'super_secret_hotel_jwt_key_2026',
  'super_secret_hotel_jwt_key_2026_change_in_production',
  'super_secret_jwt_key_hotel_management_2026'
];

/**
 * Use JWT_SECRET when it is a real secret. When it is missing or one of the published values,
 * derive the signing key from server-only configuration (the database credentials), so tokens
 * cannot be forged from the source code alone. Set a long random JWT_SECRET to silence this.
 */
function resolveJwtSecret() {
  const configured = process.env.JWT_SECRET;
  if (configured && !PUBLISHED_SECRETS.includes(configured)) return configured;
  const serverOnly = [
    process.env.DB_PASSWORD, process.env.MYSQLPASSWORD, process.env.MYSQL_PASSWORD,
    process.env.DATABASE_URL, process.env.MYSQL_URL, process.env.MYSQLURL
  ].filter(Boolean).join('|');
  console.warn('⚠️  [Security] JWT_SECRET is ' + (configured ? 'a value published in the source code' : 'not set') +
    '. Using a key derived from the database credentials instead. Set a long random JWT_SECRET in the server environment.');
  return crypto.createHash('sha256').update(`${configured || PUBLISHED_SECRETS[0]}|${serverOnly}|hms-jwt-v2`).digest('hex');
}
const JWT_SECRET = resolveJwtSecret();

const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN', 'RESTAURANT_ADMIN', 'MANAGER'];
// Roles that must never be silently promoted to RESTAURANT_ADMIN just because the user is
// linked to a restaurant (staff are linked through restaurant_admins too).
const STAFF_ROLES = ['WAITER', 'KITCHEN', 'CHEF', 'CASHIER', 'INVENTORY_MANAGER', 'DRIVER'];

const COOKIE_NAMES = ['hotel_token', 'token', 'jwt'];

// Passwords that ship with the demo data and appear in this repository. An admin-level account
// still using one of them must choose a new password before it can do anything else.
const DEFAULT_PASSWORDS = new Set([
  'admin@123', 'admin123', 'admin', '123456789', '12345678', '123456', 'password',
  'chef123', 'waiter123', 'driver123', 'customer123', 'manager123', 'cashier123'
]);
const PRIVILEGED_ROLES = ['SUPER_ADMIN', 'ADMIN', 'RESTAURANT_ADMIN', 'MANAGER'];
// Requests a "change your password first" session may still make
const PASSWORD_CHANGE_ALLOWED = [/\/auth\/change-password$/, /\/auth\/logout$/, /\/auth\/me$/];

function isDefaultPassword(password) {
  return DEFAULT_PASSWORDS.has(String(password || '').trim().toLowerCase());
}

/** True when this login must be forced through a password change (production, or when enabled). */
function mustChangePassword(role, password) {
  const enforce = process.env.NODE_ENV === 'production' || process.env.ENFORCE_DEFAULT_PASSWORD_CHANGE === 'true';
  return enforce && PRIVILEGED_ROLES.includes(String(role || '').toUpperCase()) && isDefaultPassword(password);
}

/** For a session limited to changing the password: is this request allowed? */
function passwordChangeBlocks(decoded, req) {
  if (!decoded || !decoded.pwd_change_required) return false;
  const path = (req.originalUrl || req.url || '').split('?')[0];
  return !PASSWORD_CHANGE_ALLOWED.some((re) => re.test(path));
}

function tokenExpiryFor(role) {
  const r = String(role || '').toUpperCase();
  if (ADMIN_ROLES.includes(r)) return process.env.ADMIN_JWT_EXPIRES_IN || '12h';
  return process.env.JWT_EXPIRES_IN || '7d';
}

function signToken(payload, expiresIn) {
  // A unique jti makes every login's token distinct, so logging out one session never
  // revokes another that happened to be issued in the same second with the same claims.
  // iat_ms records the issue time to the millisecond so a password reset ends exactly the
  // sessions that existed before it (the standard iat is only whole seconds).
  const { jti, iat_ms, iat, exp, ...claims } = payload || {};
  return jwt.sign({ ...claims, jti: crypto.randomUUID(), iat_ms: Date.now() }, JWT_SECRET, { expiresIn: expiresIn || tokenExpiryFor(claims.role) });
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

/** Read the bearer token from headers, then cookies, then (optionally) ?token= */
function extractToken(req, { allowQuery = false } = {}) {
  let token = null;
  const authHeader = req.headers['authorization'] || req.headers['x-authorization'] ||
    req.headers['x-access-token'] || req.headers['auth-token'];
  if (typeof authHeader === 'string' && authHeader) {
    token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
  }
  if (!token && req.cookies) {
    token = req.cookies.hotel_token || req.cookies.token || req.cookies.jwt || null;
  }
  if (!token && allowQuery && req.query && req.query.token) {
    token = req.query.token;
  }
  if (token === 'null' || token === 'undefined') token = null;
  return token || null;
}

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function hashCode(code) {
  return crypto.createHash('sha256').update(`${JWT_SECRET}:${String(code)}`).digest('hex');
}

let schemaPromise = null;
async function ensureAuthSchema() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await query(`CREATE TABLE IF NOT EXISTS revoked_tokens (
        token_hash CHAR(64) NOT NULL PRIMARY KEY,
        user_id INT NULL,
        expires_at_ms BIGINT NOT NULL,
        revoked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_revoked_tokens_exp (expires_at_ms)
      )`);
      await query(`CREATE TABLE IF NOT EXISTS password_resets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        code_hash CHAR(64) NOT NULL,
        channel VARCHAR(20) DEFAULT 'WHATSAPP',
        expires_at_ms BIGINT NOT NULL,
        attempts INT NOT NULL DEFAULT 0,
        used TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_password_resets_user (user_id)
      )`);
      const cols = await query(`SHOW COLUMNS FROM users LIKE 'tokens_valid_after_ms'`);
      if (cols.length === 0) {
        await query(`ALTER TABLE users ADD COLUMN tokens_valid_after_ms BIGINT NULL DEFAULT NULL`);
      }
    })().catch((err) => {
      schemaPromise = null;
      throw err;
    });
  }
  return schemaPromise;
}

/**
 * Server-side session check for an already signature-verified token.
 * Returns null when the session is valid, or a user-facing reason string when it is not.
 * Fails open on database errors (the signature has already been verified).
 */
async function checkSession(decoded, token) {
  if (!decoded || !decoded.id) return null;
  try {
    await ensureAuthSchema();
    const rows = await query(
      `SELECT u.status, u.tokens_valid_after_ms,
              (SELECT 1 FROM revoked_tokens rt WHERE rt.token_hash = ? LIMIT 1) AS revoked
       FROM users u WHERE u.id = ?`,
      [hashToken(token), decoded.id]
    );
    if (rows.length === 0) return 'Account not found. Please log in again.';
    const u = rows[0];
    if (u.revoked) return 'You have been logged out. Please log in again.';
    if (u.status === 'INACTIVE' || u.status === 'DISABLED') {
      return 'Your account is deactivated. Please contact your administrator.';
    }
    const validAfter = Number(u.tokens_valid_after_ms || 0);
    const issuedAtMs = Number(decoded.iat_ms) || (decoded.iat ? decoded.iat * 1000 + 999 : 0);
    if (validAfter && issuedAtMs && issuedAtMs < validAfter) {
      return 'Your session has ended because the password was changed. Please log in again.';
    }
    return null;
  } catch (err) {
    console.warn('[authSession] session check skipped (DB error):', err.message);
    return null;
  }
}

/** Revoke one token (logout). Safe to call with an invalid/expired token. */
async function revokeToken(token) {
  if (!token) return false;
  let decoded = null;
  try {
    decoded = verifyToken(token);
  } catch (e) {
    return false; // already invalid/expired: nothing to revoke
  }
  await ensureAuthSchema();
  const expMs = decoded.exp ? decoded.exp * 1000 : Date.now() + 30 * 24 * 3600 * 1000;
  await query(
    `INSERT IGNORE INTO revoked_tokens (token_hash, user_id, expires_at_ms) VALUES (?, ?, ?)`,
    [hashToken(token), decoded.id || null, expMs]
  );
  // Housekeeping: drop entries for tokens that have expired anyway
  query(`DELETE FROM revoked_tokens WHERE expires_at_ms < ?`, [Date.now()]).catch(() => {});
  return true;
}

/** End every existing session of a user (used after a password reset/change). */
async function revokeAllSessionsForUser(userId) {
  await ensureAuthSchema();
  await query(`UPDATE users SET tokens_valid_after_ms = ? WHERE id = ?`, [Date.now(), userId]);
}

function clearAuthCookies(res) {
  const base = { sameSite: 'lax', secure: process.env.NODE_ENV === 'production' };
  for (const name of COOKIE_NAMES) {
    res.clearCookie(name, base);
    res.clearCookie(name);
  }
}

/**
 * One-time cleanup of passwords that were stored in readable form.
 * Keeps the existing bcrypt hash when there is one (it is the authoritative password);
 * only builds a hash from the plain value when the hash is missing or not bcrypt.
 */
async function scrubPlainPasswords() {
  const bcrypt = require('bcryptjs');
  let cleaned = 0;
  for (const table of ['users', 'rider_applications']) {
    try {
      const cols = await query(`SHOW COLUMNS FROM \`${table}\` LIKE 'plain_password'`);
      if (cols.length === 0) continue;
      const rows = await query(
        `SELECT id, password_hash, plain_password FROM \`${table}\` WHERE plain_password IS NOT NULL AND plain_password <> ''`
      );
      for (const row of rows) {
        const hasHash = typeof row.password_hash === 'string' && row.password_hash.startsWith('$2');
        if (hasHash) {
          await query(`UPDATE \`${table}\` SET plain_password = NULL WHERE id = ?`, [row.id]);
        } else {
          const hash = await bcrypt.hash(String(row.plain_password), 10);
          await query(`UPDATE \`${table}\` SET password_hash = ?, plain_password = NULL WHERE id = ?`, [hash, row.id]);
        }
        cleaned++;
      }
    } catch (err) {
      console.warn(`[authSession] plain password cleanup skipped for ${table}:`, err.message);
    }
  }
  if (cleaned > 0) console.log(`🔐 Removed ${cleaned} readable password(s) from the database.`);
  return cleaned;
}

module.exports = {
  JWT_SECRET,
  ADMIN_ROLES,
  STAFF_ROLES,
  tokenExpiryFor,
  signToken,
  verifyToken,
  extractToken,
  hashToken,
  hashCode,
  ensureAuthSchema,
  checkSession,
  revokeToken,
  revokeAllSessionsForUser,
  clearAuthCookies,
  scrubPlainPasswords,
  isDefaultPassword,
  mustChangePassword,
  passwordChangeBlocks
};
