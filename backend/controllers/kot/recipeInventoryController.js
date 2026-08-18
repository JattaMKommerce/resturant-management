const pool = require('../../config/database');
const { sendSuccess, sendError } = require('../../utils/response');

async function getInventoryItems(req, res, next) {
  try {
    const [items] = await pool.query(
      `SELECT i.*, c.name as category_name 
       FROM inventory_items i
       JOIN inventory_categories c ON i.category_id = c.id
       ORDER BY i.item_name ASC`
    );
    return sendSuccess(res, items, 'Inventory items loaded');
  } catch (err) {
    next(err);
  }
}

async function createInventoryItem(req, res, next) {
  try {
    const { category_id, item_name, unit, current_stock, min_stock_alert, unit_cost } = req.body;
    if (!category_id || !item_name || !unit) {
      return sendError(res, 'Category, item name, and unit are required', 400);
    }

    const [result] = await pool.query(
      `INSERT INTO inventory_items (category_id, item_name, unit, current_stock, min_stock_alert, unit_cost)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [category_id, item_name, unit, current_stock || 0, min_stock_alert || 5, unit_cost || 0]
    );

    const [newItem] = await pool.query(`SELECT * FROM inventory_items WHERE id = ?`, [result.insertId]);
    return sendSuccess(res, newItem[0], 'Inventory item created', 201);
  } catch (err) {
    next(err);
  }
}

async function getRecipes(req, res, next) {
  try {
    const [recipes] = await pool.query(
      `SELECT r.id as recipe_id, m.id as menu_item_id, m.name as menu_item_name, c.name as category_name
       FROM recipes r
       JOIN menu_items m ON r.menu_item_id = m.id
       JOIN menu_categories c ON m.category_id = c.id
       ORDER BY m.name ASC`
    );

    for (let r of recipes) {
      const [ingredients] = await pool.query(
        `SELECT ri.*, ii.item_name, ii.unit as stock_unit
         FROM recipe_ingredients ri
         JOIN inventory_items ii ON ri.inventory_item_id = ii.id
         WHERE ri.recipe_id = ?`,
        [r.recipe_id]
      );
      r.ingredients = ingredients;
    }

    return sendSuccess(res, recipes, 'Recipes loaded');
  } catch (err) {
    next(err);
  }
}

async function createOrUpdateRecipe(req, res, next) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { menu_item_id, ingredients = [] } = req.body;

    if (!menu_item_id) return sendError(res, 'Menu item ID is required', 400);

    // Create or get recipe
    let recipeId;
    const [existing] = await connection.query(`SELECT id FROM recipes WHERE menu_item_id = ?`, [menu_item_id]);
    if (existing.length > 0) {
      recipeId = existing[0].id;
      await connection.query(`DELETE FROM recipe_ingredients WHERE recipe_id = ?`, [recipeId]);
    } else {
      const [resIns] = await connection.query(`INSERT INTO recipes (menu_item_id) VALUES (?)`, [menu_item_id]);
      recipeId = resIns.insertId;
    }

    for (const ing of ingredients) {
      await connection.query(
        `INSERT INTO recipe_ingredients (recipe_id, inventory_item_id, quantity, unit, wastage_percentage)
         VALUES (?, ?, ?, ?, ?)`,
        [recipeId, ing.inventory_item_id, ing.quantity, ing.unit || 'kg', ing.wastage_percentage || 0]
      );
    }

    await connection.commit();
    return sendSuccess(res, { recipe_id: recipeId, menu_item_id }, 'Recipe saved successfully');
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
}

const inventoryService = require('../../services/kot/inventoryService');

async function getIngredientAvailabilityHandler(req, res, next) {
  try {
    const items = await inventoryService.getIngredientAvailability();
    return sendSuccess(res, items, 'Ingredient availability loaded');
  } catch (err) {
    next(err);
  }
}

async function getStockTransactions(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT st.*, ii.item_name, ii.unit
       FROM stock_transactions st
       JOIN inventory_items ii ON st.inventory_item_id = ii.id
       ORDER BY st.created_at DESC
       LIMIT 100`
    );
    return sendSuccess(res, rows, 'Stock transactions loaded');
  } catch (err) {
    next(err);
  }
}

