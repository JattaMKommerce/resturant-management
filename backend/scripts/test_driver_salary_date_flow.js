require('dotenv').config({ path: __dirname + '/../.env' });
const { query } = require('../config/db');
const driverController = require('../controllers/driverController');
const driverPayoutController = require('../controllers/driverPayoutController');

function formatYMD(dateVal) {
  if (!dateVal) return null;
  if (typeof dateVal === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateVal)) return dateVal;
  const d = new Date(dateVal);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function testDriverSalaryDateFlow() {
  console.log('🚀 TESTING DRIVER ONBOARDING WITH SALARY, COMMISSION & EFFECTIVE DATE...');

  const testPhone = '9988112233';
  const testEmail = `test_salary_driver_${Date.now()}@hotel.com`;
  const testPlate = `KA-01-SL-${Date.now().toString().slice(-4)}`;
  const effectiveDate = '2026-10-15';

  // 1. Mock Request & Response for createAdminDriver
  const req = {
    headers: {},
    body: {
      name: 'Salaried Rider Test',
      email: testEmail,
      phone: testPhone,
      password: 'password123',
      vehicle_type: 'Bike',
      vehicle_number: testPlate,
      restaurant_id: 1,
      // Compensation & Salary Details
      has_salary: true,
      salary_amount: 18000,
      salary_frequency: 'MONTHLY',
      salary_effective_date: effectiveDate,
      has_commission: true,
      commission_percentage: 8.5,
      has_incentive: true,
      incentive_amount: 35.0
    },
    user: { id: 1, role: 'ADMIN' },
    adminRestaurantId: 1
  };

  let resData = null;
  let resStatus = 200;
  const res = {
    status: (code) => {
      resStatus = code;
      return res;
    },
    json: (data) => {
      resData = data;
      return res;
    }
  };

  try {
    await driverController.createAdminDriver(req, res);
    console.log(`\n1. createAdminDriver response status: ${resStatus}, success: ${resData?.success}`);
    if (!resData?.success) {
      throw new Error(`Failed to create driver: ${resData?.message}`);
    }

    const createdDriver = resData.driver;
    console.log(`   ✓ Created Driver ID: ${createdDriver.id}, Name: ${createdDriver.name}`);

    // 2. Verify driver_payout_settings
    const [settings] = await query(
      'SELECT * FROM driver_payout_settings WHERE restaurant_id = 1 AND driver_id = ?',
      [createdDriver.id]
    );

    const savedEffDate = formatYMD(settings.salary_effective_date);
    console.log('\n2. Verifying driver_payout_settings:');
    console.log(`   - has_salary: ${settings.has_salary} (Expected: 1)`);
    console.log(`   - salary_amount: ${settings.salary_amount} (Expected: 18000.00)`);
    console.log(`   - salary_effective_date: ${savedEffDate} (Expected: ${effectiveDate})`);
    console.log(`   - has_commission: ${settings.has_commission} (Expected: 1)`);
    console.log(`   - commission_percentage: ${settings.commission_percentage} (Expected: 8.50)`);
    console.log(`   - has_incentive: ${settings.has_incentive} (Expected: 1)`);
    console.log(`   - incentive_amount: ${settings.incentive_amount} (Expected: 35.00)`);

    if (
      settings.has_salary !== 1 ||
      parseFloat(settings.salary_amount) !== 18000 ||
      savedEffDate !== effectiveDate
    ) {
      throw new Error('driver_payout_settings did not store salary or effective date correctly!');
    }
    console.log('   ✅ Settings verified successfully!');

    // 3. Verify driver_wallet_transactions has CREDIT_SALARY
    const txs = await query(
      'SELECT * FROM driver_wallet_transactions WHERE restaurant_id = 1 AND driver_id = ?',
      [createdDriver.id]
    );

    console.log(`\n3. Verifying driver_wallet_transactions (${txs.length} transactions found):`);
    const salaryTx = txs.find(t => t.entry_type === 'CREDIT_SALARY');
    if (!salaryTx) {
      throw new Error('CREDIT_SALARY transaction was NOT created in driver_wallet_transactions!');
    }

    console.log(`   - entry_type: ${salaryTx.entry_type}`);
    console.log(`   - amount: ₹${salaryTx.amount}`);
    console.log(`   - status: ${salaryTx.status}`);
    console.log(`   - description: "${salaryTx.description}"`);
    console.log(`   - created_at: ${salaryTx.created_at}`);

    if (parseFloat(salaryTx.amount) !== 18000 || salaryTx.status !== 'PENDING_PAYOUT') {
      throw new Error('Salary transaction amount or status mismatch!');
    }
    console.log('   ✅ Driver Wallet credited with salary successfully!');

    // 4. Test updating salary effective date via updateDriverPayoutSettings
    const updatedDate = '2026-10-01';
    const updateReq = {
      headers: {},
      params: { driverId: createdDriver.id },
      body: {
        has_salary: true,
        salary_amount: 20000,
        salary_frequency: 'MONTHLY',
        salary_effective_date: updatedDate,
        has_commission: true,
        commission_percentage: 10,
        has_incentive: true,
        incentive_amount: 50
      },
      user: { id: 1, role: 'ADMIN' },
      adminRestaurantId: 1
    };

    let updateResData = null;
    const updateRes = {
      status: (c) => updateRes,
      json: (d) => { updateResData = d; return updateRes; }
    };

    await driverPayoutController.updateDriverPayoutSettings(updateReq, updateRes);
    console.log(`\n4. updateDriverPayoutSettings response:`, updateResData);

    const [updatedSettings] = await query(
      'SELECT * FROM driver_payout_settings WHERE restaurant_id = 1 AND driver_id = ?',
      [createdDriver.id]
    );

    const savedUpdatedDate = formatYMD(updatedSettings.salary_effective_date);
    console.log(`   - updated salary_effective_date: ${savedUpdatedDate} (Expected: ${updatedDate})`);
    console.log(`   - updated salary_amount: ${updatedSettings.salary_amount} (Expected: 20000.00)`);

    if (savedUpdatedDate !== updatedDate || parseFloat(updatedSettings.salary_amount) !== 20000) {
      throw new Error('updateDriverPayoutSettings did not update date or amount correctly!');
    }
    console.log('   ✅ Salary settings & effective date update verified successfully!');

    // Clean up test data
    console.log('\n🧹 Cleaning up test driver...');
    await query('DELETE FROM driver_wallet_transactions WHERE driver_id = ?', [createdDriver.id]);
    await query('DELETE FROM driver_payout_settings WHERE driver_id = ?', [createdDriver.id]);
    await query('DELETE FROM driver_restaurant_assignments WHERE driver_id = ?', [createdDriver.id]);
    await query('DELETE FROM delivery_drivers WHERE id = ?', [createdDriver.id]);
    await query('DELETE FROM users WHERE email = ?', [testEmail]);
    // Also clean up any prior test driver 24 if left over
    await query('DELETE FROM driver_wallet_transactions WHERE driver_id = 24');
    await query('DELETE FROM driver_payout_settings WHERE driver_id = 24');
    await query('DELETE FROM driver_restaurant_assignments WHERE driver_id = 24');
    await query('DELETE FROM delivery_drivers WHERE id = 24');
    console.log('   ✓ Test data cleaned up.');

    console.log('\n🎉 ALL CHECKS PASSED PERFECTLY!');
  } catch (err) {
    console.error('\n❌ Test failed with error:', err);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

testDriverSalaryDateFlow();
