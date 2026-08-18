const { getConnection, query } = require('../config/db');
const { validateDeliveryRadius } = require('./LocationService');
const { notifyKitchen } = require('./KitchenIntegrationService');
const { sendNotification } = require('./NotificationService');
const { updateGuestInfo } = require('../middleware/guestIdentity');

const VALID_STATUSES = [
  'PENDING', 'ACCEPTED', 'SENT_TO_KITCHEN', 'PREPARING',
  'READY_FOR_PICKUP', 'ASSIGNED_TO_DRIVER', 'DRIVER_ACCEPTED',
  'PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'REJECTED', 'CANCELLED', 'DELIVERY_FAILED'
];

// Valid state machine transitions map
const ALLOWED_TRANSITIONS = {
  'PENDING': ['ACCEPTED', 'SENT_TO_KITCHEN', 'PREPARING', 'READY_FOR_PICKUP', 'ASSIGNED_TO_DRIVER', 'DRIVER_ACCEPTED', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'REJECTED', 'CANCELLED'],
  'ACCEPTED': ['SENT_TO_KITCHEN', 'PREPARING', 'READY_FOR_PICKUP', 'ASSIGNED_TO_DRIVER', 'DRIVER_ACCEPTED', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'],
  'SENT_TO_KITCHEN': ['PREPARING', 'READY_FOR_PICKUP', 'ASSIGNED_TO_DRIVER', 'DRIVER_ACCEPTED', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'],
  'PREPARING': ['READY_FOR_PICKUP', 'ASSIGNED_TO_DRIVER', 'DRIVER_ACCEPTED', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'],
  'READY_FOR_PICKUP': ['ASSIGNED_TO_DRIVER', 'DRIVER_ACCEPTED', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'],
  'ASSIGNED_TO_DRIVER': ['DRIVER_ACCEPTED', 'READY_FOR_PICKUP', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'],
  'DRIVER_ACCEPTED': ['READY_FOR_PICKUP', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'],
  'PICKED_UP': ['OUT_FOR_DELIVERY', 'DELIVERED', 'DELIVERY_FAILED', 'CANCELLED'],
  'OUT_FOR_DELIVERY': ['DELIVERED', 'DELIVERY_FAILED', 'CANCELLED', 'READY_FOR_PICKUP'],
  'DELIVERY_FAILED': ['READY_FOR_PICKUP', 'ASSIGNED_TO_DRIVER', 'DRIVER_ACCEPTED', 'DELIVERED', 'CANCELLED'],
  'DELIVERED': [],
  'REJECTED': [],
  'CANCELLED': []
};

function generateOrderNumber() {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomNum = Math.floor(10000 + Math.random() * 90000);
  return `ORD-${dateStr}-${randomNum}`;
}

/**
 * Create a new Order with server-side validation
 */
async function createOrder(orderPayload) {
  const {
    restaurantId, restaurantSlug,
    customerId, customerIdentityId,
    customerName, customerPhone,
    deliveryAddress, deliveryArea, deliveryLandmark, deliveryInstructions,
    customerLatitude, customerLongitude,
    paymentMethod,
    items
  } = orderPayload;

  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new Error('Order cart cannot be empty.');
  }

  if (!customerName || !customerPhone) {
    throw new Error('Customer name and phone are required.');
  }

  // 1. Fetch restaurant
  let restaurant;
  if (restaurantId) {
    const rows = await query('SELECT * FROM restaurants WHERE id = ?', [restaurantId]);
    restaurant = rows[0];
  } else if (restaurantSlug) {
    const rows = await query('SELECT * FROM restaurants WHERE slug = ?', [restaurantSlug]);
    restaurant = rows[0];
  }

  if (!restaurant) throw new Error('Restaurant not found.');

  // Check restaurant status
  if (restaurant.status === 'SUSPENDED') {
    throw new Error('This restaurant is currently suspended.');
  }
  if (restaurant.status !== 'ACTIVE') {
    throw new Error('This restaurant is not currently active.');
  }
  if (restaurant.website_status !== 'PUBLISHED') {
    throw new Error('This restaurant is not currently accepting orders online.');
  }
  if (!restaurant.is_online_ordering_enabled) {
    throw new Error('Online ordering is currently unavailable at this restaurant.');
  }

  // 2. Server-side Haversine distance validation (only if location provided)
  let radiusValidation = null;
  if (customerLatitude && customerLongitude) {
    radiusValidation = validateDeliveryRadius(
      restaurant.latitude, restaurant.longitude,
      customerLatitude, customerLongitude,
      restaurant.delivery_radius_km
    );

    if (!radiusValidation.isValid) {
      throw new Error(
        `Sorry, we're currently unable to deliver to your location. Your location is ${radiusValidation.distanceKm} km away, which exceeds our maximum delivery radius of ${radiusValidation.maxRadiusKm} km.`
      );
    }
  }

  // 3. Validate menu items and recalculate prices server-side
  const itemIds = items.map(i => i.menuItemId);
  const placeholders = itemIds.map(() => '?').join(',');
  const menuItems = await query(
    `SELECT * FROM menu_items WHERE id IN (${placeholders}) AND restaurant_id = ?`,
    [...itemIds, restaurant.id]
  );

  const menuItemMap = {};
  menuItems.forEach(mi => { menuItemMap[mi.id] = mi; });

  let subtotal = 0;
  const processedItems = [];

  for (const item of items) {
    const dbItem = menuItemMap[item.menuItemId];
    if (!dbItem) throw new Error(`Menu item ID ${item.menuItemId} is not available at this restaurant.`);
    if (dbItem.is_available !== 1) throw new Error(`"${dbItem.name}" is currently out of stock.`);

    const unitPrice = dbItem.discounted_price ? parseFloat(dbItem.discounted_price) : parseFloat(dbItem.price);
    const itemTotal = unitPrice * item.quantity;
    subtotal += itemTotal;

    processedItems.push({
      menu_item_id: dbItem.id,
      item_name: dbItem.name,
      unit_price: unitPrice,
      quantity: item.quantity,
      item_total: itemTotal,
      special_instructions: item.specialInstructions || null
    });
  }

  if (subtotal < parseFloat(restaurant.min_order_amount)) {
    throw new Error(`Minimum order amount is ₹${restaurant.min_order_amount}.`);
  }

  // Server-side price calculation
  const taxPercentage = parseFloat(restaurant.tax_percentage || 5);
  const taxAmount = Math.round((subtotal * (taxPercentage / 100)) * 100) / 100;
  const deliveryFee = parseFloat(restaurant.delivery_fee || 49);
  const totalAmount = Math.round((subtotal + taxAmount + deliveryFee) * 100) / 100;

  const orderNumber = generateOrderNumber();
  const conn = await getConnection();

  try {
    await conn.beginTransaction();

    const [orderRes] = await conn.query(
      `INSERT INTO orders (
        order_number, restaurant_id, customer_identity_id, customer_id,
        customer_name, customer_phone,
        delivery_address, delivery_area, delivery_landmark, delivery_instructions,
        customer_latitude, customer_longitude, distance_km,
        subtotal, tax_amount, delivery_fee, discount_amount, total_amount,
        payment_method, payment_status, order_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0.00, ?, ?, 'PENDING', 'PENDING')`,
      [
        orderNumber, restaurant.id, customerIdentityId || null, customerId || null,
        customerName, customerPhone,
        deliveryAddress, deliveryArea, deliveryLandmark || null, deliveryInstructions || null,
        customerLatitude || null, customerLongitude || null, radiusValidation?.distanceKm || null,
        subtotal, taxAmount, deliveryFee, totalAmount,
        paymentMethod
      ]
    );

    const orderId = orderRes.insertId;

    // Insert order items (price snapshots)
    for (const pItem of processedItems) {
      await conn.query(
        `INSERT INTO order_items (order_id, menu_item_id, item_name, unit_price, quantity, item_total, special_instructions)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [orderId, pItem.menu_item_id, pItem.item_name, pItem.unit_price, pItem.quantity, pItem.item_total, pItem.special_instructions]
      );
    }

    // Initial status history
    await conn.query(
      `INSERT INTO order_status_history (order_id, status, notes, changed_by_user_id) VALUES (?, 'PENDING', 'Order placed by customer', NULL)`,
      [orderId]
    );

    await conn.commit();

    if (customerIdentityId) {
      await updateGuestInfo(customerIdentityId, customerName, customerPhone);
    }

    // Notify restaurant admin
    await sendNotification({
      restaurantId: restaurant.id,
      orderId: orderId,
      title: `New Order! #${orderNumber}`,
      message: `New order from ${customerName} — ₹${totalAmount}`,
      type: 'NEW_ORDER'
    });

    // Notify customer
    await sendNotification({
      orderId: orderId,
      customerIdentityId,
      title: 'Order Placed Successfully!',
      message: `Your order #${orderNumber} for ₹${totalAmount} has been placed.`
    });

    // Automatically dispatch online order KOT to Kitchen KDS station
    try {
      await notifyKitchen({
        id: orderId,
        order_number: orderNumber,
        restaurant_id: restaurant.id,
        items: processedItems,
        order_type: 'ONLINE'
      });
    } catch (kErr) {
      console.warn('[ORDER SERVICE] Kitchen auto-dispatch warning:', kErr.message);
    }

    return {
      id: orderId,
      orderId,
      orderNumber,
      restaurantName: restaurant.name,
      restaurantSlug: restaurant.slug,
      distanceKm: radiusValidation?.distanceKm || null,
      subtotal, taxAmount, deliveryFee, totalAmount,
      paymentMethod,
      orderStatus: 'PENDING',
      items: processedItems
    };

  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * Update Order Status with strict state machine validation
 */
async function updateOrderStatus(orderId, newStatus, userId = null, notes = '') {
  if (!VALID_STATUSES.includes(newStatus)) {
    throw new Error(`Invalid status "${newStatus}".`);
  }

  const [order] = await query('SELECT * FROM orders WHERE id = ?', [orderId]);
  if (!order) throw new Error('Order not found.');

  const prevStatus = order.order_status;

  // Enforce transition rules unless forced by system recovery
  if (prevStatus !== newStatus) {
    const allowed = ALLOWED_TRANSITIONS[prevStatus] || [];
    if (!allowed.includes(newStatus)) {
      throw new Error(`Invalid status transition from "${prevStatus}" to "${newStatus}".`);
    }
  }

  await query('UPDATE orders SET order_status = ? WHERE id = ?', [newStatus, orderId]);
  await query(
    'INSERT INTO order_status_history (order_id, status, notes, changed_by_user_id) VALUES (?, ?, ?, ?)',
    [orderId, newStatus, notes || `Status changed to ${newStatus}`, userId]
  );

  // Kitchen integration
  if (newStatus === 'SENT_TO_KITCHEN' || newStatus === 'ACCEPTED' || newStatus === 'PREPARING') {
    const items = await query('SELECT * FROM order_items WHERE order_id = ?', [orderId]);
    await notifyKitchen({ ...order, items });
  }

  // Driver room notifications & Customer tracking notifications
  let notifTitle = `Order #${order.order_number} Update`;
  let notifMsg = `Your order status: ${newStatus}`;

  if (newStatus === 'ACCEPTED') {
    notifTitle = 'Order Accepted! ✅';
    notifMsg = `Your order #${order.order_number} has been accepted.`;
  } else if (newStatus === 'PREPARING' || newStatus === 'SENT_TO_KITCHEN') {
    notifTitle = 'Preparing Your Order 🍳';
    notifMsg = `Your food is being prepared for order #${order.order_number}.`;
  } else if (newStatus === 'READY_FOR_PICKUP') {
    notifTitle = 'Order Ready for Pickup 📦';
    notifMsg = `Your order #${order.order_number} is packed and ready.`;
  } else if (newStatus === 'ASSIGNED_TO_DRIVER') {
    notifTitle = 'Delivery Partner Assigned 🛵';
    notifMsg = `A delivery partner has been assigned to your order #${order.order_number}.`;
  } else if (newStatus === 'DRIVER_ACCEPTED') {
    notifTitle = 'Delivery Partner Accepted ✅';
    notifMsg = `Your delivery partner is heading to the restaurant.`;
  } else if (newStatus === 'PICKED_UP') {
    notifTitle = 'Food Picked Up! 🛍️';
    notifMsg = `Your food package has been picked up from the restaurant.`;
  } else if (newStatus === 'OUT_FOR_DELIVERY') {
    notifTitle = 'Out for Delivery 🚀';
    notifMsg = `Your order #${order.order_number} is on the way! Track live location.`;
  } else if (newStatus === 'DELIVERED') {
    notifTitle = 'Order Delivered! 🎉';
    notifMsg = `Your order #${order.order_number} has been delivered. Enjoy your meal!`;
  } else if (newStatus === 'DELIVERY_FAILED') {
    notifTitle = 'Delivery Issue Update ⚠️';
    notifMsg = `There was an issue delivering order #${order.order_number}. The restaurant team is resolving it.`;
  } else if (newStatus === 'REJECTED') {
    notifTitle = 'Order Rejected ❌';
    notifMsg = `Unfortunately, your order #${order.order_number} was rejected.`;
  } else if (newStatus === 'CANCELLED') {
    notifTitle = 'Order Cancelled';
    notifMsg = `Your order #${order.order_number} has been cancelled.`;
  }

  await sendNotification({
    userId: order.customer_id,
    restaurantId: order.restaurant_id,
    orderId: orderId,
    customerIdentityId: order.customer_identity_id,
    title: notifTitle,
    message: notifMsg
  });

  return { success: true, orderId, prevStatus, newStatus };
}

/**
 * Assign Delivery Driver (Phase 2 with restaurant assignment verification)
 */
async function assignDriver(orderId, driverId, userId = null) {
  const [driver] = await query(
    'SELECT * FROM delivery_drivers WHERE id = ? AND account_status = "ACTIVE"',
    [driverId]
  );
  if (!driver) throw new Error('Driver not found or account is not active.');

  const [order] = await query('SELECT * FROM orders WHERE id = ?', [orderId]);
  if (!order) throw new Error('Order not found.');

  // Verify driver has an ACTIVE assignment to this order's restaurant
  const [assignment] = await query(
    'SELECT id FROM driver_restaurant_assignments WHERE driver_id = ? AND restaurant_id = ? AND status = "ACTIVE"',
    [driverId, order.restaurant_id]
  );

  if (!assignment) {
    // Auto-create active assignment for active approved driver
    await query(
      `INSERT INTO driver_restaurant_assignments (driver_id, restaurant_id, status, approved_at)
       VALUES (?, ?, 'ACTIVE', NOW())
       ON DUPLICATE KEY UPDATE status = 'ACTIVE', approved_at = NOW()`,
      [driverId, order.restaurant_id]
    );
  }

  await query(
    'UPDATE orders SET assigned_driver_id = ?, order_status = "ASSIGNED_TO_DRIVER" WHERE id = ?',
    [driverId, orderId]
  );
  await query('UPDATE delivery_drivers SET availability_status = "BUSY" WHERE id = ?', [driverId]);

  await query(
    'INSERT INTO order_status_history (order_id, status, notes, changed_by_user_id) VALUES (?, "ASSIGNED_TO_DRIVER", ?, ?)',
    [orderId, `Assigned to delivery partner ${driver.full_name || 'Driver #' + driverId}`, userId]
  );

  // Notify driver
  await sendNotification({
    userId: driver.user_id,
    restaurantId: order.restaurant_id,
    orderId,
    title: 'New Delivery Assignment! 🛵',
    message: `New delivery assigned: Order #${order.order_number}. Please accept in app.`
  });

  // Notify customer
  await sendNotification({
    orderId,
    customerIdentityId: order.customer_identity_id,
    title: 'Delivery Partner Assigned 🛵',
    message: `Delivery partner ${driver.full_name || 'Partner'} has been assigned to order #${order.order_number}.`
  });

  return { success: true, orderId, driverId, driverName: driver.full_name };
}

/**
 * Recover Failed Delivery (Phase 2 Admin Recovery Workflow)
 * Action can be: 'REASSIGN' (assign new driver), 'RETRY' (reset to READY_FOR_PICKUP), or 'CANCEL' (cancel order)
 */
async function recoverFailedDelivery(orderId, action, newDriverId = null, userId = null, notes = '') {
  const [order] = await query('SELECT * FROM orders WHERE id = ?', [orderId]);
  if (!order) throw new Error('Order not found.');

  if (order.order_status !== 'DELIVERY_FAILED') {
    throw new Error('Recovery workflow is only applicable for orders in DELIVERY_FAILED status.');
  }

  if (action === 'REASSIGN') {
    if (!newDriverId) throw new Error('New driver ID is required for reassignment.');
    return await assignDriver(orderId, newDriverId, userId);
  } else if (action === 'RETRY') {
    await query(
      'UPDATE orders SET assigned_driver_id = NULL, order_status = "READY_FOR_PICKUP" WHERE id = ?',
      [orderId]
    );
    await query(
      'INSERT INTO order_status_history (order_id, status, notes, changed_by_user_id) VALUES (?, "READY_FOR_PICKUP", ?, ?)',
      [orderId, `Delivery retry initiated by admin: ${notes || 'Reset for pickup'}`, userId]
    );
    return { success: true, orderId, status: 'READY_FOR_PICKUP' };
  } else if (action === 'CANCEL') {
    await query('UPDATE orders SET order_status = "CANCELLED" WHERE id = ?', [orderId]);
    await query(
      'INSERT INTO order_status_history (order_id, status, notes, changed_by_user_id) VALUES (?, "CANCELLED", ?, ?)',
      [orderId, `Order cancelled after delivery failure: ${notes || 'Operational cancellation'}`, userId]
    );
    return { success: true, orderId, status: 'CANCELLED' };
  } else {
    throw new Error('Invalid recovery action. Must be REASSIGN, RETRY, or CANCEL.');
  }
}

module.exports = {
  createOrder,
  updateOrderStatus,
  assignDriver,
  recoverFailedDelivery
};
