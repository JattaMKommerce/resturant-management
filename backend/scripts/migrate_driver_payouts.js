require('dotenv').config();
const { getConnection } = require('../config/db');

async function migrate() {
  const conn = await getConnection();
  try {
    console.log('🚀 Starting Driver Payouts and Wallet migration...');

    // Helper to check table existence
    async function tableExists(tableName) {
      const [rows] = await conn.query(
        `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
        [tableName]
      );
      return rows.length > 0;
    }

    // 1. Table: driver_payout_settings
    if (!(await tableExists('driver_payout_settings'))) {
      await conn.query(`
        CREATE TABLE \`driver_payout_settings\` (
          \`id\` INT AUTO_INCREMENT PRIMARY KEY,
          \`restaurant_id\` INT NOT NULL,
          \`driver_id\` INT NOT NULL,
          \`has_salary\` TINYINT(1) DEFAULT 0,
          \`salary_amount\` DECIMAL(10, 2) DEFAULT 0.00,
          \`salary_frequency\` ENUM('MONTHLY', 'WEEKLY', 'DAILY') DEFAULT 'MONTHLY',
          \`salary_effective_date\` DATE NULL,
          \`has_commission\` TINYINT(1) DEFAULT 0,
          \`commission_percentage\` DECIMAL(5, 2) DEFAULT 0.00,
          \`has_incentive\` TINYINT(1) DEFAULT 0,
          \`incentive_amount\` DECIMAL(10, 2) DEFAULT 0.00,
          \`incentive_type\` VARCHAR(32) DEFAULT 'PER_ORDER',
          \`notes\` TEXT NULL,
          \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY \`uk_rest_driver\` (\`restaurant_id\`, \`driver_id\`),
          INDEX \`idx_driver\` (\`driver_id\`),
          INDEX \`idx_restaurant\` (\`restaurant_id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
      console.log('✅ Created table driver_payout_settings');
    } else {
      console.log('ℹ️ Table driver_payout_settings already exists');
    }

    // 2. Table: driver_wallet_transactions
    if (!(await tableExists('driver_wallet_transactions'))) {
      await conn.query(`
        CREATE TABLE \`driver_wallet_transactions\` (
          \`id\` INT AUTO_INCREMENT PRIMARY KEY,
          \`restaurant_id\` INT NOT NULL,
          \`driver_id\` INT NOT NULL,
          \`order_id\` INT NULL,
          \`entry_type\` ENUM('CREDIT_SALARY', 'CREDIT_COMMISSION', 'CREDIT_INCENTIVE', 'SETTLEMENT_PAYOUT') NOT NULL,
          \`amount\` DECIMAL(10, 2) NOT NULL,
          \`description\` VARCHAR(255) NOT NULL,
          \`status\` ENUM('PENDING_PAYOUT', 'PAID', 'CANCELLED') DEFAULT 'PENDING_PAYOUT',
          \`settlement_id\` VARCHAR(64) NULL,
          \`settled_at\` DATETIME NULL,
          \`settled_by_user_id\` INT NULL,
          \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX \`idx_driver_status\` (\`driver_id\`, \`restaurant_id\`, \`status\`),
          INDEX \`idx_order\` (\`order_id\`),
          INDEX \`idx_created_at\` (\`created_at\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
      console.log('✅ Created table driver_wallet_transactions');
    } else {
      console.log('ℹ️ Table driver_wallet_transactions already exists');
    }

    // 3. Table: driver_payout_settlements
    if (!(await tableExists('driver_payout_settlements'))) {
      await conn.query(`
        CREATE TABLE \`driver_payout_settlements\` (
          \`id\` INT AUTO_INCREMENT PRIMARY KEY,
          \`settlement_number\` VARCHAR(64) NOT NULL UNIQUE,
          \`restaurant_id\` INT NOT NULL,
          \`driver_id\` INT NOT NULL,
          \`total_salary\` DECIMAL(10, 2) DEFAULT 0.00,
          \`total_commission\` DECIMAL(10, 2) DEFAULT 0.00,
          \`total_incentive\` DECIMAL(10, 2) DEFAULT 0.00,
          \`net_amount\` DECIMAL(10, 2) NOT NULL,
          \`payment_method\` ENUM('CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE') DEFAULT 'CASH',
          \`reference_note\` TEXT NULL,
          \`settled_by\` INT NOT NULL,
          \`settled_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
          INDEX \`idx_settlement_driver\` (\`driver_id\`, \`restaurant_id\`),
          INDEX \`idx_settled_at\` (\`settled_at\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
      console.log('✅ Created table driver_payout_settlements');
    } else {
      console.log('ℹ️ Table driver_payout_settlements already exists');
    }

    console.log('🎉 Driver Payouts & Wallet migration completed successfully!');
  } catch (err) {
    console.error('❌ Migration error:', err);
    throw err;
  } finally {
    conn.release();
  }
}

migrate()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
