const { query } = require('../config/db');
const { validateRestaurantAccess } = require('../middleware/auth');

// Ensure database columns for subdomain change tracking exist
(async function ensureSubdomainColumns() {
  try {
    await query(`ALTER TABLE restaurants ADD COLUMN subdomain_changed INT DEFAULT 0`);
  } catch (e) {}
  try {
    await query(`ALTER TABLE restaurants ADD COLUMN subdomain_changes_this_month INT NOT NULL DEFAULT 0`);
  } catch (e) {}
  try {
    await query(`ALTER TABLE restaurants ADD COLUMN subdomain_last_reset_month VARCHAR(7) DEFAULT NULL`);
  } catch (e) {}
})();

function getSubdomainQuota(rest) {
  const now = new Date();
  const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  // For development and testing purposes, allow flexible/unlimited updates so testing is never blocked
  const isDevOrTest = process.env.NODE_ENV !== 'production' || !process.env.NODE_ENV;
  const maxAllowed = isDevOrTest ? 999 : 3;

  let usedThisMonth = 0;
  if (rest && rest.subdomain_last_reset_month === currentYearMonth) {
    usedThisMonth = parseInt(rest.subdomain_changes_this_month, 10) || 0;
  }

  const remaining = Math.max(0, maxAllowed - usedThisMonth);

  return {
    currentYearMonth,
    usedThisMonth,
    remaining: isDevOrTest ? 999 : remaining,
    maxAllowed,
    isDevOrTest
  };
}

async function getRestaurantBySlug(req, res) {
  try {
    const slug = String(req.params.slug || '').toLowerCase();
    
    // 1. Primary lookup: Match random_slug, or enabled custom_subdomain_slug
    let rows = await query(
      `SELECT r.* FROM restaurants r
       WHERE LOWER(r.random_slug) = ?
          OR (r.custom_subdomain_enabled = 1 AND LOWER(r.custom_subdomain_slug) = ?)
          OR (r.custom_subdomain_enabled = 1 AND LOWER(r.slug) = ?)`,
      [slug, slug, slug]
    );

    // 2. Secondary lookup if not matched directly
    if (rows.length === 0) {
      rows = await query(
        `SELECT r.* FROM restaurants r
         WHERE LOWER(r.random_slug) = ? OR LOWER(r.slug) = ? OR LOWER(r.custom_subdomain_slug) = ?`,
        [slug, slug, slug]
      );
    }

    // 3. Fallback to active restaurant
    if (rows.length === 0) {
      rows = await query(
        `SELECT r.* FROM restaurants r
         ORDER BY (r.website_status = 'PUBLISHED') DESC, r.id ASC LIMIT 1`
      );
    }

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: `Restaurant "${slug}" not found.` });
    }

    const rest = rows[0];

    // Lock custom name URLs on free tier if ₹99/mo add-on is NOT active
    if (!rest.custom_subdomain_enabled && slug !== String(rest.random_slug || '').toLowerCase()) {
      return res.status(403).json({
        success: false,
        locked: true,
        message: `Custom restaurant name URLs (e.g. /restaurant/${rest.slug}) are locked on the free tier. Upgrade to the ₹99/mo Custom Subdomain Plan to unlock your restaurant name in URLs!`,
        random_slug: rest.random_slug
      });
    }

    // Always serve active restaurant publicly
    res.json({
      success: true,
      restaurant: {
        ...rest,
        status: 'ACTIVE',
        is_suspended: 0
      }
    });
  } catch (err) {
    console.error('getRestaurantBySlug Error:', err);
    res.status(500).json({ success: false, message: 'Server error retrieving restaurant.' });
  }
}

async function getDefaultRestaurant(req, res) {
  try {
    const rows = await query("SELECT * FROM restaurants WHERE status = 'ACTIVE' AND website_status = 'PUBLISHED' ORDER BY id ASC LIMIT 1");
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'No active restaurant found.' });
    }
    res.json({ success: true, restaurant: rows[0] });
  } catch (err) {
    console.error('getDefaultRestaurant Error:', err);
    res.status(500).json({ success: false, message: 'Server error retrieving restaurant.' });
  }
}

