const http = require('http');

const BASE_URL = 'http://localhost:5000/api';

async function makeRequest(path, method = 'GET', body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const headers = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: headers,
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', (err) => reject(err));

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

function extractTokenAndUser(loginResp) {
  if (!loginResp || !loginResp.body) return { token: null, user: null };
  const b = loginResp.body;
  if (b.data && b.data.token) {
    return { token: b.data.token, user: b.data.user };
  }
  return { token: b.token || null, user: b.user || null };
}

async function runTestSuite() {
  const results = [];

  function assert(name, condition, details = '') {
    if (condition) {
      results.push({ test: name, status: 'PASSED', details });
      console.log(`✅ [PASS] ${name} ${details ? `(${details})` : ''}`);
    } else {
      results.push({ test: name, status: 'FAILED', details });
      console.error(`❌ [FAIL] ${name} -> ${details}`);
    }
  }

  console.log('===============================================================');
  console.log('🚀 Starting Hotel & Restaurant Management System API Test Suite');
  console.log('===============================================================\n');

  try {
    // 1. Health & Status
    const health = await makeRequest('/health');
    assert('Health Check Endpoint', health.status === 200 && (health.body.success === true || health.body.status === 'OK'));

    // 2. Super Admin Auth
    const saLogin = await makeRequest('/auth/login', 'POST', {
      email: 'superadmin@gmail.com',
      password: 'admin123'
    });
    const saAuth = extractTokenAndUser(saLogin);
    assert('Super Admin Login', saLogin.status === 200 && Boolean(saAuth.token), `Role: ${saAuth.user?.role}`);

    // 3. Restaurant Admin Auth
    const adminLogin = await makeRequest('/auth/login', 'POST', {
      email: 'admin@hotel.com',
      password: 'admin123'
    });
    const adminAuth = extractTokenAndUser(adminLogin);
    assert('Restaurant Admin Login', adminLogin.status === 200 && Boolean(adminAuth.token), `Role: ${adminAuth.user?.role}`);

    // 4. Waiter Auth
    const waiterLogin = await makeRequest('/auth/login', 'POST', {
      email: 'waiter@hotel.com',
      password: '123456789'
    });
    const waiterAuth = extractTokenAndUser(waiterLogin);
    assert('Waiter Staff Login', waiterLogin.status === 200 && Boolean(waiterAuth.token), `Role: ${waiterAuth.user?.role}`);

    // 5. Kitchen / Chef Auth
    const chefLogin = await makeRequest('/auth/login', 'POST', {
      email: 'chef@hotel.com',
      password: '123456789'
    });
    const chefAuth = extractTokenAndUser(chefLogin);
    assert('Kitchen Chef Login', chefLogin.status === 200 && Boolean(chefAuth.token), `Role: ${chefAuth.user?.role}`);

    // 6. Driver Auth
    const driverLogin = await makeRequest('/driver/login', 'POST', {
      email: 'driver1@hotel.com',
      password: 'driver123'
    });
    const driverToken = driverLogin.body?.token;
    assert('Delivery Driver Login', driverLogin.status === 200 && Boolean(driverToken), `Driver ID: ${driverLogin.body?.driver?.id}`);

    // 7. Profile Verification (/auth/me)
    const meCheck = await makeRequest('/auth/me', 'GET', null, adminAuth.token);
    assert('Auth /me Profile Verification', meCheck.status === 200 && (meCheck.body?.data?.email === 'admin@hotel.com' || meCheck.body?.user?.email === 'admin@hotel.com'));

    // 8. Public Restaurants
    const pubRestaurants = await makeRequest('/restaurants/published');
    assert('Fetch Published Restaurants', pubRestaurants.status === 200 && Array.isArray(pubRestaurants.body?.restaurants || pubRestaurants.body?.data));

    const grandPalace = await makeRequest('/restaurants/grand-palace');
    assert('Fetch Grand Palace Profile', grandPalace.status === 200 && (grandPalace.body?.restaurant?.slug === 'grand-palace' || grandPalace.body?.data?.slug === 'grand-palace'));

    const categories = await makeRequest('/restaurants/grand-palace/categories');
    assert('Fetch Menu Categories', categories.status === 200 && Array.isArray(categories.body?.categories || categories.body?.data));

    const menu = await makeRequest('/restaurants/grand-palace/menu');
    assert('Fetch Menu Items', menu.status === 200 && (Array.isArray(menu.body?.items) || Array.isArray(menu.body?.menu) || Array.isArray(menu.body?.data)));

    // 9. Tables Management (KOT System)
    const tables = await makeRequest('/tables', 'GET', null, adminAuth.token);
    const tableList = tables.body?.data || tables.body?.tables || [];
    assert('Fetch Offline Tables', tables.status === 200 && Array.isArray(tableList), `Tables count: ${tableList.length}`);

    const nextTableNo = await makeRequest('/tables/next-number', 'GET', null, adminAuth.token);
    assert('Fetch Next Table Number', nextTableNo.status === 200);

    // 10. Active Orders & KOT Tickets
    const orders = await makeRequest('/orders', 'GET', null, adminAuth.token);
    assert('Fetch Dine-in / Offline Orders', orders.status === 200);

    const kots = await makeRequest('/kots', 'GET', null, chefAuth.token);
    assert('Fetch Kitchen KOT Tickets', kots.status === 200);

    // 11. Billing System
    const bills = await makeRequest('/billing', 'GET', null, adminAuth.token);
    assert('Fetch Billing Records', bills.status === 200);

    // 12. Recipe Inventory System
    const inventory = await makeRequest('/inventory/items', 'GET', null, adminAuth.token);
    assert('Fetch Inventory Items', inventory.status === 200);

    const recipes = await makeRequest('/inventory/recipes', 'GET', null, adminAuth.token);
    assert('Fetch Recipe Formulations', recipes.status === 200);

    const expiry = await makeRequest('/inventory/expiry-dashboard', 'GET', null, adminAuth.token);
    assert('Fetch Expiry Tracking Dashboard', expiry.status === 200);

    // 13. Reports & Intelligence
    const reportKpi = await makeRequest('/reports/dashboard-kpis', 'GET', null, adminAuth.token);
    assert('Fetch KOT Reports KPIs', reportKpi.status === 200);

    const salesReport = await makeRequest('/reports/sales', 'GET', null, adminAuth.token);
    assert('Fetch Sales Analytics Report', salesReport.status === 200);

    // 14. Operations Center
    const operations = await makeRequest('/operations/overview', 'GET', null, adminAuth.token);
    assert('Fetch Operations Center Live State', operations.status === 200);

    // 15. Audit Logs
    const auditLogs = await makeRequest('/audit-logs', 'GET', null, adminAuth.token);
    assert('Fetch System Audit Logs', auditLogs.status === 200);

    // 16. Admin Online Portal Endpoints
    const adminKPIs = await makeRequest('/admin/dashboard/kpis', 'GET', null, adminAuth.token);
    assert('Fetch Admin Portal Dashboard KPIs', adminKPIs.status === 200);

    const adminRest = await makeRequest('/admin/restaurant', 'GET', null, adminAuth.token);
    assert('Fetch Admin Restaurant Config', adminRest.status === 200);

    const adminStaff = await makeRequest('/admin/staff', 'GET', null, adminAuth.token);
    assert('Fetch Restaurant Staff List', adminStaff.status === 200);

    const adminDrivers = await makeRequest('/admin/drivers', 'GET', null, adminAuth.token);
    assert('Fetch Admin Drivers & Riders', adminDrivers.status === 200);

    const adminApplications = await makeRequest('/admin/rider-applications', 'GET', null, adminAuth.token);
    assert('Fetch Rider Onboarding Applications', adminApplications.status === 200);

    // 17. Super Admin Management Endpoints
    const saKPIs = await makeRequest('/superadmin/kpis', 'GET', null, saAuth.token);
    assert('Fetch Platform SuperAdmin KPIs', saKPIs.status === 200);

    const saRestaurants = await makeRequest('/superadmin/restaurants', 'GET', null, saAuth.token);
    assert('Fetch SuperAdmin All Restaurants', saRestaurants.status === 200);

    const saAdmins = await makeRequest('/superadmin/admins', 'GET', null, saAuth.token);
    assert('Fetch SuperAdmin Admins List', saAdmins.status === 200);

    const saDrivers = await makeRequest('/superadmin/drivers', 'GET', null, saAuth.token);
    assert('Fetch SuperAdmin Drivers List', saDrivers.status === 200);

    // 18. Driver Portal Features
    const driverProfile = await makeRequest('/driver/profile', 'GET', null, driverToken);
    assert('Fetch Driver Profile', driverProfile.status === 200);

    const driverOrders = await makeRequest('/driver/orders', 'GET', null, driverToken);
    assert('Fetch Driver Assigned Orders', driverOrders.status === 200);

    console.log('\n===============================================================');
    const passedCount = results.filter(r => r.status === 'PASSED').length;
    console.log(`📊 FINAL RESULT: ${passedCount}/${results.length} Tests Passed!`);
    console.log('===============================================================\n');

    if (passedCount === results.length) {
      console.log('🎉 ALL BACKEND API & BUSINESS LOGIC TESTS PASSED PERFECTLY!');
    } else {
      console.log('⚠️ Some tests failed. Please review output above.');
    }
  } catch (err) {
    console.error('Fatal test error:', err);
  }
}

runTestSuite();
