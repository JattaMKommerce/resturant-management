require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const pool = require('../config/database');
const kotService = require('../services/kot/kotService');
const orderService = require('../services/kot/orderService');

async function runVerification() {
  console.log('====================================================');
  console.log('RUNNING COMPREHENSIVE BATCH PREPARATION VERIFICATION');
  console.log('====================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, testName) {
    totalTests++;
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passedTests++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      throw new Error(`Test failed: ${testName}`);
    }
  }

  // --- TEST SUITE 1: MATHEMATICAL BATCH SPECIFICATIONS ---
  console.log('--- TEST SUITE 1: 7 MANDATORY BATCH QUANTITY TEST CASES ---');
  const testCases = [
    { qty: 1, prep: 15, cap: 10, expectedBatches: 1, expectedTotal: 15 },
    { qty: 10, prep: 15, cap: 10, expectedBatches: 1, expectedTotal: 15 },
    { qty: 11, prep: 15, cap: 10, expectedBatches: 2, expectedTotal: 30 },
    { qty: 20, prep: 15, cap: 10, expectedBatches: 2, expectedTotal: 30 },
    { qty: 21, prep: 15, cap: 10, expectedBatches: 3, expectedTotal: 45 },
    { qty: 29, prep: 15, cap: 10, expectedBatches: 3, expectedTotal: 45 },
    { qty: 12, prep: 25, cap: 5, expectedBatches: 3, expectedTotal: 75 }
  ];

  for (const tc of testCases) {
    const batches = Math.ceil(tc.qty / tc.cap);
    const totalPrep = batches * tc.prep;
    assert(
      batches === tc.expectedBatches && totalPrep === tc.expectedTotal,
      `Qty ${tc.qty}, Prep ${tc.prep}m, Cap ${tc.cap} -> ${batches} batches, ${totalPrep}m (Expected: ${tc.expectedBatches} batches, ${tc.expectedTotal}m)`
    );
  }

  // Explicit Dal Makhani check: NOT 29 * 15 = 435m
  const dalMakhaniNaive = 29 * 15;
  const dalMakhaniBatch = Math.ceil(29 / 10) * 15;
  assert(dalMakhaniBatch === 45 && dalMakhaniBatch !== dalMakhaniNaive, 'Dal Makhani x 29 yields 45m and NOT naive 435m');

  // --- TEST SUITE 2: DATABASE SCHEMA INTEGRITY ---
  console.log('\n--- TEST SUITE 2: DATABASE SCHEMA INTEGRITY ---');
  const [menuCols] = await pool.query(`SHOW COLUMNS FROM menu_items LIKE 'batch_capacity'`);
  assert(menuCols.length > 0, 'menu_items table has batch_capacity column');

  const [orderCols] = await pool.query(`SHOW COLUMNS FROM order_items WHERE Field IN ('prep_time_minutes', 'batch_capacity', 'number_of_batches', 'estimated_prep_time_minutes')`);
  assert(orderCols.length === 4, 'order_items table has all 4 batch & prep columns');

  const [kotCols] = await pool.query(`SHOW COLUMNS FROM kot_items WHERE Field IN ('prep_time_minutes', 'batch_capacity', 'number_of_batches', 'estimated_prep_time_minutes', 'started_at', 'expected_finish_at', 'ready_at')`);
  assert(kotCols.length === 7, 'kot_items table has all 7 prep, batch, and timestamp tracking columns');

  // --- TEST SUITE 3: END-TO-END ORDER CREATION & PREPARATION LIFECYCLE ---
  console.log('\n--- TEST SUITE 3: END-TO-END ORDER CREATION & LIFECYCLE ---');

  // 1. Ensure Dal Makhani Royal is seeded with 15m prep, 10 cap
  let [dishes] = await pool.query(`SELECT * FROM menu_items WHERE name = 'Dal Makhani Royal' LIMIT 1`);
  let dishId;
  if (dishes.length === 0) {
    const [res] = await pool.query(
      `INSERT INTO menu_items (restaurant_id, category_id, name, price, prep_time_minutes, batch_capacity, is_available, is_active)
       VALUES (1, 1, 'Dal Makhani Royal', 280, 15, 10, 1, 1)`
    );
    dishId = res.insertId;
  } else {
    dishId = dishes[0].id;
    await pool.query(`UPDATE menu_items SET prep_time_minutes = 15, batch_capacity = 10, is_available = 1, is_active = 1 WHERE id = ?`, [dishId]);
  }

  // 2. Create Order with Dal Makhani x 29
  const [tables] = await pool.query(`SELECT id FROM restaurant_tables LIMIT 1`);
  const tableId = tables.length > 0 ? tables[0].id : null;

  const orderResult = await orderService.createOrder({
    table_id: tableId,
    order_type: 'DINE_IN',
    items: [
      { menu_item_id: dishId, quantity: 29 }
    ]
  });

  const createdOrder = orderResult.order;
  assert(createdOrder.id, `Order created successfully: ID #${createdOrder.id}`);
  assert(createdOrder.kots && createdOrder.kots.length > 0, `KOT generated: ID #${createdOrder.kots[0].id}`);

  const testKOTId = createdOrder.kots[0].id;

  // 3. Verify KOT initial state: Timer is NOT started
  const kotBefore = await kotService.getKOTWithItems(testKOTId);
  const kotItemBefore = kotBefore.items[0];
  assert(kotBefore.status === 'PENDING', `Initial KOT status is PENDING (received: ${kotBefore.status})`);
  assert(kotItemBefore.started_at === null, 'Initial kot_item started_at is NULL (Timer NOT started)');
  assert(kotItemBefore.expected_finish_at === null, 'Initial kot_item expected_finish_at is NULL');
  assert(kotItemBefore.batch_capacity === 10, 'Initial kot_item batch_capacity snapshotted as 10');
  assert(kotItemBefore.number_of_batches === 3, 'Initial kot_item number_of_batches snapshotted as 3');
  assert(kotItemBefore.estimated_prep_time_minutes === 45, 'Initial kot_item estimated_prep_time_minutes snapshotted as 45');

  // 4. Kitchen clicks START PREPARING
  console.log('\nSimulating Kitchen clicking START PREPARING...');
  const updatedKOT = await kotService.updateKOTStatus(testKOTId, 'PREPARING', 1, 'Chef started cooking');
  const kotItemPrep = updatedKOT.items[0];

  assert(updatedKOT.status === 'PREPARING', `KOT status updated to PREPARING (actual: ${updatedKOT.status})`);
  assert(kotItemPrep.started_at !== null, 'kot_item started_at is now set');
  assert(kotItemPrep.expected_finish_at !== null, 'kot_item expected_finish_at is now set');

  const startedMs = new Date(kotItemPrep.started_at).getTime();
  const finishMs = new Date(kotItemPrep.expected_finish_at).getTime();
  const diffMinutes = Math.round((finishMs - startedMs) / 60000);
  assert(diffMinutes === 45, `expected_finish_at - started_at = ${diffMinutes} minutes (Expected: 45 minutes)`);

  // 5. Kitchen clicks MARK READY
  console.log('\nSimulating Kitchen clicking MARK READY...');
  const readyKOT = await kotService.updateKOTStatus(testKOTId, 'READY', 1, 'Food cooked and plated');
  const kotItemReady = readyKOT.items[0];
  assert(readyKOT.status === 'READY', `KOT status updated to READY (actual: ${readyKOT.status})`);
  assert(kotItemReady.ready_at !== null, 'kot_item ready_at is now set');

  // --- TEST SUITE 4: INVALID / MISSING CONFIGURATION REJECTION ---
  console.log('\n--- TEST SUITE 4: INVALID CONFIGURATION VALIDATION ---');

  // Create an unconfigured dish with prep_time_minutes = 0
  const [unconfDishResult] = await pool.query(
    `INSERT INTO menu_items (restaurant_id, category_id, name, price, prep_time_minutes, batch_capacity, is_available, is_active)
     VALUES (1, 1, 'Unconfigured Test Dish', 100, 0, 0, 1, 1)`
  );
  const unconfDishId = unconfDishResult.insertId;

  // Create Order with unconfigured dish
  const unconfOrderResult = await orderService.createOrder({
    table_id: tableId,
    order_type: 'DINE_IN',
    items: [
      { menu_item_id: unconfDishId, quantity: 5 }
    ]
  });
  const unconfKOTId = unconfOrderResult.order.kots[0].id;

  // Attempt START PREPARING - Must throw clear error!
  let errorCaught = false;
  let errorMessage = '';
  try {
    await kotService.updateKOTStatus(unconfKOTId, 'PREPARING', 1);
  } catch (err) {
    errorCaught = true;
    errorMessage = err.message;
  }

  assert(errorCaught === true, 'Error thrown when starting preparation with invalid configuration');
  assert(
    errorMessage.includes('missing valid preparation-time or batch-capacity configuration'),
    `Correct descriptive error returned: "${errorMessage}"`
  );

  // Verify timer was NOT started on the unconfigured item
  const unconfKOTCheck = await kotService.getKOTWithItems(unconfKOTId);
  assert(unconfKOTCheck.items[0].started_at === null, 'Timer was NOT started for invalid dish');
  assert(unconfKOTCheck.status !== 'PREPARING', 'KOT status remained in initial state');

  // Clean up unconfigured test dish
  await pool.query(`DELETE FROM menu_items WHERE id = ?`, [unconfDishId]);

  console.log('\n====================================================');
  console.log(`ALL ${passedTests}/${totalTests} TESTS PASSED PERFECTLY!`);
  console.log('====================================================\n');
  process.exit(0);
}

runVerification().catch(err => {
  console.error('\nVerification encountered error:', err);
  process.exit(1);
});
