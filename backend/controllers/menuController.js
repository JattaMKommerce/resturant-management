const { query } = require('../config/db');
const { validateRestaurantAccess } = require('../middleware/auth');

// Form uploads (multipart) send booleans as text: "false" must mean false.
function toBool(v) {
  if (v === undefined || v === null) return undefined;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  const s = String(v).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(s)) return true;
  if (['0', 'false', 'no', 'off', ''].includes(s)) return false;
  return Boolean(s);
}

// Item-wise stock (REQ-003): empty = not tracked (unlimited), otherwise a whole number >= 0.
function parseStock(v) {
  if (v === undefined) return { provided: false };
  if (v === null || String(v).trim() === '' || String(v).toLowerCase() === 'unlimited') return { provided: true, value: null };
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n > 100000) return { provided: true, error: 'Stock must be a whole number (0 or more), or empty for unlimited.' };
  return { provided: true, value: n };
}

async function getMenuBySlug(req, res) {
  try {
    const slug = String(req.params.slug || '').toLowerCase();
    const { category_id, is_veg, search } = req.query;

    let restaurants = await query(
      `SELECT id FROM restaurants
       WHERE LOWER(random_slug) = ? OR LOWER(slug) = ? OR LOWER(custom_subdomain_slug) = ?`,
      [slug, slug, slug]
    );

    if (restaurants.length === 0) {
      restaurants = await query('SELECT id FROM restaurants ORDER BY (website_status = "PUBLISHED") DESC, id ASC LIMIT 1');
    }

    if (restaurants.length === 0) {
      return res.status(404).json({ success: false, message: 'Restaurant not found.' });
    }

    const restId = restaurants[0].id;

    let sql = `
      SELECT mi.*, COALESCE(c.name, mc.name, 'Chef Specials') as category_name
      FROM menu_items mi
      LEFT JOIN categories c ON mi.category_id = c.id
      LEFT JOIN menu_categories mc ON mi.category_id = mc.id
      WHERE (mi.restaurant_id = ? OR (mi.restaurant_id = 1 AND ? = 1))
        AND (mi.is_available = 1 OR mi.is_available IS NULL)
        AND (mi.is_available_online IS NULL OR mi.is_available_online = 1)
        AND (mi.is_active IS NULL OR mi.is_active = 1)
        AND (mi.stock_quantity IS NULL OR mi.stock_quantity > 0)
    `;
    const params = [restId, restId];

    if (category_id) { sql += ` AND mi.category_id = ?`; params.push(category_id); }
    if (is_veg !== undefined && is_veg !== '') {
      sql += ` AND mi.is_veg = ?`;
      params.push(is_veg === 'true' || is_veg === '1' ? 1 : 0);
    }
    if (search) {
      sql += ` AND (mi.name LIKE ? OR mi.description LIKE ? OR mi.tags LIKE ?)`;
      const s = `%${search}%`;
      params.push(s, s, s);
    }

    sql += ` ORDER BY COALESCE(c.display_order, mc.display_order, 0) ASC, mi.display_order ASC, mi.name ASC`;
    const items = await query(sql, params);

    res.json({ success: true, count: items.length, items });
  } catch (err) {
    console.error('getMenuBySlug Error:', err);
    res.status(500).json({ success: false, message: 'Server error retrieving menu items.' });
  }
}

