const pool = require('../../config/database');
const { sendSuccess, sendError } = require('../../utils/response');
const { ensureRestaurantMenu, seedKOTData } = require('../../database/init');

let isSeeding = false;
async function autoSeedIfEmpty() {
  if (isSeeding) return;
  try {
    const [catCheck] = await pool.query('SELECT COUNT(*) as count FROM categories');
    const [deptCheck] = await pool.query('SELECT COUNT(*) as count FROM kitchen_departments');
    const [itemCheck] = await pool.query('SELECT COUNT(*) as count FROM menu_items');
    
    if (catCheck[0].count === 0 || deptCheck[0].count === 0 || itemCheck[0].count === 0) {
      isSeeding = true;
      console.log('🔄 Live Database Self-Healing: Seeding missing categories, departments, and menu items...');
      await seedKOTData(pool);
      const [allRestaurants] = await pool.query('SELECT id FROM restaurants');
      if (allRestaurants.length === 0) {
        await ensureRestaurantMenu(pool, 1);
      } else {
        for (const r of allRestaurants) {
          await ensureRestaurantMenu(pool, r.id);
        }
      }
      console.log('✅ Live Database Self-Healing: Seed completed successfully!');
    }
  } catch (err) {
    console.warn('Auto-seed check warning:', err.message);
  } finally {
    isSeeding = false;
  }
}

// CATEGORIES
async function getCategories(req, res, next) {
  try {
    await autoSeedIfEmpty();
    const [rows] = await pool.query(
      `SELECT cat.id, cat.name, cat.display_order, cat.is_active, COUNT(m.id) as total_items
       FROM (
         SELECT id, name, display_order, is_active FROM categories WHERE is_active = 1
         UNION
         SELECT id, name, display_order, is_active FROM menu_categories WHERE is_active = 1
       ) cat
       LEFT JOIN menu_items m ON cat.id = m.category_id
       GROUP BY cat.id, cat.name, cat.display_order, cat.is_active
       ORDER BY cat.display_order ASC, cat.name ASC`
    );
    return sendSuccess(res, rows, 'Categories fetched');
  } catch (err) {
    next(err);
  }
}

async function createCategory(req, res, next) {
  try {
    const { name, display_order, restaurant_id } = req.body;
    if (!name) {
      return sendError(res, 'Category name is required', 400);
    }

    const [restRows] = await pool.query('SELECT id FROM restaurants ORDER BY id ASC LIMIT 1');
    const restId = restaurant_id || (restRows[0] ? restRows[0].id : 1);

    const [result] = await pool.query(
      `INSERT INTO categories (restaurant_id, name, display_order, is_active) VALUES (?, ?, ?, 1)`,
      [restId, name, display_order || 0]
    );

    const catId = result.insertId;

    try {
      await pool.query(
        `INSERT INTO menu_categories (id, name, display_order, is_active) VALUES (?, ?, ?, 1) ON DUPLICATE KEY UPDATE name=VALUES(name)`,
        [catId, name, display_order || 0]
      );
    } catch (e) {}

    const [newCat] = await pool.query(`SELECT * FROM categories WHERE id = ?`, [catId]);
    return sendSuccess(res, newCat[0], 'Category created successfully', 201);
  } catch (err) {
    next(err);
  }
}

async function updateCategory(req, res, next) {
  try {
    const { id } = req.params;
    const { name, display_order, is_active } = req.body;
    await pool.query(
      `UPDATE menu_categories 
       SET name = COALESCE(?, name),
           display_order = COALESCE(?, display_order),
           is_active = COALESCE(?, is_active)
       WHERE id = ?`,
      [name, display_order, is_active, id]
    );
    const [updated] = await pool.query(`SELECT * FROM menu_categories WHERE id = ?`, [id]);
    return sendSuccess(res, updated[0], 'Category updated successfully');
  } catch (err) {
    next(err);
  }
}

