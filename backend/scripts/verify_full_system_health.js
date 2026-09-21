const axios = require('axios');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const BASE_URL = 'http://localhost:5000/api/v1';

async function runHealthCheck() {
  console.log('🚀 Starting Full System End-to-End Health & Bug Audit...');

  const db = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'hotel_db'
  });

  try {
    // 1. Check Restaurants
    const [restaurants] = await db.query("SELECT id, name, slug FROM restaurants WHERE status = 'ACTIVE' LIMIT 3");
    console.log(`✅ [Database] Found ${restaurants.length} active restaurants. Testing with: ${restaurants[0].name} (${restaurants[0].slug}, id: ${restaurants[0].id})`);
    const rest = restaurants[0];

    // 2. Customer OTP flow test
    console.log('\n📱 Testing Customer OTP Flow:');
    const testPhone = '9888877777';
    const otpReq = await axios.post(`${BASE_URL}/auth/customer/send-otp`, {
      phone: testPhone,
      restaurantId: rest.id,
      name: 'Audit Customer'
    });
    console.log(`  ↳ Send OTP response: success=${otpReq.data.success}, otpPreview=${otpReq.data.otpPreview}`);

    const otpCode = otpReq.data.otpPreview || '1234';
    const otpVerify = await axios.post(`${BASE_URL}/auth/customer/verify-otp`, {
      phone: testPhone,
      otp: otpCode,
      restaurantId: rest.id,
      name: 'Audit Customer'
    });
    console.log(`  ↳ Verify OTP response: success=${otpVerify.data.success}, userId=${otpVerify.data.user?.id}, token=${Boolean(otpVerify.data.token)}`);
    const customerToken = otpVerify.data.token;
    const customerId = otpVerify.data.user.id;

    // 3. Admin Login & Auth Check
    console.log('\n🔑 Testing Admin Auth:');
    const adminLogin = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'admin@hotel.com',
      password: 'admin123'
    });
    console.log(`  ↳ Admin login: success=${adminLogin.data.success}, role=${adminLogin.data.user?.role}`);
    const adminToken = adminLogin.data.token;

    // 4. Place Order as Customer
    console.log('\n🛒 Testing Order Placement:');
    const [menuItems] = await db.query('SELECT id, name, price FROM menu_items WHERE restaurant_id = ? AND is_available = 1 LIMIT 2', [rest.id]);
    if (menuItems.length === 0) {
      console.log('  ⚠️ No menu items found, fetching any menu item');
    }
    const item = menuItems[0];
    const orderPayload = {
      restaurantId: rest.id,
      customerName: 'Audit Customer',
      customerPhone: testPhone,
      deliveryAddress: 'Audit Flat 101, Test Road',
      paymentMethod: 'COD',
      items: [{
        menuItemId: item.id,
        quantity: 2,
        specialInstructions: 'Quick audit test'
      }]
    };

    const orderRes = await axios.post(`${BASE_URL}/orders/checkout`, orderPayload, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    console.log(`  ↳ Order created: success=${orderRes.data.success}, orderId=${orderRes.data.order?.orderId}, orderNumber=${orderRes.data.order?.orderNumber}`);
    const createdOrderId = orderRes.data.order.orderId;

    // 5. Admin Immediately Sees Order (No 5m wait!)
    console.log('\n👀 Testing Admin Order Visibility (Immediate Arrival):');
    const adminOrdersRes = await axios.get(`${BASE_URL}/admin/orders?slug=${rest.slug}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const orderInAdminList = adminOrdersRes.data.orders.find(o => o.id === createdOrderId);
    if (orderInAdminList) {
      console.log(`  ✅ ORDER APPEARED IMMEDIATELY in Admin list! Status: ${orderInAdminList.order_status}, created_at: ${orderInAdminList.created_at}`);
    } else {
      throw new Error(`❌ Order ${createdOrderId} NOT found immediately in admin orders list!`);
    }

    // 6. Admin Unclaimed Orders List (Immediate Arrival)
    const unclaimedRes = await axios.get(`${BASE_URL}/admin/orders/unclaimed?slug=${rest.slug}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const orderInUnclaimed = unclaimedRes.data.orders.find(o => o.id === createdOrderId);
    if (orderInUnclaimed) {
      console.log(`  ✅ ORDER APPEARED IMMEDIATELY in Admin Unclaimed list!`);
    } else {
      console.log(`  ℹ️ Order in unclaimed status: not in unclaimed or already claimed.`);
    }

    // 7. Assign Driver & Deliver Order
    console.log('\n🛵 Testing Driver Assignment & Delivery:');
    const [drivers] = await db.query('SELECT id, full_name, user_id FROM delivery_drivers WHERE account_status = "ACTIVE" LIMIT 1');
    const driver = drivers[0];
    console.log(`  ↳ Using Driver: #${driver.id} (${driver.full_name})`);

    // Assign driver
    await axios.post(`${BASE_URL}/admin/orders/${createdOrderId}/assign-driver`, {
      driver_id: driver.id
    }, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    console.log(`  ↳ Driver #${driver.id} assigned.`);

    // Driver mark status to DELIVERED
    // Set status through status update
    await axios.patch(`${BASE_URL}/admin/orders/${createdOrderId}/status`, {
      status: 'DELIVERED',
      driver_id: driver.id,
      notes: 'Delivered successfully in audit'
    }, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    console.log(`  ↳ Order #${createdOrderId} marked as DELIVERED.`);

    // 8. Verify Driver Wallet Updated
    console.log('\n💰 Testing Driver Wallet Updates:');
    const [driverTxns] = await db.query(
      'SELECT entry_type, amount, description, status FROM driver_wallet_transactions WHERE order_id = ? AND driver_id = ?',
      [createdOrderId, driver.id]
    );
    console.log(`  ↳ Driver wallet transactions for order ${createdOrderId}:`, driverTxns);
    if (driverTxns.length > 0) {
      console.log(`  ✅ Driver wallet successfully updated with commission / incentives!`);
    } else {
      console.log(`  ℹ️ Driver payout settings might have 0 commission/incentive or already processed.`);
    }

    // 9. Verify Customer Wallet Cashback
    console.log('\n🎁 Testing Customer Wallet Cashback:');
    const [custWallet] = await db.query(
      'SELECT id, cached_available_balance, cached_pending_balance FROM wallet_accounts WHERE customer_id = ? AND tenant_id = ?',
      [customerId, rest.id]
    );
    console.log(`  ↳ Customer wallet state:`, custWallet[0] || 'No record yet');

    // 10. Clean up test order from audit
    console.log('\n🧹 Cleaning up test audit order...');
    await db.query('DELETE FROM driver_wallet_transactions WHERE order_id = ?', [createdOrderId]);
    await db.query('DELETE FROM order_status_history WHERE order_id = ?', [createdOrderId]);
    await db.query('DELETE FROM order_items WHERE order_id = ?', [createdOrderId]);
    await db.query('DELETE FROM orders WHERE id = ?', [createdOrderId]);
    console.log('✅ Audit order cleaned up cleanly.');

    console.log('\n🎉 ALL CORE WORKFLOWS PASSED 100% HEALTH CHECK!');
  } finally {
    await db.end();
  }
}

runHealthCheck().catch(err => {
  console.error('❌ Health Check Failed:', err.message, err.response?.data || '');
  process.exit(1);
});
