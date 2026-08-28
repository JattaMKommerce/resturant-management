const pool = require('../../config/database');
const crypto = require('crypto');
const { sendSuccess, sendError } = require('../../utils/response');
const { emitToRoom, broadcastEvent } = require('../../config/socket');

function calculateNextTableNumber(tables) {
  const usedNumbers = new Set();
  
  for (const t of tables) {
    const matchNum = String(t.table_number || '').match(/\d+/);
    if (matchNum) {
      const n = parseInt(matchNum[0], 10);
      if (!isNaN(n) && n > 0) usedNumbers.add(n);
    }
    const matchName = String(t.table_name || '').match(/\d+/);
    if (matchName) {
      const n = parseInt(matchName[0], 10);
      if (!isNaN(n) && n > 0) usedNumbers.add(n);
    }
  }

  // Find the lowest positive integer starting from 1 not currently in use (gap-filling)
  let nextNum = 1;
  while (usedNumbers.has(nextNum)) {
    nextNum++;
  }

  const table_number = nextNum < 10 ? `T0${nextNum}` : `T${nextNum}`;
  const table_name = `Table ${nextNum}`;

  return { number: nextNum, table_number, table_name };
}

async function getNextTableNumberHandler(req, res, next) {
  try {
    const restaurantId = req.user?.restaurant_id || 1;
    const [rows] = await pool.query(
      `SELECT table_number, table_name FROM restaurant_tables WHERE (restaurant_id = ? OR restaurant_id IS NULL) AND is_active = 1`,
      [restaurantId]
    );
    const nextTable = calculateNextTableNumber(rows);
    return sendSuccess(res, nextTable, 'Next available table number calculated');
  } catch (err) {
    next(err);
  }
}

async function autoSeedTablesIfEmpty(restaurantId = 1) {
  try {
    const [tCheck] = await pool.query(
      'SELECT COUNT(*) as count FROM restaurant_tables WHERE (restaurant_id = ? OR restaurant_id IS NULL) AND is_active = 1',
      [restaurantId]
    );
    if (tCheck[0].count === 0) {
      console.log('🔄 Auto-seeding default restaurant tables for restaurant:', restaurantId);
      const tablesData = [
        ['T01', 'Table 1', 'Main Dining', 'Section A', 2, 'STANDARD'],
        ['T02', 'Table 2', 'Main Dining', 'Section A', 4, 'STANDARD'],
        ['T03', 'Table 3', 'Main Dining', 'Section B', 4, 'BOOTH'],
        ['T04', 'Table 4', 'Terrace Floor', 'Outdoor', 6, 'OUTDOOR'],
        ['T05', 'Table 5 (VIP)', 'VIP Lounge', 'VIP Area', 8, 'VIP'],
        ['T06', 'Table 6', 'Main Dining', 'Section B', 4, 'STANDARD'],
        ['T07', 'Table 7', 'Terrace Floor', 'Outdoor', 4, 'OUTDOOR'],
        ['T08', 'Table 8', 'Main Dining', 'Section A', 2, 'STANDARD']
      ];
      for (const [tNum, tName, floor, section, capacity, type] of tablesData) {
        const qrToken = crypto.randomBytes(32).toString('hex');
        await pool.query(
          `INSERT INTO restaurant_tables (restaurant_id, table_number, table_name, floor, section, capacity, table_type, qr_token, status, is_active)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'AVAILABLE', 1)`,
          [restaurantId, tNum, tName, floor, section, capacity, type, qrToken]
        );
      }
      console.log('✅ Default restaurant tables seeded successfully!');
    }
  } catch (err) {
    console.warn('Table auto-seed check warning:', err.message);
  }
}

