const pool = require('../../config/database');
const { emitToRoom, broadcastEvent } = require('../../config/socket');
const inventoryService = require('./inventoryService');

async function getKOTWithItems(kotId, existingConnection = null) {
  const connection = existingConnection || pool;
  const [kots] = await connection.query(
    `SELECT k.*, kd.name as kitchen_department_name, kd.code as kitchen_department_code, 
            t.table_number, t.table_name, t.floor, r.room_number, o.order_number
     FROM kots k
     JOIN kitchen_departments kd ON k.kitchen_department_id = kd.id
     LEFT JOIN restaurant_tables t ON k.table_id = t.id
     LEFT JOIN rooms r ON k.room_id = r.id
     LEFT JOIN restaurant_orders o ON k.order_id = o.id
     WHERE k.id = ?`,
    [kotId]
  );

  if (kots.length === 0) return null;
  const kot = kots[0];

  const [items] = await connection.query(
    `SELECT ki.*, oi.unit_price, COALESCE(oi.item_total, oi.unit_price * oi.quantity) as total_price, COALESCE(NULLIF(ki.item_name, ''), oi.item_name, m.name, 'Food Item') as item_name
     FROM kot_items ki
     LEFT JOIN order_items oi ON ki.order_item_id = oi.id
     LEFT JOIN menu_items m ON oi.menu_item_id = m.id
     WHERE ki.kot_id = ?`,
    [kot.id]
  );

  for (let item of items) {
    if (typeof item.modifiers_json === 'string') {
      try {
        item.modifiers = JSON.parse(item.modifiers_json);
      } catch (e) {
        item.modifiers = [];
      }
    } else {
      item.modifiers = item.modifiers_json || [];
    }
  }

  kot.items = items;
  return kot;
}

async function resolveAndValidateItemPrepConfig(item, connection) {
  let prepTimeMins = item.prep_time_minutes;
  let batchCap = item.batch_capacity;

  // If missing or invalid on kot_items, try resolving from order_items / menu_items
  if ((!prepTimeMins || prepTimeMins <= 0 || !batchCap || batchCap <= 0) && item.order_item_id) {
    const [oiRows] = await connection.query(
      `SELECT oi.menu_item_id, oi.prep_time_minutes as oi_prep, oi.batch_capacity as oi_cap,
              m.prep_time_minutes as m_prep, m.batch_capacity as m_cap
       FROM order_items oi
       LEFT JOIN menu_items m ON oi.menu_item_id = m.id
       WHERE oi.id = ?`,
      [item.order_item_id]
    );
    if (oiRows.length > 0) {
      if (!prepTimeMins || prepTimeMins <= 0) {
        prepTimeMins = oiRows[0].oi_prep || oiRows[0].m_prep;
      }
      if (!batchCap || batchCap <= 0) {
        batchCap = oiRows[0].oi_cap || oiRows[0].m_cap;
      }
    }
  }

  const parsedPrep = parseInt(prepTimeMins);
  const parsedCap = parseInt(batchCap);

  if (isNaN(parsedPrep) || parsedPrep <= 0 || isNaN(parsedCap) || parsedCap <= 0) {
    throw new Error(
      `Menu item "${item.item_name}" is missing valid preparation-time or batch-capacity configuration. Please configure it in Admin Menu Management before starting preparation.`
    );
  }

  const quantity = Math.max(1, parseInt(item.quantity) || 1);
  const numberOfBatches = Math.ceil(quantity / parsedCap);
  const estimatedPrepTimeMinutes = numberOfBatches * parsedPrep;

  return {
    prepTimeMinutes: parsedPrep,
    batchCapacity: parsedCap,
    numberOfBatches,
    estimatedPrepTimeMinutes
  };
}