async function getInventoryBatches(req, res, next) {
  try {
    const { status, category_id, search } = req.query;

    let query = `
      SELECT b.*, ii.item_name, ii.unit, ii.category_id, c.name as category_name, s.name as supplier_ref_name,
             DATEDIFF(b.expiry_date, CURRENT_DATE()) as days_diff
      FROM inventory_batches b
      JOIN inventory_items ii ON b.inventory_item_id = ii.id
      JOIN inventory_categories c ON ii.category_id = c.id
      LEFT JOIN suppliers s ON b.supplier_id = s.id
      WHERE 1=1
    `;
    const params = [];

    if (category_id) {
      query += ` AND ii.category_id = ?`;
      params.push(category_id);
    }

    if (search) {
      query += ` AND (ii.item_name LIKE ? OR b.batch_number LIKE ? OR b.supplier_name LIKE ? OR s.name LIKE ?)`;
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    query += ` ORDER BY b.expiry_date ASC, b.id DESC`;

    const [rows] = await pool.query(query, params);

    // Compute dynamic status and days_remaining text
    const processed = rows.map(b => {
      const daysDiff = parseInt(b.days_diff);
      let expStatus = 'SAFE';
      let daysText = `${daysDiff} days remaining`;
      let badgeColor = 'emerald';

      if (daysDiff < 0) {
        expStatus = 'EXPIRED';
        const absDays = Math.abs(daysDiff);
        daysText = `Expired by ${absDays} day${absDays === 1 ? '' : 's'}`;
        badgeColor = 'rose';
      } else if (daysDiff === 0) {
        expStatus = 'EXPIRING_7';
        daysText = 'Expired today';
        badgeColor = 'rose';
      } else if (daysDiff <= 7) {
        expStatus = 'EXPIRING_7';
        daysText = `${daysDiff} day${daysDiff === 1 ? '' : 's'} remaining`;
        badgeColor = 'rose';
      } else if (daysDiff <= 30) {
        expStatus = 'EXPIRING_30';
        daysText = `${daysDiff} days remaining`;
        badgeColor = 'amber';
      }

      // Quantity tracking metrics
      const initQty = parseFloat(b.initial_quantity);
      const currQty = parseFloat(b.current_quantity);
      const consumedQty = Math.max(0, initQty - currQty);
      const usableQty = expStatus === 'EXPIRED' ? 0 : currQty;
      const expiredQty = expStatus === 'EXPIRED' ? currQty : 0;

      return {
        ...b,
        initial_quantity: initQty,
        current_quantity: currQty,
        consumed_quantity: consumedQty,
        usable_quantity: usableQty,
        expired_quantity: expiredQty,
        supplier_display_name: b.supplier_ref_name || b.supplier_name || 'General Supplier',
        days_remaining: daysDiff,
        days_text: daysText,
        expiry_status: expStatus,
        badge_color: badgeColor
      };
    });

    // Apply status filter if provided
    let filtered = processed;
    if (status && status !== 'ALL') {
      filtered = processed.filter(item => item.expiry_status === status);
    }

    return sendSuccess(res, filtered, 'Inventory batches loaded');
  } catch (err) {
    next(err);
  }
}

async function createInventoryBatch(req, res, next) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const {
      inventory_item_id,
      batch_number,
      supplier_id,
      supplier_name,
      initial_quantity,
      unit_price,
      purchase_date,
      expiry_date,
      notes
    } = req.body;

    if (!inventory_item_id || !batch_number || !initial_quantity || !purchase_date || !expiry_date) {
      await connection.rollback();
      return sendError(res, 'Item, Batch Number, Quantity, Purchase Date, and Expiry Date are required', 400);
    }

    // Validate dates: expiry_date cannot be before purchase_date
    const pDate = new Date(purchase_date);
    const eDate = new Date(expiry_date);
    pDate.setHours(0, 0, 0, 0);
    eDate.setHours(0, 0, 0, 0);

    if (eDate < pDate) {
      await connection.rollback();
      return sendError(res, 'Expiry date cannot be before purchase date', 400);
    }

    // Check unique batch_number
    const [existing] = await connection.query(`SELECT id FROM inventory_batches WHERE batch_number = ?`, [batch_number]);
    if (existing.length > 0) {
      await connection.rollback();
      return sendError(res, `Batch number '${batch_number}' already exists`, 400);
    }

    const initQty = parseFloat(initial_quantity);
    const price = parseFloat(unit_price || 0);

    const [result] = await connection.query(
      `INSERT INTO inventory_batches (inventory_item_id, batch_number, supplier_id, supplier_name, initial_quantity, current_quantity, unit_price, purchase_date, expiry_date, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [inventory_item_id, batch_number, supplier_id || null, supplier_name || null, initQty, initQty, price, purchase_date, expiry_date, notes || null]
    );
    const batchId = result.insertId;

    // Record stock transaction for RESTOCK
    const referenceId = `BATCH_RESTOCK_${batchId}_${Date.now()}`;
    await connection.query(
      `INSERT INTO stock_transactions (inventory_item_id, batch_id, change_quantity, type, reference_id, notes)
       VALUES (?, ?, ?, 'RESTOCK', ?, ?)`,
      [inventory_item_id, batchId, initQty, referenceId, `New stock batch #${batch_number} received`]
    );

    // Sync inventory_items usable stock
    const [usableRow] = await connection.query(
      `SELECT COALESCE(SUM(current_quantity), 0.000) as usable_total
       FROM inventory_batches 
       WHERE inventory_item_id = ? AND current_quantity > 0 AND expiry_date >= CURRENT_DATE()`,
      [inventory_item_id]
    );
    const usableTotal = parseFloat(usableRow[0].usable_total);

    await connection.query(
      `UPDATE inventory_items SET current_stock = ? WHERE id = ?`,
      [usableTotal, inventory_item_id]
    );

    await connection.commit();

    const [newBatch] = await pool.query(
      `SELECT b.*, ii.item_name, ii.unit 
       FROM inventory_batches b 
       JOIN inventory_items ii ON b.inventory_item_id = ii.id 
       WHERE b.id = ?`,
      [batchId]
    );

    return sendSuccess(res, newBatch[0], 'Stock batch created successfully', 201);
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
}

