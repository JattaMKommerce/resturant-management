const { query, getConnection } = require('../config/db');
const { getSocketIO } = require('../services/NotificationService');

/**
 * Helper to ensure restaurant tenant isolation for Admin operations
 */
async function getTargetRestaurantId(req) {
  const targetId = req.query?.restaurant_id || req.headers?.['x-restaurant-id'];
  if (targetId) {
    const parsed = parseInt(targetId, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  const targetSlug = req.query?.slug || req.headers?.['x-restaurant-slug'];
  if (targetSlug) {
    const [rest] = await query('SELECT id FROM restaurants WHERE slug = ?', [targetSlug]);
    if (rest) return rest.id;
  }
  return req.restaurantId ||
         req.adminRestaurantId ||
         (req.adminRestaurantIds && req.adminRestaurantIds[0]) ||
         req.user?.restaurant_id ||
         1;
}

/**
 * 1. Automatic Delivery Commission & Incentive Crediting
 * Called whenever an order is marked DELIVERED
 */
async function creditDriverDeliveryEarnings(order) {
  try {
    if (!order || !order.assigned_driver_id || !order.restaurant_id) return null;

    const driverId = order.assigned_driver_id;
    const restaurantId = order.restaurant_id;

    // 1. Fetch compensation settings for this driver
    const [settings] = await query(
      `SELECT * FROM driver_payout_settings WHERE restaurant_id = ? AND driver_id = ?`,
      [restaurantId, driverId]
    );

    if (!settings) return null;

    const orderNumber = order.order_number || `#${order.id}`;
    const orderTotal = parseFloat(order.total_amount || 0);

    // 2. Parcel Commission Calculation
    if (settings.has_commission && parseFloat(settings.commission_percentage || 0) > 0) {
      const commPct = parseFloat(settings.commission_percentage);
      const commAmount = Math.round((orderTotal * (commPct / 100)) * 100) / 100;

      if (commAmount > 0) {
        // Idempotency check: don't double credit commission for the same order
        const [existingComm] = await query(
          `SELECT id FROM driver_wallet_transactions 
           WHERE order_id = ? AND driver_id = ? AND entry_type = 'CREDIT_COMMISSION'`,
          [order.id, driverId]
        );

        if (!existingComm) {
          await query(
            `INSERT INTO driver_wallet_transactions 
             (restaurant_id, driver_id, order_id, entry_type, amount, description, status)
             VALUES (?, ?, ?, 'CREDIT_COMMISSION', ?, ?, 'PENDING_PAYOUT')`,
            [
              restaurantId,
              driverId,
              order.id,
              commAmount,
              `Parcel Delivery Commission (${commPct}%) for Order ${orderNumber}`
            ]
          );
        }
      }
    }

    // 3. Delivery Incentive Calculation
    if (settings.has_incentive && parseFloat(settings.incentive_amount || 0) > 0) {
      const incentiveAmt = parseFloat(settings.incentive_amount);

      // Idempotency check
      const [existingInc] = await query(
        `SELECT id FROM driver_wallet_transactions 
         WHERE order_id = ? AND driver_id = ? AND entry_type = 'CREDIT_INCENTIVE'`,
        [order.id, driverId]
      );

      if (!existingInc) {
        await query(
          `INSERT INTO driver_wallet_transactions 
           (restaurant_id, driver_id, order_id, entry_type, amount, description, status)
           VALUES (?, ?, ?, 'CREDIT_INCENTIVE', ?, ?, 'PENDING_PAYOUT')`,
          [
            restaurantId,
            driverId,
            order.id,
            incentiveAmt,
            `Delivery Incentive Bonus for Order ${orderNumber}`
          ]
        );
      }
    }

    // Broadcast wallet update event to driver and admin rooms
    try {
      const io = getSocketIO();
      if (io) {
        io.emit('driver_wallet_updated', { driverId, restaurantId, orderId: order.id });
      }
    } catch (e) {}

    return true;
  } catch (err) {
    console.error('[driverPayoutController] Error crediting delivery earnings:', err);
    return false;
  }
}

/**
 * 2. Sync Monthly/Period Salary Accrual
 * Automatically ensures a pending salary transaction exists for the active billing cycle
 */
async function syncDriverSalaryForPeriod(restaurantId, driverId, settings) {
  try {
    if (!settings || !settings.has_salary || parseFloat(settings.salary_amount || 0) <= 0) {
      return;
    }

    const now = new Date();
    const currentMonthYear = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    const salaryDesc = `Fixed Salary for ${currentMonthYear}`;

    // Check if salary for current month has already been created (either pending or paid)
    const [existingSalary] = await query(
      `SELECT id FROM driver_wallet_transactions 
       WHERE restaurant_id = ? AND driver_id = ? AND entry_type = 'CREDIT_SALARY' AND description = ?`,
      [restaurantId, driverId, salaryDesc]
    );

    if (!existingSalary) {
      await query(
        `INSERT INTO driver_wallet_transactions 
         (restaurant_id, driver_id, entry_type, amount, description, status)
         VALUES (?, ?, 'CREDIT_SALARY', ?, ?, 'PENDING_PAYOUT')`,
        [restaurantId, driverId, parseFloat(settings.salary_amount), salaryDesc]
      );
    }
  } catch (err) {
    console.error('[driverPayoutController] Error syncing salary:', err);
  }
}

/**
 * 3. ADMIN: Get Driver Fleet Compensation & Payouts Overview
 * GET /api/admin/driver-payouts
 */
async function getAdminDriverPayouts(req, res) {
  try {
    const targetRestId = await getTargetRestaurantId(req);

    // Fetch all drivers assigned to this restaurant
    let drivers = await query(
      `SELECT DISTINCT d.id, d.user_id, d.restaurant_id, d.full_name, d.mobile, d.email,
              d.vehicle_type, d.vehicle_number, d.account_status, d.availability_status,
              u.name as user_name, u.phone as user_phone
       FROM delivery_drivers d
       LEFT JOIN users u ON d.user_id = u.id
       LEFT JOIN driver_restaurant_assignments dra ON dra.driver_id = d.id
       WHERE (d.restaurant_id = ? OR dra.restaurant_id = ?)
       ORDER BY d.id DESC`,
      [targetRestId, targetRestId]
    );

    // If no drivers specifically mapped to this restaurant yet, fallback to all active fleet drivers
    // so the hotel admin can see the riders and configure their compensation!
    if (!drivers || drivers.length === 0) {
      drivers = await query(
        `SELECT DISTINCT d.id, d.user_id, d.restaurant_id, d.full_name, d.mobile, d.email,
                d.vehicle_type, d.vehicle_number, d.account_status, d.availability_status,
                u.name as user_name, u.phone as user_phone
         FROM delivery_drivers d
         LEFT JOIN users u ON d.user_id = u.id
         WHERE d.account_status = 'ACTIVE' OR d.account_status IS NULL
         ORDER BY d.id DESC`
      );
    }

    let fleetTotalPending = 0;
    let fleetTotalPaidThisMonth = 0;
    let driversWithDue = 0;
    const driverList = [];

    // Query total settled this month for this restaurant
    const [settledThisMonth] = await query(
      `SELECT COALESCE(SUM(net_amount), 0) as total_settled
       FROM driver_payout_settlements
       WHERE restaurant_id = ? AND MONTH(settled_at) = MONTH(CURDATE()) AND YEAR(settled_at) = YEAR(CURDATE())`,
      [targetRestId]
    );
    fleetTotalPaidThisMonth = parseFloat(settledThisMonth?.total_settled || 0);

    for (const drv of drivers) {
      // 1. Fetch compensation settings
      let [settings] = await query(
        `SELECT * FROM driver_payout_settings WHERE restaurant_id = ? AND driver_id = ?`,
        [targetRestId, drv.id]
      );

      if (!settings) {
        settings = {
          has_salary: 0,
          salary_amount: 0,
          salary_frequency: 'MONTHLY',
          has_commission: 0,
          commission_percentage: 0,
          has_incentive: 0,
          incentive_amount: 0,
          incentive_type: 'PER_ORDER'
        };
      } else {
        // Sync salary if configured
        await syncDriverSalaryForPeriod(targetRestId, drv.id, settings);
      }

      // 2. Delivered Orders Count
      const [orderStats] = await query(
        `SELECT COUNT(*) as delivered_count 
         FROM orders 
         WHERE assigned_driver_id = ? AND order_status = 'DELIVERED'`,
        [drv.id]
      );

      // 3. Compute Pending Balances
      const [pendingBalances] = await query(
        `SELECT 
           COALESCE(SUM(CASE WHEN entry_type = 'CREDIT_SALARY' AND status = 'PENDING_PAYOUT' THEN amount ELSE 0 END), 0) as pending_salary,
           COALESCE(SUM(CASE WHEN entry_type = 'CREDIT_COMMISSION' AND status = 'PENDING_PAYOUT' THEN amount ELSE 0 END), 0) as pending_commission,
           COALESCE(SUM(CASE WHEN entry_type = 'CREDIT_INCENTIVE' AND status = 'PENDING_PAYOUT' THEN amount ELSE 0 END), 0) as pending_incentive,
           COALESCE(SUM(CASE WHEN status = 'PENDING_PAYOUT' THEN amount ELSE 0 END), 0) as total_collectible
         FROM driver_wallet_transactions
         WHERE restaurant_id = ? AND driver_id = ?`,
        [targetRestId, drv.id]
      );

      // 4. Compute All-time Paid Settlements
      const [paidStats] = await query(
        `SELECT COALESCE(SUM(net_amount), 0) as total_paid
         FROM driver_payout_settlements
         WHERE restaurant_id = ? AND driver_id = ?`,
        [targetRestId, drv.id]
      );

      const totalCollectible = parseFloat(pendingBalances?.total_collectible || 0);
      if (totalCollectible > 0) {
        fleetTotalPending += totalCollectible;
        driversWithDue++;
      }

      driverList.push({
        id: drv.id,
        user_id: drv.user_id,
        name: drv.full_name || drv.user_name || 'Delivery Partner',
        phone: drv.mobile || drv.user_phone || '',
        vehicle_type: drv.vehicle_type || 'Bike',
        vehicle_number: drv.vehicle_number || '',
        account_status: drv.account_status || 'ACTIVE',
        availability_status: drv.availability_status || 'OFFLINE',
        delivered_count: parseInt(orderStats?.delivered_count || 0, 10),
        settings: {
          has_salary: Boolean(settings.has_salary),
          salary_amount: parseFloat(settings.salary_amount || 0),
          salary_frequency: settings.salary_frequency || 'MONTHLY',
          has_commission: Boolean(settings.has_commission),
          commission_percentage: parseFloat(settings.commission_percentage || 0),
          has_incentive: Boolean(settings.has_incentive),
          incentive_amount: parseFloat(settings.incentive_amount || 0),
          incentive_type: settings.incentive_type || 'PER_ORDER'
        },
        wallet: {
          pending_salary: parseFloat(pendingBalances?.pending_salary || 0),
          pending_commission: parseFloat(pendingBalances?.pending_commission || 0),
          pending_incentive: parseFloat(pendingBalances?.pending_incentive || 0),
          total_collectible: totalCollectible,
          total_paid_lifetime: parseFloat(paidStats?.total_paid || 0),
          has_due: totalCollectible > 0
        }
      });
    }

    res.json({
      success: true,
      summary: {
        total_fleet_pending_payout: fleetTotalPending,
        total_paid_this_month: fleetTotalPaidThisMonth,
        total_drivers: driverList.length,
        drivers_with_due_payout: driversWithDue,
        reminder_alert: driversWithDue > 0 ? {
          message: `⚠️ Payout Reminder: You have ₹${fleetTotalPending.toLocaleString('en-IN')} pending delivery boy payout to settle across ${driversWithDue} driver${driversWithDue > 1 ? 's' : ''}.`,
          amount: fleetTotalPending,
          count: driversWithDue
        } : null
      },
      drivers: driverList
    });
  } catch (err) {
    console.error('getAdminDriverPayouts Error:', err);
    res.status(500).json({ success: false, message: 'Server error loading driver payouts.' });
  }
}

/**
 * 4. ADMIN: Get Detailed Ledger & History for a Driver with Date Filters
 * GET /api/admin/driver-payouts/:driverId
 */
async function getDriverPayoutDetails(req, res) {
  try {
    const targetRestId = await getTargetRestaurantId(req);
    const { driverId } = req.params;
    const { startDate, endDate, status } = req.query;

    const [driver] = await query(
      `SELECT d.*, u.name as user_name, u.phone as user_phone
       FROM delivery_drivers d
       LEFT JOIN users u ON d.user_id = u.id
       WHERE d.id = ?`,
      [driverId]
    );

    if (!driver) {
      return res.status(404).json({ success: false, message: 'Driver not found.' });
    }

    // Settings
    let [settings] = await query(
      `SELECT * FROM driver_payout_settings WHERE restaurant_id = ? AND driver_id = ?`,
      [targetRestId, driverId]
    );

    if (settings) {
      await syncDriverSalaryForPeriod(targetRestId, driverId, settings);
    }

    // Build ledger query with optional date filters
    let ledgerSql = `
      SELECT * FROM driver_wallet_transactions
      WHERE restaurant_id = ? AND driver_id = ?
    `;
    const ledgerParams = [targetRestId, driverId];

    if (startDate) {
      ledgerSql += ` AND DATE(created_at) >= ?`;
      ledgerParams.push(startDate);
    }
    if (endDate) {
      ledgerSql += ` AND DATE(created_at) <= ?`;
      ledgerParams.push(endDate);
    }
    if (status && status !== 'ALL') {
      ledgerSql += ` AND status = ?`;
      ledgerParams.push(status);
    }

    ledgerSql += ` ORDER BY id DESC`;

    const transactions = await query(ledgerSql, ledgerParams);

    // Past settlement receipts
    let settlementSql = `
      SELECT s.*, u.name as settled_by_name
      FROM driver_payout_settlements s
      LEFT JOIN users u ON s.settled_by = u.id
      WHERE s.restaurant_id = ? AND s.driver_id = ?
    `;
    const settParams = [targetRestId, driverId];

    if (startDate) {
      settlementSql += ` AND DATE(s.settled_at) >= ?`;
      settParams.push(startDate);
    }
    if (endDate) {
      settlementSql += ` AND DATE(s.settled_at) <= ?`;
      settParams.push(endDate);
    }
    settlementSql += ` ORDER BY s.id DESC`;

    const settlements = await query(settlementSql, settParams);

    // Current pending balance
    const [balance] = await query(
      `SELECT 
         COALESCE(SUM(CASE WHEN entry_type = 'CREDIT_SALARY' AND status = 'PENDING_PAYOUT' THEN amount ELSE 0 END), 0) as pending_salary,
         COALESCE(SUM(CASE WHEN entry_type = 'CREDIT_COMMISSION' AND status = 'PENDING_PAYOUT' THEN amount ELSE 0 END), 0) as pending_commission,
         COALESCE(SUM(CASE WHEN entry_type = 'CREDIT_INCENTIVE' AND status = 'PENDING_PAYOUT' THEN amount ELSE 0 END), 0) as pending_incentive,
         COALESCE(SUM(CASE WHEN status = 'PENDING_PAYOUT' THEN amount ELSE 0 END), 0) as total_collectible
       FROM driver_wallet_transactions
       WHERE restaurant_id = ? AND driver_id = ?`,
      [targetRestId, driverId]
    );

    res.json({
      success: true,
      driver: {
        id: driver.id,
        name: driver.full_name || driver.user_name,
        phone: driver.mobile || driver.user_phone,
        vehicle_number: driver.vehicle_number
      },
      settings: settings || null,
      balance: {
        pending_salary: parseFloat(balance?.pending_salary || 0),
        pending_commission: parseFloat(balance?.pending_commission || 0),
        pending_incentive: parseFloat(balance?.pending_incentive || 0),
        total_collectible: parseFloat(balance?.total_collectible || 0)
      },
      transactions,
      settlements
    });
  } catch (err) {
    console.error('getDriverPayoutDetails Error:', err);
    res.status(500).json({ success: false, message: 'Server error loading driver ledger.' });
  }
}

/**
 * 5. ADMIN: Save/Update Driver Compensation Settings (Multi-Select: Salary, Commission, Incentive)
 * POST /api/admin/driver-payouts/:driverId/settings
 */
async function updateDriverPayoutSettings(req, res) {
  try {
    const targetRestId = await getTargetRestaurantId(req);
    const { driverId } = req.params;
    const {
      has_salary,
      salary_amount,
      salary_frequency,
      has_commission,
      commission_percentage,
      has_incentive,
      incentive_amount,
      incentive_type,
      notes
    } = req.body;

    const salaryAmount = parseFloat(salary_amount || 0);
    const commissionPct = parseFloat(commission_percentage || 0);
    const incentiveAmt = parseFloat(incentive_amount || 0);

    await query(
      `INSERT INTO driver_payout_settings (
         restaurant_id, driver_id,
         has_salary, salary_amount, salary_frequency,
         has_commission, commission_percentage,
         has_incentive, incentive_amount, incentive_type,
         notes, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE
         has_salary = VALUES(has_salary),
         salary_amount = VALUES(salary_amount),
         salary_frequency = VALUES(salary_frequency),
         has_commission = VALUES(has_commission),
         commission_percentage = VALUES(commission_percentage),
         has_incentive = VALUES(has_incentive),
         incentive_amount = VALUES(incentive_amount),
         incentive_type = VALUES(incentive_type),
         notes = VALUES(notes),
         updated_at = NOW()`,
      [
        targetRestId,
        driverId,
        has_salary ? 1 : 0,
        salaryAmount,
        salary_frequency || 'MONTHLY',
        has_commission ? 1 : 0,
        commissionPct,
        has_incentive ? 1 : 0,
        incentiveAmt,
        incentive_type || 'PER_ORDER',
        notes || null
      ]
    );

    // Sync salary immediately if enabled
    if (has_salary && salaryAmount > 0) {
      await syncDriverSalaryForPeriod(targetRestId, driverId, {
        has_salary: 1,
        salary_amount: salaryAmount,
        salary_frequency: salary_frequency || 'MONTHLY'
      });
    }

    // Broadcast update so driver sees new compensation structure
    try {
      const io = getSocketIO();
      if (io) {
        io.emit('driver_wallet_updated', { driverId, restaurantId: targetRestId });
      }
    } catch (e) {}

    res.json({
      success: true,
      message: 'Driver compensation settings saved successfully!'
    });
  } catch (err) {
    console.error('updateDriverPayoutSettings Error:', err);
    res.status(500).json({ success: false, message: 'Server error updating driver settings.' });
  }
}

/**
 * 6. ADMIN: Settle Driver Payout (Resets current collectible balance to 0, archives history)
 * POST /api/admin/driver-payouts/:driverId/settle
 */
async function settleDriverPayout(req, res) {
  const conn = await getConnection();
  try {
    await conn.beginTransaction();
    const targetRestId = await getTargetRestaurantId(req);
    const { driverId } = req.params;
    const { payment_method, reference_note } = req.body;
    const userId = req.user?.id || 1;

    // Fetch all pending transactions for this driver
    const [pendingRows] = await conn.query(
      `SELECT * FROM driver_wallet_transactions
       WHERE restaurant_id = ? AND driver_id = ? AND status = 'PENDING_PAYOUT'`,
      [targetRestId, driverId]
    );

    if (!pendingRows || pendingRows.length === 0) {
      await conn.rollback();
      return res.status(400).json({
        success: false,
        message: 'No pending payout due for this driver. Balance is already ₹0.00.'
      });
    }

    let totalSalary = 0;
    let totalCommission = 0;
    let totalIncentive = 0;
    let netAmount = 0;

    pendingRows.forEach(tx => {
      const amt = parseFloat(tx.amount);
      netAmount += amt;
      if (tx.entry_type === 'CREDIT_SALARY') totalSalary += amt;
      else if (tx.entry_type === 'CREDIT_COMMISSION') totalCommission += amt;
      else if (tx.entry_type === 'CREDIT_INCENTIVE') totalIncentive += amt;
    });

    const settlementNumber = `PAYOUT-${Date.now().toString().slice(-6)}-${driverId}`;

    // 1. Create settlement receipt record
    await conn.query(
      `INSERT INTO driver_payout_settlements 
       (settlement_number, restaurant_id, driver_id, total_salary, total_commission, total_incentive, net_amount, payment_method, reference_note, settled_by, settled_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        settlementNumber,
        targetRestId,
        driverId,
        totalSalary,
        totalCommission,
        totalIncentive,
        netAmount,
        payment_method || 'CASH',
        reference_note || null,
        userId
      ]
    );

    // 2. Mark all pending ledger transactions as PAID
    await conn.query(
      `UPDATE driver_wallet_transactions
       SET status = 'PAID', settlement_id = ?, settled_at = NOW(), settled_by_user_id = ?
       WHERE restaurant_id = ? AND driver_id = ? AND status = 'PENDING_PAYOUT'`,
      [settlementNumber, userId, targetRestId, driverId]
    );

    await conn.commit();

    // Broadcast real-time wallet refreshed event to driver
    try {
      const io = getSocketIO();
      if (io) {
        io.emit('driver_wallet_refreshed', {
          driverId,
          restaurantId: targetRestId,
          settlementNumber,
          netAmount
        });
      }
    } catch (e) {}

    res.json({
      success: true,
      message: `🎉 Payout of ₹${netAmount.toLocaleString('en-IN')} marked as PAID! Driver wallet refreshed to ₹0.`,
      settlement: {
        settlement_number: settlementNumber,
        net_amount: netAmount,
        total_salary: totalSalary,
        total_commission: totalCommission,
        total_incentive: totalIncentive,
        payment_method: payment_method || 'CASH',
        settled_at: new Date()
      }
    });
  } catch (err) {
    await conn.rollback();
    console.error('settleDriverPayout Error:', err);
    res.status(500).json({ success: false, message: 'Server error processing settlement.' });
  } finally {
    conn.release();
  }
}

/**
 * 7. DRIVER PORTAL: Get Driver Wallet Breakdown & Collection Notice
 * GET /api/driver/wallet
 */
async function getDriverWallet(req, res) {
  try {
    const userId = req.user?.id || 0;
    const driverId = req.user?.driverId || 0;

    // Identify driver
    let [driver] = await query(
      `SELECT * FROM delivery_drivers WHERE user_id = ? OR id = ?`,
      [userId, driverId]
    );

    if (!driver) {
      return res.status(404).json({ success: false, message: 'Driver profile not found.' });
    }

    const restaurantId = driver.restaurant_id || 1;

    // Fetch restaurant name for notice
    const [restaurant] = await query(
      `SELECT name, phone, address FROM restaurants WHERE id = ?`,
      [restaurantId]
    );

    // Fetch compensation configuration
    let [settings] = await query(
      `SELECT * FROM driver_payout_settings WHERE restaurant_id = ? AND driver_id = ?`,
      [restaurantId, driver.id]
    );

    if (settings) {
      await syncDriverSalaryForPeriod(restaurantId, driver.id, settings);
    }

    // Compute wallet balances
    const [balance] = await query(
      `SELECT 
         COALESCE(SUM(CASE WHEN entry_type = 'CREDIT_SALARY' AND status = 'PENDING_PAYOUT' THEN amount ELSE 0 END), 0) as pending_salary,
         COALESCE(SUM(CASE WHEN entry_type = 'CREDIT_COMMISSION' AND status = 'PENDING_PAYOUT' THEN amount ELSE 0 END), 0) as pending_commission,
         COALESCE(SUM(CASE WHEN entry_type = 'CREDIT_INCENTIVE' AND status = 'PENDING_PAYOUT' THEN amount ELSE 0 END), 0) as pending_incentive,
         COALESCE(SUM(CASE WHEN status = 'PENDING_PAYOUT' THEN amount ELSE 0 END), 0) as total_collectible
       FROM driver_wallet_transactions
       WHERE driver_id = ? AND restaurant_id = ?`,
      [driver.id, restaurantId]
    );

    // Lifetime settled total
    const [lifetime] = await query(
      `SELECT COALESCE(SUM(net_amount), 0) as lifetime_earned
       FROM driver_payout_settlements
       WHERE driver_id = ? AND restaurant_id = ?`,
      [driver.id, restaurantId]
    );

    // Total delivered orders
    const [ordersCount] = await query(
      `SELECT COUNT(*) as delivered_count
       FROM orders
       WHERE assigned_driver_id = ? AND order_status = 'DELIVERED'`,
      [driver.id]
    );

    // Recent 5 transactions
    const recentTransactions = await query(
      `SELECT * FROM driver_wallet_transactions
       WHERE driver_id = ? AND restaurant_id = ?
       ORDER BY id DESC LIMIT 5`,
      [driver.id, restaurantId]
    );

    const totalCollectible = parseFloat(balance?.total_collectible || 0);

    res.json({
      success: true,
      wallet: {
        total_collectible: totalCollectible,
        lifetime_settled: parseFloat(lifetime?.lifetime_earned || 0),
        delivered_orders_count: parseInt(ordersCount?.delivered_count || 0, 10),
        admin_collection_notice: totalCollectible > 0
          ? `Please collect your salary/payout of ₹${totalCollectible.toLocaleString('en-IN')} from the ${restaurant?.name || 'Hotel'} Admin Desk.`
          : `Your wallet is settled. New delivery earnings and salary will reflect here automatically.`,
        has_pending_payout: totalCollectible > 0,
        restaurant_name: restaurant?.name || 'Hotel Admin Desk',
        restaurant_phone: restaurant?.phone || '',
        sections: {
          salary: {
            enabled: Boolean(settings?.has_salary),
            rate: parseFloat(settings?.salary_amount || 0),
            frequency: settings?.salary_frequency || 'MONTHLY',
            accrued_amount: parseFloat(balance?.pending_salary || 0),
            description: settings?.has_salary ? `Fixed ₹${parseFloat(settings?.salary_amount || 0).toLocaleString('en-IN')} / ${settings?.salary_frequency || 'Month'}` : 'Not Enabled'
          },
          commission: {
            enabled: Boolean(settings?.has_commission),
            percentage: parseFloat(settings?.commission_percentage || 0),
            accrued_amount: parseFloat(balance?.pending_commission || 0),
            description: settings?.has_commission ? `${parseFloat(settings?.commission_percentage || 0)}% Commission per parcel` : 'Not Enabled'
          },
          incentive: {
            enabled: Boolean(settings?.has_incentive),
            amount: parseFloat(settings?.incentive_amount || 0),
            accrued_amount: parseFloat(balance?.pending_incentive || 0),
            description: settings?.has_incentive ? `₹${parseFloat(settings?.incentive_amount || 0)} Bonus per delivered order` : 'Not Enabled'
          }
        },
        recent_transactions: recentTransactions
      }
    });
  } catch (err) {
    console.error('getDriverWallet Error:', err);
    res.status(500).json({ success: false, message: 'Server error loading driver wallet.' });
  }
}

/**
 * 8. DRIVER PORTAL: Get Full Wallet Transaction History with Date Filters
 * GET /api/driver/wallet/history
 */
async function getDriverWalletHistory(req, res) {
  try {
    const userId = req.user?.id || 0;
    const driverId = req.user?.driverId || 0;
    const { startDate, endDate, status, entryType } = req.query || {};

    let [driver] = await query(
      `SELECT * FROM delivery_drivers WHERE user_id = ? OR id = ?`,
      [userId, driverId]
    );

    if (!driver) {
      return res.status(404).json({ success: false, message: 'Driver profile not found.' });
    }

    const restaurantId = driver.restaurant_id || 1;

    let sql = `
      SELECT * FROM driver_wallet_transactions
      WHERE driver_id = ? AND restaurant_id = ?
    `;
    const params = [driver.id, restaurantId];

    if (startDate) {
      sql += ` AND DATE(created_at) >= ?`;
      params.push(startDate);
    }
    if (endDate) {
      sql += ` AND DATE(created_at) <= ?`;
      params.push(endDate);
    }
    if (status && status !== 'ALL') {
      sql += ` AND status = ?`;
      params.push(status);
    }
    if (entryType && entryType !== 'ALL') {
      sql += ` AND entry_type = ?`;
      params.push(entryType);
    }

    sql += ` ORDER BY id DESC`;

    const transactions = await query(sql, params);

    // Also fetch settlements within range
    let settSql = `
      SELECT * FROM driver_payout_settlements
      WHERE driver_id = ? AND restaurant_id = ?
    `;
    const settParams = [driver.id, restaurantId];

    if (startDate) {
      settSql += ` AND DATE(settled_at) >= ?`;
      settParams.push(startDate);
    }
    if (endDate) {
      settSql += ` AND DATE(settled_at) <= ?`;
      settParams.push(endDate);
    }
    settSql += ` ORDER BY id DESC`;

    const settlements = await query(settSql, settParams);

    res.json({
      success: true,
      transactions,
      settlements
    });
  } catch (err) {
    console.error('getDriverWalletHistory Error:', err);
    res.status(500).json({ success: false, message: 'Server error loading wallet history.' });
  }
}

module.exports = {
  creditDriverDeliveryEarnings,
  syncDriverSalaryForPeriod,
  getAdminDriverPayouts,
  getDriverPayoutDetails,
  updateDriverPayoutSettings,
  settleDriverPayout,
  getDriverWallet,
  getDriverWalletHistory
};
