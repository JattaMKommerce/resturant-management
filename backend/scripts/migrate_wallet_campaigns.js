require('dotenv').config();
const { query, getConnection } = require('../config/db');

async function migrate() {
  const conn = await getConnection();
  try {
    async function addCol(table, col, def) {
      const [cols] = await conn.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [table, col]
      );
      if (cols.length === 0) {
        await conn.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${col}\` ${def}`);
        console.log(`✅ Added ${table}.${col}`);
      } else {
        console.log(`ℹ️ Column ${table}.${col} already exists`);
      }
    }

    try {
      await conn.query(`ALTER TABLE wallet_campaign_rules MODIFY COLUMN reward_type VARCHAR(32) DEFAULT 'UPTO_LUCKY'`);
      console.log('✅ Modified reward_type column to VARCHAR(32)');
    } catch (e) {
      console.warn('Modify reward_type warning:', e.message);
    }

    await addCol('wallet_campaign_rules', 'upto_amount', 'DECIMAL(10, 2) DEFAULT 70.00');
    await addCol('wallet_campaign_rules', 'min_reward_amount', 'DECIMAL(10, 2) DEFAULT 10.00');
    await addCol('wallet_campaign_rules', 'lucky_ratio', 'DECIMAL(5, 2) DEFAULT 35.00');
    await addCol('wallet_campaign_rules', 'auto_distribute_on_order', 'TINYINT(1) DEFAULT 1');
    await addCol('wallet_campaign_rules', 'auto_distribute_on_signup', 'TINYINT(1) DEFAULT 1');

    // Update existing active campaign rules to have reward_type = 'UPTO_LUCKY', upto_amount = 70.00, min_reward_amount = 10.00, lucky_ratio = 35.00
    await conn.query(`
      UPDATE wallet_campaign_rules
      SET reward_type = 'UPTO_LUCKY',
          upto_amount = COALESCE(upto_amount, 70.00),
          min_reward_amount = COALESCE(min_reward_amount, 10.00),
          lucky_ratio = COALESCE(lucky_ratio, 35.00),
          auto_distribute_on_order = 1,
          auto_distribute_on_signup = 1
      WHERE upto_amount IS NULL OR reward_type = 'PERCENTAGE'
    `);
    console.log('✅ Updated existing campaign rules to UPTO_LUCKY defaults');

    const [rules] = await conn.query('SELECT * FROM wallet_campaign_rules WHERE tenant_id = 1');
    console.log('Campaign rule for Grand Palace (tenant 1):', rules[0]);

  } finally {
    conn.release();
  }
}

migrate()
  .then(() => {
    console.log('Migration finished successfully.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
