const { getConnection, query } = require('../config/db');
const { validateDeliveryRadius } = require('./LocationService');
const { notifyKitchen } = require('./KitchenIntegrationService');
const { sendNotification, getSocketIO } = require('./NotificationService');
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
 *
 * - Prices, tax, delivery fee and discounts are all computed here; nothing money-related is
 *   trusted from the browser (the rewards discount comes from the wallet reservation).
 * - Disabled, hidden-from-online and sold-out items cannot be ordered (REQ-003 / REQ-018);
 *   tracked stock is taken inside the same transaction as the order.
 * - Repeated clicks / network retries return the same order instead of creating another
 *   (REQ-025): by the checkout's idempotency key, or for older pages without one, by an
 *   identical order from the same phone in the last 2 minutes.
 * - Online-payment orders are held back from the restaurant, kitchen and drivers until the
 *   payment is verified (REQ-024). COD orders are released immediately.
 */
const MAX_QTY_PER_LINE = 100;
const DUPLICATE_WINDOW_SECONDS = 120;

function cleanIdempotencyKey(raw) {
  if (!raw) return null;
  const key = String(raw).trim().slice(0, 64);
  return /^[A-Za-z0-9_-]{8,64}$/.test(key) ? key : null;
}

function itemsSignature(lines) {
  return lines
    .map((l) => `${l.menu_item_id}x${l.quantity}`)
    .sort()
    .join(',');
}

async function buildOrderResult(orderId, restaurant, extra = {}) {
  const [o] = await query('SELECT * FROM orders WHERE id = ?', [orderId]);
  const items = await query(
    'SELECT menu_item_id, item_name, unit_price, quantity, item_total, special_instructions FROM order_items WHERE order_id = ? AND COALESCE(order_source, "ONLINE") = "ONLINE"',
    [orderId]
  );
  return {
    id: o.id,
    orderId: o.id,
    orderNumber: o.order_number,
    restaurantName: restaurant.name,
    restaurantSlug: restaurant.slug,
    distanceKm: o.distance_km != null ? parseFloat(o.distance_km) : null,
    subtotal: parseFloat(o.subtotal),
    taxAmount: parseFloat(o.tax_amount),
    deliveryFee: parseFloat(o.delivery_fee),
    discountAmount: parseFloat(o.discount_amount || 0),
    totalAmount: parseFloat(o.total_amount),
    taxRate: o.tax_rate != null ? parseFloat(o.tax_rate) : null,
    couponCode: o.coupon_code || null,
    couponDiscount: parseFloat(o.coupon_discount || 0),
    orderType: o.order_type || 'DELIVERY',
    paymentMethod: o.payment_method,
    paymentStatus: o.payment_status,
    awaitingPayment: Number(o.payment_hold) === 1,
    orderStatus: o.order_status,
    items,
    ...extra
  };
}

