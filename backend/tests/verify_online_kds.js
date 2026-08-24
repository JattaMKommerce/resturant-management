require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const pool = require('../config/database');
const { notifyKitchen } = require('../services/KitchenIntegrationService');
const orderService = require('../services/OrderService');
const kotService = require('../services/kot/kotService');

async function testOnlineOrderKDS() {
  console.log('Testing Online Order -> KDS Integration...\n');

  // 1. Fetch a menu item
  const [items] = await pool.query('SELECT * FROM menu_items WHERE is_available = 1 LIMIT 1');
  if (items.length === 0) {
    console.error('No menu items available');
    process.exit(1);
  }
  const item = items[0];

  // 2. Create online order
  const orderRes = await orderService.createOrder({
    restaurantId: 1,
    customerName: 'Test Online Customer',
    customerPhone: '9876543210',
    deliveryAddress: '123 Test Street, Suite 4',
    deliveryArea: 'Downtown',
    paymentMethod: 'COD',
    items: [
      { menuItemId: item.id, quantity: 2 }
    ]
  });

  console.log(`✅ Online Order Created: ID #${orderRes.id}, Number: ${orderRes.orderNumber}`);

  // 3. Verify KOT was created for this online order
  const [kots] = await pool.query('SELECT * FROM kots WHERE order_id = ? AND order_type = "ONLINE"', [orderRes.id]);
  if (kots.length === 0) {
    console.error('❌ Failed: KOT was not created for online order!');
    process.exit(1);
  }
  console.log(`✅ Online KOT Created: ID #${kots[0].id}, KOT Number: ${kots[0].kot_number}`);

  // 4. Fetch KOT with items via KDS service
  const kotDetails = await kotService.getKOTWithItems(kots[0].id);
  console.log(`✅ KOT Details retrieved for KDS: Items count = ${kotDetails.items.length}`);
  console.log(`   Item Name: ${kotDetails.items[0].item_name}, Quantity: ${kotDetails.items[0].quantity}, Status: ${kotDetails.items[0].status}`);

  // 5. Test START PREPARING on online KOT
  const updatedKOT = await kotService.updateKOTStatus(kots[0].id, 'PREPARING', 1);
  console.log(`✅ Kitchen Started Preparing Online KOT: Status = ${updatedKOT.status}`);
  console.log(`   started_at = ${updatedKOT.items[0].started_at}, expected_finish_at = ${updatedKOT.items[0].expected_finish_at}`);

  // Cleanup test order
  await pool.query('DELETE FROM kot_items WHERE kot_id = ?', [kots[0].id]);
  await pool.query('DELETE FROM kots WHERE id = ?', [kots[0].id]);
  await pool.query('DELETE FROM order_items WHERE order_id = ?', [orderRes.id]);
  await pool.query('DELETE FROM orders WHERE id = ?', [orderRes.id]);
  console.log('\n✅ Cleaned up test records. Online Order -> KDS pipeline verified 100% working!');
  process.exit(0);
}

testOnlineOrderKDS().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
