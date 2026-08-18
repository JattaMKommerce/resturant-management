const pool = require('../../config/database');
const crypto = require('crypto');
const qrcode = require('qrcode');
const { sendSuccess, sendError } = require('../../utils/response');

async function regenerateQR(req, res, next) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { tableId } = req.params;

    const [tables] = await connection.query(`SELECT * FROM restaurant_tables WHERE id = ?`, [tableId]);
    if (tables.length === 0) {
      return sendError(res, 'Table not found', 404);
    }

    const newQrToken = crypto.randomBytes(32).toString('hex');

    // Deactivate previous QR history
    await connection.query(
      `UPDATE table_qr_codes SET status = 'INACTIVE' WHERE table_id = ?`,
      [tableId]
    );

    // Update table with new token
    await connection.query(
      `UPDATE restaurant_tables SET qr_token = ?, qr_status = 'ACTIVE' WHERE id = ?`,
      [newQrToken, tableId]
    );

    // Insert new history entry
    await connection.query(
      `INSERT INTO table_qr_codes (table_id, qr_token, status) VALUES (?, ?, 'ACTIVE')`,
      [tableId, newQrToken]
    );

    await connection.commit();

    const [updated] = await pool.query(`SELECT * FROM restaurant_tables WHERE id = ?`, [tableId]);
    return sendSuccess(res, updated[0], 'QR Code regenerated successfully');
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
}

async function toggleQRStatus(req, res, next) {
  try {
    const { tableId } = req.params;
    const { status } = req.body; // 'ACTIVE' or 'INACTIVE'

    if (!['ACTIVE', 'INACTIVE'].includes(status)) {
      return sendError(res, 'Status must be ACTIVE or INACTIVE', 400);
    }

    const [tables] = await pool.query(`SELECT * FROM restaurant_tables WHERE id = ?`, [tableId]);
    if (tables.length === 0) {
      return sendError(res, 'Table not found', 404);
    }

    await pool.query(`UPDATE restaurant_tables SET qr_status = ? WHERE id = ?`, [status, tableId]);
    await pool.query(`UPDATE table_qr_codes SET status = ? WHERE table_id = ? AND qr_token = ?`, [status, tableId, tables[0].qr_token]);

    const [updated] = await pool.query(`SELECT * FROM restaurant_tables WHERE id = ?`, [tableId]);
    return sendSuccess(res, updated[0], `QR status updated to ${status}`);
  } catch (err) {
    next(err);
  }
}

async function getQRHistory(req, res, next) {
  try {
    const { tableId } = req.params;
    const [rows] = await pool.query(
      `SELECT * FROM table_qr_codes WHERE table_id = ? ORDER BY created_at DESC`,
      [tableId]
    );
    return sendSuccess(res, rows, 'QR history fetched');
  } catch (err) {
    next(err);
  }
}

async function getPublicTableByToken(req, res, next) {
  try {
    const { token } = req.params;
    const [tables] = await pool.query(
      `SELECT id, table_number, table_name, floor, section, capacity, status, is_active, qr_status 
       FROM restaurant_tables 
       WHERE qr_token = ?`,
      [token]
    );

    if (tables.length === 0) {
      return sendError(res, 'Invalid QR code token. Table not found.', 404);
    }

    const table = tables[0];

    if (!table.is_active || table.status === 'OUT_OF_SERVICE') {
      return sendError(res, 'This table is currently out of service or inactive.', 400);
    }

    if (table.qr_status !== 'ACTIVE') {
      return sendError(res, 'This QR code has been disabled by the restaurant admin.', 400);
    }

    return sendSuccess(res, table, 'Table identified successfully');
  } catch (err) {
    next(err);
  }
}

const { emitToRoom, broadcastEvent } = require('../../config/socket');

async function callWaiterHandler(req, res, next) {
  try {
    const { token } = req.params;
    const { message, table_number } = req.body;

    let table = null;
    if (token && token !== 'default') {
      const [tables] = await pool.query(
        `SELECT id, table_number, table_name, floor, section FROM restaurant_tables WHERE qr_token = ? OR id = ? OR table_number = ?`,
        [token, token, token]
      );
      if (tables.length > 0) {
        table = tables[0];
      }
    }

    const payload = {
      table_id: table ? table.id : null,
      table_number: table ? table.table_number : (table_number || 'T01'),
      table_name: table ? table.table_name : `Table ${table_number || 'T01'}`,
      floor: table ? table.floor : 'Main Dining Area',
      message: message || 'Customer requesting waiter assistance',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };

    emitToRoom('waiter', 'call_waiter', payload);
    emitToRoom('admin', 'call_waiter', payload);
    broadcastEvent('call_waiter', payload);

    return sendSuccess(res, payload, 'Waiter called successfully');
  } catch (err) {
    next(err);
  }
}

module.exports = {
  regenerateQR,
  toggleQRStatus,
  getQRHistory,
  getPublicTableByToken,
  callWaiterHandler
};
