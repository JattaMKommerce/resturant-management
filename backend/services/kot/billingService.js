const pool = require('../../config/database');
const { broadcastEvent } = require('../../config/socket');

async function generateBill(orderId, discountAmount = 0.00, serviceCharge = 0.00) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [orders] = await connection.query(`SELECT * FROM restaurant_orders WHERE id = ?`, [orderId]);
    if (orders.length === 0) throw new Error('Order not found');

    const order = orders[0];

    // Check if bill already generated
    const [existingBill] = await connection.query(`SELECT * FROM bills WHERE order_id = ?`, [orderId]);
    if (existingBill.length > 0) {
      await connection.rollback();
      return existingBill[0];
    }

    const subtotal = parseFloat(order.subtotal);
    const taxAmount = parseFloat(order.tax_amount);
    const discount = parseFloat(discountAmount) || 0.00;
    const service = parseFloat(serviceCharge) || 0.00;
    const grandTotal = subtotal + taxAmount + service - discount;

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const billNumber = `BILL-${dateStr}-${randomSuffix}`;

    const [result] = await connection.query(
      `INSERT INTO bills (bill_number, order_id, table_id, room_id, subtotal, discount_amount, tax_amount, service_charge, grand_total, payment_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'UNPAID')`,
      [billNumber, orderId, order.table_id, order.room_id, subtotal, discount, taxAmount, service, grandTotal]
    );

    const billId = result.insertId;

    if (order.table_id) {
      await connection.query(`UPDATE restaurant_tables SET status = 'BILL_REQUESTED' WHERE id = ?`, [order.table_id]);
      broadcastEvent('table_status_changed', { table_id: order.table_id, status: 'BILL_REQUESTED' });
    }

    await connection.commit();

    const [newBill] = await pool.query(`SELECT * FROM bills WHERE id = ?`, [billId]);
    broadcastEvent('bill_generated', newBill[0]);
    return newBill[0];
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

async function recordPayment(billId, paymentMethod = 'CASH', amountPaid = null, transactionRef = null) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [bills] = await connection.query(`SELECT * FROM bills WHERE id = ?`, [billId]);
    if (bills.length === 0) throw new Error('Bill not found');

    const bill = bills[0];
    const amount = amountPaid ? parseFloat(amountPaid) : parseFloat(bill.grand_total);

    // 1. Insert Payment Record
    await connection.query(
      `INSERT INTO payments (order_id, payment_method, amount, transaction_id, status)
       VALUES (?, ?, ?, ?, 'SUCCESS')`,
      [bill.order_id, paymentMethod, amount, transactionRef || `TXN-${Date.now()}`]
    );

    // 2. Handle ROOM_CHARGE integration
    if (paymentMethod === 'ROOM_CHARGE') {
      if (!bill.room_id) {
        throw new Error('No hotel room associated with this order for room folio posting');
      }

      const [folios] = await connection.query(
        `SELECT id, balance FROM room_folios WHERE room_id = ? AND folio_status = 'OPEN' LIMIT 1`,
        [bill.room_id]
      );

      if (folios.length === 0) {
        throw new Error('No open room folio found for this room');
      }

      const folio = folios[0];
      await connection.query(
        `UPDATE room_folios SET balance = balance + ? WHERE id = ?`,
        [amount, folio.id]
      );

      await connection.query(
        `UPDATE restaurant_orders SET payment_status = 'ROOM_CHARGED' WHERE id = ?`,
        [bill.order_id]
      );
      await connection.query(`UPDATE bills SET payment_status = 'ROOM_CHARGED' WHERE id = ?`, [billId]);

    } else {
      await connection.query(
        `UPDATE restaurant_orders SET payment_status = 'PAID' WHERE id = ?`,
        [bill.order_id]
      );
      await connection.query(`UPDATE bills SET payment_status = 'PAID' WHERE id = ?`, [billId]);
    }

    // 3. Complete Order & Update Table Lifecycle to BILL_PAID -> CLEANING
    await connection.query(`UPDATE restaurant_orders SET order_status = 'COMPLETED' WHERE id = ?`, [bill.order_id]);

    if (bill.table_id) {
      await connection.query(`UPDATE restaurant_tables SET status = 'CLEANING' WHERE id = ?`, [bill.table_id]);
      broadcastEvent('table_status_changed', { table_id: bill.table_id, status: 'CLEANING' });
    }

    await connection.commit();

    const [updatedBill] = await pool.query(`SELECT * FROM bills WHERE id = ?`, [billId]);
    broadcastEvent('payment_recorded', { bill: updatedBill[0], amount, payment_method: paymentMethod });
    
    // Notify customer phone tracking screen
    const { emitToRoom } = require('../../config/socket');
    if (bill.order_id) {
      emitToRoom(`customer_${bill.order_id}`, 'order_updated', { order_id: bill.order_id, payment_status: updatedBill[0].payment_status });
      emitToRoom(`customer_${bill.order_id}`, 'bill_paid', updatedBill[0]);
    }
    
    return updatedBill[0];
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

module.exports = {
  generateBill,
  recordPayment
};
