const mysql = require('mysql2/promise');
require('dotenv').config();

const isProduction = process.env.NODE_ENV === 'production';
const connectionLimit = parseInt(process.env.DB_CONNECTION_LIMIT || '15', 10);

// Resolve configuration options
const host = process.env.DB_HOST || process.env.MYSQLHOST || 'localhost';
const port = parseInt(process.env.DB_PORT || process.env.MYSQLPORT || '3306', 10);
const user = process.env.DB_USER || process.env.MYSQLUSER || 'root';
const password = process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || 'db123';
const database = process.env.DB_NAME || process.env.MYSQLDATABASE || 'hotel_db';

let rawUri = process.env.DATABASE_URL || process.env.MYSQL_URL;

function isValidUri(uri) {
  if (!uri || typeof uri !== 'string') return false;
  const trimmed = uri.trim();
  if (trimmed.startsWith('mysql://:@') || trimmed === 'mysql://:@:/' || trimmed.length < 12) return false;
  try {
    const parsed = new URL(trimmed);
    return Boolean(parsed.hostname && parsed.hostname.length > 0 && parsed.hostname !== ':');
  } catch (e) {
    return false;
  }
}

const connectionUri = isValidUri(rawUri) ? rawUri.trim() : null;

let pool;

if (connectionUri) {
  const isRailwayInternal = connectionUri.includes('railway.internal');
  const isLocalhost = connectionUri.includes('localhost') || connectionUri.includes('127.0.0.1');
  const useSsl = process.env.DB_SSL === 'true' && !isRailwayInternal && !isLocalhost;

  if (useSsl) {
    pool = mysql.createPool({
      uri: connectionUri,
      waitForConnections: true,
      connectionLimit: connectionLimit,
      queueLimit: 0,
      connectTimeout: 15000,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
      multipleStatements: true,
      ssl: { rejectUnauthorized: false }
    });
  } else {
    pool = mysql.createPool(connectionUri);
  }
} else {
  pool = mysql.createPool({
    host,
    port,
    user,
    password,
    database,
    waitForConnections: true,
    connectionLimit: connectionLimit,
    queueLimit: 0,
    connectTimeout: 15000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    multipleStatements: true
  });
}

/**
 * Execute a query with parameters using the connection pool
 */
async function query(sql, params = []) {
  try {
    const [rows] = await pool.execute(sql, params);
    return rows;
  } catch (err) {
    if (!isProduction) {
      console.error('MySQL Query Error:', err.message, '| SQL:', sql);
    } else {
      console.error(`MySQL Query Error [Code: ${err.code}]:`, err.message);
    }
    throw err;
  }
}

/**
 * Get an isolated connection from the pool
 */
async function getConnection() {
  return await pool.getConnection();
}

/**
 * Execute multi-step atomic operations inside a transaction.
 */
async function withTransaction(callback) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

/**
 * Lightweight database ping for health check endpoints
 */
async function testConnection() {
  const [rows] = await pool.query('SELECT 1 as is_healthy');
  return rows[0]?.is_healthy === 1;
}

module.exports = {
  pool,
  query,
  getConnection,
  withTransaction,
  testConnection
};
