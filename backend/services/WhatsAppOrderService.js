/**
 * WhatsApp order updates to customers (REQ-010 / REQ-026), via the Meta WhatsApp Cloud API.
 *
 * WhatsApp only lets a business start a conversation with a pre-approved template, so all
 * updates use ONE "utility" template with four body variables:
 *   {{1}} customer name, {{2}} order number, {{3}} update text, {{4}} restaurant name
 *   e.g. "Hi {{1}}, your order {{2}} {{3}}. Thank you for ordering from {{4}}."
 *
 * Settings (server environment):
 *   WHATSAPP_ORDER_UPDATES=true                 switch on (off by default)
 *   WHATSAPP_ORDER_TEMPLATE=order_status_update template name in Meta Business Manager
 *   WHATSAPP_ORDER_TEMPLATE_LANG=en             template language code
 *   WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID (already used for OTP)
 * A restaurant can switch updates off (restaurants.whatsapp_updates_enabled = 0).
 *
 * Each order + event is sent at most once (whatsapp_messages has a unique key), and every
 * attempt is recorded with its result.
 */
const axios = require('axios');
const { query } = require('../config/db');
const { normalizePhoneNumber } = require('./WhatsAppOtpService');

// Overridable only so tests can point at a local stand-in instead of Meta
const GRAPH = process.env.WHATSAPP_GRAPH_URL || 'https://graph.facebook.com/v21.0';

let schemaPromise = null;
function ensureSchema() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await query(`CREATE TABLE IF NOT EXISTS whatsapp_messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id INT NOT NULL,
        restaurant_id INT NULL,
        event VARCHAR(30) NOT NULL,
        phone VARCHAR(20) NULL,
        status ENUM('PENDING','SENT','FAILED','SKIPPED') NOT NULL DEFAULT 'PENDING',
        message_id VARCHAR(100) NULL,
        error VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_whatsapp_order_event (order_id, event)
      )`);
      const cols = await query(
        `SELECT COUNT(*) AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'restaurants' AND COLUMN_NAME = 'whatsapp_updates_enabled'`
      );
      if (!Number(cols[0]?.n)) await query('ALTER TABLE restaurants ADD COLUMN whatsapp_updates_enabled TINYINT(1) NOT NULL DEFAULT 1');
    })().catch((err) => { schemaPromise = null; throw err; });
  }
  return schemaPromise;
}

/** Text that completes "your order #123 …" for each event. */
function updateText(event, order, extra = {}) {
  const takeaway = order.order_type === 'TAKEAWAY';
  switch (event) {
    case 'PLACED': return order.payment_method === 'ONLINE' ? 'has been paid and confirmed' : 'has been received and confirmed';
    case 'ACCEPTED': return 'has been accepted and the kitchen is preparing it';
    case 'READY': return 'is ready. Please collect it from the counter';
    case 'OUT_FOR_DELIVERY': return 'is out for delivery';
    case 'DELIVERED': return takeaway ? 'has been collected' : 'has been delivered';
    case 'CANCELLED': return extra.byRestaurant ? 'could not be accepted by the restaurant and has been cancelled' : 'has been cancelled';
    case 'REFUNDED': return `has been refunded (₹${Number(extra.amount || order.total_amount || 0).toFixed(2)})`;
    default: return null;
  }
}

/** Which order status changes produce a WhatsApp update. */
function eventForStatus(status, order) {
  switch (status) {
    case 'ACCEPTED': return 'ACCEPTED';
    case 'READY_FOR_PICKUP': return order.order_type === 'TAKEAWAY' ? 'READY' : null;
    case 'OUT_FOR_DELIVERY': return 'OUT_FOR_DELIVERY';
    case 'DELIVERED': return 'DELIVERED';
    case 'CANCELLED': return 'CANCELLED';
    case 'REJECTED': return 'CANCELLED';
    default: return null;
  }
}

function enabledGlobally() {
  return process.env.WHATSAPP_ORDER_UPDATES === 'true' &&
    Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

async function record(id, status, fields = {}) {
  await query('UPDATE whatsapp_messages SET status = ?, message_id = ?, error = ? WHERE id = ?',
    [status, fields.messageId || null, fields.error ? String(fields.error).slice(0, 250) : null, id]);
}

/**
 * Send one update. Never throws (a WhatsApp problem must not break the order flow).
 * Returns { status } — SENT, FAILED, SKIPPED or DUPLICATE.
 */
async function sendOrderUpdate(orderId, event, extra = {}) {
  try {
    await ensureSchema();
    const [order] = await query(
      `SELECT o.*, r.name AS restaurant_name, r.whatsapp_updates_enabled
       FROM orders o JOIN restaurants r ON r.id = o.restaurant_id WHERE o.id = ?`,
      [orderId]
    );
    if (!order) return { status: 'SKIPPED' };
    const text = updateText(event, order, extra);
    if (!text) return { status: 'SKIPPED' };

    const phone = normalizePhoneNumber(order.customer_phone);
    // Claim the (order, event) slot first so concurrent calls cannot double-send
    const ins = await query(
      `INSERT IGNORE INTO whatsapp_messages (order_id, restaurant_id, event, phone, status) VALUES (?, ?, ?, ?, 'PENDING')`,
      [orderId, order.restaurant_id, event, phone]
    );
    if (!ins.affectedRows) return { status: 'DUPLICATE' };
    const rowId = ins.insertId;

    if (!enabledGlobally() || Number(order.whatsapp_updates_enabled) === 0 || !phone) {
      const why = !phone ? 'No valid phone number' : (!enabledGlobally() ? 'WhatsApp order updates are switched off on the server' : 'Switched off for this restaurant');
      await record(rowId, 'SKIPPED', { error: why });
      return { status: 'SKIPPED', reason: why };
    }
    if (process.env.NODE_ENV !== 'production' && process.env.WHATSAPP_SEND_IN_DEV !== 'true') {
      await record(rowId, 'SKIPPED', { error: 'Not sent from a development server' });
      return { status: 'SKIPPED', reason: 'development' };
    }

    const payload = {
      messaging_product: 'whatsapp',
      to: phone,
      type: 'template',
      template: {
        name: process.env.WHATSAPP_ORDER_TEMPLATE || 'order_status_update',
        language: { code: process.env.WHATSAPP_ORDER_TEMPLATE_LANG || 'en' },
        components: [{
          type: 'body',
          parameters: [
            { type: 'text', text: String(order.customer_name || 'there').slice(0, 60) },
            { type: 'text', text: `#${order.order_number}` },
            { type: 'text', text },
            { type: 'text', text: String(order.restaurant_name || 'our restaurant').slice(0, 60) }
          ]
        }]
      }
    };
    try {
      const resp = await axios.post(`${GRAPH}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, payload, {
        headers: { Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
        timeout: 10000
      });
      const messageId = resp.data?.messages?.[0]?.id || null;
      await record(rowId, 'SENT', { messageId });
      return { status: 'SENT', messageId };
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.message;
      console.warn(`[WhatsApp order update] ${event} for order ${orderId} failed: ${msg}`);
      await record(rowId, 'FAILED', { error: msg });
      return { status: 'FAILED', error: msg };
    }
  } catch (err) {
    console.warn('[WhatsApp order update] skipped:', err.message);
    return { status: 'FAILED', error: err.message };
  }
}

module.exports = { ensureSchema, sendOrderUpdate, eventForStatus, updateText };
