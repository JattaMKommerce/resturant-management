const pool = require('../../config/database');
const { emitToRoom, broadcastEvent } = require('../../config/socket');

/**
 * Deduct inventory for a single KOT item based on its recipe/BOM.
 * Guaranteed idempotent via stock_transactions.unique_stock_ref UNIQUE constraint
 * and kot_items.inventory_deducted flag.
 */
async function deductStockForKOTItem(kotItemId, existingConnection = null) {
  const connection = existingConnection || (await pool.getConnection());
  const manageTx = !existingConnection;

  try {
    if (manageTx) await connection.beginTransaction();

    // 1. Fetch KOT item details
    const [kotItems] = await connection.query(
      `SELECT ki.*, k.kot_number, oi.menu_item_id
       FROM kot_items ki
       JOIN kots k ON ki.kot_id = k.id
       JOIN order_items oi ON ki.order_item_id = oi.id
       WHERE ki.id = ?`,
      [kotItemId]
    );

    if (kotItems.length === 0) {
      if (manageTx) await connection.rollback();
      return { success: false, message: 'KOT item not found' };
    }

    const item = kotItems[0];

    // Idempotency check: if already deducted, skip
    if (item.inventory_deducted) {
      if (manageTx) await connection.rollback();
      return { success: true, message: 'Already deducted', alreadyDeducted: true };
    }

    // 2. Fetch recipe for menu_item_id
    const [recipes] = await connection.query(
      `SELECT id FROM recipes WHERE menu_item_id = ?`,
      [item.menu_item_id]
    );

    let itemsDeducted = 0;

    if (recipes.length > 0) {
      const recipeId = recipes[0].id;
      const [ingredients] = await connection.query(
        `SELECT inventory_item_id, quantity, unit FROM recipe_ingredients WHERE recipe_id = ?`,
        [recipeId]
      );

      for (const ing of ingredients) {
        let remainingToDeduct = parseFloat(ing.quantity) * item.quantity;
        const baseRefId = `KOT_ITEM_DEDUCTION_${kotItemId}_ING_${ing.inventory_item_id}`;
        const notes = `KOT #${item.kot_number} - ${item.item_name} × ${item.quantity}`;

        // 1. Fetch available NON-EXPIRED batches ordered by earliest expiry_date (FEFO)
        const [batches] = await connection.query(
          `SELECT id, current_quantity, expiry_date 
           FROM inventory_batches 
           WHERE inventory_item_id = ? AND current_quantity > 0 AND expiry_date >= CURRENT_DATE()
           ORDER BY expiry_date ASC, id ASC`,
          [ing.inventory_item_id]
        );

        if (batches.length > 0) {
          for (const batch of batches) {
            if (remainingToDeduct <= 0) break;

            const batchQty = parseFloat(batch.current_quantity);
            const deductFromBatch = Math.min(batchQty, remainingToDeduct);
            const referenceId = `${baseRefId}_BATCH_${batch.id}`;

            try {
              // Update batch current_quantity
              await connection.query(
                `UPDATE inventory_batches 
                 SET current_quantity = current_quantity - ? 
                 WHERE id = ?`,
                [deductFromBatch, batch.id]
              );

              // Record stock transaction linked to batch_id
              await connection.query(
                `INSERT INTO stock_transactions (inventory_item_id, batch_id, change_quantity, type, reference_id, notes)
                 VALUES (?, ?, ?, 'ORDER_DEDUCTION', ?, ?)`,
                [ing.inventory_item_id, batch.id, -deductFromBatch, referenceId, notes]
              );

              remainingToDeduct -= deductFromBatch;
            } catch (dupErr) {
              if (dupErr.code === 'ER_DUP_ENTRY') {
                console.log(`Idempotent guard: Stock deduction for KOT item #${kotItemId} batch #${batch.id} already performed.`);
              } else {
                throw dupErr;
              }
            }
          }
        }

        // Fallback for unbatched or remaining stock deduction
        if (remainingToDeduct > 0) {
          const referenceId = `${baseRefId}_UNBATCHED`;
          try {
            await connection.query(
              `INSERT INTO stock_transactions (inventory_item_id, change_quantity, type, reference_id, notes)
               VALUES (?, ?, 'ORDER_DEDUCTION', ?, ?)`,
              [ing.inventory_item_id, -remainingToDeduct, referenceId, notes]
            );
          } catch (dupErr) {
            if (dupErr.code !== 'ER_DUP_ENTRY') throw dupErr;
          }
        }

        // Sync current_stock in inventory_items to represent usable non-expired stock
        const [usableStockRow] = await connection.query(
          `SELECT COALESCE(SUM(current_quantity), 0.000) as usable_total
           FROM inventory_batches 
           WHERE inventory_item_id = ? AND current_quantity > 0 AND expiry_date >= CURRENT_DATE()`,
          [ing.inventory_item_id]
        );
        const usableTotal = parseFloat(usableStockRow[0].usable_total);

        // Check if item has batches recorded
        const [batchCountRow] = await connection.query(
          `SELECT COUNT(*) as count FROM inventory_batches WHERE inventory_item_id = ?`,
          [ing.inventory_item_id]
        );

        if (batchCountRow[0].count > 0) {
          await connection.query(
            `UPDATE inventory_items SET current_stock = ? WHERE id = ?`,
            [usableTotal, ing.inventory_item_id]
          );
        } else {
          const totalQtyToDeduct = parseFloat(ing.quantity) * item.quantity;
          await connection.query(
            `UPDATE inventory_items SET current_stock = current_stock - ? WHERE id = ?`,
            [totalQtyToDeduct, ing.inventory_item_id]
          );
        }

        itemsDeducted++;
      }
    }

    // 3. Mark kot_items.inventory_deducted = TRUE
    await connection.query(
      `UPDATE kot_items SET inventory_deducted = TRUE WHERE id = ?`,
      [kotItemId]
    );

    if (manageTx) await connection.commit();

    // Broadcast live realtime inventory update to Kitchen and Admin
    emitToRoom('kitchen', 'inventory_updated', { kot_item_id: kotItemId, itemsDeducted });
    emitToRoom('admin', 'inventory_updated', { kot_item_id: kotItemId, itemsDeducted });

    return { success: true, itemsDeducted };
  } catch (err) {
    if (manageTx) await connection.rollback();
    throw err;
  } finally {
    if (manageTx) connection.release();
  }
}