async function createOrder(orderPayload) {
  const OrderLifecycle = require('./OrderLifecycleService');
  await OrderLifecycle.ensureOrderSchema();

  const {
    restaurantId, restaurantSlug,
    customerId, customerIdentityId,
    customerName, customerPhone,
    deliveryAddress, deliveryArea, deliveryLandmark, deliveryInstructions,
    customerLatitude, customerLongitude,
    items
  } = orderPayload;

  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new Error('Order cart cannot be empty.');
  }

  if (!customerName || !customerPhone) {
    throw new Error('Customer name and phone are required.');
  }

  const paymentMethod = String(orderPayload.paymentMethod || 'COD').toUpperCase();
  if (!['COD', 'ONLINE'].includes(paymentMethod)) {
    throw new Error('Please choose Cash on Delivery or Online Payment.');
  }

  // REQ-008: DELIVERY or TAKEAWAY (customer collects from the restaurant)
  const orderType = String(orderPayload.orderType || orderPayload.order_type || 'DELIVERY').toUpperCase();
  if (!['DELIVERY', 'TAKEAWAY'].includes(orderType)) {
    throw new Error('Please choose Delivery or Takeaway.');
  }
  const isTakeaway = orderType === 'TAKEAWAY';
  if (!isTakeaway && !String(deliveryAddress || '').trim()) {
    throw new Error('Please enter a delivery address.');
  }

  // 1. Fetch restaurant
  let restaurant;
  if (restaurantId) {
    const rows = await query('SELECT * FROM restaurants WHERE id = ?', [restaurantId]);
    restaurant = rows[0];
  } else if (restaurantSlug) {
    const cleanSlug = String(restaurantSlug).toLowerCase();
    let rows = await query(
      `SELECT * FROM restaurants
       WHERE LOWER(random_slug) = ? OR LOWER(slug) = ? OR LOWER(custom_subdomain_slug) = ?`,
      [cleanSlug, cleanSlug, cleanSlug]
    );
    if (rows.length === 0) {
      rows = await query('SELECT * FROM restaurants ORDER BY (website_status = "PUBLISHED") DESC, id ASC LIMIT 1');
    }
    restaurant = rows[0];
  } else {
    const rows = await query('SELECT * FROM restaurants ORDER BY (website_status = "PUBLISHED") DESC, id ASC LIMIT 1');
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
  if (paymentMethod === 'COD' && Number(restaurant.is_cod_enabled) === 0) {
    throw new Error('Cash on Delivery is not available at this restaurant. Please pay online.');
  }
  if (paymentMethod === 'ONLINE' && Number(restaurant.is_online_payment_enabled) === 0) {
    throw new Error('Online payment is not available at this restaurant. Please choose Cash on Delivery.');
  }
  if (isTakeaway && Number(restaurant.is_takeaway_enabled) === 0) {
    throw new Error('Takeaway is not available at this restaurant. Please choose delivery.');
  }

  // 2. Server-side Haversine distance validation (only if location provided)
  let radiusValidation = null;
  if (!isTakeaway && customerLatitude && customerLongitude) {
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

  // 3. Validate quantities, then menu items, and recalculate prices server-side
  const cartLines = items.map((i) => {
    const qty = Number(i.quantity);
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY_PER_LINE) {
      throw new Error(`Each item quantity must be a whole number between 1 and ${MAX_QTY_PER_LINE}.`);
    }
    const id = parseInt(i.menuItemId || i.menu_item_id, 10);
    if (!id) throw new Error('Invalid menu item in cart.');
    return { id, quantity: qty, specialInstructions: i.specialInstructions || i.special_instructions || null };
  });

  const itemIds = [...new Set(cartLines.map((l) => l.id))];
  const placeholders = itemIds.map(() => '?').join(',');
  const menuItems = await query(
    `SELECT mi.*, c.meal_periods AS category_meal_periods
     FROM menu_items mi LEFT JOIN categories c ON c.id = mi.category_id
     WHERE mi.id IN (${placeholders}) AND (mi.restaurant_id = ? OR mi.restaurant_id IS NULL)`,
    [...itemIds, restaurant.id]
  );

  // REQ-001: only dishes served in the current meal period can be ordered
  const meals = require('../utils/mealPeriods');
  const mealConfig = meals.configFor(restaurant);
  const servingNow = meals.currentPeriod(mealConfig);

  const menuItemMap = {};
  menuItems.forEach(mi => { menuItemMap[mi.id] = mi; });

  const qtyPerItem = {};
  let subtotal = 0;
  const processedItems = [];

  for (const line of cartLines) {
    const dbItem = menuItemMap[line.id];
    if (!dbItem) throw new Error(`Menu item ID ${line.id} is not available at this restaurant.`);
    const disabled = Number(dbItem.is_available) !== 1 ||
      (dbItem.is_active != null && Number(dbItem.is_active) === 0) ||
      (dbItem.is_available_online != null && Number(dbItem.is_available_online) === 0);
    if (disabled) throw new Error(`"${dbItem.name}" is currently unavailable. Please remove it from your cart.`);
    if (mealConfig.enabled) {
      const periods = meals.effectivePeriods(dbItem.meal_periods, dbItem.category_meal_periods);
      if (!meals.servedIn(periods, servingNow)) {
        throw new Error(`"${dbItem.name}" is only served at ${meals.servedWhenText(periods, mealConfig)}. Please remove it from your cart.`);
      }
    }

    qtyPerItem[dbItem.id] = (qtyPerItem[dbItem.id] || 0) + line.quantity;
    if (dbItem.stock_quantity != null && qtyPerItem[dbItem.id] > Number(dbItem.stock_quantity)) {
      const left = Math.max(0, Number(dbItem.stock_quantity));
      throw new Error(left === 0
        ? `"${dbItem.name}" is sold out. Please remove it from your cart.`
        : `Only ${left} portion(s) of "${dbItem.name}" are left. Please reduce the quantity.`);
    }

    const unitPrice = dbItem.discounted_price ? parseFloat(dbItem.discounted_price) : parseFloat(dbItem.price);
    const itemTotal = Math.round(unitPrice * line.quantity * 100) / 100;
    subtotal += itemTotal;

    processedItems.push({
      menu_item_id: dbItem.id,
      item_name: dbItem.name,
      unit_price: unitPrice,
      quantity: line.quantity,
      item_total: itemTotal,
      special_instructions: line.specialInstructions
    });
  }
  subtotal = Math.round(subtotal * 100) / 100;

  if (subtotal < parseFloat(restaurant.min_order_amount)) {
    throw new Error(`Minimum order amount is ₹${restaurant.min_order_amount}.`);
  }

  // Coupon (REQ-022): discount on the food subtotal. Previewed here, then checked again with the
  // coupon row locked inside the order transaction.
  const CouponService = require('./CouponService');
  const couponCode = orderPayload.couponCode ? CouponService.normalizeCode(orderPayload.couponCode) : null;
  let couponDiscount = 0;
  if (couponCode) {
    couponDiscount = (await CouponService.preview({ restaurantId: restaurant.id, code: couponCode, subtotal, customerPhone })).discount;
  }

  // Server-side price calculation. GST (REQ-027) is charged on the food value after the coupon
  // discount and shown as CGST + SGST (half each) on the invoice. A rate or fee of 0 is respected.
  const taxPercentage = parseFloat(restaurant.tax_percentage ?? 5) || 0;
  const taxableValue = Math.round((subtotal - couponDiscount) * 100) / 100;
  const taxAmount = Math.round((taxableValue * (taxPercentage / 100)) * 100) / 100;
  const deliveryFee = isTakeaway ? 0 : (parseFloat(restaurant.delivery_fee ?? 49) || 0);
  const grossTotal = taxableValue + taxAmount + deliveryFee;

  // Kratu Rewards discount: the amount actually reserved in the wallet, never the browser's figure
  let rewardsDiscount = 0;
  if (orderPayload.walletCheckoutId) {
    const [reservation] = await query(
      `SELECT reserved_amount FROM wallet_reservations WHERE checkout_id = ? AND tenant_id = ? AND status = 'RESERVED' LIMIT 1`,
      [orderPayload.walletCheckoutId, restaurant.id]
    );
    if (reservation) rewardsDiscount = Math.min(parseFloat(reservation.reserved_amount) || 0, grossTotal);
  }
  const rewardsApplied = Math.round(rewardsDiscount * 100) / 100;
  // discount_amount = everything taken off (coupon + rewards); total = subtotal + tax + fee - discount
  const discountAmount = Math.round((couponDiscount + rewardsApplied) * 100) / 100;
  const totalAmount = Math.max(0, Math.round((grossTotal - rewardsApplied) * 100) / 100);

  // Resolve actual customer ID if not provided directly
  let actualCustomerId = customerId || null;
  if (!actualCustomerId && customerPhone) {
    const cleanPhone = String(customerPhone).replace(/[^0-9]/g, '').slice(-10);
    if (cleanPhone.length >= 10) {
      const [u] = await query('SELECT id FROM users WHERE phone LIKE ? OR phone = ? LIMIT 1', [`%${cleanPhone}%`, cleanPhone]);
      if (u) actualCustomerId = u.id;
    }
  }

  const idempotencyKey = cleanIdempotencyKey(orderPayload.idempotencyKey || orderPayload.idempotency_key);
  const phoneDigits = String(customerPhone).replace(/\D/g, '').slice(-10);
  const lockName = `hms_order_${restaurant.id}_${phoneDigits}`.slice(0, 64);
  const signature = itemsSignature(processedItems);
  const holdForPayment = paymentMethod === 'ONLINE';

  const orderNumber = generateOrderNumber();
  const conn = await getConnection();
  let lockHeld = false;

  try {
    // Serialise checkouts from the same phone at the same restaurant so two simultaneous
    // submits cannot both pass the duplicate check.
    const [[lockRow]] = await conn.query('SELECT GET_LOCK(?, 10) AS got', [lockName]);
    lockHeld = Number(lockRow?.got) === 1;

    // Duplicate check 1: same checkout attempt (idempotency key)
    if (idempotencyKey) {
      const [dupRows] = await conn.query(
        'SELECT id FROM orders WHERE restaurant_id = ? AND idempotency_key = ? LIMIT 1',
        [restaurant.id, idempotencyKey]
      );
      if (dupRows.length > 0) {
        return await buildOrderResult(dupRows[0].id, restaurant, { duplicate: true });
      }
    } else {
      // Duplicate check 2 (older checkout pages without a key): identical recent order
      const [recent] = await conn.query(
        `SELECT id, total_amount FROM orders
         WHERE restaurant_id = ? AND customer_phone = ? AND payment_method = ? AND COALESCE(order_type, 'DELIVERY') = ?
           AND order_status NOT IN ('CANCELLED', 'REJECTED')
           AND created_at >= (NOW() - INTERVAL ? SECOND)
         ORDER BY id DESC LIMIT 3`,
        [restaurant.id, customerPhone, paymentMethod, orderType, DUPLICATE_WINDOW_SECONDS]
      );
      for (const r of recent) {
        if (Math.abs(parseFloat(r.total_amount) - totalAmount) > 0.009) continue;
        const [lines] = await conn.query('SELECT menu_item_id, quantity FROM order_items WHERE order_id = ? AND COALESCE(order_source, "ONLINE") = "ONLINE"', [r.id]);
        if (itemsSignature(lines) === signature) {
          return await buildOrderResult(r.id, restaurant, { duplicate: true });
        }
      }
    }

    await conn.beginTransaction();

    // Take tracked stock atomically; fails if another order took the last portions meanwhile
    for (const [menuItemId, qty] of Object.entries(qtyPerItem)) {
      const [upd] = await conn.query(
        `UPDATE menu_items SET stock_quantity = stock_quantity - ?
         WHERE id = ? AND stock_quantity IS NOT NULL AND stock_quantity >= ?`,
        [qty, menuItemId, qty]
      );
      if (upd.affectedRows === 0 && menuItemMap[menuItemId].stock_quantity != null) {
        throw new Error(`"${menuItemMap[menuItemId].name}" just sold out. Please update your cart.`);
      }
    }

    let couponRedemption = null;
    if (couponCode) {
      couponRedemption = await CouponService.redeemInTransaction(conn, { restaurantId: restaurant.id, code: couponCode, subtotal, customerPhone });
      if (Math.abs(couponRedemption.discount - couponDiscount) > 0.009) {
        throw new Error('This coupon was just changed. Please apply it again.');
      }
    }

    const finalAddress = isTakeaway ? (String(deliveryAddress || '').trim() || 'Takeaway - collect at restaurant') : deliveryAddress;
    const safeDeliveryArea = isTakeaway ? 'Takeaway' : ((deliveryArea && String(deliveryArea).trim())
      || (deliveryAddress ? String(deliveryAddress).trim().slice(0, 50) : '')
      || 'Standard Delivery');

    const [orderRes] = await conn.query(
      `INSERT INTO orders (
        order_number, restaurant_id, customer_identity_id, customer_id,
        customer_name, customer_phone,
        delivery_address, delivery_area, delivery_landmark, delivery_instructions,
        customer_latitude, customer_longitude, distance_km,
        subtotal, tax_amount, delivery_fee, discount_amount, total_amount,
        payment_method, payment_status, order_status, idempotency_key, payment_hold,
        order_type, coupon_code, coupon_discount, tax_rate
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', 'PENDING', ?, ?, ?, ?, ?, ?)`,
      [
        orderNumber, restaurant.id, customerIdentityId || null, actualCustomerId || null,
        customerName, customerPhone,
        finalAddress, safeDeliveryArea, deliveryLandmark || null, deliveryInstructions || null,
        customerLatitude || null, customerLongitude || null, radiusValidation?.distanceKm || null,
        subtotal, taxAmount, deliveryFee, discountAmount, totalAmount,
        paymentMethod, idempotencyKey, holdForPayment ? 1 : 0,
        orderType, couponCode, couponDiscount, taxPercentage
      ]
    );

    const orderId = orderRes.insertId;
    if (couponRedemption) await couponRedemption.record(orderId);

    // Insert order items (price snapshots)
    for (const pItem of processedItems) {
      await conn.query(
        `INSERT INTO order_items (order_id, menu_item_id, item_name, unit_price, quantity, item_total, special_instructions, order_source)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'ONLINE')`,
        [orderId, pItem.menu_item_id, pItem.item_name, pItem.unit_price, pItem.quantity, pItem.item_total, pItem.special_instructions]
      );
    }

    // Initial status history
    await conn.query(
      `INSERT INTO order_status_history (order_id, status, notes, changed_by_user_id) VALUES (?, 'PENDING', ?, NULL)`,
      [orderId, holdForPayment ? 'Order placed by customer. Waiting for online payment.' : 'Order placed by customer']
    );

    await conn.commit();

    // Kratu Rewards: Commit reservation and issue PENDING cashback (Slide 05 & 06)
    try {
      const walletService = require('./walletService');

      // 1. Commit redemption if rewards were applied
      if (orderPayload.walletCheckoutId && rewardsDiscount > 0) {
        await walletService.commitRedemption(restaurant.id, orderPayload.walletCheckoutId, orderId);
      }

      // 2. Calculate and create PENDING cashback (Slide 05: unlocks only upon delivery)
      const earned = await walletService.calculateCashback(restaurant.id, subtotal, actualCustomerId);
      // Cashback needs a customer account (wallet_accounts.customer_id is required)
      if (actualCustomerId && earned.eligible && earned.cashbackAmount > 0) {
        await walletService.createPendingCredit(
          restaurant.id,
          actualCustomerId || null,
          orderId,
          earned.cashbackAmount,
          customerPhone
        );
      }
    } catch (wErr) {
      console.warn('[Wallet] Post-order rewards processing warning:', wErr.message);
    }

    if (customerIdentityId) {
      await updateGuestInfo(customerIdentityId, customerName, customerPhone);
    }

    // REQ-039: alert when a dish runs low / sells out
    require('./StockAlertService').checkMenuItems(Object.keys(qtyPerItem), restaurant.id);

    // COD orders go to the restaurant, kitchen and drivers now; online-payment orders only
    // after the payment is verified (PaymentService -> OrderLifecycle.releasePaidOrder).
    if (!holdForPayment) {
      await OrderLifecycle.releaseOrderToRestaurant(orderId);
    }

    return {
      id: orderId,
      orderId,
      orderNumber,
      restaurantName: restaurant.name,
      restaurantSlug: restaurant.slug,
      distanceKm: radiusValidation?.distanceKm || null,
      subtotal, taxAmount, deliveryFee, discountAmount, totalAmount,
      taxRate: taxPercentage,
      couponCode, couponDiscount,
      orderType,
      paymentMethod,
      paymentStatus: 'PENDING',
      awaitingPayment: holdForPayment,
      orderStatus: 'PENDING',
      items: processedItems
    };

  } catch (err) {
    try { await conn.rollback(); } catch (rbErr) { /* no open transaction */ }
    if (err && err.code === 'ER_DUP_ENTRY' && idempotencyKey) {
      // Same checkout key raced in from another request: return that order
      const [dup] = await query('SELECT id FROM orders WHERE restaurant_id = ? AND idempotency_key = ? LIMIT 1', [restaurant.id, idempotencyKey]);
      if (dup) return buildOrderResult(dup.id, restaurant, { duplicate: true });
    }
    throw err;
  } finally {
    if (lockHeld) {
      try { await conn.query('SELECT RELEASE_LOCK(?)', [lockName]); } catch (e) { /* ignore */ }
    }
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

  // An online-payment order that has not been paid yet must not be accepted, cooked or
  // dispatched (REQ-024). It can only be cancelled/rejected until the payment is verified.
  if (Number(order.payment_hold) === 1 && prevStatus !== newStatus && !['CANCELLED', 'REJECTED'].includes(newStatus)) {
    throw new Error('This order is still waiting for the customer\'s online payment. It can only be cancelled until the payment is completed.');
  }

  // Conditional update: if someone else changed the status in the meantime, stop here so
  // cancellation side effects (refund, stock) can never run twice.
  const upd = await query('UPDATE orders SET order_status = ? WHERE id = ? AND order_status = ?', [newStatus, orderId, prevStatus]);
  if (!upd.affectedRows) {
    throw new Error('This order was just updated by someone else. Please refresh and try again.');
  }
  await query(
    'INSERT INTO order_status_history (order_id, status, notes, changed_by_user_id) VALUES (?, ?, ?, ?)',
    [orderId, newStatus, notes || `Status changed to ${newStatus}`, userId]
  );

  // Cancellation / rejection: give stock back, refund a paid order, keep the reason (REQ-006)
  let closedRefunds = [];
  if ((newStatus === 'CANCELLED' || newStatus === 'REJECTED') && prevStatus !== newStatus) {
    try {
      const closed = await require('./OrderLifecycleService').onOrderClosed(order, { status: newStatus, reason: notes, userId });
      closedRefunds = closed.refunds || [];
    } catch (closeErr) {
      console.error(`[OrderService] cancellation follow-up failed for order ${orderId}:`, closeErr.message);
    }
  }

  // Kitchen integration
  if (newStatus === 'SENT_TO_KITCHEN' || newStatus === 'ACCEPTED' || newStatus === 'PREPARING') {
    const items = await query('SELECT * FROM order_items WHERE order_id = ? AND COALESCE(order_source, "ONLINE") = "ONLINE"', [orderId]);
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

    // Kratu Rewards: Unlock and activate PENDING cashback into AVAILABLE rewards (Slide 05)
    try {
      const walletService = require('./walletService');
      await walletService.activateCredit(order.restaurant_id, orderId);
    } catch (wErr) {
      console.warn('[Wallet] Error activating pending credit upon delivery:', wErr.message);
    }

    // Driver Compensation: Credit commission, delivery incentive, and salary to driver wallet
    try {
      let deliveryOrder = order;
      if (!deliveryOrder.assigned_driver_id) {
        const [fresh] = await query('SELECT * FROM orders WHERE id = ?', [orderId]);
        if (fresh) deliveryOrder = fresh;
      }
      const driverPayoutController = require('../controllers/driverPayoutController');
      await driverPayoutController.creditDriverDeliveryEarnings({
        ...deliveryOrder,
        order_status: 'DELIVERED'
      });
    } catch (dpErr) {
      console.warn('[Driver Payout] Error crediting delivery earnings:', dpErr.message);
    }
  } else if (newStatus === 'DELIVERY_FAILED') {
    notifTitle = 'Delivery Issue Update ⚠️';
    notifMsg = `There was an issue delivering order #${order.order_number}. The restaurant team is resolving it.`;
  } else if (newStatus === 'REJECTED') {
    notifTitle = 'Order Rejected ❌';
    notifMsg = `Unfortunately, your order #${order.order_number} was rejected.`;

    // Kratu Rewards: Reverse pending rewards upon rejection
    try {
      const walletService = require('./walletService');
      await walletService.reverseCredit(order.restaurant_id, orderId, 'Order rejected');
    } catch (wErr) {
      console.warn('[Wallet] Error reversing rewards upon rejection:', wErr.message);
    }
  } else if (newStatus === 'CANCELLED') {
    notifTitle = 'Order Cancelled';
    notifMsg = `Your order #${order.order_number} has been cancelled.`;

    // Kratu Rewards: Reverse pending rewards upon cancellation
    try {
      const walletService = require('./walletService');
      await walletService.reverseCredit(order.restaurant_id, orderId, 'Order cancelled');
    } catch (wErr) {
      console.warn('[Wallet] Error reversing rewards upon cancellation:', wErr.message);
    }
  }

  if (closedRefunds.length > 0) {
    const refundTotal = closedRefunds.reduce((s, r) => s + Number(r.amount || 0), 0);
    const done = closedRefunds.every((r) => r.status === 'PROCESSED');
    notifMsg += done
      ? ` Your refund of ₹${refundTotal.toFixed(2)} has been issued to your original payment method.`
      : ` A refund of ₹${refundTotal.toFixed(2)} has been started and will reach your original payment method.`;
  }

  await sendNotification({
    userId: order.customer_id,
    restaurantId: order.restaurant_id,
    orderId: orderId,
    customerIdentityId: order.customer_identity_id,
    title: notifTitle,
    message: notifMsg
  });

  return { success: true, orderId, prevStatus, newStatus, refunds: closedRefunds };
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
  if (Number(order.payment_hold) === 1) {
    throw new Error('This order is still waiting for the customer\'s online payment and cannot be dispatched yet.');
  }

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
    // Through the normal path so stock, refunds and the customer notification are handled
    const result = await updateOrderStatus(orderId, 'CANCELLED', userId, `Order cancelled after delivery failure: ${notes || 'Operational cancellation'}`);
    return { success: true, orderId, status: 'CANCELLED', refunds: result.refunds };
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
