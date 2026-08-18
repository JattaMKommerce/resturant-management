const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const axios = require('axios');
const express = require('express');
const http = require('http');
const cors = require('cors');
const { initDatabase } = require('./database/init');
const apiRoutes = require('./routes/api');
const { query } = require('./config/db');

async function runCompleteFlow() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🚀 COMPLETE END-TO-END SYSTEM TEST & WALKTHROUGH SIMULATION');
  console.log('═══════════════════════════════════════════════════════════\n');

  await initDatabase();

  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
  app.use('/api/v1', apiRoutes);

  const server = http.createServer(app);
  const PORT = 5088;
  await new Promise(resolve => server.listen(PORT, resolve));
  const BASE_URL = `http://localhost:${PORT}/api/v1`;

  const api = axios.create({ baseURL: BASE_URL });

  try {
    // ═══════════════════════════════════════════════
    // STEP 1: APPLY FOR A NEW RIDER (WITH FILE UPLOADS)
    // ═══════════════════════════════════════════════
    console.log('📋 STEP 1: Submitting New Rider Application with Document Uploads...');
    
    // Find an existing image file from uploads
    const sampleImgPath = path.join(__dirname, 'uploads/riders/selfies/rider-selfie-1786532293367-41a7fe6d83672074ad6e8628.jpg');
    let fileBuffer;
    if (fs.existsSync(sampleImgPath)) {
      fileBuffer = fs.readFileSync(sampleImgPath);
    } else {
      // 1x1 test gif buffer
      fileBuffer = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    }

    const timestamp = Date.now();
    const riderEmail = `rider_${timestamp}@test.com`;
    const riderMobile = `+91 98${Math.floor(10000000 + Math.random() * 90000000)}`;

    const form = new FormData();
    form.append('restaurantId', '6'); // Taj Hotel Hubli
    form.append('fullName', `Kiran Kumar (${timestamp % 1000})`);
    form.append('mobile', riderMobile);
    form.append('email', riderEmail);
    form.append('dateOfBirth', '1998-05-15');
    form.append('homeCity', 'Hubballi');
    form.append('currentCity', 'Hubballi');
    form.append('currentAddress', 'Gokul Road, Hubballi, Karnataka');
    form.append('emergencyContact', '+91 9876543210');
    form.append('vehicleType', 'Bike');
    form.append('vehicleNumber', 'KA-25-EA-8899');
    form.append('password', 'driver123');

    form.append('selfie', fileBuffer, { filename: 'selfie.jpg', contentType: 'image/jpeg' });
    form.append('aadhaar_front', fileBuffer, { filename: 'aadhaar_front.jpg', contentType: 'image/jpeg' });
    form.append('driving_license_front', fileBuffer, { filename: 'license_front.jpg', contentType: 'image/jpeg' });

    const applyRes = await api.post('/driver-applications', form, {
      headers: form.getHeaders()
    });

    console.log(`  ✅ Rider Application Submitted!`);
    console.log(`     - Application ID: ${applyRes.data.applicationId}`);
    console.log(`     - Applicant: Kiran Kumar | Email: ${riderEmail} | Restaurant: ${applyRes.data.restaurantName}`);
    const newAppId = applyRes.data.applicationId;

    // ═══════════════════════════════════════════════
    // STEP 2: RESTAURANT ADMIN OF TAJ HOTEL HUBLI REVIEWS & APPROVES RIDER
    // ═══════════════════════════════════════════════
    console.log('\n🏨 STEP 2: Restaurant Admin ("taj hotel hubli") Reviews & Approves Rider Application...');
    
    // Login as Taj Hotel Hubli Admin (gi@gmail.com / 123456789)
    const adminLoginRes = await api.post('/auth/login', {
      email: 'gi@gmail.com',
      password: '123456789'
    });

    const adminToken = adminLoginRes.data.token;
    console.log(`  ✅ Taj Hotel Hubli Admin logged in: ${adminLoginRes.data.user.name} (${adminLoginRes.data.restaurant.name})`);

    // Fetch pending applications
    const pendingAppsRes = await api.get('/admin/rider-applications?status=PENDING', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    console.log(`  ✅ Found ${pendingAppsRes.data.applications.length} pending rider application(s) for Taj Hotel Hubli.`);

    // Approve the new rider
    const approveRes = await api.patch(`/admin/rider-applications/${newAppId}/approve`, {
      initialPassword: 'driver123'
    }, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    console.log(`  ✅ Rider Application Approved by Restaurant Admin!`);
    console.log(`     - Driver ID: ${approveRes.data.driverId}`);
    console.log(`     - Credentials: Email: ${approveRes.data.credentials.email} | Password: ${approveRes.data.credentials.temporaryPassword}`);
    const newDriverId = approveRes.data.driverId;

    // ═══════════════════════════════════════════════
    // STEP 3: RIDER LOGS IN & TESTS MULTI-RESTAURANT HANDLING
    // ═══════════════════════════════════════════════
    console.log('\n🛵 STEP 3: Driver Logs In & Tests Multi-Restaurant Application (1-Click No Re-Upload)...');
    
    const driverLoginRes = await api.post('/driver/login', {
      login: riderEmail,
      password: 'driver123'
    });

    const driverToken = driverLoginRes.data.token;
    console.log(`  ✅ Driver logged in successfully: ${driverLoginRes.data.driver.fullName}`);
    console.log(`  ✅ Assigned Restaurants: ${driverLoginRes.data.assignedRestaurants.map(r => r.name).join(', ')}`);

    // Fetch available restaurants
    const availRestsRes = await api.get('/driver/available-restaurants', {
      headers: { Authorization: `Bearer ${driverToken}` }
    });
    console.log(`  ✅ Platform available restaurants: ${availRestsRes.data.restaurants.length} active stores`);

    // Apply to a 2nd restaurant (e.g. Spice Garden Kitchen ID 2) without re-uploading documents
    const secondRest = availRestsRes.data.restaurants.find(r => !r.isAssigned);
    if (secondRest) {
      console.log(`  Applying to 2nd restaurant: "${secondRest.name}" (ID ${secondRest.id})...`);
      const secondApplyRes = await api.post('/driver/apply-restaurant', {
        restaurantId: secondRest.id
      }, {
        headers: { Authorization: `Bearer ${driverToken}` }
      });
      console.log(`  ✅ 1-Click Application Success: ${secondApplyRes.data.message}`);
    }

    const [restDb] = await query('SELECT latitude, longitude FROM restaurants WHERE id = 6');
    const restLat = restDb.latitude ? parseFloat(restDb.latitude) : 12.9716;
    const restLng = restDb.longitude ? parseFloat(restDb.longitude) : 77.5946;

    // Driver goes ONLINE
    await api.post('/driver/go-online', {
      latitude: restLat + 0.002,
      longitude: restLng + 0.002
    }, {
      headers: { Authorization: `Bearer ${driverToken}` }
    });
    console.log(`  ✅ Driver is now ONLINE 🟢 in delivery zone.`);

    // ═══════════════════════════════════════════════
    // STEP 4: CUSTOMER PLACES ORDER ON TAJ HOTEL HUBLI
    // ═══════════════════════════════════════════════
    console.log('\n🍔 STEP 4: Customer Places Order on "taj hotel hubli"...');
    
    const guestInit = await api.post('/guest/init', {
      deviceFingerprint: `cust_device_${timestamp}`
    });
    const guestCookie = guestInit.headers['set-cookie'] ? guestInit.headers['set-cookie'][0] : null;

    // Checkout: Order 1x Chicken Biryani (ID 39) + 2x Thumps Up (ID 38)
    const checkoutPayload = {
      restaurantSlug: 'taj-hotel-hubli',
      customerName: 'Anil Deshmukh',
      customerPhone: '+91 9741234567',
      deliveryAddress: 'House 14, Main Road, Hubballi, Karnataka',
      deliveryArea: 'Main Road',
      customerLatitude: restLat + 0.005,
      customerLongitude: restLng + 0.005,
      paymentMethod: 'COD',
      items: [
        { menuItemId: 39, quantity: 1 }, // Chicken Biryani 449
        { menuItemId: 38, quantity: 2 }  // 2x Thumps Up 25 = 50
      ]
    };

    const orderRes = await api.post('/orders/checkout', checkoutPayload, {
      headers: guestCookie ? { Cookie: guestCookie } : {}
    });

    const order = orderRes.data.order;
    console.log(`  ✅ Order Placed Successfully!`);
    console.log(`     - Order Number: #${order.orderNumber} (ID: ${order.orderId})`);
    console.log(`     - Subtotal: ₹${order.subtotal} | Tax: ₹${order.taxAmount} | Delivery Fee: ₹${order.deliveryFee} | Total: ₹${order.totalAmount}`);
    console.log(`     - Items: ${order.items.map(i => `${i.quantity}x ${i.item_name}`).join(', ')}`);

    // ═══════════════════════════════════════════════
    // STEP 5: RESTAURANT ADMIN ACCEPTS & MARKS READY FOR PICKUP
    // ═══════════════════════════════════════════════
    console.log('\n👨‍🍳 STEP 5: Restaurant Admin Accepts Order & Marks Food READY FOR PICKUP...');
    
    // Restaurant accepts order
    await api.patch(`/admin/orders/${order.orderId}/status`, {
      status: 'ACCEPTED',
      notes: 'Kitchen confirmed order.'
    }, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    console.log(`  ✅ Order #${order.orderNumber} -> ACCEPTED`);

    // Kitchen prepares & marks ready for pickup
    await api.patch(`/admin/orders/${order.orderId}/status`, {
      status: 'READY_FOR_PICKUP',
      notes: 'Food is freshly cooked, packed and waiting on counter.'
    }, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    console.log(`  ✅ Order #${order.orderNumber} -> READY_FOR_PICKUP 📦`);

    // ═══════════════════════════════════════════════
    // STEP 6: DRIVER VIEWS AVAILABLE ORDERS POOL & INSTANTLY CLAIMS
    // ═══════════════════════════════════════════════
    console.log('\n⚡ STEP 6: Driver Views Available Orders Pool & Instantly Claims Order (FCFS)...');
    
    const poolRes = await api.get('/driver/available-orders', {
      headers: { Authorization: `Bearer ${driverToken}` }
    });

    console.log(`  ✅ Driver Available Orders Pool: ${poolRes.data.orders.length} order(s) waiting`);
    const targetOrder = poolRes.data.orders.find(o => o.id === order.orderId);

    if (!targetOrder) {
      throw new Error(`Order #${order.orderNumber} not found in driver available orders pool!`);
    }

    console.log(`  Target Order found in pool: #${targetOrder.order_number} from ${targetOrder.restaurant_name} for ₹${targetOrder.total_amount}`);

    // Driver claims order
    const claimRes = await api.post(`/driver/orders/${order.orderId}/claim`, {}, {
      headers: { Authorization: `Bearer ${driverToken}` }
    });

    console.log(`  🎉 ${claimRes.data.message}`);

    // ═══════════════════════════════════════════════
    // STEP 7: DRIVER COMPLETES FULL DELIVERY CYCLE
    // ═══════════════════════════════════════════════
    console.log('\n🛵 STEP 7: Driver Completes Pickup, Transit & Customer Drop-off...');
    
    // Pickup
    await api.post(`/driver/orders/${order.orderId}/pickup`, {}, {
      headers: { Authorization: `Bearer ${driverToken}` }
    });
    console.log(`  ✅ Driver picked up package from Taj Hotel Hubli counter.`);

    // Out for delivery
    await api.post(`/driver/orders/${order.orderId}/start-delivery`, {}, {
      headers: { Authorization: `Bearer ${driverToken}` }
    });
    console.log(`  ✅ Driver started route to customer (OUT_FOR_DELIVERY 🚀).`);

    // Send live GPS tracking update
    await api.post('/driver/location', {
      latitude: restLat + 0.003,
      longitude: restLng + 0.003,
      orderId: order.orderId
    }, {
      headers: { Authorization: `Bearer ${driverToken}` }
    });
    console.log(`  ✅ Live GPS coordinates streamed for customer real-time tracking.`);

    // Mark delivered & collect COD
    const deliverRes = await api.post(`/driver/orders/${order.orderId}/deliver`, {
      isCodCollected: true,
      remainOnline: true
    }, {
      headers: { Authorization: `Bearer ${driverToken}` }
    });
    console.log(`  🎉 ${deliverRes.data.message} (₹${order.totalAmount} COD collected).`);

    // ═══════════════════════════════════════════════
    // STEP 8: VERIFY FINAL STATUS
    // ═══════════════════════════════════════════════
    console.log('\n📊 STEP 8: Verifying Final Order State...');
    const [finalOrderRows] = await query('SELECT id, order_number, order_status, payment_status, cod_collected_by FROM orders WHERE id = ?', [order.orderId]);
    console.log('Final Order in Database:', finalOrderRows[0]);

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('🏆 100% COMPLETE END-TO-END SIMULATION SUCCEEDED!');
    console.log('═══════════════════════════════════════════════════════════');

    server.close();
    process.exit(0);

  } catch (err) {
    console.error('\n❌ End-to-End Simulation Error:', err.response?.data || err.message);
    if (server) server.close();
    process.exit(1);
  }
}

runCompleteFlow();