/**
 * Get read-only ingredient availability & daily usage for Kitchen Ingredient View
 */
async function getIngredientAvailability() {
  const [items] = await pool.query(
    `SELECT i.*, c.name as category_name,
       COALESCE((
         SELECT SUM(ABS(st.change_quantity))
         FROM stock_transactions st
         WHERE st.inventory_item_id = i.id 
           AND st.type = 'ORDER_DEDUCTION'
           AND DATE(st.created_at) = CURRENT_DATE()
       ), 0.000) as used_today,
       COALESCE((
         SELECT SUM(b.current_quantity)
         FROM inventory_batches b
         WHERE b.inventory_item_id = i.id
           AND b.current_quantity > 0
           AND b.expiry_date >= CURRENT_DATE()
       ), 0.000) as batch_usable_stock,
       COALESCE((
         SELECT SUM(b.current_quantity)
         FROM inventory_batches b
         WHERE b.inventory_item_id = i.id
           AND b.current_quantity > 0
           AND b.expiry_date >= CURRENT_DATE()
           AND b.expiry_date <= DATE_ADD(CURRENT_DATE(), INTERVAL 7 DAY)
       ), 0.000) as expiring_soon_stock,
       COALESCE((
         SELECT SUM(b.current_quantity)
         FROM inventory_batches b
         WHERE b.inventory_item_id = i.id
           AND b.current_quantity > 0
           AND b.expiry_date < CURRENT_DATE()
       ), 0.000) as expired_stock,
       (
         SELECT COUNT(*)
         FROM inventory_batches b
         WHERE b.inventory_item_id = i.id
       ) as total_batches
     FROM inventory_items i
     JOIN inventory_categories c ON i.category_id = c.id
     ORDER BY i.item_name ASC`
  );

  for (let item of items) {
    // If batch records exist, use batch_usable_stock as current_stock display
    const totalBatches = parseInt(item.total_batches || 0);
    if (totalBatches > 0) {
      item.usable_stock = parseFloat(item.batch_usable_stock);
    } else {
      item.usable_stock = parseFloat(item.current_stock);
    }

    item.expiring_soon_stock = parseFloat(item.expiring_soon_stock || 0);
    item.expired_stock = parseFloat(item.expired_stock || 0);

    // Determine status badge (Strictly non-overlapping per requirement #1)
    const usable = item.usable_stock;
    const expiringSoon = item.expiring_soon_stock;
    const expired = item.expired_stock;
    const minAlert = parseFloat(item.min_stock_alert);

    if (usable <= 0) {
      item.stock_status = 'OUT_OF_STOCK';
    } else if (expired > 0) {
      item.stock_status = 'EXPIRED_STOCK';
    } else if (expiringSoon > 0) {
      item.stock_status = 'EXPIRING_SOON';
    } else if (usable <= minAlert) {
      item.stock_status = 'LOW_STOCK';
    } else {
      item.stock_status = 'STOCK_OK';
    }

    // Fetch active batches sorted by earliest expiry date (FEFO order)
    const [batches] = await pool.query(
      `SELECT b.*, DATEDIFF(b.expiry_date, CURRENT_DATE()) as days_remaining
       FROM inventory_batches b
       WHERE b.inventory_item_id = ? AND b.current_quantity > 0
       ORDER BY b.expiry_date ASC, b.id ASC`,
      [item.id]
    );

    let fefoCandidateFound = false;
    item.batches = batches.map(b => {
      const daysDiff = parseInt(b.days_remaining);
      const isExpired = daysDiff < 0;
      let isFefoTarget = false;

      // FEFO highlight ONLY applies to earliest NON-EXPIRED batch
      if (!isExpired && !fefoCandidateFound && parseFloat(b.current_quantity) > 0) {
        isFefoTarget = true;
        fefoCandidateFound = true;
      }

      return {
        ...b,
        days_remaining: daysDiff,
        is_expired: isExpired,
        is_fefo_target: isFefoTarget
      };
    });

    // Fetch recent consumptions (last 5)
    const [recent] = await pool.query(
      `SELECT st.id, st.change_quantity, st.notes, st.created_at
       FROM stock_transactions st
       WHERE st.inventory_item_id = ? AND st.type = 'ORDER_DEDUCTION'
       ORDER BY st.created_at DESC
       LIMIT 5`,
      [item.id]
    );
    item.recent_consumptions = recent;
  }

  // Top-level expiring soon items list (expiring in <= 7 days, sorted by earliest expiry date first)
  const [expiringSoonItems] = await pool.query(
    `SELECT b.*, ii.item_name, ii.unit, c.name as category_name, DATEDIFF(b.expiry_date, CURRENT_DATE()) as days_remaining
     FROM inventory_batches b
     JOIN inventory_items ii ON b.inventory_item_id = ii.id
     JOIN inventory_categories c ON ii.category_id = c.id
     WHERE b.current_quantity > 0 
       AND b.expiry_date >= CURRENT_DATE() 
       AND b.expiry_date <= DATE_ADD(CURRENT_DATE(), INTERVAL 7 DAY)
     ORDER BY b.expiry_date ASC, b.id ASC`
  );

  // Top-level expired stock items list
  const [expiredStockItems] = await pool.query(
    `SELECT b.*, ii.item_name, ii.unit, c.name as category_name, ABS(DATEDIFF(b.expiry_date, CURRENT_DATE())) as days_expired
     FROM inventory_batches b
     JOIN inventory_items ii ON b.inventory_item_id = ii.id
     JOIN inventory_categories c ON ii.category_id = c.id
     WHERE b.current_quantity > 0 
       AND b.expiry_date < CURRENT_DATE()
     ORDER BY b.expiry_date ASC, b.id ASC`
  );

  return {
    items,
    expiring_soon_items: expiringSoonItems,
    expired_stock_items: expiredStockItems
  };
}

/**
 * Deduct inventory for all KOT items belonging to an order.
 * Safe and idempotent - skips items where inventory_deducted is already TRUE.
 */
async function deductStockForOrder(orderId) {
  if (!orderId) return { success: false, message: 'Invalid order ID' };
  try {
    const [kotItems] = await pool.query(
      `SELECT ki.id 
       FROM kot_items ki
       JOIN kots k ON ki.kot_id = k.id
       WHERE k.order_id = ? AND ki.status != 'CANCELLED' AND (ki.inventory_deducted IS FALSE OR ki.inventory_deducted IS NULL)`,
      [orderId]
    );

    let totalDeducted = 0;
    for (const item of kotItems) {
      const res = await deductStockForKOTItem(item.id);
      if (res && res.success && !res.alreadyDeducted) {
        totalDeducted++;
      }
    }

    return { success: true, totalDeducted };
  } catch (err) {
    console.error(`Error in deductStockForOrder for order #${orderId}:`, err);
    return { success: false, error: err.message };
  }
}

module.exports = {
  deductStockForKOTItem,
  deductStockForOrder,
  getIngredientAvailability
};