async function getTables(req, res, next) {
  try {
    const { floor, section, status, search } = req.query;
    const restaurantId = req.user?.restaurant_id || 1;
    await autoSeedTablesIfEmpty(restaurantId);
    let query = `
      SELECT t.*, 
        (SELECT COUNT(*) FROM restaurant_orders o WHERE o.table_id = t.id AND o.order_status NOT IN ('COMPLETED', 'CANCELLED')) as active_orders_count
      FROM restaurant_tables t
      WHERE (t.restaurant_id = ? OR t.restaurant_id IS NULL) AND (t.is_active = 1 OR t.is_active IS NULL)
    `;
    const params = [restaurantId];

    if (floor) {
      query += ` AND t.floor = ?`;
      params.push(floor);
    }
    if (section) {
      query += ` AND t.section = ?`;
      params.push(section);
    }
    if (status) {
      if (status === 'ATTENTION') {
        query += ` AND (t.status IN ('BILL_REQUESTED', 'CLEANING') OR t.id IN (SELECT DISTINCT table_id FROM kots WHERE status = 'READY' AND table_id IS NOT NULL))`;
      } else {
        query += ` AND t.status = ?`;
        params.push(status);
      }
    }
    if (search) {
      query += ` AND (t.table_number LIKE ? OR t.table_name LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY CAST(REGEXP_REPLACE(t.table_number, '[^0-9]', '') AS UNSIGNED) ASC, t.table_number ASC`;

    const [rows] = await pool.query(query, params);
    return sendSuccess(res, rows, 'Tables fetched successfully');
  } catch (err) {
    next(err);
  }
}

async function createTable(req, res, next) {
  const connection = await pool.getConnection();
  let table_number = '';
  let table_name = '';
  try {
    await connection.beginTransaction();
    const restaurantId = req.user?.restaurant_id || 1;
    let body = req.body || {};
    table_number = body.table_number;
    table_name = body.table_name;
    const { floor, section, capacity, table_type } = body;

    // Auto-generate if not provided or empty (check tables for this restaurant)
    const [allTables] = await connection.query(
      `SELECT table_number, table_name FROM restaurant_tables WHERE (restaurant_id = ? OR restaurant_id IS NULL) AND is_active = 1`,
      [restaurantId]
    );
    const autoGen = calculateNextTableNumber(allTables);

    if (!table_number || String(table_number).trim() === '') {
      table_number = autoGen.table_number;
    }
    if (!table_name || String(table_name).trim() === '') {
      table_name = autoGen.table_name;
    }

    table_number = String(table_number).trim();
    table_name = String(table_name).trim();

    // Check duplicate per restaurant
    const [existing] = await connection.query(
      `SELECT id, table_number, table_name FROM restaurant_tables WHERE (table_number = ? OR table_name = ?) AND (restaurant_id = ? OR restaurant_id IS NULL) AND is_active = 1`,
      [table_number, table_name, restaurantId]
    );
    if (existing.length > 0) {
      const isNumMatch = existing.some(e => String(e.table_number).toLowerCase() === table_number.toLowerCase());
      if (isNumMatch) {
        return sendError(res, `Table number "${table_number}" already exists.`, 400);
      }
      return sendError(res, `Table name "${table_name}" already exists.`, 400);
    }

    const qrToken = crypto.randomBytes(32).toString('hex');

    const [result] = await connection.query(
      `INSERT INTO restaurant_tables (table_number, table_name, floor, section, capacity, table_type, qr_token, status, qr_status, is_active, restaurant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'AVAILABLE', 'ACTIVE', 1, ?)`,
      [table_number, table_name, floor || 'Main Dining', section || 'General', capacity || 4, table_type || 'STANDARD', qrToken, restaurantId]
    );

    const tableId = result.insertId;

    await connection.query(
      `INSERT INTO table_qr_codes (table_id, qr_token, status) VALUES (?, ?, 'ACTIVE')`,
      [tableId, qrToken]
    );

    await connection.commit();

    const [newTable] = await pool.query(`SELECT * FROM restaurant_tables WHERE id = ?`, [tableId]);
    
    broadcastEvent('table_created', { table: newTable[0] });
    broadcastEvent('table_status_changed', { table_id: tableId, status: 'AVAILABLE', table: newTable[0] });

    return sendSuccess(res, newTable[0], 'Table created successfully', 201);
  } catch (err) {
    await connection.rollback();
    if (err.code === 'ER_DUP_ENTRY') {
      return sendError(res, `Table number "${table_number || 'specified'}" already exists.`, 400);
    }
    next(err);
  } finally {
    connection.release();
  }
}

async function getTableById(req, res, next) {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(`SELECT * FROM restaurant_tables WHERE id = ?`, [id]);
    if (rows.length === 0) {
      return sendError(res, 'Table not found', 404);
    }
    return sendSuccess(res, rows[0], 'Table details fetched');
  } catch (err) {
    next(err);
  }
}

