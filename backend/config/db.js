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

function getDbConnectionConfig(overrideDbName = null) {
  const rawUri = process.env.DATABASE_URL || 
                 process.env.MYSQL_URL || 
                 process.env.MYSQLURL || 
                 process.env.MYSQL_PRIVATE_URL || 
                 process.env.MYSQL_PUBLIC_URL;
                 
  const uri = isValidUri(rawUri) ? rawUri.trim() : null;

  const baseConfig = {
    waitForConnections: true,
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '15', 10),
    queueLimit: 0,
    multipleStatements: true
  };

  if (uri) {
    const isRailwayInternal = uri.includes('railway.internal');
    const isLocalhost = uri.includes('localhost') || uri.includes('127.0.0.1');
    const config = {
      ...baseConfig,
      uri
    };
    if (process.env.DB_SSL === 'true' && !isRailwayInternal && !isLocalhost) {
      config.ssl = { rejectUnauthorized: false };
    }
    return config;
  }

  const host = process.env.DB_HOST || 
               process.env.MYSQLHOST || 
               process.env.MYSQL_HOST || 
               process.env.MYSQL_PRIVATE_HOST || 
               process.env.MYSQL_PUBLIC_HOST || 
               'localhost';

  const port = parseInt(
    process.env.DB_PORT || 
    process.env.MYSQLPORT || 
    process.env.MYSQL_PORT || 
    process.env.MYSQL_PUBLIC_PORT || 
    '3306', 
    10
  );

  const user = process.env.DB_USER || 
               process.env.MYSQLUSER || 
               process.env.MYSQL_USER || 
               'root';

  const password = process.env.DB_PASSWORD !== undefined 
    ? process.env.DB_PASSWORD 
    : (process.env.MYSQLPASSWORD !== undefined 
        ? process.env.MYSQLPASSWORD 
        : (process.env.MYSQL_PASSWORD !== undefined 
            ? process.env.MYSQL_PASSWORD 
            : ''));

  const database = overrideDbName || 
                   process.env.DB_NAME || 
                   process.env.MYSQLDATABASE || 
                   process.env.MYSQL_DATABASE || 
                   process.env.MYSQLDB || 
                   'hotel_db';

  const isLocalhost = host === 'localhost' || host === '127.0.0.1';
  const isRailwayInternal = host.includes('railway.internal');

  const config = {
    ...baseConfig,
    host,
    port,
    user,
    password,
    database
  };

  if (process.env.DB_SSL === 'true' && !isLocalhost && !isRailwayInternal) {
    config.ssl = { rejectUnauthorized: false };
  }

  return config;
}

const pool = mysql.createPool(getDbConnectionConfig());

/**
 * Test database connectivity
 */
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    return true;
  } catch (err) {
    console.error('Database connection test failed:', err.message);
    return false;
  }
}

/**
 * Execute a query with parameters
 */
async function query(sql, params = []) {
  try {
    const [rows, fields] = await pool.execute(sql, params);
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

/**
 * Execute a callback inside a managed database transaction
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

module.exports = {
  pool,
  query,
  getConnection,
  withTransaction,
  testConnection,
  getDbConnectionConfig
};
