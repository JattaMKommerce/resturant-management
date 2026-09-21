require('dotenv').config();
const { query } = require('../config/db');

async function seedDriverPayoutSettings() {
  try {
    console.log('--- Seeding Driver Payout Settings for Dedicated Restaurants ---');
    const drivers = await query('SELECT id, full_name, restaurant_id FROM delivery_drivers');
    console.log(`Found ${drivers.length} drivers in delivery_drivers.`);

    let createdCount = 0;
    let existingCount = 0;

    for (const drv of drivers) {
      const restId = drv.restaurant_id || 1;
      const [existing] = await query(
        'SELECT id, has_salary, has_commission, has_incentive FROM driver_payout_settings WHERE restaurant_id = ? AND driver_id = ?',
        [restId, drv.id]
      );

      if (existing) {
        existingCount++;
        console.log(`Driver #${drv.id} (${drv.full_name || 'Driver'}) already has settings for Restaurant #${restId}.`);
      } else {
        await query(
          `INSERT INTO driver_payout_settings 
           (restaurant_id, driver_id, has_salary, salary_amount, salary_frequency, has_commission, commission_percentage, has_incentive, incentive_amount, incentive_type, notes, created_at, updated_at)
           VALUES (?, ?, 1, 15000.00, 'MONTHLY', 1, 10.00, 1, 25.00, 'PER_ORDER', 'Auto-provisioned dedicated restaurant package', NOW(), NOW())`,
          [restId, drv.id]
        );
        createdCount++;
        console.log(`✅ Provisioned settings for Driver #${drv.id} (${drv.full_name || 'Driver'}) at Restaurant #${restId}: Salary ₹15,000, Comm 10%, Incentive ₹25.`);
      }
    }

    console.log(`\nSummary: ${existingCount} already existed, ${createdCount} newly provisioned.`);
    console.log('All drivers now have active compensation settings for their dedicated restaurant.');
    process.exit(0);
  } catch (err) {
    console.error('Error seeding driver payout settings:', err);
    process.exit(1);
  }
}

seedDriverPayoutSettings();