async function deleteCategory(req, res, next) {
  try {
    const { id } = req.params;
    await pool.query(`UPDATE menu_categories SET is_active = FALSE WHERE id = ?`, [id]);
    return sendSuccess(res, null, 'Category deactivated');
  } catch (err) {
    next(err);
  }
}

// KITCHEN DEPARTMENTS
async function getKitchenDepartments(req, res, next) {
  try {
    await autoSeedIfEmpty();
    const [rows] = await pool.query(`SELECT * FROM kitchen_departments ORDER BY name ASC`);
    return sendSuccess(res, rows, 'Kitchen departments fetched');
  } catch (err) {
    next(err);
  }
}

async function createKitchenDepartment(req, res, next) {
  try {
    const { name, code, description } = req.body;
    if (!name || !code) {
      return sendError(res, 'Name and Code are required', 400);
    }
    const [result] = await pool.query(
      `INSERT INTO kitchen_departments (name, code, description) VALUES (?, ?, ?)`,
      [name, code.toUpperCase(), description || '']
    );
    const [newDept] = await pool.query(`SELECT * FROM kitchen_departments WHERE id = ?`, [result.insertId]);
    return sendSuccess(res, newDept[0], 'Kitchen department created', 201);
  } catch (err) {
    next(err);
  }
}

async function updateKitchenDepartment(req, res, next) {
  try {
    const { id } = req.params;
    const { name, description, is_active } = req.body;
    await pool.query(
      `UPDATE kitchen_departments 
       SET name = COALESCE(?, name),
           description = COALESCE(?, description),
           is_active = COALESCE(?, is_active)
       WHERE id = ?`,
      [name, description, is_active, id]
    );
    const [updated] = await pool.query(`SELECT * FROM kitchen_departments WHERE id = ?`, [id]);
    return sendSuccess(res, updated[0], 'Kitchen department updated');
  } catch (err) {
    next(err);
  }
}

