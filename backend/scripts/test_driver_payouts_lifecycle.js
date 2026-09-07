require('dotenv').config();
const { query } = require('../config/db');
const driverPayoutController = require('../controllers/driverPayoutController');

async function testDriverPayouts() {
  console.log('🧪 Starting Driver Payouts Lifecycle Test...');

  // 1. Find or verify a driver and restaurant
  const [driver] = await query('SELECT id, restaurant_id, full_name FROM delivery_drivers LIMIT 1');
  if (!driver) {
    console.error('❌ No driver found in DB to test with.');
    process.exit(1);
  }

  const restaurantId = driver.restaurant_id || 1;
  const driverId = driver.id;
  console.log(`Found test driver: ID=${driverId}, Name=${driver.full_name}, Restaurant=${restaurantId}`);

  // 2. Clean previous test transactions for clean assertion
  await query('DELETE FROM driver_wallet_transactions WHERE driver_id = ? AND restaurant_id = ?', [driverId, restaurantId]);
  await query('DELETE FROM driver_payout_settlements WHERE driver_id = ? AND restaurant_id = ?', [driverId, restaurantId]);

  // 3. Test Update Driver Payout Settings with Multi-Select (Salary + Commission + Incentive)
  const reqMockUpdate = {
    restaurantId,
    params: { driverId },
    body: {
      has_salary: 1,
      salary_amount: 15000.00,
      salary_frequency: 'MONTHLY',
      has_commission: 1,
      commission_percentage: 10.00,
      has_incentive: 1,
      incentive_amount: 25.00,
      incentive_type: 'PER_ORDER',
      notes: 'Automated test compensation package'
    }
  };

  let resData = null;
  const resMock = {
    json: (d) => { resData = d; return resMock; },
    status: (c) => ({ json: (d) => { resData = { status: c, ...d }; } })
  };

  await driverPayoutController.updateDriverPayoutSettings(reqMockUpdate, resMock);
  console.log('Update settings response:', resData);

  // 4. Verify settings in DB
  const [settings] = await query(
    'SELECT * FROM driver_payout_settings WHERE restaurant_id = ? AND driver_id = ?',
    [restaurantId, driverId]
  );
  console.log('Saved settings:', {
    has_salary: settings.has_salary,
    salary_amount: settings.salary_amount,
    has_commission: settings.has_commission,
    commission_percentage: settings.commission_percentage,
    has_incentive: settings.has_incentive,
    incentive_amount: settings.incentive_amount
  });

  if (settings.has_salary !== 1 || settings.has_commission !== 1 || settings.has_incentive !== 1) {
    throw new Error('Settings multi-select did not save properly!');
  }

  // 5. Test creditDriverDeliveryEarnings on a mock delivered order
  const mockOrder = {
    id: 999991,
    order_number: 'TEST-ORD-999',
    restaurant_id: restaurantId,
    assigned_driver_id: driverId,
    total_amount: 500.00,
    order_status: 'DELIVERED'
  };

  await driverPayoutController.creditDriverDeliveryEarnings(mockOrder);
  console.log('✅ Executed creditDriverDeliveryEarnings for order total ₹500 (10% comm = ₹50, inc = ₹25)');

  // 6. Test Admin overview endpoint
  const reqMockAdmin = { restaurantId, user: { role: 'ADMIN', restaurant_id: restaurantId } };
  let adminOverview = null;
  await driverPayoutController.getAdminDriverPayouts(reqMockAdmin, {
    json: (d) => { adminOverview = d; }
  });

  const driverSummary = adminOverview.drivers.find(d => d.id === driverId);
  console.log('Admin Driver Overview for Driver:', {
    name: driverSummary.name,
    wallet: driverSummary.wallet
  });

  // Expected collectible: ₹15,000 (salary) + ₹50 (commission) + ₹25 (incentive) = ₹15,075
  console.log('Expected Total Collectible: ₹15,075. Actual:', driverSummary.wallet.total_collectible);
  if (driverSummary.wallet.total_collectible !== 15075) {
    throw new Error(`Expected wallet total 15075, got ${driverSummary.wallet.total_collectible}`);
  }

  // 7. Test Driver Wallet endpoint
  let driverWalletRes = null;
  const makeResMock = () => {
    let out = {};
    const res = {
      json: (d) => { out = d; return res; },
      status: (c) => res
    };
    return { res, get: () => out };
  };

  const mockWallet = makeResMock();
  await driverPayoutController.getDriverWallet({
    user: { id: driver.user_id, driverId: driver.id }
  }, mockWallet.res);
  driverWalletRes = mockWallet.get();

  console.log('Driver Portal Wallet Response:', {
    total_collectible: driverWalletRes.wallet.total_collectible,
    notice: driverWalletRes.wallet.admin_collection_notice,
    sections: driverWalletRes.wallet.sections
  });

  // 8. Test Settle Driver Payout (Resets wallet to 0)
  let settleRes = null;
  await driverPayoutController.settleDriverPayout({
    restaurantId,
    params: { driverId },
    body: {
      payment_method: 'CASH',
      reference_note: 'Handed over cash at desk'
    },
    user: { id: 1 }
  }, {
    json: (d) => { settleRes = d; },
    status: (code) => ({ json: (d) => { settleRes = { code, ...d }; } })
  });

  console.log('Settle Payout Result:', settleRes);

  // 9. Re-fetch driver wallet to verify it refreshed to ₹0
  let driverWalletAfterSettle = null;
  const mockWalletAfter = makeResMock();
  await driverPayoutController.getDriverWallet({
    user: { id: driver.user_id, driverId: driver.id }
  }, mockWalletAfter.res);
  driverWalletAfterSettle = mockWalletAfter.get();

  console.log('Driver Wallet After Settlement (Should be 0):', driverWalletAfterSettle.wallet.total_collectible);
  if (driverWalletAfterSettle.wallet.total_collectible !== 0) {
    throw new Error(`Expected wallet to refresh to 0 after settlement, got ${driverWalletAfterSettle.wallet.total_collectible}`);
  }

  // 10. Test Driver History endpoint to verify past data is preserved with date filters
  let historyRes = null;
  const mockHistory = makeResMock();
  await driverPayoutController.getDriverWalletHistory({
    user: { id: driver.user_id, driverId: driver.id },
    query: { status: 'PAID' }
  }, mockHistory.res);
  historyRes = mockHistory.get();

  console.log('Driver History (Preserved Past Data):', {
    paid_transactions_count: historyRes.transactions.length,
    settlements_count: historyRes.settlements.length,
    settlement_receipt: historyRes.settlements[0]?.settlement_number,
    settled_net_amount: historyRes.settlements[0]?.net_amount
  });

  if (historyRes.transactions.length === 0 || historyRes.settlements.length === 0) {
    throw new Error('Past data was not preserved in history!');
  }

  console.log('🎉 ALL BACKEND LOGIC VERIFIED AND PASSED 100%!');
}

testDriverPayouts()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('❌ Test failed:', e);
    process.exit(1);
  });
