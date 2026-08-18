const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

const BASE_URL = 'http://localhost:5000/api/v1';

let superAdminToken = '';
let restaurantAdminToken = '';
let driverToken = '';
let testApplicationId = null;
let testDriverId = null;
let testOrderId = null;
let grandPalaceId = 1;
let spiceGardenId = 2;

async function runPhase2Tests() {
  console.log('\n🚀 STARTING PHASE 2 AUTOMATED INTEGRATION TEST SUITE...\n');
  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✅ PASSED: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAILED: ${name}`);
      console.error(`     Error: ${err.response?.data?.message || err.message}`);
      failed++;
    }
  }

  // 1. Super Admin & Restaurant Admin Login
  await test('1. Super Admin Authentication', async () => {
    const res = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'superadmin@gmail.com',
      password: 'admin@123'
    });
    if (!res.data.token || res.data.user.role !== 'SUPER_ADMIN') throw new Error('Invalid Super Admin response');
    superAdminToken = res.data.token;
  });

  await test('2. Grand Palace Restaurant Admin Authentication', async () => {
    const res = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'admin@hotel.com',
      password: 'admin123'
    });
    if (!res.data.token) throw new Error('Invalid Restaurant Admin response');
    restaurantAdminToken = res.data.token;
    if (res.data.restaurant) grandPalaceId = res.data.restaurant.id;
  });

  // 2. Public Rider Application Submission
  await test('3. Submit Public Rider Application with Files', async () => {
    const form = new FormData();
    form.append('restaurantId', grandPalaceId);
    form.append('fullName', 'Rahul Kumar (Test Rider)');
    form.append('mobile', '+91 9900112233');
    form.append('email', 'rahul.testrider@gmail.com');
    form.append('dateOfBirth', '1998-05-15');
    form.append('homeCity', 'Hubballi');
    form.append('currentCity', 'Bengaluru');
    form.append('currentAddress', 'No 45, Indiranagar, Bengaluru');
    form.append('vehicleType', 'Bike');
    form.append('vehicleNumber', 'KA-01-AB-1234');

    // Dummy 1x1 GIF buffer for images
    const dummyImg = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    form.append('selfie', dummyImg, { filename: 'selfie.jpg', contentType: 'image/jpeg' });
    form.append('aadhaar_front', dummyImg, { filename: 'aadhaar_f.jpg', contentType: 'image/jpeg' });
    form.append('aadhaar_back', dummyImg, { filename: 'aadhaar_b.jpg', contentType: 'image/jpeg' });
    form.append('driving_license_front', dummyImg, { filename: 'dl_f.jpg', contentType: 'image/jpeg' });
    form.append('driving_license_back', dummyImg, { filename: 'dl_b.jpg', contentType: 'image/jpeg' });

    const res = await axios.post(`${BASE_URL}/driver-applications`, form, {
      headers: form.getHeaders()
    });

    if (!res.data.success || !res.data.applicationId) throw new Error('Application submission failed');
    testApplicationId = res.data.applicationId;
  });

  // 3. Duplicate Application Prevention
  await test('4. Duplicate Application Prevention Check', async () => {
    const form = new FormData();
    form.append('restaurantId', grandPalaceId);
    form.append('fullName', 'Rahul Kumar Duplicate');
    form.append('mobile', '+91 9900112233');
    form.append('email', 'rahul.testrider@gmail.com');
    form.append('vehicleType', 'Bike');
    const dummyImg = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    form.append('selfie', dummyImg, { filename: 'selfie.jpg', contentType: 'image/jpeg' });

    try {
      await axios.post(`${BASE_URL}/driver-applications`, form, { headers: form.getHeaders() });
      throw new Error('Should have rejected duplicate application');
    } catch (err) {
      if (err.response?.status !== 400) throw err;
    }
  });

  // 4. Admin View Applications
  await test('5. Admin Fetch Pending Rider Applications (Restaurant Scoped)', async () => {
    const res = await axios.get(`${BASE_URL}/admin/rider-applications?status=PENDING`, {
      headers: { Authorization: `Bearer ${restaurantAdminToken}` }
    });
    if (!res.data.success || res.data.applications.length === 0) throw new Error('No pending applications found');
  });

  // 5. Admin Approve Application (Atomic Transaction)
  await test('6. Admin Atomic Transaction Approval of Rider Application', async () => {
    const res = await axios.patch(
      `${BASE_URL}/admin/rider-applications/${testApplicationId}/approve`,
      { initialPassword: 'riderpassword123' },
      { headers: { Authorization: `Bearer ${restaurantAdminToken}` } }
    );
    if (!res.data.success || !res.data.driverId) throw new Error('Approval failed');
    testDriverId = res.data.driverId;
  });

  // 6. Approved Rider Login (No OTP)
  await test('7. Approved Rider Login with Credentials (No OTP)', async () => {
    const res = await axios.post(`${BASE_URL}/driver/login`, {
      login: 'rahul.testrider@gmail.com',
      password: 'riderpassword123'
    });
    if (!res.data.token || res.data.driver.accountStatus !== 'ACTIVE') throw new Error('Rider login failed');
    driverToken = res.data.token;
  });

  // 7. Rider Go Online / Offline
  await test('8. Rider Go Online (Availability = AVAILABLE)', async () => {
    const res = await axios.post(
      `${BASE_URL}/driver/go-online`,
      { latitude: 12.9716, longitude: 77.5946 },
      { headers: { Authorization: `Bearer ${driverToken}` } }
    );
    if (!res.data.success || res.data.availabilityStatus !== 'AVAILABLE') throw new Error('Failed to go online');
  });

  // 8. Place Customer Order & Assign Rider
  await test('9. Place Customer Order for Assignment Flow', async () => {
    const res = await axios.post(`${BASE_URL}/orders/checkout`, {
      restaurantId: grandPalaceId,
      customerName: 'Customer Test',
      customerPhone: '+91 9111122222',
      deliveryAddress: 'No 100, M.G. Road, Bengaluru',
      deliveryArea: 'Central',
      customerLatitude: 12.9720,
      customerLongitude: 77.5950,
      paymentMethod: 'COD',
      items: [{ menuItemId: 1, quantity: 1 }]
    });

    if (!res.data.success || !res.data.order.orderId) throw new Error('Order placement failed');
    testOrderId = res.data.order.orderId;

    // Transition order to READY_FOR_PICKUP
    await axios.patch(`${BASE_URL}/admin/orders/${testOrderId}/status`, { status: 'ACCEPTED' }, { headers: { Authorization: `Bearer ${restaurantAdminToken}` } });
    await axios.patch(`${BASE_URL}/admin/orders/${testOrderId}/status`, { status: 'PREPARING' }, { headers: { Authorization: `Bearer ${restaurantAdminToken}` } });
    await axios.patch(`${BASE_URL}/admin/orders/${testOrderId}/status`, { status: 'READY_FOR_PICKUP' }, { headers: { Authorization: `Bearer ${restaurantAdminToken}` } });
  });

  await test('10. Admin Assign Approved Rider to Order', async () => {
    const res = await axios.post(
      `${BASE_URL}/admin/orders/${testOrderId}/assign-driver`,
      { driver_id: testDriverId },
      { headers: { Authorization: `Bearer ${restaurantAdminToken}` } }
    );
    if (!res.data.success) throw new Error('Driver assignment failed');
  });

  // 9. Rider Accept & Pickup
  await test('11. Rider Accept Assigned Order (DRIVER_ACCEPTED)', async () => {
    const res = await axios.post(
      `${BASE_URL}/driver/orders/${testOrderId}/accept`,
      {},
      { headers: { Authorization: `Bearer ${driverToken}` } }
    );
    if (!res.data.success) throw new Error('Rider accept failed');
  });

  await test('12. Rider Mark Food Picked Up (PICKED_UP)', async () => {
    const res = await axios.post(
      `${BASE_URL}/driver/orders/${testOrderId}/pickup`,
      {},
      { headers: { Authorization: `Bearer ${driverToken}` } }
    );
    if (!res.data.success) throw new Error('Rider pickup failed');
  });

  await test('13. Rider Start Delivery Route (OUT_FOR_DELIVERY)', async () => {
    const res = await axios.post(
      `${BASE_URL}/driver/orders/${testOrderId}/start-delivery`,
      {},
      { headers: { Authorization: `Bearer ${driverToken}` } }
    );
    if (!res.data.success) throw new Error('Start delivery failed');
  });

  // 10. Canonical GPS Location Stream
  await test('14. Canonical Driver Location Stream Update', async () => {
    const res = await axios.post(
      `${BASE_URL}/driver/location`,
      { latitude: 12.9730, longitude: 77.5960, orderId: testOrderId },
      { headers: { Authorization: `Bearer ${driverToken}` } }
    );
    if (!res.data.success || res.data.latitude !== 12.973) throw new Error('Location stream update failed');
  });

  // 11. Delivery Completion & COD Collection
  await test('15. Rider Mark Order Delivered with COD Collection', async () => {
    const res = await axios.post(
      `${BASE_URL}/driver/orders/${testOrderId}/deliver`,
      { isCodCollected: true, remainOnline: true },
      { headers: { Authorization: `Bearer ${driverToken}` } }
    );
    if (!res.data.success) throw new Error('Order delivery completion failed');

    // Verify order status & payment status using admin token
    const orderRes = await axios.get(`${BASE_URL}/orders/${testOrderId}`, {
      headers: { Authorization: `Bearer ${restaurantAdminToken}` }
    });
    if (orderRes.data.order.order_status !== 'DELIVERED' || orderRes.data.order.payment_status !== 'COMPLETED') {
      throw new Error('Order or payment status not updated correctly on delivery');
    }
  });

  // 12. Delivery Failure Recovery Workflow
  await test('16. Failed Delivery Recovery Workflow', async () => {
    // Create new test order
    const res = await axios.post(`${BASE_URL}/orders/checkout`, {
      restaurantId: grandPalaceId,
      customerName: 'Failure Test Customer',
      customerPhone: '+91 9222233333',
      deliveryAddress: 'No 200, M.G. Road',
      deliveryArea: 'Central',
      customerLatitude: 12.9720,
      customerLongitude: 77.5950,
      paymentMethod: 'COD',
      items: [{ menuItemId: 1, quantity: 1 }]
    });
    const fOrderId = res.data.order.orderId;

    // Transition to OUT_FOR_DELIVERY
    await axios.patch(`${BASE_URL}/admin/orders/${fOrderId}/status`, { status: 'ACCEPTED' }, { headers: { Authorization: `Bearer ${restaurantAdminToken}` } });
    await axios.patch(`${BASE_URL}/admin/orders/${fOrderId}/status`, { status: 'PREPARING' }, { headers: { Authorization: `Bearer ${restaurantAdminToken}` } });
    await axios.patch(`${BASE_URL}/admin/orders/${fOrderId}/status`, { status: 'READY_FOR_PICKUP' }, { headers: { Authorization: `Bearer ${restaurantAdminToken}` } });
    await axios.post(`${BASE_URL}/admin/orders/${fOrderId}/assign-driver`, { driver_id: testDriverId }, { headers: { Authorization: `Bearer ${restaurantAdminToken}` } });
    await axios.post(`${BASE_URL}/driver/orders/${fOrderId}/accept`, {}, { headers: { Authorization: `Bearer ${driverToken}` } });
    await axios.post(`${BASE_URL}/driver/orders/${fOrderId}/pickup`, {}, { headers: { Authorization: `Bearer ${driverToken}` } });
    await axios.post(`${BASE_URL}/driver/orders/${fOrderId}/start-delivery`, {}, { headers: { Authorization: `Bearer ${driverToken}` } });

    // Mark delivery failed
    await axios.post(`${BASE_URL}/driver/orders/${fOrderId}/delivery-failed`, { reason: 'Customer unreachable' }, { headers: { Authorization: `Bearer ${driverToken}` } });

    // Execute Recovery RETRY
    const recRes = await axios.post(
      `${BASE_URL}/admin/orders/${fOrderId}/recover-delivery`,
      { action: 'RETRY', notes: 'Reset to pickup pool' },
      { headers: { Authorization: `Bearer ${restaurantAdminToken}` } }
    );
    if (!recRes.data.success || recRes.data.result.status !== 'READY_FOR_PICKUP') throw new Error('Recovery workflow failed');
  });

  // 13. Multi-Restaurant Isolation
  await test('17. Restaurant Admin Isolation Check (Spice Garden Admin cannot see Grand Palace Rider)', async () => {
    // Login as Spice Garden Admin
    const spiceRes = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'admin@spicegarden.com',
      password: 'admin123'
    });
    const spiceAdminToken = spiceRes.data.token;

    // Try fetching Grand Palace rider details
    const driversRes = await axios.get(`${BASE_URL}/admin/riders`, {
      headers: { Authorization: `Bearer ${spiceAdminToken}` }
    });

    const foundGP = driversRes.data.drivers.find(d => d.id === testDriverId);
    if (foundGP) throw new Error('Isolation breach: Spice Garden admin can see Grand Palace rider');
  });

  console.log(`\n==================================================`);
  console.log(`🎉 PHASE 2 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log(`==================================================\n`);

  if (failed > 0) process.exit(1);
}

runPhase2Tests();