async function getPublishedRestaurants(req, res) {
  try {
    const rows = await query("SELECT * FROM restaurants WHERE status = 'ACTIVE' AND website_status = 'PUBLISHED' ORDER BY id ASC");
    res.json({ success: true, restaurants: rows });
  } catch (err) {
    console.error('getPublishedRestaurants Error:', err);
    res.status(500).json({ success: false, message: 'Server error retrieving restaurants.' });
  }
}

// Public Room Catalog for Customer Website
async function getPublicRoomsBySlug(req, res) {
  try {
    const slug = String(req.params.slug || '').toLowerCase();
    const restRows = await query(
      `SELECT r.id, r.name, r.custom_subdomain_slug, r.random_slug, r.amenities 
       FROM restaurants r 
       WHERE LOWER(r.random_slug) = ? OR LOWER(r.slug) = ? OR LOWER(r.custom_subdomain_slug) = ?`,
      [slug, slug, slug]
    );

    if (restRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Restaurant not found.' });
    }

    const rest = restRows[0];
    const roomRows = await query(
      `SELECT rm.* FROM rooms rm WHERE rm.restaurant_id = ? ORDER BY rm.room_number ASC`,
      [rest.id]
    ).catch(() => []);

    let parsedAmenities = ['High-Speed Wi-Fi', '100% AC Suites', 'Free Breakfast', 'Valet Parking', '24/7 Housekeeping'];
    if (rest.amenities) {
      try {
        parsedAmenities = JSON.parse(rest.amenities);
      } catch (e) {
        parsedAmenities = String(rest.amenities).split(',').map(s => s.trim()).filter(Boolean);
      }
    }

    res.json({
      success: true,
      hotel_name: rest.name,
      hotel_amenities: parsedAmenities,
      rooms: roomRows
    });
  } catch (err) {
    console.error('getPublicRoomsBySlug Error:', err);
    res.status(500).json({ success: false, message: 'Server error loading room catalog.' });
  }
}

