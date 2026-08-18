const { query } = require('../config/db');
const { validateRestaurantAccess } = require('../middleware/auth');

async function getMenuBySlug(req, res) {
  try {
    const { slug } = req.params;
    const { category_id, is_veg, search } = req.query;

    const restaurants = await query('SELECT id FROM restaurants WHERE slug = ?', [slug]);
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
        AND (mi.is_active IS NULL OR mi.is_active = 1)
        AND mi.is_available = 1
        AND (mi.is_available_online IS NULL OR mi.is_available_online = 1)
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
      is_veg, prep_time_minutes, ingredients, tags,
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

    // Verify category belongs to same restaurant
    const [cat] = await query('SELECT restaurant_id FROM categories WHERE id = ?', [category_id]);
    if (!cat || cat.restaurant_id !== parseInt(restId)) {
      return res.status(400).json({ success: false, message: 'Category does not belong to this restaurant.' });
    }

    let imageUrl = null;
    if (req.file) imageUrl = `/uploads/${req.file.filename}`;

    const result = await query(
      `INSERT INTO menu_items (
        restaurant_id, category_id, name, description, price, discounted_price,
        image_url, is_veg, prep_time_minutes, ingredients, tags, is_bestseller,
        is_recommended, is_available, display_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        restId, category_id, name, description || null,
        parseFloat(price), discounted_price ? parseFloat(discounted_price) : null,
        imageUrl, is_veg !== undefined ? (is_veg ? 1 : 0) : 1,
        prep_time_minutes ? parseInt(prep_time_minutes) : 20,
        ingredients || null, tags || null,
        is_bestseller ? 1 : 0, is_recommended ? 1 : 0,
        is_available !== undefined ? (is_available ? 1 : 0) : 1,
        display_order ? parseInt(display_order) : 0
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
      is_veg, prep_time_minutes, ingredients, tags,
      is_bestseller, is_recommended, is_available, display_order
    } = req.body;

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
      is_veg !== undefined ? (is_veg ? 1 : 0) : null,
      prep_time_minutes ? parseInt(prep_time_minutes) : null,
      ingredients || null, tags || null,
      is_bestseller !== undefined ? (is_bestseller ? 1 : 0) : null,
      is_recommended !== undefined ? (is_recommended ? 1 : 0) : null,
      is_available !== undefined ? (is_available ? 1 : 0) : null,
      display_order !== undefined ? parseInt(display_order) : null
    ];

    if (imageUrl) { sql += `, image_url = ?`; params.push(imageUrl); }
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
