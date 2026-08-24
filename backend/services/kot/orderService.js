const pool = require('../../config/database');
const crypto = require('crypto');
const { emitToRoom, broadcastEvent } = require('../../config/socket');
const kotService = require('./kotService');

async function createOrder(orderData, idempotencyKey = null) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const { qr_token, table_id, room_id, customer_name, customer_phone, order_type = 'DINE_IN', items = [], source = 'QR' } = orderData;

    if (!items || items.length === 0) {
      throw new Error('Order must contain at least one item');
    }

    // 1. Idempotency Check
    if (idempotencyKey) {
      const [existingIdempotent] = await connection.query(
        `SELECT id, order_number, total_amount, order_status FROM restaurant_orders WHERE idempotency_key = ?`,
        [idempotencyKey]
      );
      if (existingIdempotent.length > 0) {
        await connection.rollback();
        return { isDuplicate: true, order: existingIdempotent[0] };
      }
    }

    // 2. Table Validation (If Dine-In / QR)
    let validatedTableId = table_id || null;
    let tableNumber = null;

    if (qr_token) {
      const [tables] = await connection.query(
        `SELECT id, table_number, is_active, status, qr_status FROM restaurant_tables WHERE qr_token = ?`,
        [qr_token]
      );

      if (tables.length === 0) {
        throw new Error('Invalid QR code token. Table not found.');
      }
      const table = tables[0];
      if (!table.is_active || table.status === 'OUT_OF_SERVICE') {
        throw new Error('This table is out of service and cannot accept orders.');
      }
      if (table.qr_status !== 'ACTIVE') {
        throw new Error('QR ordering is currently disabled for this table.');
      }

      validatedTableId = table.id;
      tableNumber = table.table_number;
    } else if (table_id) {
      const [tables] = await connection.query(`SELECT table_number FROM restaurant_tables WHERE id = ?`, [table_id]);
      if (tables.length > 0) tableNumber = tables[0].table_number;
    }

    // 3. Backend Price & Item Validation
    let subtotal = 0;
    let totalTaxAmount = 0;
    const validatedItems = [];

    for (const rawItem of items) {
      const [dbItems] = await connection.query(
        `SELECT id, name, price, tax_percentage, is_available, is_active, kitchen_department_id, prep_time_minutes, batch_capacity 
         FROM menu_items 
         WHERE id = ?`,
        [rawItem.menu_item_id]
      );

      if (dbItems.length === 0) {
        throw new Error(`Menu item ID ${rawItem.menu_item_id} not found`);
      }

      const dbItem = dbItems[0];
      if (!dbItem.is_active || !dbItem.is_available) {
        throw new Error(`Menu item "${dbItem.name}" is currently unavailable`);
      }

      const qty = Math.max(1, parseInt(rawItem.quantity) || 1);
      const unitPrice = parseFloat(dbItem.price);
      let modifierTotalPrice = 0;
      const validatedModifiers = [];

      // Validate Modifiers
      if (rawItem.selected_options && Array.isArray(rawItem.selected_options)) {
        for (const optId of rawItem.selected_options) {
          const [opts] = await connection.query(
            `SELECT id, name, price_adjustment, is_available FROM modifier_options WHERE id = ?`,
            [optId]
          );
          if (opts.length > 0 && opts[0].is_available) {
            const priceAdj = parseFloat(opts[0].price_adjustment) || 0;
            modifierTotalPrice += priceAdj;
            validatedModifiers.push({
              option_name: opts[0].name,
              price_adjustment: priceAdj
            });
          }
        }
      }

      const itemUnitPriceWithModifiers = unitPrice + modifierTotalPrice;
      const itemSubtotal = itemUnitPriceWithModifiers * qty;
      const taxRate = parseFloat(dbItem.tax_percentage) || 5.0;
      const itemTax = (itemSubtotal * taxRate) / 100;

      subtotal += itemSubtotal;
      totalTaxAmount += itemTax;

      const prepTimeMins = dbItem.prep_time_minutes !== null && dbItem.prep_time_minutes !== undefined ? parseInt(dbItem.prep_time_minutes) : null;
      const batchCap = dbItem.batch_capacity !== null && dbItem.batch_capacity !== undefined ? parseInt(dbItem.batch_capacity) : null;
      const batches = (batchCap && batchCap > 0) ? Math.ceil(qty / batchCap) : null;
      const estimatedPrep = (batches && prepTimeMins && prepTimeMins > 0) ? (batches * prepTimeMins) : null;

      validatedItems.push({
        menu_item_id: dbItem.id,
        item_name: dbItem.name,
        unit_price: itemUnitPriceWithModifiers,
        quantity: qty,
        tax_amount: itemTax,
        total_price: itemSubtotal + itemTax,
        special_instructions: rawItem.special_instructions || '',
        kitchen_department_id: dbItem.kitchen_department_id,
        prep_time_minutes: prepTimeMins,
        batch_capacity: batchCap,
        number_of_batches: batches,
        estimated_prep_time_minutes: estimatedPrep,
        modifiers: validatedModifiers
      });
    }

    const serviceCharge = 0.00;
    const discountAmount = 0.00;
    const grandTotal = subtotal + totalTaxAmount + serviceCharge - discountAmount;

    // 4. Generate Order Number
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const orderNumber = `ORD-${dateStr}-${randomSuffix}`;

    // 5. Insert Restaurant Order
    const [orderResult] = await connection.query(
      `INSERT INTO restaurant_orders 
        (order_number, table_id, room_id, customer_name, customer_phone, order_type, order_status, subtotal, discount_amount, tax_amount, service_charge, total_amount, payment_status, source, idempotency_key)
       VALUES (?, ?, ?, ?, ?, ?, 'CONFIRMED', ?, ?, ?, ?, ?, 'UNPAID', ?, ?)`,
      [
        orderNumber,
        validatedTableId,
        room_id || null,
        customer_name || 'Guest',
        customer_phone || null,
        order_type,
        subtotal,
        discountAmount,
        totalTaxAmount,
        serviceCharge,
        grandTotal,
        source,
        idempotencyKey || null
      ]
    );

    const orderId = orderResult.insertId;

    // 6. Insert Order Items & Modifiers
    for (const vItem of validatedItems) {
      const [orderItemResult] = await connection.query(
        `INSERT INTO order_items 
          (order_id, menu_item_id, item_name, unit_price, quantity, tax_amount, item_total, special_instructions, kitchen_department_id, prep_time_minutes, batch_capacity, number_of_batches, estimated_prep_time_minutes, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
        [
          orderId,
          vItem.menu_item_id,
          vItem.item_name,
          vItem.unit_price,
          vItem.quantity,
          vItem.tax_amount,
          vItem.total_price, // value mapped to item_total column
          vItem.special_instructions,
          vItem.kitchen_department_id,
          vItem.prep_time_minutes,
          vItem.batch_capacity,
          vItem.number_of_batches,
          vItem.estimated_prep_time_minutes
        ]
      );

      const orderItemId = orderItemResult.insertId;
      vItem.order_item_id = orderItemId;

      for (const mod of vItem.modifiers) {
        await connection.query(
          `INSERT INTO order_item_modifiers (order_item_id, option_name, price_adjustment) VALUES (?, ?, ?)`,
          [orderItemId, mod.option_name, mod.price_adjustment]
        );
      }
    }

    // 7. Update Table Lifecycle State to OCCUPIED
    if (validatedTableId) {
      await connection.query(`UPDATE restaurant_tables SET status = 'OCCUPIED' WHERE id = ?`, [validatedTableId]);
    }

    // 8. AUTOMATIC KOT SPLITTING BY KITCHEN DEPARTMENT
    const itemsByDept = {};
    for (const vItem of validatedItems) {
      const deptId = vItem.kitchen_department_id ? parseInt(vItem.kitchen_department_id) : 1;
      if (!itemsByDept[deptId]) {
        itemsByDept[deptId] = [];
      }
      itemsByDept[deptId].push(vItem);
    }

    const createdKOTs = [];
    const deptKeys = Object.keys(itemsByDept);
    let deptLetterCode = 65; // 'A'

    for (const deptIdStr of deptKeys) {
      const deptId = parseInt(deptIdStr) || 1;
      const deptItems = itemsByDept[deptIdStr] || [];
      if (deptItems.length === 0) continue;

      // Calculate initial KOT target completion estimate (for planning only, timer starts at START PREPARING)
      const validEstimates = deptItems.map(i => i.estimated_prep_time_minutes).filter(t => t && t > 0);
      const maxPrepMinutes = validEstimates.length > 0 ? Math.max(...validEstimates) : 15;
      const receivedAt = new Date();
      const targetAt = new Date(receivedAt.getTime() + maxPrepMinutes * 60000);

      const letter = String.fromCharCode(deptLetterCode++);
      const kotNumber = `KOT-${dateStr}-${randomSuffix}-${letter}`;

      let kotResult;
      try {
        [kotResult] = await connection.query(
          `INSERT INTO kots 
            (kot_number, order_id, table_id, room_id, kitchen_department_id, order_type, status, kitchen_received_at, target_completion_at, restaurant_id)
           VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?)`,
          [kotNumber, orderId, validatedTableId, room_id || null, deptId, order_type, receivedAt, targetAt, 1]
        );
      } catch (insertKotErr) {
        if (insertKotErr.message && insertKotErr.message.includes('restaurant_id')) {
          [kotResult] = await connection.query(
            `INSERT INTO kots 
              (kot_number, order_id, table_id, room_id, kitchen_department_id, order_type, status, kitchen_received_at, target_completion_at)
             VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?, ?)`,
            [kotNumber, orderId, validatedTableId, room_id || null, deptId, order_type, receivedAt, targetAt]
          );
        } else {
          throw insertKotErr;
        }
      }

      const kotId = kotResult.insertId;

      for (const dItem of deptItems) {
        await connection.query(
          `INSERT INTO kot_items (kot_id, order_item_id, item_name, quantity, special_instructions, modifiers_json, status, prep_time_minutes, batch_capacity, number_of_batches, estimated_prep_time_minutes)
           VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, ?)`,
          [
            kotId,
            dItem.order_item_id,
            dItem.item_name,
            dItem.quantity,
            dItem.special_instructions,
            JSON.stringify(dItem.modifiers),
            dItem.prep_time_minutes,
            dItem.batch_capacity,
            dItem.number_of_batches,
            dItem.estimated_prep_time_minutes
          ]
        );
      }

      // KOT Status History Audit
      await connection.query(
        `INSERT INTO kot_status_history (kot_id, old_status, new_status, reason) VALUES (?, NULL, 'PENDING', 'Automatic KOT Generation')`,
        [kotId]
      );

      createdKOTs.push({
        id: kotId,
        kot_id: kotId,
        kot_number: kotNumber,
        kitchen_department_id: deptId,
        items_count: deptItems.length,
        target_completion_at: targetAt
      });
    }

    await connection.commit();

    // Fetch full KOT objects with items
    const fullCreatedKOTs = [];
    for (const k of createdKOTs) {
      const fullKOT = await kotService.getKOTWithItems(k.kot_id, pool);
      if (fullKOT) {
        fullCreatedKOTs.push(fullKOT);
      } else {
        fullCreatedKOTs.push(k);
      }
    }

    // 9. Emit Real-time Socket.IO Events & Save Notification
    const createdOrderPayload = {
      id: orderId,
      order_number: orderNumber,
      table_id: validatedTableId,
      table_number: tableNumber,
      total_amount: grandTotal,
      order_status: 'CONFIRMED',
      kots: fullCreatedKOTs
    };

    emitToRoom('kitchen', 'new_kot', createdOrderPayload);
    emitToRoom('waiter', 'new_order', createdOrderPayload);
    emitToRoom('admin', 'new_order', createdOrderPayload);
    if (validatedTableId) {
      broadcastEvent('table_status_changed', { table_id: validatedTableId, status: 'OCCUPIED' });
    }

    // Save notification for Hotel Admin notification center
    try {
      const notificationService = require('../NotificationService');
      const tableLabel = tableNumber ? `Table ${tableNumber}` : (room_id ? `Room ${room_id}` : (order_type || 'Dine-In'));
      await notificationService.sendNotification({
        restaurantId: orderData.restaurant_id || 1,
        orderId: null,
        title: `🍽️ New KOT Order! #${orderNumber}`,
        message: `${tableLabel} — ₹${grandTotal.toFixed(2)} (${validatedItems.length} items)`,
        type: 'ORDER_UPDATE'
      });
    } catch (notifErr) {
      console.warn('Could not record KOT notification:', notifErr.message);
    }

    return {
      isDuplicate: false,
      order: createdOrderPayload
    };

  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

module.exports = {
  createOrder
};