async function updateInventoryBatch(req, res, next) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { id } = req.params;
    const { current_quantity, unit_price, purchase_date, expiry_date, supplier_id, supplier_name, notes } = req.body;

    const [existing] = await connection.query(`SELECT * FROM inventory_batches WHERE id = ?`, [id]);
    if (existing.length === 0) {
      await connection.rollback();
      return sendError(res, 'Batch not found', 404);
    }
    const oldBatch = existing[0];

    // Validate dates if updated
    const pDateStr = purchase_date || oldBatch.purchase_date;
    const eDateStr = expiry_date || oldBatch.expiry_date;
    if (new Date(eDateStr) < new Date(pDateStr)) {
      await connection.rollback();
      return sendError(res, 'Expiry date cannot be before purchase date', 400);
    }

    const newCurrQty = current_quantity !== undefined ? parseFloat(current_quantity) : parseFloat(oldBatch.current_quantity);
    const newPrice = unit_price !== undefined ? parseFloat(unit_price) : parseFloat(oldBatch.unit_price);

    await connection.query(
      `UPDATE inventory_batches 
       SET current_quantity = ?, unit_price = ?, purchase_date = ?, expiry_date = ?, supplier_id = ?, supplier_name = ?, notes = ?
       WHERE id = ?`,
      [newCurrQty, newPrice, pDateStr, eDateStr, supplier_id || null, supplier_name || null, notes || null, id]
    );

    // Sync inventory_items usable stock
    const [usableRow] = await connection.query(
      `SELECT COALESCE(SUM(current_quantity), 0.000) as usable_total
       FROM inventory_batches 
       WHERE inventory_item_id = ? AND current_quantity > 0 AND expiry_date >= CURRENT_DATE()`,
      [oldBatch.inventory_item_id]
    );
    await connection.query(
      `UPDATE inventory_items SET current_stock = ? WHERE id = ?`,
      [parseFloat(usableRow[0].usable_total), oldBatch.inventory_item_id]
    );

    await connection.commit();
    return sendSuccess(res, { id, current_quantity: newCurrQty }, 'Batch updated successfully');
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
}

async function deleteInventoryBatch(req, res, next) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { id } = req.params;

    const [existing] = await connection.query(`SELECT * FROM inventory_batches WHERE id = ?`, [id]);
    if (existing.length === 0) {
      await connection.rollback();
      return sendError(res, 'Batch not found', 404);
    }
    const batch = existing[0];

    await connection.query(`DELETE FROM inventory_batches WHERE id = ?`, [id]);

    // Recalculate usable stock for inventory item
    const [usableRow] = await connection.query(
      `SELECT COALESCE(SUM(current_quantity), 0.000) as usable_total
       FROM inventory_batches 
       WHERE inventory_item_id = ? AND current_quantity > 0 AND expiry_date >= CURRENT_DATE()`,
      [batch.inventory_item_id]
    );
    await connection.query(
      `UPDATE inventory_items SET current_stock = ? WHERE id = ?`,
      [parseFloat(usableRow[0].usable_total), batch.inventory_item_id]
    );

    await connection.commit();
    return sendSuccess(res, { id }, 'Batch deleted successfully');
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
}

async function getExpiryDashboardData(req, res, next) {
  try {
    const [countsRow] = await pool.query(`
      SELECT 
        SUM(CASE WHEN expiry_date < CURRENT_DATE() AND current_quantity > 0 THEN 1 ELSE 0 END) as expired_count,
        SUM(CASE WHEN expiry_date >= CURRENT_DATE() AND expiry_date <= DATE_ADD(CURRENT_DATE(), INTERVAL 7 DAY) AND current_quantity > 0 THEN 1 ELSE 0 END) as expiring_7_count,
        SUM(CASE WHEN expiry_date > DATE_ADD(CURRENT_DATE(), INTERVAL 7 DAY) AND expiry_date <= DATE_ADD(CURRENT_DATE(), INTERVAL 30 DAY) AND current_quantity > 0 THEN 1 ELSE 0 END) as expiring_30_count,
        COUNT(CASE WHEN current_quantity > 0 THEN 1 END) as total_batches_count
      FROM inventory_batches
    `);

    const stats = {
      expired_count: parseInt(countsRow[0].expired_count || 0),
      expiring_7_count: parseInt(countsRow[0].expiring_7_count || 0),
      expiring_30_count: parseInt(countsRow[0].expiring_30_count || 0),
      total_batches_count: parseInt(countsRow[0].total_batches_count || 0)
    };

    const alerts = [];
    if (stats.expired_count > 0) {
      alerts.push({
        type: 'EXPIRED',
        message: `🔴 ${stats.expired_count} batch${stats.expired_count === 1 ? '' : 'es'} have already expired.`,
        filter_status: 'EXPIRED'
      });
    }
    if (stats.expiring_7_count > 0) {
      alerts.push({
        type: 'EXPIRING_7',
        message: `⚠️ ${stats.expiring_7_count} batch${stats.expiring_7_count === 1 ? '' : 'es'} are expiring within 7 days.`,
        filter_status: 'EXPIRING_7'
      });
    }
    if (stats.expiring_30_count > 0) {
      alerts.push({
        type: 'EXPIRING_30',
        message: `🟠 ${stats.expiring_30_count} batch${stats.expiring_30_count === 1 ? '' : 'es'} are expiring within 30 days.`,
        filter_status: 'EXPIRING_30'
      });
    }

    return sendSuccess(res, { stats, alerts }, 'Expiry dashboard data loaded');
  } catch (err) {
    next(err);
  }
}