async function updateTable(req, res, next) {
  try {
    const { id } = req.params;
    const { table_name, floor, section, capacity, table_type, is_active } = req.body;

    const [existing] = await pool.query(`SELECT * FROM restaurant_tables WHERE id = ?`, [id]);
    if (existing.length === 0) {
      return sendError(res, 'Table not found', 404);
    }

    await pool.query(
      `UPDATE restaurant_tables 
       SET table_name = COALESCE(?, table_name),
           floor = COALESCE(?, floor),
           section = COALESCE(?, section),
           capacity = COALESCE(?, capacity),
           table_type = COALESCE(?, table_type),
           is_active = COALESCE(?, is_active)
       WHERE id = ?`,
      [table_name, floor, section, capacity, table_type, is_active, id]
    );

    const [updated] = await pool.query(`SELECT * FROM restaurant_tables WHERE id = ?`, [id]);
    return sendSuccess(res, updated[0], 'Table updated successfully');
  } catch (err) {
    next(err);
  }
}

async function updateTableStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['AVAILABLE', 'OCCUPIED', 'ORDERING', 'RESERVED', 'BILL_REQUESTED', 'BILL_PAID', 'CLEANING', 'OUT_OF_SERVICE'];
    if (!validStatuses.includes(status)) {
      return sendError(res, `Invalid table status. Valid statuses: ${validStatuses.join(', ')}`, 400);
    }

    const [existing] = await pool.query(`SELECT * FROM restaurant_tables WHERE id = ?`, [id]);
    if (existing.length === 0) {
      return sendError(res, 'Table not found', 404);
    }

    await pool.query(`UPDATE restaurant_tables SET status = ? WHERE id = ?`, [status, id]);

    const [updated] = await pool.query(`SELECT * FROM restaurant_tables WHERE id = ?`, [id]);
    
    broadcastEvent('table_status_changed', { table_id: parseInt(id), status, table: updated[0] });

    if (status === 'BILL_REQUESTED') {
      const payload = { 
        table_id: parseInt(id), 
        table_number: updated[0]?.table_number, 
        table_name: updated[0]?.table_name, 
        floor: updated[0]?.floor,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      emitToRoom('cashier', 'bill_requested', payload);
      emitToRoom('admin', 'bill_requested', payload);
      emitToRoom('waiter', 'bill_requested', payload);
      broadcastEvent('bill_requested', payload);
    }

    return sendSuccess(res, updated[0], `Table status updated to ${status}`);
  } catch (err) {
    next(err);
  }
}

async function deleteTable(req, res, next) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { id } = req.params;
    const [existing] = await connection.query(`SELECT * FROM restaurant_tables WHERE id = ?`, [id]);
    if (existing.length === 0) {
      return sendError(res, 'Table not found', 404);
    }

    // Check if table has ongoing active orders
    const [activeOrders] = await connection.query(
      `SELECT id, order_number FROM restaurant_orders WHERE table_id = ? AND order_status NOT IN ('COMPLETED', 'CANCELLED')`,
      [id]
    );
    if (activeOrders.length > 0) {
      return sendError(res, `Cannot delete table with active order (${activeOrders[0].order_number}). Please complete or cancel the order first.`, 400);
    }

    // Delete associated QR codes
    await connection.query(`DELETE FROM table_qr_codes WHERE table_id = ?`, [id]);
    // Delete table
    await connection.query(`DELETE FROM restaurant_tables WHERE id = ?`, [id]);

    await connection.commit();
    
    broadcastEvent('table_deleted', { table_id: parseInt(id) });
    return sendSuccess(res, { id: parseInt(id) }, 'Table deleted successfully');
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
}

module.exports = {
  calculateNextTableNumber,
  getNextTableNumberHandler,
  getTables,
  createTable,
  getTableById,
  updateTable,
  updateTableStatus,
  deleteTable
};

