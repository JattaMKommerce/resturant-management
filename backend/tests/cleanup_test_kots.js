require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const pool = require('../config/database');

async function cleanup() {
  await pool.query("DELETE FROM kot_items WHERE item_name LIKE '%Unconfigured%' OR item_name LIKE '%Test%'");
  await pool.query("DELETE FROM kots WHERE id NOT IN (SELECT DISTINCT kot_id FROM kot_items)");
  await pool.query("DELETE FROM menu_items WHERE name LIKE '%Unconfigured%' OR name LIKE '%Test%'");
  console.log('Test artifacts removed from database successfully.');
  process.exit(0);
}

cleanup().catch(err => {
  console.error(err);
  process.exit(1);
});