async function getExpiryReportData(req, res, next) {
  try {
    const { filter } = req.query; // 'ALL', 'EXPIRING_7', 'EXPIRING_30', 'EXPIRED'

    let query = `
      SELECT b.*, ii.item_name, ii.unit, c.name as category_name, s.name as supplier_ref_name,
             DATEDIFF(b.expiry_date, CURRENT_DATE()) as days_diff
      FROM inventory_batches b
      JOIN inventory_items ii ON b.inventory_item_id = ii.id
      JOIN inventory_categories c ON ii.category_id = c.id
      LEFT JOIN suppliers s ON b.supplier_id = s.id
      WHERE b.current_quantity > 0
    `;

    if (filter === 'EXPIRED') {
      query += ` AND b.expiry_date < CURRENT_DATE()`;
    } else if (filter === 'EXPIRING_7') {
      query += ` AND b.expiry_date >= CURRENT_DATE() AND b.expiry_date <= DATE_ADD(CURRENT_DATE(), INTERVAL 7 DAY)`;
    } else if (filter === 'EXPIRING_30') {
      query += ` AND b.expiry_date > DATE_ADD(CURRENT_DATE(), INTERVAL 7 DAY) AND b.expiry_date <= DATE_ADD(CURRENT_DATE(), INTERVAL 30 DAY)`;
    }

    query += ` ORDER BY b.expiry_date ASC`;

    const [rows] = await pool.query(query);

    const report = rows.map(b => {
      const daysDiff = parseInt(b.days_diff);
      let expStatus = 'SAFE';
      let daysText = `${daysDiff} days remaining`;

      if (daysDiff < 0) {
        expStatus = 'EXPIRED';
        const absDays = Math.abs(daysDiff);
        daysText = `Expired by ${absDays} day${absDays === 1 ? '' : 's'}`;
      } else if (daysDiff === 0) {
        expStatus = 'EXPIRING_7';
        daysText = 'Expired today';
      } else if (daysDiff <= 7) {
        expStatus = 'EXPIRING_7';
        daysText = `${daysDiff} day${daysDiff === 1 ? '' : 's'} remaining`;
      } else if (daysDiff <= 30) {
        expStatus = 'EXPIRING_30';
        daysText = `${daysDiff} days remaining`;
      }

      const currQty = parseFloat(b.current_quantity);
      const price = parseFloat(b.unit_price);
      const estValue = currQty * price;

      return {
        id: b.id,
        batch_number: b.batch_number,
        item_name: b.item_name,
        category_name: b.category_name,
        supplier: b.supplier_ref_name || b.supplier_name || 'General Supplier',
        current_quantity: currQty,
        unit: b.unit,
        unit_price: price,
        estimated_value: estValue,
        purchase_date: b.purchase_date,
        expiry_date: b.expiry_date,
        days_remaining: daysDiff,
        days_text: daysText,
        status: expStatus
      };
    });

    return sendSuccess(res, report, 'Expiry report loaded');
  } catch (err) {
    next(err);
  }
}

async function getSuppliers(req, res, next) {
  try {
    const [rows] = await pool.query(`SELECT * FROM suppliers ORDER BY name ASC`);
    return sendSuccess(res, rows, 'Suppliers loaded');
  } catch (err) {
    next(err);
  }
}

async function createSupplier(req, res, next) {
  try {
    const { name, contact_person, phone, email, address } = req.body;
    if (!name) return sendError(res, 'Supplier name is required', 400);

    const [result] = await pool.query(
      `INSERT INTO suppliers (name, contact_person, phone, email, address)
       VALUES (?, ?, ?, ?, ?)`,
      [name, contact_person || null, phone || null, email || null, address || null]
    );

    const [newSupp] = await pool.query(`SELECT * FROM suppliers WHERE id = ?`, [result.insertId]);
    return sendSuccess(res, newSupp[0], 'Supplier created successfully', 201);
  } catch (err) {
    next(err);
  }
}