// Public Room Reservation Lead Submission Endpoint
async function submitRoomInquiry(req, res) {
  try {
    const slug = String(req.params.slug || '').toLowerCase();
    const { guest_name, guest_phone, room_id, room_number, room_type, price_per_night, check_in_date, check_out_date, notes } = req.body;

    if (!guest_name || !guest_phone) {
      return res.status(400).json({ success: false, message: 'Name and Phone number are required.' });
    }

    let restId = null;
    if (slug && slug !== 'undefined' && slug !== 'null') {
      const restRows = await query(
        `SELECT r.id FROM restaurants r 
         WHERE LOWER(r.random_slug) = ? OR LOWER(r.slug) = ? OR LOWER(r.custom_subdomain_slug) = ?`,
        [slug, slug, slug]
      );
      if (restRows.length > 0) restId = restRows[0].id;
    }

    if (!restId) {
      const defaultRows = await query(
        `SELECT r.id FROM restaurants r ORDER BY (r.website_status = 'PUBLISHED') DESC, r.id ASC LIMIT 1`
      );
      if (defaultRows.length > 0) restId = defaultRows[0].id;
    }

    if (!restId) {
      return res.status(404).json({ success: false, message: 'No active hotel or restaurant found.' });
    }

    await query(
      `CREATE TABLE IF NOT EXISTS room_bookings (
         id INT AUTO_INCREMENT PRIMARY KEY,
         restaurant_id INT NOT NULL,
         room_id INT DEFAULT NULL,
         room_number VARCHAR(50) DEFAULT NULL,
         room_type VARCHAR(100) DEFAULT NULL,
         price_per_night DECIMAL(10,2) DEFAULT NULL,
         guest_name VARCHAR(100),
         guest_phone VARCHAR(30),
         check_in_date VARCHAR(100) DEFAULT NULL,
         check_out_date VARCHAR(100) DEFAULT NULL,
         notes TEXT,
         status VARCHAR(30) DEFAULT 'PENDING_INQUIRY',
         created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    ).catch(() => {});

    // Ensure columns exist on older tables & handle date format flexibility
    await query(`ALTER TABLE room_bookings ADD COLUMN room_id INT DEFAULT NULL`).catch(() => {});
    await query(`ALTER TABLE room_bookings ADD COLUMN room_number VARCHAR(50) DEFAULT NULL`).catch(() => {});
    await query(`ALTER TABLE room_bookings ADD COLUMN price_per_night DECIMAL(10,2) DEFAULT NULL`).catch(() => {});
    await query(`ALTER TABLE room_bookings MODIFY COLUMN check_in_date VARCHAR(100) DEFAULT NULL`).catch(() => {});
    await query(`ALTER TABLE room_bookings MODIFY COLUMN check_out_date VARCHAR(100) DEFAULT NULL`).catch(() => {});

    const parsedRoomId = room_id ? (parseInt(room_id, 10) || null) : null;
    const parsedPrice = price_per_night ? (parseFloat(price_per_night) || null) : null;
    const dateIn = check_in_date ? String(check_in_date).trim() : null;
    const dateOut = check_out_date ? String(check_out_date).trim() : null;

    await query(
      `INSERT INTO room_bookings (restaurant_id, room_id, room_number, room_type, price_per_night, guest_name, guest_phone, check_in_date, check_out_date, notes, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING_INQUIRY', NOW())`,
      [
        restId,
        parsedRoomId,
        room_number ? String(room_number) : null,
        room_type ? String(room_type) : 'Deluxe Room',
        parsedPrice,
        String(guest_name),
        String(guest_phone),
        dateIn,
        dateOut,
        notes ? String(notes) : ''
      ]
    );

    res.json({
      success: true,
      message: '🎉 Your room reservation request has been sent! Front Desk will call/WhatsApp you shortly to confirm.'
    });
  } catch (err) {
    console.error('submitRoomInquiry Error:', err);
    res.status(500).json({ success: false, message: err.message || 'Failed to submit room inquiry.' });
  }
}

// ═══════════════════════════════════════════════
// ADMIN RESTAURANT ENDPOINTS (with isolation)
// ═══════════════════════════════════════════════

async function getFeaturesForRestaurant(restId) {
  try {
    const [row] = await query('SELECT * FROM restaurant_feature_controls WHERE restaurant_id = ?', [restId]);
    if (row) {
      return {
        online_ordering: row.online_ordering,
        delivery_fleet: row.delivery_fleet,
        rewards_wallet: row.rewards_wallet,
        table_dine_in: row.table_dine_in,
        kds_kot: row.kds_kot,
        pos_billing: row.pos_billing,
        inventory_stock: row.inventory_stock,
        reports_analytics: row.reports_analytics,
        hotel_accommodations: row.hotel_accommodations,
        custom_subdomain: row.custom_subdomain
      };
    }
  } catch (e) {}
  return {
    online_ordering: 1,
    delivery_fleet: 1,
    rewards_wallet: 1,
    table_dine_in: 1,
    kds_kot: 1,
    pos_billing: 1,
    inventory_stock: 1,
    reports_analytics: 1,
    hotel_accommodations: 1,
    custom_subdomain: 1
  };
}

async function getAdminRestaurant(req, res) {
  try {
    const slug = req.query.slug || req.params.slug;
    let restaurantId = req.params.id || req.query.restaurantId;

    if (slug) {
      const rowsBySlug = await query('SELECT * FROM restaurants WHERE slug = ?', [slug]);
      if (rowsBySlug.length > 0) {
        if (!req.isSuperAdmin && !validateRestaurantAccess(rowsBySlug[0].id, req)) {
          return res.status(403).json({ success: false, message: 'Access denied to this restaurant.' });
        }
        const quota = getSubdomainQuota(rowsBySlug[0]);
        const features = await getFeaturesForRestaurant(rowsBySlug[0].id);
        return res.json({
          success: true,
          restaurant: {
            ...rowsBySlug[0],
            subdomain_changes_this_month: quota.usedThisMonth,
            subdomain_changes_left: quota.remaining,
            max_subdomain_changes_per_month: 3,
            features
          }
        });
      }
    }

    if (!restaurantId) {
      restaurantId = req.adminRestaurantId;
    }

    if (req.isSuperAdmin && !restaurantId) {
      const rowsAll = await query('SELECT id FROM restaurants ORDER BY id ASC LIMIT 1');
      if (rowsAll.length > 0) restaurantId = rowsAll[0].id;
    }

    if (!restaurantId && !req.isSuperAdmin) {
      return res.status(403).json({ success: false, message: 'No restaurant assigned.' });
    }

    if (!restaurantId) {
      return res.status(404).json({ success: false, message: 'Restaurant not found.' });
    }

    if (!req.isSuperAdmin && !validateRestaurantAccess(restaurantId, req)) {
      return res.status(403).json({ success: false, message: 'Access denied to this restaurant.' });
    }

    const rows = await query('SELECT * FROM restaurants WHERE id = ?', [restaurantId]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Restaurant not found.' });
    }

    const quota = getSubdomainQuota(rows[0]);
    const features = await getFeaturesForRestaurant(rows[0].id);
    res.json({
      success: true,
      restaurant: {
        ...rows[0],
        subdomain_changes_this_month: quota.usedThisMonth,
        subdomain_changes_left: quota.remaining,
        max_subdomain_changes_per_month: 3,
        features
      }
    });
  } catch (err) {
    console.error('getAdminRestaurant Error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// Helper to resolve target restaurant ID cleanly
async function resolveTargetRestaurantId(req) {
  let restId = req.params.id || req.body?.restaurantId || req.body?.id || req.query?.restaurantId || req.query?.id;

  if (!restId && (req.body?.slug || req.query?.slug)) {
    const slug = req.body?.slug || req.query?.slug;
    const rowsSlug = await query('SELECT id FROM restaurants WHERE slug = ?', [slug]);
    if (rowsSlug.length > 0) restId = rowsSlug[0].id;
  }

  if (!restId) {
    restId = req.adminRestaurantId;
  }

  if (req.isSuperAdmin && !restId) {
    const rowsAll = await query('SELECT id FROM restaurants ORDER BY id ASC LIMIT 1');
    if (rowsAll.length > 0) restId = rowsAll[0].id;
  }

  return restId ? parseInt(restId, 10) : null;
}

async function updateRestaurantSettings(req, res) {
  try {
    const {
      id, name, slug, phone, email, description, tagline, about,
      address, area, city, state, postal_code,
      latitude, longitude, opening_time, closing_time, opening_hours,
      delivery_radius_km, min_order_amount, delivery_fee, tax_percentage,
      is_online_ordering_enabled, is_cod_enabled, is_online_payment_enabled,
      razorpay_key_id, razorpay_key_secret, razorpay_enabled, upi_id, upi_name,
      template_id
    } = req.body;

    const restId = await resolveTargetRestaurantId(req);
    if (!restId) {
      return res.status(404).json({ success: false, message: 'Restaurant not found.' });
    }

    if (!req.isSuperAdmin && !validateRestaurantAccess(restId, req)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    let logoUrl = null;
    let coverUrl = null;

    if (req.files) {
      if (req.files.logo && req.files.logo[0]) {
        logoUrl = `/uploads/${req.files.logo[0].filename}`;
      }
      if (req.files.cover && req.files.cover[0]) {
        coverUrl = `/uploads/${req.files.cover[0].filename}`;
      }
    }

    const parseBool = (val) => {
      if (val === undefined || val === null) return undefined;
      return val === true || val === 1 || val === '1' || val === 'true';
    };

    const parseNum = (val) => {
      if (val === undefined || val === null || val === '') return null;
      const n = parseFloat(val);
      return isNaN(n) ? null : n;
    };

    const boolOrdering = parseBool(is_online_ordering_enabled);
    const boolCod = parseBool(is_cod_enabled);
    const boolPayment = parseBool(is_online_payment_enabled);
    const boolRzpEnabled = parseBool(razorpay_enabled);

    let sql = `
      UPDATE restaurants SET
        name = COALESCE(?, name),
        phone = COALESCE(?, phone),
        email = COALESCE(?, email),
        description = COALESCE(?, description),
        tagline = COALESCE(?, tagline),
        \`about\` = COALESCE(?, \`about\`),
        address = COALESCE(?, address),
        area = COALESCE(?, area),
        city = COALESCE(?, city),
        state = COALESCE(?, state),
        postal_code = COALESCE(?, postal_code),
        latitude = COALESCE(?, latitude),
        longitude = COALESCE(?, longitude),
        opening_time = COALESCE(?, opening_time),
        closing_time = COALESCE(?, closing_time),
        delivery_radius_km = COALESCE(?, delivery_radius_km),
        min_order_amount = COALESCE(?, min_order_amount),
        delivery_fee = COALESCE(?, delivery_fee),
        tax_percentage = COALESCE(?, tax_percentage),
        is_online_ordering_enabled = COALESCE(?, is_online_ordering_enabled),
        is_cod_enabled = COALESCE(?, is_cod_enabled),
        is_online_payment_enabled = COALESCE(?, is_online_payment_enabled),
        razorpay_key_id = COALESCE(?, razorpay_key_id),
        razorpay_key_secret = COALESCE(?, razorpay_key_secret),
        razorpay_enabled = COALESCE(?, razorpay_enabled),
        upi_id = COALESCE(?, upi_id),
        upi_name = COALESCE(?, upi_name),
        template_id = COALESCE(?, template_id)
    `;

    const params = [
      name || null, phone || null, email || null,
      description || null, tagline || null, about || null,
      address || null, area || null, city || null, state || null, postal_code || null,
      parseNum(latitude),
      parseNum(longitude),
      opening_time || null, closing_time || null,
      parseNum(delivery_radius_km),
      parseNum(min_order_amount),
      parseNum(delivery_fee),
      parseNum(tax_percentage),
      boolOrdering !== undefined ? (boolOrdering ? 1 : 0) : null,
      boolCod !== undefined ? (boolCod ? 1 : 0) : null,
      boolPayment !== undefined ? (boolPayment ? 1 : 0) : null,
      razorpay_key_id !== undefined ? (razorpay_key_id ? razorpay_key_id.trim() : null) : null,
      razorpay_key_secret !== undefined ? (razorpay_key_secret ? razorpay_key_secret.trim() : null) : null,
      boolRzpEnabled !== undefined ? (boolRzpEnabled ? 1 : 0) : null,
      upi_id !== undefined ? (upi_id ? upi_id.trim() : null) : null,
      upi_name !== undefined ? (upi_name ? upi_name.trim() : null) : null,
      template_id || null
    ];

    if (req.body.remove_logo === '1' || req.body.remove_logo === 'true' || req.body.remove_logo === true) {
      sql += `, logo_url = NULL`;
    } else if (logoUrl) {
      sql += `, logo_url = ?`; params.push(logoUrl);
    }

    if (req.body.remove_cover === '1' || req.body.remove_cover === 'true' || req.body.remove_cover === true) {
      sql += `, cover_url = NULL`;
    } else if (coverUrl) {
      sql += `, cover_url = ?`; params.push(coverUrl);
    }

    const targetSlug = (req.body.custom_subdomain_slug || req.body.slug || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
    const [existingRest] = await query('SELECT * FROM restaurants WHERE id = ?', [restId]);

    if (targetSlug && existingRest) {
      const currentSlug = String(existingRest.custom_subdomain_slug || existingRest.slug || '').toLowerCase();
      if (targetSlug !== currentSlug) {
        const conflicts = await query(
          'SELECT id FROM restaurants WHERE (LOWER(slug) = ? OR LOWER(custom_subdomain_slug) = ?) AND id != ? LIMIT 1',
          [targetSlug, targetSlug, restId]
        );
        if (conflicts.length > 0) {
          return res.status(400).json({
            success: false,
            message: `Subdomain "${targetSlug}" is already taken by another restaurant. Please choose a different name.`
          });
        }

        const quota = getSubdomainQuota(existingRest);
        if (quota.remaining <= 0 && !quota.isDevOrTest) {
          return res.status(400).json({
            success: false,
            message: 'You have reached your limit of 3 subdomain name changes for this month. You can change your subdomain name again next month.'
          });
        }
        const newUsedCount = quota.usedThisMonth + 1;
        sql += `, slug = ?, custom_subdomain_slug = ?, subdomain_changed = 1, subdomain_changes_this_month = ?, subdomain_last_reset_month = ?`;
        params.push(targetSlug, targetSlug, newUsedCount, quota.currentYearMonth);
      }
    }

    sql += ` WHERE id = ?`;
    params.push(restId);

    await query(sql, params);
    const updated = await query('SELECT * FROM restaurants WHERE id = ?', [restId]);

    // Broadcast if ordering status changed
    if (boolOrdering !== undefined) {
      try {
        const { getSocketIO } = require('../services/NotificationService');
        const io = getSocketIO();
        if (io) {
          io.emit('restaurant_ordering_status_changed', { restaurantId: restId, is_online_ordering_enabled: boolOrdering ? 1 : 0 });
        }
      } catch (e) {}
    }

    res.json({ success: true, message: 'Restaurant settings updated.', restaurant: updated[0] });
  } catch (err) {
    console.error('updateRestaurantSettings Error:', err);
    res.status(500).json({ success: false, message: 'Server error updating settings.' });
  }
}

// ═══════════════════════════════════════════════
// SETUP PROGRESS & PUBLISHING
// ═══════════════════════════════════════════════

async function getSetupProgress(req, res) {
  try {
    const restId = await resolveTargetRestaurantId(req);
    if (!restId) return res.status(404).json({ success: false, message: 'Restaurant not found.' });

    if (!req.isSuperAdmin && !validateRestaurantAccess(restId, req)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const [rest] = await query('SELECT * FROM restaurants WHERE id = ?', [restId]);
    if (!rest) return res.status(404).json({ success: false, message: 'Restaurant not found.' });

    const [catCount] = await query('SELECT COUNT(*) as cnt FROM categories WHERE restaurant_id = ?', [restId]);
    const [menuCount] = await query('SELECT COUNT(*) as cnt FROM menu_items WHERE restaurant_id = ?', [restId]);

    const steps = [
      { id: 'details', name: 'Basic Details & Location', completed: !!(rest.name && rest.phone && rest.address) },
      { id: 'categories', name: 'Menu Categories', completed: catCount.cnt > 0, count: catCount.cnt },
      { id: 'menu', name: 'Menu Items', completed: menuCount.cnt > 0, count: menuCount.cnt },
      { id: 'delivery', name: 'Delivery & Pricing Rules', completed: !!(rest.delivery_radius_km > 0) },
      { id: 'publish', name: 'Publish Website', completed: rest.website_status === 'PUBLISHED' }
    ];

    const completedSteps = steps.filter(s => s.completed).length;
    const progressPercent = Math.round((completedSteps / steps.length) * 100);

    res.json({
      success: true,
      restaurantId: restId,
      website_status: rest.website_status,
      is_online_ordering_enabled: rest.is_online_ordering_enabled === 1,
      progressPercent,
      isReadyToPublish: catCount.cnt > 0 && menuCount.cnt > 0 && !!rest.name && !!rest.address,
      steps
    });
  } catch (err) {
    console.error('getSetupProgress Error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
}

async function publishWebsite(req, res) {
  try {
    const restId = await resolveTargetRestaurantId(req);
    if (!restId) return res.status(404).json({ success: false, message: 'Restaurant not found.' });

    if (!req.isSuperAdmin && !validateRestaurantAccess(restId, req)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    // Verify minimum requirements
    const [rest] = await query('SELECT * FROM restaurants WHERE id = ?', [restId]);
    if (!rest) return res.status(404).json({ success: false, message: 'Restaurant not found.' });

    const [catCount] = await query('SELECT COUNT(*) as cnt FROM categories WHERE restaurant_id = ?', [restId]);
    const [menuCount] = await query('SELECT COUNT(*) as cnt FROM menu_items WHERE restaurant_id = ?', [restId]);

    if (!rest.name || !rest.address) {
      return res.status(400).json({ success: false, message: 'Please complete restaurant details first.' });
    }
    if (catCount.cnt === 0) {
      return res.status(400).json({ success: false, message: 'Please add at least one category.' });
    }
    if (menuCount.cnt === 0) {
      return res.status(400).json({ success: false, message: 'Please add at least one menu item.' });
    }

    await query(
      `UPDATE restaurants SET website_status = 'PUBLISHED', status = CASE WHEN status = 'PENDING' THEN 'ACTIVE' ELSE status END, setup_completed_at = COALESCE(setup_completed_at, NOW()) WHERE id = ?`,
      [restId]
    );

    res.json({ success: true, message: 'Website published successfully!', slug: rest.slug });
  } catch (err) {
    console.error('publishWebsite Error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
}

async function unpublishWebsite(req, res) {
  try {
    const restId = await resolveTargetRestaurantId(req);
    if (!restId) return res.status(404).json({ success: false, message: 'Restaurant not found.' });

    if (!req.isSuperAdmin && !validateRestaurantAccess(restId, req)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    await query("UPDATE restaurants SET website_status = 'UNPUBLISHED' WHERE id = ?", [restId]);
    res.json({ success: true, message: 'Website unpublished.' });
  } catch (err) {
    console.error('unpublishWebsite Error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
}

async function toggleOnlineOrdering(req, res) {
  try {
    const enabled = req.body.enabled !== undefined ? req.body.enabled : req.body.is_online_ordering_enabled;
    const restId = await resolveTargetRestaurantId(req);

    if (!restId) {
      return res.status(404).json({ success: false, message: 'Restaurant not found.' });
    }

    if (!req.isSuperAdmin && !validateRestaurantAccess(restId, req)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const isEnabledVal = (enabled === true || enabled === 1 || enabled === '1' || enabled === 'true') ? 1 : 0;
    await query('UPDATE restaurants SET is_online_ordering_enabled = ? WHERE id = ?', [isEnabledVal, restId]);

    const [updatedRest] = await query('SELECT * FROM restaurants WHERE id = ?', [restId]);

    // Broadcast via socket if available
    try {
      const { getSocketIO } = require('../services/NotificationService');
      const io = getSocketIO();
      if (io) {
        io.emit('restaurant_ordering_status_changed', { restaurantId: restId, is_online_ordering_enabled: isEnabledVal });
      }
    } catch (e) {}

    res.json({ 
      success: true, 
      message: `Online ordering ${isEnabledVal ? 'enabled' : 'disabled'}.`, 
      is_online_ordering_enabled: isEnabledVal,
      restaurant: updatedRest 
    });
  } catch (err) {
    console.error('toggleOnlineOrdering Error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
}

async function purchaseCustomSubdomain(req, res) {
  try {
    const { restaurant_id, custom_subdomain_slug } = req.body;
    const restId = restaurant_id || req.adminRestaurantId;

    if (!restId) return res.status(400).json({ success: false, message: 'Restaurant ID required.' });

    const [rest] = await query('SELECT * FROM restaurants WHERE id = ?', [restId]);
    if (!rest) return res.status(404).json({ success: false, message: 'Restaurant not found.' });

    const newCustomSlug = (custom_subdomain_slug || rest.custom_subdomain_slug || rest.slug || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (!newCustomSlug) {
      return res.status(400).json({ success: false, message: 'Please enter a valid subdomain name (letters, numbers, hyphens).' });
    }

    // Check if another restaurant already uses this slug
    const conflicts = await query(
      'SELECT id, name FROM restaurants WHERE (LOWER(slug) = ? OR LOWER(custom_subdomain_slug) = ?) AND id != ? LIMIT 1',
      [newCustomSlug, newCustomSlug, restId]
    );
    if (conflicts.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Subdomain "${newCustomSlug}" is already taken by another restaurant. Please choose a different subdomain.`
      });
    }

    const currentCustomSlug = String(rest.custom_subdomain_slug || '').toLowerCase();
    const isSlugChanging = Boolean(rest.custom_subdomain_enabled && currentCustomSlug && currentCustomSlug !== newCustomSlug);

    const quota = getSubdomainQuota(rest);

    if (isSlugChanging && quota.remaining <= 0 && !quota.isDevOrTest) {
      return res.status(400).json({
        success: false,
        message: 'You have reached your limit of 3 subdomain name changes for this month. You can change your subdomain name again next month.'
      });
    }

    const newUsedCount = isSlugChanging ? quota.usedThisMonth + 1 : quota.usedThisMonth;

    // Enable custom subdomain for ₹99/mo add-on plan and update both slug & custom_subdomain_slug
    await query(
      `UPDATE restaurants SET 
         custom_subdomain_enabled = 1, 
         custom_subdomain_slug = ?, 
         slug = ?,
         subdomain_changed = 1,
         subdomain_changes_this_month = ?,
         subdomain_last_reset_month = ?
       WHERE id = ?`,
      [newCustomSlug, newCustomSlug, newUsedCount, quota.currentYearMonth, restId]
    );

    const [updatedRest] = await query('SELECT * FROM restaurants WHERE id = ?', [restId]);
    const remainingLeft = quota.isDevOrTest ? 999 : Math.max(0, 3 - newUsedCount);

    res.json({
      success: true,
      message: `🎉 ₹99/mo Custom Subdomain active! ${quota.isDevOrTest ? '(Testing Mode: Unlimited updates)' : `(${remainingLeft} name changes remaining this month)`}`,
      custom_subdomain_enabled: 1,
      custom_subdomain_slug: newCustomSlug,
      slug: newCustomSlug,
      subdomain_changes_this_month: newUsedCount,
      subdomain_changes_left: remainingLeft,
      restaurant: {
        ...updatedRest,
        subdomain_changes_this_month: newUsedCount,
        subdomain_changes_left: remainingLeft,
        max_subdomain_changes_per_month: quota.isDevOrTest ? 999 : 3
      }
    });
  } catch (err) {
    console.error('purchaseCustomSubdomain Error:', err);
    res.status(500).json({ success: false, message: err.sqlMessage || err.message || 'Server error processing custom subdomain purchase.' });
  }
}

async function resetSubdomainQuota(req, res) {
  try {
    const restId = req.body.restaurant_id || req.adminRestaurantId;
    if (!restId) return res.status(400).json({ success: false, message: 'Restaurant ID required.' });

    const now = new Date();
    const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    await query(
      'UPDATE restaurants SET subdomain_changes_this_month = 0, subdomain_last_reset_month = ? WHERE id = ?',
      [currentYearMonth, restId]
    );

    const [updatedRest] = await query('SELECT * FROM restaurants WHERE id = ?', [restId]);
    res.json({
      success: true,
      message: 'Subdomain changes counter reset to 0 for testing.',
      restaurant: updatedRest
    });
  } catch (err) {
    console.error('resetSubdomainQuota Error:', err);
    res.status(500).json({ success: false, message: 'Server error resetting quota.' });
  }
}

module.exports = {
  getRestaurantBySlug,
  getDefaultRestaurant,
  getPublishedRestaurants,
  getPublicRoomsBySlug,
  submitRoomInquiry,
  getAdminRestaurant,
  updateRestaurantSettings,
  getSetupProgress,
  publishWebsite,
  unpublishWebsite,
  toggleOnlineOrdering,
  purchaseCustomSubdomain,
  resetSubdomainQuota
};
