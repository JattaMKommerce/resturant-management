/**
 * KitchenIntegrationService.js
 * Integration boundary for Kitchen Display System (KDS).
 * When online orders transition to SENT_TO_KITCHEN or ACCEPTED, this service creates KOTs and dispatches socket events.
 */

const pool = require('../config/database');
const { emitToRoom, broadcastEvent } = require('../config/socket');

async function notifyKitchen(orderData) {
  console.log(`[KITCHEN INTEGRATION] 🍳 Online Order #${orderData.order_number} sent to Kitchen KDS.`);

  try {
    const orderId = orderData.id;
    if (!orderId) return { success: false, message: 'Invalid order data' };

    // Check if KOT already created for this online order
    const [existingKots] = await pool.query(
      `SELECT id, kot_number FROM kots WHERE order_id = ? AND order_type = 'ONLINE'`,
      [orderId]
    );

    if (existingKots.length > 0) {
      console.log(`[KITCHEN INTEGRATION] KOT #${existingKots[0].kot_number} already active for online order #${orderId}`);
      return { success: true, kotId: existingKots[0].id, kotNumber: existingKots[0].kot_number };
    }

    // Query actual inserted order items for this order to ensure valid order_item_id references
    const [dbItems] = await pool.query(`SELECT * FROM order_items WHERE order_id = ?`, [orderId]);
    const itemsToProcess = dbItems.length > 0 ? dbItems : (orderData.items || []);

    // Resolve default kitchen department
    const [departments] = await pool.query(`SELECT id FROM kitchen_departments ORDER BY id ASC LIMIT 1`);
    const defaultDeptId = departments.length > 0 ? departments[0].id : 1;

    // Extract last 5 digits of order_number for clean display
    const rawOrderNum = String(orderData.order_number || '');
    const cleanDigits = rawOrderNum.replace(/\D/g, '');
    const last5 = cleanDigits.length >= 5 ? cleanDigits.slice(-5) : rawOrderNum.slice(-5) || String(orderId).padStart(5, '0');
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const kotNumber = `KOT-ONL-${last5}`;

    const receivedAt = new Date();
    const maxPrepMinutes = 20;
    const targetAt = new Date(receivedAt.getTime() + maxPrepMinutes * 60000);

    const [kotResult] = await pool.query(
      `INSERT INTO kots 
        (kot_number, order_id, table_id, room_id, kitchen_department_id, order_type, status, kitchen_received_at, target_completion_at, restaurant_id)
       VALUES (?, ?, NULL, NULL, ?, 'ONLINE', 'PENDING', ?, ?, ?)`,
      [kotNumber, orderId, defaultDeptId, receivedAt, targetAt, orderData.restaurant_id || 1]
    );

    const kotId = kotResult.insertId;

    for (const item of itemsToProcess) {
      await pool.query(
        `INSERT INTO kot_items 
          (kot_id, order_item_id, item_name, quantity, special_instructions, modifiers_json, status, prep_time_minutes)
         VALUES (?, ?, ?, ?, ?, '[]', 'PENDING', ?)`,
        [
          kotId,
          item.id || null,
          item.item_name || item.name || 'Food Item',
          item.quantity || 1,
          item.special_instructions || item.specialInstructions || null,
          item.prep_time_minutes || 15
        ]
      );
    }

    // Insert status history
    try {
      await pool.query(
        `INSERT INTO kot_status_history (kot_id, old_status, new_status, reason) VALUES (?, NULL, 'PENDING', 'Online Order Sent to Kitchen')`,
        [kotId]
      );
    } catch (e) {}

    // Broadcast new_kot to kitchen via socket
    try {
      emitToRoom('kitchen', 'new_kot', {
        kot_id: kotId,
        kot_number: kotNumber,
        order_id: orderId,
        order_number: orderData.order_number,
        order_type: 'ONLINE',
        last5
      });
      broadcastEvent('new_kot', {
        kot_id: kotId,
        kot_number: kotNumber,
        order_id: orderId,
        order_number: orderData.order_number,
        order_type: 'ONLINE',
        last5
      });
    } catch (e) {
      console.error('Socket broadcast error on new_kot:', e);
    }

    console.log(`[KITCHEN INTEGRATION] ✅ Created KOT #${kotNumber} (ID: ${kotId}) for Online Order #${orderData.order_number}`);

    return {
      success: true,
      kotId,
      kotNumber,
      status: 'SENT_TO_KITCHEN'
    };
  } catch (err) {
    console.error('Error creating KOT for online order:', err);
    return { success: false, error: err.message };
  }
}

module.exports = {
  notifyKitchen
};