async function getInventoryIntelligence(req, res, next) {
  try {
    const { period = '30d', startDate, endDate, item_id, category_id } = req.query;

    // 1. Calculate date ranges for current period and comparison previous period
    const now = new Date();
    let currentStart, currentEnd, prevStart, prevEnd;

    if (startDate && endDate) {
      currentStart = new Date(startDate);
      currentEnd = new Date(endDate);
      const diffMs = currentEnd.getTime() - currentStart.getTime();
      prevEnd = new Date(currentStart.getTime() - (24 * 60 * 60 * 1000));
      prevStart = new Date(prevEnd.getTime() - diffMs);
    } else {
      currentEnd = new Date(now);
      let days = 30;
      if (period === 'today') days = 1;
      else if (period === '7d') days = 7;
      else if (period === '30d') days = 30;
      else if (period === 'this_month') {
        currentStart = new Date(now.getFullYear(), now.getMonth(), 1);
        days = Math.max(1, Math.ceil((currentEnd - currentStart) / (24 * 60 * 60 * 1000)));
      } else if (period === 'last_month') {
        currentStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        currentEnd = new Date(now.getFullYear(), now.getMonth(), 0);
        days = Math.max(1, Math.ceil((currentEnd - currentStart) / (24 * 60 * 60 * 1000)));
      }

      if (!currentStart) {
        currentStart = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));
      }
      prevEnd = new Date(currentStart.getTime() - (24 * 60 * 60 * 1000));
      prevStart = new Date(prevEnd.getTime() - ((days || 30) * 24 * 60 * 60 * 1000));
    }

    const fmt = d => d.toISOString().slice(0, 10);
    const currStartStr = fmt(currentStart);
    const currEndStr = fmt(currentEnd);
    const prevStartStr = fmt(prevStart);
    const prevEndStr = fmt(prevEnd);

    // 2. 🥇 MOST CONSUMED
    const [mostConsumedRows] = await pool.query(
      `SELECT st.inventory_item_id, ii.item_name, ii.unit, c.name as category_name,
              SUM(ABS(st.change_quantity)) as total_consumed
       FROM stock_transactions st
       JOIN inventory_items ii ON st.inventory_item_id = ii.id
       JOIN inventory_categories c ON ii.category_id = c.id
       WHERE st.type = 'ORDER_DEDUCTION'
         AND DATE(st.created_at) BETWEEN ? AND ?
       GROUP BY st.inventory_item_id, ii.item_name, ii.unit, c.name
       ORDER BY total_consumed DESC
       LIMIT 1`,
      [currStartStr, currEndStr]
    );

    let mostConsumed = null;
    if (mostConsumedRows.length > 0) {
      const top = mostConsumedRows[0];
      const [prevRows] = await pool.query(
        `SELECT SUM(ABS(st.change_quantity)) as prev_consumed
         FROM stock_transactions st
         WHERE st.inventory_item_id = ?
           AND st.type = 'ORDER_DEDUCTION'
           AND DATE(st.created_at) BETWEEN ? AND ?`,
        [top.inventory_item_id, prevStartStr, prevEndStr]
      );
      const currVal = parseFloat(top.total_consumed);
      const prevVal = parseFloat(prevRows[0]?.prev_consumed || 0);
      let pctChange = 0;
      if (prevVal > 0) {
        pctChange = Math.round(((currVal - prevVal) / prevVal) * 100);
      } else {
        pctChange = currVal > 0 ? 100 : 0;
      }

      mostConsumed = {
        item_id: top.inventory_item_id,
        item_name: top.item_name,
        category_name: top.category_name,
        quantity: currVal,
        unit: top.unit,
        percentage_change: pctChange,
        change_text: pctChange >= 0 ? `+${pctChange}% compared with previous period` : `${pctChange}% compared with previous period`
      };
    }

    // 3. 💰 HIGHEST INGREDIENT COST (BOM Recipe Cost)
    const [highestBOMRows] = await pool.query(
      `SELECT r.id as recipe_id, m.id as menu_item_id, m.name as menu_item_name, c.name as category_name,
              COALESCE(SUM(ri.quantity * ii.unit_cost), 0.00) as total_ingredient_cost
       FROM recipes r
       JOIN menu_items m ON r.menu_item_id = m.id
       JOIN menu_categories c ON m.category_id = c.id
       JOIN recipe_ingredients ri ON r.id = ri.recipe_id
       JOIN inventory_items ii ON ri.inventory_item_id = ii.id
       GROUP BY r.id, m.id, m.name, c.name
       ORDER BY total_ingredient_cost DESC
       LIMIT 1`
    );

    let highestIngredientCost = null;
    if (highestBOMRows.length > 0) {
      const topBOM = highestBOMRows[0];
      const [ingredients] = await pool.query(
        `SELECT ri.quantity, ri.unit, ii.item_name, ii.unit_cost, (ri.quantity * ii.unit_cost) as cost
         FROM recipe_ingredients ri
         JOIN inventory_items ii ON ri.inventory_item_id = ii.id
         WHERE ri.recipe_id = ?
         ORDER BY cost DESC`,
        [topBOM.recipe_id]
      );

      highestIngredientCost = {
        recipe_id: topBOM.recipe_id,
        menu_item_id: topBOM.menu_item_id,
        menu_item_name: topBOM.menu_item_name,
        category_name: topBOM.category_name,
        total_cost: parseFloat(topBOM.total_ingredient_cost),
        ingredients: ingredients.map(i => ({
          item_name: i.item_name,
          quantity: parseFloat(i.quantity),
          unit: i.unit,
          unit_cost: parseFloat(i.unit_cost),
          cost: parseFloat(i.cost)
        }))
      };
    }

    // 4. 🗑️ HIGHEST WASTAGE & WASTAGE ANALYTICS
    const [highestWasteRows] = await pool.query(
      `SELECT st.inventory_item_id, ii.item_name, ii.unit, ii.unit_cost,
              SUM(ABS(st.change_quantity)) as total_wasted_qty,
              SUM(ABS(st.change_quantity) * ii.unit_cost) as total_wasted_value
       FROM stock_transactions st
       JOIN inventory_items ii ON st.inventory_item_id = ii.id
       WHERE st.type IN ('WASTAGE', 'EXPIRED_DISPOSAL')
         AND DATE(st.created_at) BETWEEN ? AND ?
       GROUP BY st.inventory_item_id, ii.item_name, ii.unit, ii.unit_cost
       ORDER BY total_wasted_value DESC
       LIMIT 1`,
      [currStartStr, currEndStr]
    );

    let highestWastage = null;
    if (highestWasteRows.length > 0) {
      const topWaste = highestWasteRows[0];
      highestWastage = {
        item_id: topWaste.inventory_item_id,
        item_name: topWaste.item_name,
        quantity: parseFloat(topWaste.total_wasted_qty),
        unit: topWaste.unit,
        value: parseFloat(topWaste.total_wasted_value)
      };
    }

    // Wastage Breakdown by Reason
    const [wasteByReasonRows] = await pool.query(
      `SELECT COALESCE(st.reason, 'OTHER') as reason,
              SUM(ABS(st.change_quantity) * ii.unit_cost) as value,
              SUM(ABS(st.change_quantity)) as qty
       FROM stock_transactions st
       JOIN inventory_items ii ON st.inventory_item_id = ii.id
       WHERE st.type IN ('WASTAGE', 'EXPIRED_DISPOSAL')
         AND DATE(st.created_at) BETWEEN ? AND ?
       GROUP BY reason
       ORDER BY value DESC`,
      [currStartStr, currEndStr]
    );

    const totalWastageValue = wasteByReasonRows.reduce((sum, r) => sum + parseFloat(r.value || 0), 0);
    const totalWastageQty = wasteByReasonRows.reduce((sum, r) => sum + parseFloat(r.qty || 0), 0);

    const wastageAnalytics = {
      total_value: totalWastageValue,
      total_quantity: totalWastageQty,
      highest_item: highestWastage,
      by_reason: wasteByReasonRows.map(r => ({
        reason: r.reason,
        value: parseFloat(r.value),
        quantity: parseFloat(r.qty)
      }))
    };

    // 5. ⚡ FASTEST DEPLETION
    // Usable stock / average daily consumption rate over past 30 days
    const [depletionRows] = await pool.query(
      `SELECT ii.id, ii.item_name, ii.unit, ii.min_stock_alert,
              COALESCE((
                SELECT SUM(b.current_quantity)
                FROM inventory_batches b
                WHERE b.inventory_item_id = ii.id
                  AND b.current_quantity > 0
                  AND b.expiry_date >= CURRENT_DATE()
              ), ii.current_stock) as usable_stock,
              COALESCE((
                SELECT SUM(ABS(st.change_quantity))
                FROM stock_transactions st
                WHERE st.inventory_item_id = ii.id
                  AND st.type = 'ORDER_DEDUCTION'
                  AND DATE(st.created_at) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
              ), 0.000) as recent_30d_consumption
       FROM inventory_items ii
       ORDER BY ii.item_name ASC`
    );

    let fastestDepletion = null;
    let lowestDays = Infinity;
    const allDepletions = [];

    for (const d of depletionRows) {
      const usable = parseFloat(d.usable_stock);
      const totalConsumed30d = parseFloat(d.recent_30d_consumption);
      const avgDaily = totalConsumed30d / 30; // avg per day

      if (usable > 0 && avgDaily > 0) {
        const estDays = usable / avgDaily;
        const record = {
          item_id: d.id,
          item_name: d.item_name,
          unit: d.unit,
          usable_stock: usable,
          avg_daily_usage: parseFloat(avgDaily.toFixed(2)),
          estimated_days_remaining: parseFloat(estDays.toFixed(1)),
          min_stock_alert: parseFloat(d.min_stock_alert),
          is_critical: estDays <= 3
        };
        allDepletions.push(record);

        if (estDays < lowestDays) {
          lowestDays = estDays;
          fastestDepletion = record;
        }
      }
    }

    allDepletions.sort((a, b) => a.estimated_days_remaining - b.estimated_days_remaining);

    // 6. 📊 CONSUMPTION TREND
    let trendQuery = `
      SELECT DATE(st.created_at) as date, ii.item_name, SUM(ABS(st.change_quantity)) as consumed, ii.unit
      FROM stock_transactions st
      JOIN inventory_items ii ON st.inventory_item_id = ii.id
      WHERE st.type = 'ORDER_DEDUCTION'
        AND DATE(st.created_at) BETWEEN ? AND ?
    `;
    const trendParams = [currStartStr, currEndStr];

    if (item_id) {
      trendQuery += ` AND ii.id = ?`;
      trendParams.push(item_id);
    }
    if (category_id) {
      trendQuery += ` AND ii.category_id = ?`;
      trendParams.push(category_id);
    }

    trendQuery += ` GROUP BY DATE(st.created_at), ii.item_name, ii.unit ORDER BY date ASC`;
    const [trendRows] = await pool.query(trendQuery, trendParams);

    // 7. 💰 PURCHASE COST TRENDS (Admin Only)
    const [batchPriceRows] = await pool.query(
      `SELECT b.inventory_item_id, ii.item_name, ii.unit, b.unit_price, b.purchase_date, b.batch_number
       FROM inventory_batches b
       JOIN inventory_items ii ON b.inventory_item_id = ii.id
       ORDER BY b.inventory_item_id, b.purchase_date DESC, b.id DESC`
    );

    const priceTrendsMap = {};
    for (const b of batchPriceRows) {
      if (!priceTrendsMap[b.inventory_item_id]) {
        priceTrendsMap[b.inventory_item_id] = {
          item_id: b.inventory_item_id,
          item_name: b.item_name,
          unit: b.unit,
          prices: []
        };
      }
      priceTrendsMap[b.inventory_item_id].prices.push({
        price: parseFloat(b.unit_price),
        purchase_date: b.purchase_date,
        batch_number: b.batch_number
      });
    }

    const purchaseCostTrends = [];
    for (const id in priceTrendsMap) {
      const entry = priceTrendsMap[id];
      if (entry.prices.length >= 2) {
        const currPrice = entry.prices[0].price;
        const prevPrice = entry.prices[1].price;
        const diff = currPrice - prevPrice;
        const pct = prevPrice > 0 ? ((diff / prevPrice) * 100).toFixed(1) : 0;
        purchaseCostTrends.push({
          item_id: entry.item_id,
          item_name: entry.item_name,
          unit: entry.unit,
          current_price: currPrice,
          previous_price: prevPrice,
          percentage_change: parseFloat(pct),
          trend: diff > 0 ? 'UP' : diff < 0 ? 'DOWN' : 'FLAT'
        });
      }
    }

    // 8. 🧠 SMART INSIGHTS (Rule-based dynamic generation)
    const smartInsights = [];

    if (mostConsumed && mostConsumed.percentage_change > 15) {
      smartInsights.push({
        type: 'CONSUMPTION_SPIKE',
        icon: '⚠️',
        title: 'Consumption Spike',
        message: `${mostConsumed.item_name} consumption increased ${mostConsumed.percentage_change}% this period (${mostConsumed.quantity} ${mostConsumed.unit} used).`
      });
    }

    if (fastestDepletion && fastestDepletion.estimated_days_remaining <= 3) {
      smartInsights.push({
        type: 'DEPLETION_ALERT',
        icon: '📦',
        title: 'Stock Depletion Warning',
        message: `${fastestDepletion.item_name} is expected to reach minimum stock in ~${fastestDepletion.estimated_days_remaining} days (Usable: ${fastestDepletion.usable_stock} ${fastestDepletion.unit}, Usage: ${fastestDepletion.avg_daily_usage} ${fastestDepletion.unit}/day).`
      });
    }

    const priceIncrease = purchaseCostTrends.find(p => p.percentage_change > 5);
    if (priceIncrease) {
      smartInsights.push({
        type: 'PRICE_INCREASE',
        icon: '💰',
        title: 'Procurement Cost Increase',
        message: `${priceIncrease.item_name} purchase cost increased +${priceIncrease.percentage_change}% (from ₹${priceIncrease.previous_price}/${priceIncrease.unit} to ₹${priceIncrease.current_price}/${priceIncrease.unit}).`
      });
    }

    if (highestWastage && highestWastage.value > 0) {
      smartInsights.push({
        type: 'WASTAGE_ALERT',
        icon: '🗑️',
        title: 'Wastage Impact',
        message: `${highestWastage.item_name} generated ₹${highestWastage.value.toFixed(2)} in wastage this period (${highestWastage.quantity} ${highestWastage.unit} discarded).`
      });
    }

    if (highestIngredientCost) {
      smartInsights.push({
        type: 'HIGHEST_BOM',
        icon: '🍛',
        title: 'Highest Recipe Cost',
        message: `${highestIngredientCost.menu_item_name} has the highest ingredient BOM cost per serving at ₹${highestIngredientCost.total_cost.toFixed(2)}.`
      });
    }

    // Expiry Insight
    const [expiringBatches] = await pool.query(
      `SELECT COUNT(*) as count FROM inventory_batches WHERE current_quantity > 0 AND expiry_date >= CURRENT_DATE() AND expiry_date <= DATE_ADD(CURRENT_DATE(), INTERVAL 7 DAY)`
    );
    if (expiringBatches[0]?.count > 0) {
      smartInsights.push({
        type: 'EXPIRY_WARNING',
        icon: '⚠️',
        title: 'Upcoming Expirations',
        message: `${expiringBatches[0].count} batch${expiringBatches[0].count === 1 ? '' : 'es'} will expire within the next 7 days.`
      });
    }

    return sendSuccess(res, {
      most_consumed: mostConsumed,
      highest_ingredient_cost: highestIngredientCost,
      highest_wastage: highestWastage,
      fastest_depletion: fastestDepletion,
      all_depletions: allDepletions,
      smart_insights: smartInsights,
      consumption_trend: trendRows,
      wastage_analytics: wastageAnalytics,
      purchase_cost_trends: purchaseCostTrends
    }, 'Inventory intelligence loaded');
  } catch (err) {
    next(err);
  }
}

