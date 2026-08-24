/**
 * reset_to_trial.js
 * Resets Restaurant 1 (The Grand Palace) to the 7-Day Free Trial state.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const pool = require('../config/database');

async function resetRestaurantToTrial(restaurantId = 1) {
  try {
    console.log(`Setting Restaurant #${restaurantId} to 7-Day Free Trial...`);

    // 1. Find or create Free Trial Plan
    let [planRows] = await pool.query("SELECT * FROM subscription_plans WHERE slug = 'free-trial' OR slug = 'trial' LIMIT 1");
    let trialPlanId = null;

    if (planRows.length > 0) {
      trialPlanId = planRows[0].id;
    } else {
      const [createPlan] = await pool.query(
        `INSERT INTO subscription_plans 
          (name, slug, description, price, duration_days, max_orders_per_month, max_menu_items, max_staff_accounts, features_json, is_active, display_order)
         VALUES ('7-Day Free Trial', 'free-trial', 'Full complimentary operational access for 7 days.', 0.00, 7, 100, 50, 5, ?, 1, 0)`,
        [JSON.stringify(['Kitchen Display System (KDS)', 'Table QR Digital Menus', 'POS Billing & GST Invoices', 'Online Customer Storefront', 'Dedicated Rider Dispatch'])]
      );
      trialPlanId = createPlan.insertId;
    }

    // 2. Set starts_at = NOW(), expires_at = NOW() + 7 Days
    const startsAt = new Date();
    const expiresAt = new Date(startsAt.getTime() + 7 * 24 * 60 * 60 * 1000);

    // 3. Clear old payments/subscriptions for Restaurant 1
    await pool.query('DELETE FROM subscription_history WHERE restaurant_id = ?', [restaurantId]);
    await pool.query('DELETE FROM subscription_payments WHERE restaurant_id = ?', [restaurantId]);
    await pool.query('DELETE FROM hotel_subscriptions WHERE restaurant_id = ?', [restaurantId]);

    // 4. Insert 7-Day Free Trial Subscription
    const [subRes] = await pool.query(
      `INSERT INTO hotel_subscriptions 
        (restaurant_id, plan_id, subscription_type, status, starts_at, expires_at, notes)
       VALUES (?, ?, 'TRIAL', 'ACTIVE', ?, ?, '7-Day Free Trial activated')`,
      [restaurantId, trialPlanId, startsAt, expiresAt]
    );

    await pool.query(
      `INSERT INTO subscription_history 
        (restaurant_id, subscription_id, plan_id, action, previous_status, new_status, starts_at, expires_at, notes)
       VALUES (?, ?, ?, 'ASSIGNED', 'NONE', 'ACTIVE', ?, ?, '7-Day Free Trial activated')`,
      [restaurantId, subRes.insertId, trialPlanId, startsAt, expiresAt]
    );

    console.log(`✅ Successfully activated 7-Day Free Trial for Restaurant #${restaurantId}!`);
    console.log(`Starts At:  ${startsAt.toLocaleString('en-IN')}`);
    console.log(`Expires At: ${expiresAt.toLocaleString('en-IN')}`);
  } catch (err) {
    console.error('Error resetting to trial:', err);
  } finally {
    process.exit(0);
  }
}

resetRestaurantToTrial(1);