// MENU ITEMS
async function getMenuItems(req, res, next) {
  try {
    await autoSeedIfEmpty();
    const { category_id, kitchen_department_id, is_veg, is_available, search } = req.query;
    let query = `
      SELECT m.*, COALESCE(c.name, mc.name) as category_name, k.name as kitchen_department_name, k.code as kitchen_department_code
      FROM menu_items m
      LEFT JOIN categories c ON m.category_id = c.id
      LEFT JOIN menu_categories mc ON m.category_id = mc.id
      LEFT JOIN kitchen_departments k ON m.kitchen_department_id = k.id
      WHERE 1=1
    `;
    const params = [];

    if (category_id) {
      query += ` AND m.category_id = ?`;
      params.push(category_id);
    }
    if (kitchen_department_id) {
      query += ` AND m.kitchen_department_id = ?`;
      params.push(kitchen_department_id);
    }
    if (is_veg !== undefined && is_veg !== '') {
      query += ` AND m.is_veg = ?`;
      params.push(is_veg === 'true' || is_veg === '1');
    }
    if (is_available !== undefined && is_available !== '') {
      query += ` AND m.is_available = ?`;
      params.push(is_available === 'true' || is_available === '1');
    }
    if (search) {
      query += ` AND (m.name LIKE ? OR m.description LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY m.display_order ASC, m.name ASC`;

    const [items] = await pool.query(query, params);

    // Fetch modifiers for each item
    for (let item of items) {
      const [modifiers] = await pool.query(
        `SELECT mg.*
         FROM modifier_groups mg
         JOIN menu_item_modifiers mim ON mg.id = mim.modifier_group_id
         WHERE mim.menu_item_id = ?`,
        [item.id]
      );
      for (let mod of modifiers) {
        const [options] = await pool.query(
          `SELECT id, name, price_adjustment, is_available FROM modifier_options WHERE modifier_group_id = ?`,
          [mod.id]
        );
        mod.options = options;
      }
      item.modifiers = modifiers;
    }

    return sendSuccess(res, items, 'Menu items fetched');
  } catch (err) {
    next(err);
  }
}

async function createMenuItem(req, res, next) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const {
      category_id, kitchen_department_id, name, description, image_url, price,
      tax_percentage, is_veg, prep_time_minutes, preparation_time_minutes, batch_capacity,
      modifier_group_ids, restaurant_id, is_available, is_available_online
    } = req.body;

    if (!category_id || !name || price === undefined) {
      return sendError(res, 'Category, name, and price are required', 400);
    }

    const prepTime = parseInt(prep_time_minutes ?? preparation_time_minutes ?? 15);
    if (isNaN(prepTime) || prepTime <= 0) {
      return sendError(res, 'Preparation time must be a valid positive number (> 0)', 400);
    }

    const batchCap = parseInt(batch_capacity ?? 10);
    if (isNaN(batchCap) || batchCap <= 0) {
      return sendError(res, 'Batch capacity must be a valid positive number (> 0)', 400);
    }

    let restId = restaurant_id || req.user?.restaurant_id;
    if (!restId) {
      const [restRows] = await connection.query('SELECT id FROM restaurants ORDER BY id ASC LIMIT 1');
      restId = restRows[0] ? restRows[0].id : 1;
    }

    const isOnline = is_available_online !== undefined ? (is_available_online ? 1 : 0) : 1;
    const isAvail = is_available !== undefined ? (is_available ? 1 : 0) : 1;

    const [result] = await connection.query(
      `INSERT INTO menu_items 
        (restaurant_id, category_id, kitchen_department_id, name, description, image_url, price, tax_percentage, is_veg, prep_time_minutes, batch_capacity, is_available, is_available_online)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        restId,
        category_id,
        kitchen_department_id || null,
        name,
        description || '',
        image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80',
        price,
        tax_percentage || 5.0,
        is_veg !== undefined ? (is_veg ? 1 : 0) : 1,
        prepTime,
        batchCap,
        isAvail,
        isOnline
      ]
    );

    const menuItemId = result.insertId;

    if (modifier_group_ids && Array.isArray(modifier_group_ids)) {
      for (const gId of modifier_group_ids) {
        await connection.query(
          `INSERT INTO menu_item_modifiers (menu_item_id, modifier_group_id) VALUES (?, ?)`,
          [menuItemId, gId]
        );
      }
    }

    await connection.commit();

    const [item] = await pool.query(`SELECT * FROM menu_items WHERE id = ?`, [menuItemId]);
    return sendSuccess(res, item[0], 'Menu item created successfully', 201);
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
}

async function getMenuItemById(req, res, next) {
  try {
    const { id } = req.params;
    const [items] = await pool.query(
      `SELECT m.*, COALESCE(c.name, mc.name) as category_name, k.name as kitchen_department_name
       FROM menu_items m
       LEFT JOIN categories c ON m.category_id = c.id
       LEFT JOIN menu_categories mc ON m.category_id = mc.id
       LEFT JOIN kitchen_departments k ON m.kitchen_department_id = k.id
       WHERE m.id = ?`,
      [id]
    );

    if (items.length === 0) {
      return sendError(res, 'Menu item not found', 404);
    }

    const item = items[0];

    const [modifiers] = await pool.query(
      `SELECT mg.*
       FROM modifier_groups mg
       JOIN menu_item_modifiers mim ON mg.id = mim.modifier_group_id
       WHERE mim.menu_item_id = ?`,
      [item.id]
    );
    for (let mod of modifiers) {
      const [options] = await pool.query(
        `SELECT id, name, price_adjustment, is_available FROM modifier_options WHERE modifier_group_id = ?`,
        [mod.id]
      );
      mod.options = options;
    }
    item.modifiers = modifiers;

    return sendSuccess(res, item, 'Menu item details fetched');
  } catch (err) {
    next(err);
  }
}

async function updateMenuItem(req, res, next) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { id } = req.params;
    const {
      category_id, kitchen_department_id, name, description, image_url, price,
      tax_percentage, is_veg, prep_time_minutes, preparation_time_minutes, batch_capacity,
      is_available, is_available_online, is_active, modifier_group_ids
    } = req.body;

    const [existing] = await connection.query(`SELECT id FROM menu_items WHERE id = ?`, [id]);
    if (existing.length === 0) {
      return sendError(res, 'Menu item not found', 404);
    }

    let validatedPrepTime = null;
    const rawPrep = prep_time_minutes !== undefined ? prep_time_minutes : preparation_time_minutes;
    if (rawPrep !== undefined && rawPrep !== null && rawPrep !== '') {
      const pt = parseInt(rawPrep);
      if (isNaN(pt) || pt <= 0) {
        return sendError(res, 'Preparation time must be a valid positive number (> 0)', 400);
      }
      validatedPrepTime = pt;
    }

    let validatedBatchCap = null;
    if (batch_capacity !== undefined && batch_capacity !== null && batch_capacity !== '') {
      const bc = parseInt(batch_capacity);
      if (isNaN(bc) || bc <= 0) {
        return sendError(res, 'Batch capacity must be a valid positive number (> 0)', 400);
      }
      validatedBatchCap = bc;
    }

    await connection.query(
      `UPDATE menu_items 
       SET category_id = COALESCE(?, category_id),
           kitchen_department_id = COALESCE(?, kitchen_department_id),
           name = COALESCE(?, name),
           description = COALESCE(?, description),
           image_url = COALESCE(?, image_url),
           price = COALESCE(?, price),
           tax_percentage = COALESCE(?, tax_percentage),
           is_veg = COALESCE(?, is_veg),
           prep_time_minutes = COALESCE(?, prep_time_minutes),
           batch_capacity = COALESCE(?, batch_capacity),
           is_available = COALESCE(?, is_available),
           is_available_online = COALESCE(?, is_available_online),
           is_active = COALESCE(?, is_active)
       WHERE id = ?`,
      [
        category_id,
        kitchen_department_id,
        name,
        description,
        image_url,
        price,
        tax_percentage,
        is_veg !== undefined ? (is_veg ? 1 : 0) : null,
        validatedPrepTime,
        validatedBatchCap,
        is_available !== undefined ? (is_available ? 1 : 0) : null,
        is_available_online !== undefined ? (is_available_online ? 1 : 0) : null,
        is_active !== undefined ? (is_active ? 1 : 0) : null,
        id
      ]
    );

    if (modifier_group_ids !== undefined && Array.isArray(modifier_group_ids)) {
      await connection.query(`DELETE FROM menu_item_modifiers WHERE menu_item_id = ?`, [id]);
      for (const gId of modifier_group_ids) {
        await connection.query(
          `INSERT INTO menu_item_modifiers (menu_item_id, modifier_group_id) VALUES (?, ?)`,
          [id, gId]
        );
      }
    }

    await connection.commit();

    const [updated] = await pool.query(`SELECT * FROM menu_items WHERE id = ?`, [id]);
    return sendSuccess(res, updated[0], 'Menu item updated successfully');
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
}

async function toggleOnlineAvailability(req, res, next) {
  try {
    const { id } = req.params;
    const [existing] = await pool.query(`SELECT id, name, is_available_online FROM menu_items WHERE id = ?`, [id]);
    if (existing.length === 0) {
      return sendError(res, 'Menu item not found', 404);
    }
    const currentOnline = existing[0].is_available_online === null || existing[0].is_available_online === undefined ? 1 : existing[0].is_available_online;
    const newStatus = currentOnline ? 0 : 1;
    await pool.query(`UPDATE menu_items SET is_available_online = ? WHERE id = ?`, [newStatus, id]);
    const [updated] = await pool.query(`SELECT * FROM menu_items WHERE id = ?`, [id]);
    return sendSuccess(res, updated[0], `"${existing[0].name}" is now ${newStatus ? 'enabled' : 'disabled'} for online ordering`);
  } catch (err) {
    next(err);
  }
}

async function deleteMenuItem(req, res, next) {
  try {
    const { id } = req.params;
    await pool.query(`UPDATE menu_items SET is_active = FALSE WHERE id = ?`, [id]);
    return sendSuccess(res, null, 'Menu item deactivated');
  } catch (err) {
    next(err);
  }
}

// MODIFIERS
async function getModifierGroups(req, res, next) {
  try {
    const [groups] = await pool.query(`SELECT * FROM modifier_groups ORDER BY name ASC`);
    for (let group of groups) {
      const [options] = await pool.query(`SELECT * FROM modifier_options WHERE modifier_group_id = ?`, [group.id]);
      group.options = options;
    }
    return sendSuccess(res, groups, 'Modifier groups fetched');
  } catch (err) {
    next(err);
  }
}

async function createModifierGroup(req, res, next) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { name, is_required, min_selection, max_selection, options } = req.body;
    if (!name) {
      return sendError(res, 'Modifier group name is required', 400);
    }

    const [result] = await connection.query(
      `INSERT INTO modifier_groups (name, is_required, min_selection, max_selection) VALUES (?, ?, ?, ?)`,
      [name, is_required || false, min_selection || 0, max_selection || 1]
    );

    const groupId = result.insertId;

    if (options && Array.isArray(options)) {
      for (const opt of options) {
        await connection.query(
          `INSERT INTO modifier_options (modifier_group_id, name, price_adjustment) VALUES (?, ?, ?)`,
          [groupId, opt.name, opt.price_adjustment || 0.00]
        );
      }
    }

    await connection.commit();

    return sendSuccess(res, { id: groupId, name }, 'Modifier group created', 201);
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
}

// PUBLIC MENU (For Customer QR Ordering)
async function getPublicMenu(req, res, next) {
  try {
    const [categories] = await pool.query(
      `SELECT cat.id, cat.name, cat.display_order 
       FROM (
         SELECT id, name, display_order, is_active FROM categories WHERE is_active = 1
         UNION
         SELECT id, name, display_order, is_active FROM menu_categories WHERE is_active = 1
       ) cat
       ORDER BY cat.display_order ASC, cat.name ASC`
    );

    const [items] = await pool.query(
      `SELECT m.id, m.category_id, m.name, m.description, m.image_url, m.price, 
              5.00 as tax_percentage, 
              m.is_veg, m.prep_time_minutes, m.batch_capacity, m.is_available, m.is_available_online, 
              'Main Kitchen' as kitchen_department_name
       FROM menu_items m
       WHERE m.is_available = TRUE
       ORDER BY m.display_order ASC, m.name ASC`
    );

    for (let item of items) {
      const [modifiers] = await pool.query(
        `SELECT mg.id, mg.name, mg.is_required, mg.min_selection, mg.max_selection
         FROM modifier_groups mg
         JOIN menu_item_modifiers mim ON mg.id = mim.modifier_group_id
         WHERE mim.menu_item_id = ?`,
        [item.id]
      );

      for (let mod of modifiers) {
        const [options] = await pool.query(
          `SELECT id, name, price_adjustment 
           FROM modifier_options 
           WHERE modifier_group_id = ? AND is_available = TRUE`,
          [mod.id]
        );
        mod.options = options;
      }

      item.modifiers = modifiers;
    }

    return sendSuccess(res, { categories, items }, 'Public menu loaded successfully');
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getKitchenDepartments,
  createKitchenDepartment,
  updateKitchenDepartment,
  getMenuItems,
  createMenuItem,
  getMenuItemById,
  updateMenuItem,
  deleteMenuItem,
  toggleOnlineAvailability,
  getModifierGroups,
  createModifierGroup,
  getPublicMenu
};