async function getKitchenIntelligence(req, res, next) {
  try {
    // 1. Most Used Item (Quantities only, NO ₹)
    const [mostUsedRows] = await pool.query(
      `SELECT st.inventory_item_id, ii.item_name, ii.unit,
              SUM(ABS(st.change_quantity)) as total_used
       FROM stock_transactions st
       JOIN inventory_items ii ON st.inventory_item_id = ii.id
       WHERE st.type = 'ORDER_DEDUCTION'
         AND DATE(st.created_at) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
       GROUP BY st.inventory_item_id, ii.item_name, ii.unit
       ORDER BY total_used DESC
       LIMIT 1`
    );

    const mostUsed = mostUsedRows.length > 0 ? {
      item_name: mostUsedRows[0].item_name,
      quantity_used: parseFloat(mostUsedRows[0].total_used),
      unit: mostUsedRows[0].unit
    } : null;

    // 2. Fastest Depletion (Usable stock & days only, NO ₹)
    const [depletionRows] = await pool.query(
      `SELECT ii.id, ii.item_name, ii.unit, ii.min_stock_alert,
              COALESCE((
                SELECT SUM(b.current_quantity)
                FROM inventory_batches b
                WHERE b.inventory_item_id = ii.id
                  AND b.current_quantity > 0
                  AND b.expiry_date >= CURRENT_DATE()
              ), ii.current_stock) as usable_stock,
              COALESCE((
                SELECT SUM(ABS(st.change_quantity))
                FROM stock_transactions st
                WHERE st.inventory_item_id = ii.id
                  AND st.type = 'ORDER_DEDUCTION'
                  AND DATE(st.created_at) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
              ), 0.000) as recent_consumption
       FROM inventory_items ii`
    );

    let fastestDepletion = null;
    let lowestDays = Infinity;

    for (const d of depletionRows) {
      const usable = parseFloat(d.usable_stock);
      const consumed = parseFloat(d.recent_consumption);
      const avgDaily = consumed / 30;

      if (usable > 0 && avgDaily > 0) {
        const estDays = usable / avgDaily;
        if (estDays < lowestDays) {
          lowestDays = estDays;
          fastestDepletion = {
            item_name: d.item_name,
            usable_stock: usable,
            unit: d.unit,
            estimated_days: parseFloat(estDays.toFixed(1)),
            avg_daily_usage: parseFloat(avgDaily.toFixed(1))
          };
        }
      }
    }

    // 3. Expiring Soon Count & Top Items (<= 7 days)
    const [expiringSoonRows] = await pool.query(
      `SELECT b.batch_number, ii.item_name, b.current_quantity, ii.unit, DATEDIFF(b.expiry_date, CURRENT_DATE()) as days_remaining
       FROM inventory_batches b
       JOIN inventory_items ii ON b.inventory_item_id = ii.id
       WHERE b.current_quantity > 0
         AND b.expiry_date >= CURRENT_DATE()
         AND b.expiry_date <= DATE_ADD(CURRENT_DATE(), INTERVAL 7 DAY)
       ORDER BY b.expiry_date ASC
       LIMIT 5`
    );

    // 4. Critical Stock Alerts (Usable stock <= min_stock_alert)
    const criticalAlerts = [];
    for (const d of depletionRows) {
      const usable = parseFloat(d.usable_stock);
      const minAlert = parseFloat(d.min_stock_alert);
      if (usable <= minAlert) {
        criticalAlerts.push({
          item_name: d.item_name,
          usable_stock: usable,
          min_stock_alert: minAlert,
          unit: d.unit,
          is_out_of_stock: usable <= 0
        });
      }
    }

    return sendSuccess(res, {
      most_used_item: mostUsed,
      fastest_depletion: fastestDepletion,
      expiring_soon_batches: expiringSoonRows,
      critical_stock_alerts: criticalAlerts
    }, 'Kitchen intelligence loaded');
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getInventoryItems,
  createInventoryItem,
  getRecipes,
  createOrUpdateRecipe,
  getStockTransactions,
  getIngredientAvailabilityHandler,
  getInventoryBatches,
  createInventoryBatch,
  updateInventoryBatch,
  deleteInventoryBatch,
  getExpiryDashboardData,
  getExpiryReportData,
  getSuppliers,
  createSupplier,
  getInventoryIntelligence,
  getKitchenIntelligence
};
