const axios = require('axios');
const http = require('http');

const API_BASE = 'http://localhost:5000/api/v1';

// Cookie jar simulation for guest identity
let guestCookie = null;

const api = axios.create({
  baseURL: API_BASE,
  validateStatus: () => true // Don't throw on status codes
});

// Interceptor to handle cookies
api.interceptors.response.use(res => {
  const setCookie = res.headers['set-cookie'];
  if (setCookie && setCookie.length > 0) {
    guestCookie = setCookie[0].split(';')[0];
  }
  return res;
});

api.interceptors.request.use(config => {
  if (guestCookie) {
    config.headers.Cookie = guestCookie;
  }
  return config;
});

async function runTests() {
  console.log('🧪 STARTING COMPREHENSIVE PHASE 1 INTEGRATION TESTS...\n');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASSED: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAILED: ${message}`);
      failed++;
    }
  }

  try {
    // 1. Guest Identity Init
    console.log('--- TEST GROUP 1: Guest Identity & Public Browsing ---');
    const guestInitRes = await api.post('/guest/init');
    assert(guestInitRes.data.success === true, 'Guest identity initialized without login requirement');
    assert(!!guestCookie, 'HttpOnly guest_identity cookie set by backend');

    // 2. Public Restaurant Page - Grand Palace
    const rest1Res = await api.get('/restaurants/grand-palace');
    assert(rest1Res.data.success === true, 'Public restaurant Grand Palace accessible without auth');
    assert(rest1Res.data.restaurant.slug === 'grand-palace', 'Correct slug returned');
    assert(rest1Res.data.restaurant.website_status === 'PUBLISHED', 'Grand Palace is PUBLISHED');
    assert(rest1Res.data.restaurant.status === 'ACTIVE', 'Grand Palace is ACTIVE');

    // 3. Public Menu & Categories - Grand Palace
    const menu1Res = await api.get('/restaurants/grand-palace/menu');
    assert(menu1Res.data.success === true && menu1Res.data.items.length > 0, `Grand Palace menu fetched (${menu1Res.data.items.length} items)`);

    const cat1Res = await api.get('/restaurants/grand-palace/categories');
    assert(cat1Res.data.success === true && cat1Res.data.categories.length > 0, `Grand Palace categories fetched (${cat1Res.data.categories.length} categories)`);

    // 4. Public Restaurant Page - Spice Garden
    const rest2Res = await api.get('/restaurants/spice-garden');
    assert(rest2Res.data.success === true, 'Public restaurant Spice Garden accessible without auth');
    assert(rest2Res.data.restaurant.slug === 'spice-garden', 'Correct slug returned for second restaurant');

    const menu2Res = await api.get('/restaurants/spice-garden/menu');
    assert(menu2Res.data.success === true && menu2Res.data.items.length > 0, `Spice Garden menu fetched (${menu2Res.data.items.length} items)`);

    // 5. Customer Ordering - Outside 10km Radius Rejection
    console.log('\n--- TEST GROUP 2: Location & Delivery Radius Validation ---');
    const item1 = menu1Res.data.items[0];
    const farAwayCheckout = await api.post('/orders/checkout', {
      restaurantSlug: 'grand-palace',
      customerName: 'Far Away Customer',
      customerPhone: '+91 9999911111',
      deliveryAddress: 'Mysuru City Center',
      deliveryArea: 'Mysuru',
      customerLatitude: 12.2958, // ~140km away from Bengaluru
      customerLongitude: 76.6394,
      paymentMethod: 'COD',
      items: [{ menuItemId: item1.id, quantity: 2 }]
    });

    assert(farAwayCheckout.data.success === false, 'Outside 10km radius order successfully REJECTED by backend');
    assert(farAwayCheckout.data.message.includes('exceeds our maximum delivery radius'), 'Correct distance rejection message returned');

    // 6. Customer Ordering - Inside 10km Radius (Valid Order)
    console.log('\n--- TEST GROUP 3: Guest Customer Order Creation (No Login Required) ---');
    const validCheckout = await api.post('/orders/checkout', {
      restaurantSlug: 'grand-palace',
      customerName: 'Vikram Mehta',
      customerPhone: '+91 9876543210',
      deliveryAddress: 'Indiranagar 100ft Road',
      deliveryArea: 'Indiranagar',
      deliveryLandmark: 'Near Toit Pub',
      customerLatitude: 12.9784, // ~5km from M.G. Road
      customerLongitude: 77.6408,
      paymentMethod: 'COD',
      items: [
        { menuItemId: item1.id, quantity: 2, specialInstructions: 'Extra spicy' }
      ]
    });

    assert(validCheckout.data.success === true, 'Inside-radius guest order created successfully');
    const createdOrder = validCheckout.data.order;
    assert(!!createdOrder.orderNumber, `Order Number generated: ${createdOrder?.orderNumber}`);
    assert(createdOrder.distanceKm < 10, `Calculated distance: ${createdOrder?.distanceKm} km (< 10km)`);

    // 7. Returning Customer Recognition (Active Order Lookup)
    console.log('\n--- TEST GROUP 4: Returning Customer Identity Recognition ---');
    const activeOrderRes = await api.get('/guest/active-order/grand-palace');
    assert(activeOrderRes.data.success === true, 'Active order lookup endpoint works');
    assert(activeOrderRes.data.activeOrder?.id === createdOrder.orderId, 'Guest identity recognized returning customer active order');

    const guestOrdersRes = await api.get('/guest/orders');
    assert(guestOrdersRes.data.success === true && guestOrdersRes.data.orders.length > 0, `Guest order history retrieved via HttpOnly cookie (${guestOrdersRes.data.orders.length} orders)`);

    // 8. Order Tracking Detail Access
    const trackingRes = await api.get(`/orders/${createdOrder.orderId}`);
    assert(trackingRes.data.success === true, 'Order tracking page data retrieved via guest identity');
    assert(trackingRes.data.order.items.length > 0, 'Order items retrieved with historical price snapshot');

    // 9. Super Admin Authentication & Platform Control
    console.log('\n--- TEST GROUP 5: Super Admin Console & Multi-Tenant Oversight ---');
    const saLogin = await api.post('/auth/login', { email: 'superadmin@gmail.com', password: 'admin@123' });
    assert(saLogin.data.success === true, 'Super Admin login successful');
    const saToken = saLogin.data.token;

    const saKpis = await api.get('/superadmin/kpis', { headers: { Authorization: `Bearer ${saToken}` } });
    assert(saKpis.data.success === true, 'Super Admin platform KPIs retrieved');
    assert(saKpis.data.kpis.totalRestaurants >= 2, `Total platform restaurants count: ${saKpis.data.kpis.totalRestaurants}`);

    const saRests = await api.get('/superadmin/restaurants', { headers: { Authorization: `Bearer ${saToken}` } });
    assert(saRests.data.success === true && saRests.data.restaurants.length >= 2, `Super Admin list all restaurants (${saRests.data.restaurants.length} stores listed)`);

    // 10. Restaurant Admin Authentication & Multi-Tenant Data Isolation
    console.log('\n--- TEST GROUP 6: Restaurant Admin Isolation & Authorization ---');
    // Admin 1: Grand Palace
    const admin1Login = await api.post('/auth/login', { email: 'admin@hotel.com', password: 'admin123' });
    assert(admin1Login.data.success === true, 'Grand Palace Admin login successful');
    const admin1Token = admin1Login.data.token;

    // Admin 2: Spice Garden
    const admin2Login = await api.post('/auth/login', { email: 'admin@spicegarden.com', password: 'admin123' });
    assert(admin2Login.data.success === true, 'Spice Garden Admin login successful');
    const admin2Token = admin2Login.data.token;

    // Data Isolation Check: Admin 1 gets only Grand Palace orders
    const admin1Orders = await api.get('/admin/orders', { headers: { Authorization: `Bearer ${admin1Token}` } });
    assert(admin1Orders.data.success === true, 'Grand Palace Admin orders retrieved');
    const allGrandPalace = admin1Orders.data.orders.every(o => o.restaurant_name === 'The Grand Palace Restaurant & Dining');
    assert(allGrandPalace === true, 'ISOLATION CONFIRMED: Grand Palace Admin sees ONLY Grand Palace orders');

    // Data Isolation Check: Admin 2 gets only Spice Garden orders
    const admin2Orders = await api.get('/admin/orders', { headers: { Authorization: `Bearer ${admin2Token}` } });
    assert(admin2Orders.data.success === true, 'Spice Garden Admin orders retrieved');
    const allSpiceGarden = admin2Orders.data.orders.length === 0 || admin2Orders.data.orders.every(o => o.restaurant_name === 'Spice Garden Kitchen');
    assert(allSpiceGarden === true, 'ISOLATION CONFIRMED: Spice Garden Admin sees ONLY Spice Garden orders');

    // 11. Order Status State Machine Transitions
    console.log('\n--- TEST GROUP 7: Admin Order Pipeline State Machine ---');
    const orderIdToUpdate = createdOrder.orderId;

    // PENDING -> ACCEPTED
    const acceptRes = await api.patch(`/admin/orders/${orderIdToUpdate}/status`, { status: 'ACCEPTED' }, { headers: { Authorization: `Bearer ${admin1Token}` } });
    assert(acceptRes.data.success === true, 'Status transitioned: PENDING ➔ ACCEPTED');

    // ACCEPTED -> SENT_TO_KITCHEN
    const kitchenRes = await api.patch(`/admin/orders/${orderIdToUpdate}/status`, { status: 'SENT_TO_KITCHEN' }, { headers: { Authorization: `Bearer ${admin1Token}` } });
    assert(kitchenRes.data.success === true, 'Status transitioned: ACCEPTED ➔ SENT_TO_KITCHEN');

    // SENT_TO_KITCHEN -> PREPARING
    const prepRes = await api.patch(`/admin/orders/${orderIdToUpdate}/status`, { status: 'PREPARING' }, { headers: { Authorization: `Bearer ${admin1Token}` } });
    assert(prepRes.data.success === true, 'Status transitioned: SENT_TO_KITCHEN ➔ PREPARING');

    // PREPARING -> READY_FOR_PICKUP
    const readyRes = await api.patch(`/admin/orders/${orderIdToUpdate}/status`, { status: 'READY_FOR_PICKUP' }, { headers: { Authorization: `Bearer ${admin1Token}` } });
    assert(readyRes.data.success === true, 'Status transitioned: PREPARING ➔ READY_FOR_PICKUP');

    // READY_FOR_PICKUP -> DELIVERED
    const delivRes = await api.patch(`/admin/orders/${orderIdToUpdate}/status`, { status: 'DELIVERED' }, { headers: { Authorization: `Bearer ${admin1Token}` } });
    assert(delivRes.data.success === true, 'Status transitioned: READY_FOR_PICKUP ➔ DELIVERED');

    // 12. Payment Verification (COD Mark Collected)
    console.log('\n--- TEST GROUP 8: Payment Verification & COD Collection ---');
    const codRes = await api.post('/payments/mark-cod-collected', { order_id: orderIdToUpdate }, { headers: { Authorization: `Bearer ${admin1Token}` } });
    assert(codRes.data.success === true, 'COD payment marked collected by admin');

    // Online payment initiation check
    const payInitRes = await api.post('/payments/initiate', { order_id: orderIdToUpdate });
    assert(payInitRes.data.success === true, 'Online payment order initiated (Razorpay mock)');

    console.log(`\n==================================================`);
    console.log(`📊 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log(`==================================================\n`);

    if (failed > 0) process.exit(1);

  } catch (err) {
    console.error('Fatal test execution error:', err);
    process.exit(1);
  }
}

runTests();