async function updateKOTStatus(kotId, newStatus, userId = null, reason = '') {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [kots] = await connection.query(`SELECT * FROM kots WHERE id = ?`, [kotId]);
    if (kots.length === 0) {
      throw new Error('KOT not found');
    }

    const kot = kots[0];
    const oldStatus = kot.status;

    let completedAt = kot.completed_at;
    if (newStatus === 'READY' || newStatus === 'SERVED') {
      completedAt = new Date();
    }

    // Update KOT table
    await connection.query(
      `UPDATE kots SET status = ?, completed_at = ? WHERE id = ?`,
      [newStatus, completedAt, kotId]
    );

    // Update KOT items based on new status
    if (newStatus === 'PREPARING') {
      const [kotItems] = await connection.query(
        `SELECT * FROM kot_items WHERE kot_id = ? AND status != 'CANCELLED'`,
        [kotId]
      );

      for (const item of kotItems) {
        if (!item.started_at) {
          const config = await resolveAndValidateItemPrepConfig(item, connection);
          const startTime = new Date();
          const expectedTime = new Date(startTime.getTime() + config.estimatedPrepTimeMinutes * 60000);

          await connection.query(
            `UPDATE kot_items 
             SET status = ?, 
                 started_at = ?,
                 expected_finish_at = ?,
                 prep_time_minutes = ?,
                 batch_capacity = ?,
                 number_of_batches = ?,
                 estimated_prep_time_minutes = ?
             WHERE id = ?`,
            [
              newStatus,
              startTime,
              expectedTime,
              config.prepTimeMinutes,
              config.batchCapacity,
              config.numberOfBatches,
              config.estimatedPrepTimeMinutes,
              item.id
            ]
          );
        } else {
          await connection.query(
            `UPDATE kot_items SET status = ? WHERE id = ?`,
            [newStatus, item.id]
          );
        }
      }
    } else if (newStatus === 'READY' || newStatus === 'SERVED') {
      await connection.query(
        `UPDATE kot_items 
         SET status = ?,
             started_at = COALESCE(started_at, NOW()),
             ready_at = COALESCE(ready_at, NOW())
         WHERE kot_id = ?`,
        [newStatus, kotId]
      );

      // Perform item-level inventory deduction for all items in this KOT
      const [kotItems] = await connection.query(`SELECT id FROM kot_items WHERE kot_id = ? AND status != 'CANCELLED'`, [kotId]);
      for (const item of kotItems) {
        await inventoryService.deductStockForKOTItem(item.id, connection);
      }
    } else {
      await connection.query(`UPDATE kot_items SET status = ? WHERE kot_id = ?`, [newStatus, kotId]);
    }

    // Update corresponding order items status
    await connection.query(
      `UPDATE order_items 
       SET status = ? 
       WHERE id IN (SELECT order_item_id FROM kot_items WHERE kot_id = ?)`,
      [newStatus, kotId]
    );

    // Sync online order status if this is an online order
    if (kot.order_id) {
      try {
        if (newStatus === 'PREPARING') {
          await connection.query(
            `UPDATE orders SET order_status = 'PREPARING' WHERE id = ? AND order_status IN ('PENDING', 'ACCEPTED', 'SENT_TO_KITCHEN')`,
            [kot.order_id]
          );
        } else if (newStatus === 'READY') {
          await connection.query(
            `UPDATE orders SET order_status = 'READY_FOR_PICKUP' WHERE id = ? AND order_status NOT IN ('DELIVERED', 'CANCELLED', 'OUT_FOR_DELIVERY', 'PICKED_UP')`,
            [kot.order_id]
          );
        }
      } catch (e) {
        console.error('Failed to sync online order status from KOT:', e);
      }
    }

    // Record KOT Status History Audit
    await connection.query(
      `INSERT INTO kot_status_history (kot_id, old_status, new_status, changed_by_user_id, reason)
       VALUES (?, ?, ?, ?, ?)`,
      [kotId, oldStatus, newStatus, userId, reason || 'Status transition']
    );

    let overallOrderStatus = newStatus;

    // Update restaurant_orders status if offline order
    if (kot.order_id && kot.order_type !== 'ONLINE') {
      try {
        const [allKots] = await connection.query(`SELECT status FROM kots WHERE order_id = ?`, [kot.order_id]);
        const statuses = allKots.map(k => k.status);

        overallOrderStatus = 'IN_KITCHEN';
        if (statuses.every(s => s === 'SERVED' || s === 'CANCELLED')) {
          overallOrderStatus = 'SERVED';
        } else if (statuses.every(s => s === 'READY' || s === 'SERVED' || s === 'CANCELLED')) {
          overallOrderStatus = 'READY';
        } else if (statuses.some(s => s === 'PREPARING' || s === 'ACCEPTED')) {
          overallOrderStatus = 'IN_KITCHEN';
        }

        await connection.query(`UPDATE restaurant_orders SET order_status = ? WHERE id = ?`, [overallOrderStatus, kot.order_id]);
      } catch (e) {}
    }

    await connection.commit();

    // Fetch updated KOT details WITH items for real-time broadcast
    const updatedKOT = await getKOTWithItems(kotId);

    // Socket.IO Broadcasts
    if (updatedKOT) {
      emitToRoom('kitchen', 'kot_updated', updatedKOT);
      emitToRoom('waiter', 'kot_updated', updatedKOT);
      emitToRoom('admin', 'kot_updated', updatedKOT);
    }
    emitToRoom(`customer_${kot.order_id}`, 'order_updated', { order_id: kot.order_id, status: overallOrderStatus });

    if (newStatus === 'READY') {
      emitToRoom('waiter', 'order_ready', {
        kot_id: kotId,
        kot_number: kot.kot_number,
        order_id: kot.order_id,
        table_number: updatedKOT ? updatedKOT.table_number : null,
        kitchen_department_name: updatedKOT ? updatedKOT.kitchen_department_name : null
      });
    } else if (newStatus === 'SERVED') {
      emitToRoom('waiter', 'order_served', { kot_id: kotId, order_id: kot.order_id });
    }

    return updatedKOT;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

async function updateKOTItemStatus(itemId, newStatus, userId = null) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [items] = await connection.query(`SELECT * FROM kot_items WHERE id = ?`, [itemId]);
    if (items.length === 0) {
      throw new Error('KOT item not found');
    }

    const item = items[0];

    // Idempotency check: if status is unchanged, return existing item
    if (item.status === newStatus) {
      await connection.rollback();
      return item;
    }

    let startedAt = item.started_at;
    let expectedFinishAt = item.expected_finish_at;
    let readyAt = item.ready_at;
    let config = null;

    if (newStatus === 'PREPARING') {
      if (!startedAt) {
        config = await resolveAndValidateItemPrepConfig(item, connection);
        startedAt = new Date();
        expectedFinishAt = new Date(startedAt.getTime() + config.estimatedPrepTimeMinutes * 60000);
      }
    } else if (newStatus === 'READY' || newStatus === 'SERVED') {
      if (!startedAt) {
        startedAt = new Date();
      }
      if (!readyAt) {
        readyAt = new Date();
      }

      // ITEM-LEVEL INVENTORY DEDUCTION ON READY
      if (newStatus === 'READY') {
        await inventoryService.deductStockForKOTItem(itemId, connection);
      }
    }

    if (config) {
      await connection.query(
        `UPDATE kot_items 
         SET status = ?, 
             started_at = ?, 
             expected_finish_at = ?, 
             ready_at = ?,
             prep_time_minutes = ?,
             batch_capacity = ?,
             number_of_batches = ?,
             estimated_prep_time_minutes = ? 
         WHERE id = ?`,
        [
          newStatus,
          startedAt,
          expectedFinishAt,
          readyAt,
          config.prepTimeMinutes,
          config.batchCapacity,
          config.numberOfBatches,
          config.estimatedPrepTimeMinutes,
          itemId
        ]
      );
    } else {
      await connection.query(
        `UPDATE kot_items 
         SET status = ?, started_at = ?, expected_finish_at = ?, ready_at = ? 
         WHERE id = ?`,
        [newStatus, startedAt, expectedFinishAt, readyAt, itemId]
      );
    }

    // Update corresponding order item status
    await connection.query(`UPDATE order_items SET status = ? WHERE id = ?`, [newStatus, item.order_item_id]);

    // Check parent KOT items status to evaluate parent KOT transition
    const [kotItems] = await connection.query(`SELECT status FROM kot_items WHERE kot_id = ?`, [item.kot_id]);
    const itemStatuses = kotItems.map(i => i.status);

    let newKOTStatus = null;
    if (itemStatuses.every(s => s === 'SERVED' || s === 'CANCELLED')) {
      newKOTStatus = 'SERVED';
    } else if (itemStatuses.every(s => s === 'READY' || s === 'SERVED' || s === 'CANCELLED')) {
      newKOTStatus = 'READY';
    } else if (itemStatuses.some(s => s === 'PREPARING' || s === 'READY')) {
      newKOTStatus = 'PREPARING';
    }

    if (newKOTStatus) {
      const [kotRows] = await connection.query(`SELECT status FROM kots WHERE id = ?`, [item.kot_id]);
      if (kotRows.length > 0 && kotRows[0].status !== newKOTStatus) {
        let completedAt = (newKOTStatus === 'READY' || newKOTStatus === 'SERVED') ? new Date() : null;
        await connection.query(
          `UPDATE kots SET status = ?, completed_at = COALESCE(completed_at, ?) WHERE id = ?`,
          [newKOTStatus, completedAt, item.kot_id]
        );
      }
    }

    // Check overall order status
    const [kotRows] = await connection.query(`SELECT order_id FROM kots WHERE id = ?`, [item.kot_id]);
    if (kotRows.length > 0) {
      const orderId = kotRows[0].order_id;
      const [allKots] = await connection.query(`SELECT status FROM kots WHERE order_id = ?`, [orderId]);
      const allStatuses = allKots.map(k => k.status);

      let overallOrderStatus = 'IN_KITCHEN';
      if (allStatuses.every(s => s === 'SERVED' || s === 'CANCELLED')) {
        overallOrderStatus = 'SERVED';
      } else if (allStatuses.every(s => s === 'READY' || s === 'SERVED' || s === 'CANCELLED')) {
        overallOrderStatus = 'READY';
      } else if (allStatuses.some(s => s === 'PREPARING' || s === 'ACCEPTED')) {
        overallOrderStatus = 'IN_KITCHEN';
      }

      await connection.query(`UPDATE restaurant_orders SET order_status = ? WHERE id = ?`, [overallOrderStatus, orderId]);
    }

    await connection.commit();

    // Fetch updated KOT details WITH items for Socket.IO broadcast
    const updatedKOT = await getKOTWithItems(item.kot_id);

    if (updatedKOT) {
      emitToRoom('kitchen', 'kot_updated', updatedKOT);
      emitToRoom('waiter', 'kot_updated', updatedKOT);
      emitToRoom('admin', 'kot_updated', updatedKOT);
      emitToRoom('kitchen', 'kot_item_updated', { kot: updatedKOT, itemId, status: newStatus });
    }

    return { itemId, status: newStatus, started_at: startedAt, expected_finish_at: expectedFinishAt, ready_at: readyAt, updatedKOT };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

// Background / Interval check to flag delayed KOTs once
async function checkAndTriggerDelayedKOTs() {
  try {
    const [delayedRows] = await pool.query(
      `SELECT k.id, k.kot_number, k.order_id, k.kitchen_department_id, kd.name as dept_name, t.table_number
       FROM kots k
       JOIN kitchen_departments kd ON k.kitchen_department_id = kd.id
       LEFT JOIN restaurant_tables t ON k.table_id = t.id
       WHERE k.status IN ('PENDING', 'ACCEPTED', 'PREPARING')
         AND k.is_delayed = FALSE
         AND k.target_completion_at < NOW()`
    );

    for (const kot of delayedRows) {
      await pool.query(
        `UPDATE kots SET is_delayed = TRUE, delayed_alert_sent = TRUE WHERE id = ?`,
        [kot.id]
      );

      const delayAlert = {
        kot_id: kot.id,
        kot_number: kot.kot_number,
        order_id: kot.order_id,
        table_number: kot.table_number,
        kitchen_department_name: kot.dept_name,
        message: `⚠️ KOT #${kot.kot_number} for Table ${kot.table_number || 'N/A'} is DELAYED!`
      };

      // Store system notification
      await pool.query(
        `INSERT INTO notifications (type, title, message) VALUES ('KOT_DELAYED', 'KOT Delay Alert', ?)`,
        [delayAlert.message]
      );

      emitToRoom('kitchen', 'kot_delayed', delayAlert);
      emitToRoom('waiter', 'kot_delayed', delayAlert);
      emitToRoom('admin', 'kot_delayed', delayAlert);
    }
  } catch (err) {
    console.error('Error checking delayed KOTs:', err);
  }
}

module.exports = {
  getKOTWithItems,
  updateKOTStatus,
  updateKOTItemStatus,
  checkAndTriggerDelayedKOTs
};
