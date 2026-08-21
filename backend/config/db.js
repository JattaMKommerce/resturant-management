const mysql = require('mysql2/promise');
require('dotenv').config();

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

function createDbPool() {
  const rawUri = process.env.DATABASE_URL || process.env.MYSQL_URL;
  const uri = isValidUri(rawUri) ? rawUri.trim() : null;

  if (uri) {
    const isRailwayInternal = uri.includes('railway.internal');
    const isLocalhost = uri.includes('localhost') || uri.includes('127.0.0.1');
    const poolConfig = {
      uri,
      waitForConnections: true,
      connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '15'),
      queueLimit: 0,
      multipleStatements: true,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000
    };

    if (process.env.DB_SSL === 'true' && !isRailwayInternal && !isLocalhost) {
      poolConfig.ssl = { rejectUnauthorized: false };
    }

    console.log('🔗 MySQL Pool initialized via Cloud URI');
    return mysql.createPool(poolConfig);
  }

  const host = process.env.DB_HOST || process.env.MYSQLHOST || 'localhost';
  const port = parseInt(process.env.DB_PORT || process.env.MYSQLPORT || '3306');
  const user = process.env.DB_USER || process.env.MYSQLUSER || 'root';
  const password = process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : (process.env.MYSQLPASSWORD !== undefined ? process.env.MYSQLPASSWORD : '');
  const database = process.env.DB_NAME || process.env.MYSQLDATABASE || 'hotel_db';

  const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1') || host.includes('railway.internal');

  const poolConfig = {
    host,
    port,
    user,
    password,
    database,
    waitForConnections: true,
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '15'),
    queueLimit: 0,
    multipleStatements: true,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000
  };

  if (process.env.DB_SSL === 'true' && !isLocalhost) {
    poolConfig.ssl = { rejectUnauthorized: false };
  }

  console.log(`🔗 MySQL Pool initialized for ${host}:${port}/${database}`);
  return mysql.createPool(poolConfig);
}

const pool = createDbPool();

/**
 * Execute a query with parameters
 */
async function query(sql, params = []) {
  try {
    const [rows] = await pool.query(sql, params);
    return rows;
  } catch (err) {
    console.error('MySQL Query Error:', err.message, '| SQL:', sql);
    throw err;
  }
}

/**
 * Get a connection for transactions
 */
async function getConnection() {
  return await pool.getConnection();
}

module.exports = {
  pool,
  query,
  getConnection
};
