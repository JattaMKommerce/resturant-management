const { query } = require('../config/db');
const { validateRestaurantAccess } = require('../middleware/auth');

async function getCategoriesBySlug(req, res) {
  try {
    const { slug } = req.params;
    const restaurants = await query('SELECT id FROM restaurants WHERE slug = ?', [slug]);
    if (restaurants.length === 0) {
      return res.status(404).json({ success: false, message: 'Restaurant not found.' });
    }

    const restId = restaurants[0].id;
    const categories = await query(
      'SELECT * FROM categories WHERE restaurant_id = ? ORDER BY display_order ASC, name ASC',
      [restId]
    );

    res.json({ success: true, categories });
  } catch (err) {
    console.error('getCategoriesBySlug Error:', err);
    res.status(500).json({ success: false, message: 'Server error retrieving categories.' });
  }
}

async function getAdminCategories(req, res) {
  try {
    const restId = req.adminRestaurantId;
    if (!restId && !req.isSuperAdmin) {
      return res.status(403).json({ success: false, message: 'No restaurant assigned.' });
    }

    let targetRestId = req.query.restaurant_id || restId;
    if (!targetRestId) {
      const [firstRest] = await query('SELECT id FROM restaurants ORDER BY id ASC LIMIT 1');
      targetRestId = firstRest ? firstRest.id : 1;
    }

    if (!req.isSuperAdmin && !validateRestaurantAccess(targetRestId, req)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const categories = await query(
      'SELECT * FROM categories WHERE restaurant_id = ? ORDER BY display_order ASC, name ASC',
      [targetRestId]
    );

    res.json({ success: true, categories });
  } catch (err) {
    console.error('getAdminCategories Error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
}

async function createCategory(req, res) {
  try {
    const { restaurant_id, name, description, display_order, is_active } = req.body;
    let restId = restaurant_id || req.adminRestaurantId || req.query?.restaurant_id;
    if (!restId) {
      const [firstRest] = await query('SELECT id FROM restaurants ORDER BY id ASC LIMIT 1');
      restId = firstRest ? firstRest.id : 1;
    }

    if (!req.isSuperAdmin && !validateRestaurantAccess(restId, req)) {
      return res.status(403).json({ success: false, message: 'Access denied to this restaurant.' });
    }

    if (!name) {
      return res.status(400).json({ success: false, message: 'Category name is required.' });
    }

    let imageUrl = null;
    if (req.file) {
      imageUrl = `/uploads/${req.file.filename}`;
    }

    const result = await query(
      `INSERT INTO categories (restaurant_id, name, description, image_url, display_order, is_active) VALUES (?, ?, ?, ?, ?, ?)`,
      [restId, name, description || null, imageUrl, display_order || 0, is_active !== undefined ? (is_active ? 1 : 0) : 1]
    );

    // Sync to menu_categories for Offline KOT POS compatibility
    try {
      await query(
        `INSERT INTO menu_categories (id, name, display_order, is_active) VALUES (?, ?, ?, 1) ON DUPLICATE KEY UPDATE name=VALUES(name)`,
        [result.insertId, name, display_order || 0]
      );
    } catch (e) {
      console.warn('Sync to menu_categories warning:', e.message);
    }

    const newCat = await query('SELECT * FROM categories WHERE id = ?', [result.insertId]);

    res.status(201).json({
      success: true,
      message: 'Category created successfully.',
      category: newCat[0]
    });
  } catch (err) {
    console.error('createCategory Error:', err);
    res.status(500).json({ success: false, message: 'Server error creating category.' });
  }
}

async function updateCategory(req, res) {
  try {
    const { id } = req.params;
    const { name, description, display_order, is_active } = req.body;

    // Verify category belongs to admin's restaurant
    const [cat] = await query('SELECT restaurant_id FROM categories WHERE id = ?', [id]);
    if (!cat) return res.status(404).json({ success: false, message: 'Category not found.' });

    if (!req.isSuperAdmin && !validateRestaurantAccess(cat.restaurant_id, req)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    let imageUrl = null;
    if (req.file) {
      imageUrl = `/uploads/${req.file.filename}`;
    }

    let sql = `
      UPDATE categories SET
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        display_order = COALESCE(?, display_order),
        is_active = COALESCE(?, is_active)
    `;

    const params = [
      name || null,
      description !== undefined ? description : null,
      display_order !== undefined ? parseInt(display_order) : null,
      is_active !== undefined ? (is_active ? 1 : 0) : null
    ];

    if (imageUrl) {
      sql += `, image_url = ?`;
      params.push(imageUrl);
    }

    sql += ` WHERE id = ?`;
    params.push(id);

    await query(sql, params);
    const updated = await query('SELECT * FROM categories WHERE id = ?', [id]);

    res.json({ success: true, message: 'Category updated.', category: updated[0] });
  } catch (err) {
    console.error('updateCategory Error:', err);
    res.status(500).json({ success: false, message: 'Server error updating category.' });
  }
}

async function deleteCategory(req, res) {
  try {
    const { id } = req.params;

    const [cat] = await query('SELECT restaurant_id FROM categories WHERE id = ?', [id]);
    if (!cat) return res.status(404).json({ success: false, message: 'Category not found.' });

    if (!req.isSuperAdmin && !validateRestaurantAccess(cat.restaurant_id, req)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    await query('DELETE FROM categories WHERE id = ?', [id]);
    res.json({ success: true, message: 'Category deleted successfully.' });
  } catch (err) {
    console.error('deleteCategory Error:', err);
    res.status(500).json({ success: false, message: 'Server error deleting category.' });
  }
}

module.exports = {
  getCategoriesBySlug,
  getAdminCategories,
  createCategory,
  updateCategory,
  deleteCategory
};