async function getAdminMenu(req, res) {
  try {
    let restId = req.query.restaurant_id || req.adminRestaurantId;
    if (!restId) {
      const [firstRest] = await query('SELECT id FROM restaurants ORDER BY id ASC LIMIT 1');
      restId = firstRest ? firstRest.id : 1;
    }

    if (!req.isSuperAdmin && !validateRestaurantAccess(restId, req)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const items = await query(
      `SELECT mi.*, c.name as category_name
       FROM menu_items mi
       JOIN categories c ON mi.category_id = c.id
       WHERE mi.restaurant_id = ?
       ORDER BY c.display_order ASC, mi.display_order ASC`,
      [restId]
    );

    res.json({ success: true, count: items.length, items });
  } catch (err) {
    console.error('getAdminMenu Error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
}

async function createMenuItem(req, res) {
  try {
    const {
      restaurant_id, category_id, name, description, price, discounted_price,
      is_veg, prep_time_minutes, preparation_time_minutes, batch_capacity, ingredients, tags,
      is_bestseller, is_recommended, is_available, display_order, kitchen_department_id, tax_percentage
    } = req.body;

    let restId = restaurant_id || req.adminRestaurantId || req.query?.restaurant_id;
    if (!restId) {
      const [firstRest] = await query('SELECT id FROM restaurants ORDER BY id ASC LIMIT 1');
      restId = firstRest ? firstRest.id : 1;
    }

    if (!req.isSuperAdmin && !validateRestaurantAccess(restId, req)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    if (!category_id || !name || !price) {
      return res.status(400).json({ success: false, message: 'Category, name, and price are required.' });
    }

    const prepTime = parseInt(prep_time_minutes ?? preparation_time_minutes ?? 15);
    if (isNaN(prepTime) || prepTime <= 0) {
      return res.status(400).json({ success: false, message: 'Preparation time must be a valid positive number (> 0).' });
    }

    const batchCap = parseInt(batch_capacity ?? 10);
    if (isNaN(batchCap) || batchCap <= 0) {
      return res.status(400).json({ success: false, message: 'Batch capacity must be a valid positive number (> 0).' });
    }

    // Verify category belongs to same restaurant
    const [cat] = await query('SELECT restaurant_id FROM categories WHERE id = ?', [category_id]);
    if (!cat || cat.restaurant_id !== parseInt(restId)) {
      return res.status(400).json({ success: false, message: 'Category does not belong to this restaurant.' });
    }

    const stock = parseStock(req.body.stock_quantity);
    if (stock.error) return res.status(400).json({ success: false, message: stock.error });

    let imageUrl = null;
    if (req.file) imageUrl = `/uploads/${req.file.filename}`;

    const result = await query(
      `INSERT INTO menu_items (
        restaurant_id, category_id, name, description, price, discounted_price,
        image_url, is_veg, prep_time_minutes, batch_capacity, ingredients, tags, is_bestseller,
        is_recommended, is_available, display_order, stock_quantity
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        restId, category_id, name, description || null,
        parseFloat(price), discounted_price ? parseFloat(discounted_price) : null,
        imageUrl, toBool(is_veg) === false ? 0 : 1,
        prepTime,
        batchCap,
        ingredients || null, tags || null,
        toBool(is_bestseller) ? 1 : 0, toBool(is_recommended) ? 1 : 0,
        toBool(is_available) === false ? 0 : 1,
        display_order ? parseInt(display_order) : 0,
        stock.provided ? stock.value : null
      ]
    );

    const newItem = await query('SELECT * FROM menu_items WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, message: 'Menu item created.', item: newItem[0] });
  } catch (err) {
    console.error('createMenuItem Error:', err);
    res.status(500).json({ success: false, message: 'Server error creating menu item.' });
  }
}

async function updateMenuItem(req, res) {
  try {
    const { id } = req.params;

    // Verify ownership
    const [item] = await query('SELECT restaurant_id FROM menu_items WHERE id = ?', [id]);
    if (!item) return res.status(404).json({ success: false, message: 'Menu item not found.' });
    if (!req.isSuperAdmin && !validateRestaurantAccess(item.restaurant_id, req)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const {
      category_id, name, description, price, discounted_price,
      is_veg, prep_time_minutes, preparation_time_minutes, batch_capacity, ingredients, tags,
      is_bestseller, is_recommended, is_available, display_order
    } = req.body;

    let validatedPrepTime = null;
    const rawPrep = prep_time_minutes !== undefined ? prep_time_minutes : preparation_time_minutes;
    if (rawPrep !== undefined && rawPrep !== null && rawPrep !== '') {
      const pt = parseInt(rawPrep);
      if (isNaN(pt) || pt <= 0) {
        return res.status(400).json({ success: false, message: 'Preparation time must be a valid positive number (> 0).' });
      }
      validatedPrepTime = pt;
    }

    let validatedBatchCap = null;
    if (batch_capacity !== undefined && batch_capacity !== null && batch_capacity !== '') {
      const bc = parseInt(batch_capacity);
      if (isNaN(bc) || bc <= 0) {
        return res.status(400).json({ success: false, message: 'Batch capacity must be a valid positive number (> 0).' });
      }
      validatedBatchCap = bc;
    }

    const stock = parseStock(req.body.stock_quantity);
    if (stock.error) return res.status(400).json({ success: false, message: stock.error });

    let imageUrl = null;
    if (req.file) imageUrl = `/uploads/${req.file.filename}`;

    let sql = `
      UPDATE menu_items SET
        category_id = COALESCE(?, category_id),
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        price = COALESCE(?, price),
        discounted_price = COALESCE(?, discounted_price),
        is_veg = COALESCE(?, is_veg),
        prep_time_minutes = COALESCE(?, prep_time_minutes),
        batch_capacity = COALESCE(?, batch_capacity),
        ingredients = COALESCE(?, ingredients),
        tags = COALESCE(?, tags),
        is_bestseller = COALESCE(?, is_bestseller),
        is_recommended = COALESCE(?, is_recommended),
        is_available = COALESCE(?, is_available),
        display_order = COALESCE(?, display_order)
    `;

    const params = [
      category_id || null, name || null, description !== undefined ? description : null,
      price ? parseFloat(price) : null,
      discounted_price !== undefined ? (discounted_price ? parseFloat(discounted_price) : null) : null,
      toBool(is_veg) === undefined ? null : (toBool(is_veg) ? 1 : 0),
      validatedPrepTime,
      validatedBatchCap,
      ingredients || null, tags || null,
      toBool(is_bestseller) === undefined ? null : (toBool(is_bestseller) ? 1 : 0),
      toBool(is_recommended) === undefined ? null : (toBool(is_recommended) ? 1 : 0),
      toBool(is_available) === undefined ? null : (toBool(is_available) ? 1 : 0),
      display_order !== undefined ? parseInt(display_order) : null
    ];

    if (imageUrl) { sql += `, image_url = ?`; params.push(imageUrl); }
    if (stock.provided) { sql += `, stock_quantity = ?`; params.push(stock.value); }
    sql += ` WHERE id = ?`;
    params.push(id);

    await query(sql, params);
    const updated = await query('SELECT * FROM menu_items WHERE id = ?', [id]);
    res.json({ success: true, message: 'Menu item updated.', item: updated[0] });
  } catch (err) {
    console.error('updateMenuItem Error:', err);
    res.status(500).json({ success: false, message: 'Server error updating menu item.' });
  }
}

async function toggleAvailability(req, res) {
  try {
    const { id } = req.params;
    const { is_available } = req.body;

    const [item] = await query('SELECT restaurant_id FROM menu_items WHERE id = ?', [id]);
    if (!item) return res.status(404).json({ success: false, message: 'Menu item not found.' });
    if (!req.isSuperAdmin && !validateRestaurantAccess(item.restaurant_id, req)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    await query('UPDATE menu_items SET is_available = ? WHERE id = ?', [is_available ? 1 : 0, id]);
    res.json({ success: true, message: `Menu item ${is_available ? 'available' : 'unavailable'}.` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
}

async function deleteMenuItem(req, res) {
  try {
    const { id } = req.params;

    const [item] = await query('SELECT restaurant_id FROM menu_items WHERE id = ?', [id]);
    if (!item) return res.status(404).json({ success: false, message: 'Menu item not found.' });
    if (!req.isSuperAdmin && !validateRestaurantAccess(item.restaurant_id, req)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    await query('DELETE FROM menu_items WHERE id = ?', [id]);
    res.json({ success: true, message: 'Menu item deleted.' });
  } catch (err) {
    console.error('deleteMenuItem Error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
}

module.exports = {
  getMenuBySlug,
  getAdminMenu,
  createMenuItem,
  updateMenuItem,
  toggleAvailability,
  deleteMenuItem
};
