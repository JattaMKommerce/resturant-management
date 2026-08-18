const { pool } = require('./db');

// Export the native mysql2 pool instance for KOT services & controllers
module.exports = pool;
