const mysql = require('mysql2/promise');
require('dotenv').config();

const isProduction = process.env.NODE_ENV === 'production';
const connectionLimit = parseInt(process.env.DB_CONNECTION_LIMIT || '15', 10);

// Base connection configuration
let poolConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'db123',
  database: process.env.DB_NAME || 'hotel_db',
  waitForConnections: true,
  connectionLimit: connectionLimit,
  queueLimit: 0,
  connectTimeout: 15000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  multipleStatements: true
};

// Check for unified DATABASE_URL / MYSQL_URL (common on Railway / cloud providers)
const connectionUri = process.env.DATABASE_URL || process.env.MYSQL_URL;
if (connectionUri) {
  poolConfig = {
    uri: connectionUri,
    waitForConnections: true,
    connectionLimit: connectionLimit,
    queueLimit: 0,
    connectTimeout: 15000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    multipleStatements: true
  };
}

// SSL Configuration for cloud databases
const useSsl = process.env.DB_SSL === 'true' || (isProduction && Boolean(connectionUri));
if (useSsl) {
  poolConfig.ssl = {
    rejectUnauthorized: false
  };
}

const pool = mysql.createPool(poolConfig);

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
      console.error('MySQL Query Error [Code:', err.code, ']:', err.message);
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
 * Automatically handles BEGIN, COMMIT, and ROLLBACK with connection release.
 *
 * @param {Function} callback - async (connection) => { ... }
 * @returns {Promise<*>} Result of the callback
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
