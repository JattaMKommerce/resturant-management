const mysql = require('mysql2/promise');
require('dotenv').config();

let poolConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'db123',
  database: process.env.DB_NAME || 'hotel_db',
  waitForConnections: true,
  connectionLimit: 15,
  queueLimit: 0,
  multipleStatements: true
};

if (process.env.DATABASE_URL || process.env.MYSQL_URL) {
  const connectionUri = process.env.DATABASE_URL || process.env.MYSQL_URL;
  poolConfig = {
    uri: connectionUri,
    waitForConnections: true,
    connectionLimit: 15,
    queueLimit: 0,
    multipleStatements: true,
    ssl: {
      rejectUnauthorized: false
    }
  };
} else if (process.env.DB_SSL === 'true' || process.env.NODE_ENV === 'production') {
  poolConfig.ssl = { rejectUnauthorized: false };
}

const pool = mysql.createPool(poolConfig);

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

module.exports = {
  pool,
  query,
  getConnection
};
