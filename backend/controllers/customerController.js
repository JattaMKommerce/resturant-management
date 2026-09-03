const { query } = require('../config/db');
const walletService = require('../services/walletService');

/**
 * GET /api/v1/customer/portal/data
 * Complete customer profile, active live order, past orders, and Kratu Rewards
 */
async function getCustomerPortalData(req, res) {
  try {
    const customerId = req.user.id;
    const slug = req.query.slug || 'grand-palace';

    // Fetch restaurant
    const [restaurant] = await query(
      `SELECT id, name, slug, random_slug, logo_url, phone, address, area, city, opening_time, closing_time 
       FROM restaurants 
       WHERE slug = ? OR random_slug = ? LIMIT 1`,
      [slug, slug]
    );

    const tenantId = restaurant ? restaurant.id : 1;

    // Fetch customer profile
    const [user] = await query(
      `SELECT id, name, email, phone, role, created_at FROM users WHERE id = ? LIMIT 1`,
      [customerId]
    );

    if (!user) {
      return res.status(404).json({ success: false, message: 'Customer account not found.' });
    }

    // Fetch Kratu Rewards Statement
    let rewards = { availableBalance: 0, pendingBalance: 0, expiringSoonBalance: 0, availableLots: [], transactions: [] };
    try {
      rewards = await walletService.getStatement(tenantId, customerId);
    } catch (wErr) {
      console.warn('Could not fetch wallet statement for customer portal:', wErr.message);
    }

    // Fetch orders for this restaurant
    const orders = await query(
      `SELECT o.*, 
              d.name as driver_name, d.phone as driver_phone, d.vehicle_number as driver_vehicle
       FROM orders o
       LEFT JOIN delivery_drivers d ON o.delivery_driver_id = d.id
       WHERE (o.customer_id = ? OR o.customer_phone = ?) AND o.restaurant_id = ?
       ORDER BY o.id DESC LIMIT 30`,
      [customerId, user.phone, tenantId]
    );

    // Fetch items for each order
    const orderIds = orders.map(o => o.id);
    let itemsByOrder = {};
    if (orderIds.length > 0) {
      const allItems = await query(
        `SELECT * FROM order_items WHERE order_id IN (${orderIds.map(() => '?').join(',')})`,
        orderIds
      );
      allItems.forEach(it => {
        if (!itemsByOrder[it.order_id]) itemsByOrder[it.order_id] = [];
        itemsByOrder[it.order_id].push(it);
      });
    }

    const formattedOrders = orders.map(o => ({
      ...o,
      items: itemsByOrder[o.id] || []
    }));

    const activeOrders = formattedOrders.filter(o => !['DELIVERED', 'CANCELLED', 'REJECTED'].includes(o.order_status));
    const pastOrders = formattedOrders.filter(o => ['DELIVERED', 'CANCELLED', 'REJECTED'].includes(o.order_status));

    return res.json({
      success: true,
      data: {
        customer: user,
        restaurant: restaurant || { id: 1, name: 'Grand Palace' },
        rewards,
        activeOrders,
        pastOrders
      }
    });
  } catch (err) {
    console.error('getCustomerPortalData error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  getCustomerPortalData
};
