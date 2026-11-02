const path = require('path');
const fs = require('fs');
const { query } = require('../config/db');
const { validateRestaurantAccess } = require('../middleware/auth');

// Kept in sync with frontend/src/config/offerings.js
const OFFERING_TYPES = ['TODAYS_SPECIAL', 'BRUNCH', 'LUNCH', 'DINNER', 'COMBO'];

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');

function removeUploadedFile(imageUrl) {
  if (!imageUrl || !String(imageUrl).startsWith('/uploads/')) return;
  fs.unlink(path.join(UPLOAD_DIR, path.basename(imageUrl)), () => {});
}

function toBoolOrNull(value) {
  if (value === undefined || value === null || value === '' || value === 'null') return null;
  return value === true || value === 1 || value === '1' || value === 'true' ? 1 : 0;
}

function trimOrNull(value, maxLength) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  if (!text) return null;
  return maxLength ? text.slice(0, maxLength) : text;
}

/**
 * Turns the request body into column values. Only fields present in the body are
 * returned, so the same function serves a full create and a partial update
 * (e.g. just toggling is_active). Throws a user-facing message on bad input.
 */
function parseOfferingFields(body = {}, { requireTitle }) {
  const fields = {};

  if (body.offering_type !== undefined) {
    const type = String(body.offering_type).toUpperCase();
    if (!OFFERING_TYPES.includes(type)) throw new Error('Please choose a valid offering type.');
    fields.offering_type = type;
  }

  if (body.title !== undefined || requireTitle) {
    const title = trimOrNull(body.title, 150);
    if (!title) throw new Error('Offering title is required.');
    fields.title = title;
  }

  if (body.description !== undefined) fields.description = trimOrNull(body.description);
  if (body.available_time !== undefined) fields.available_time = trimOrNull(body.available_time, 100);
  if (body.includes_text !== undefined) fields.includes_text = trimOrNull(body.includes_text);

  if (body.price !== undefined) {
    const raw = String(body.price ?? '').trim();
    if (!raw) {
      fields.price = null;
    } else {
      const price = Number(raw);
      if (!Number.isFinite(price) || price < 0) throw new Error('Price must be a positive number.');
      fields.price = Math.round(price * 100) / 100;
    }
  }

  if (body.is_veg !== undefined) fields.is_veg = toBoolOrNull(body.is_veg);
  if (body.is_active !== undefined) fields.is_active = toBoolOrNull(body.is_active) ?? 1;
  if (body.display_order !== undefined) fields.display_order = parseInt(body.display_order, 10) || 0;

  return fields;
}

async function resolveAdminRestaurantId(req) {
  let restId = req.adminRestaurantId || req.user?.restaurant_id || req.query?.restaurant_id || req.body?.restaurant_id;
  if (!restId && req.isSuperAdmin) {
    const [first] = await query('SELECT id FROM restaurants ORDER BY id ASC LIMIT 1');
    restId = first ? first.id : null;
  }
  return restId ? parseInt(restId, 10) : null;
}

async function loadOwnedOffering(req, res) {
  const [offering] = await query('SELECT * FROM restaurant_offerings WHERE id = ?', [req.params.id]);
  if (!offering) {
    res.status(404).json({ success: false, message: 'Offering not found.' });
    return null;
  }
  if (!req.isSuperAdmin && !validateRestaurantAccess(offering.restaurant_id, req)) {
    res.status(403).json({ success: false, message: 'Access denied.' });
    return null;
  }
  return offering;
}

/**
 * PUBLIC: active offerings for a storefront
 */
async function getOfferingsBySlug(req, res) {
  try {
    const slug = String(req.params.slug || '').toLowerCase();
    const isNum = !isNaN(Number(slug)) && Number(slug) > 0;
    const [restaurant] = await query(
      `SELECT id FROM restaurants
       WHERE LOWER(slug) = ? OR LOWER(random_slug) = ? OR LOWER(custom_subdomain_slug) = ? ${isNum ? 'OR id = ?' : ''}
       LIMIT 1`,
      isNum ? [slug, slug, slug, Number(slug)] : [slug, slug, slug]
    );
    if (!restaurant) return res.json({ success: true, offerings: [] });

    const offerings = await query(
      `SELECT id, offering_type, title, description, image_url, price, available_time, includes_text, is_veg, is_active, display_order
       FROM restaurant_offerings
       WHERE restaurant_id = ? AND is_active = 1
       ORDER BY display_order ASC, id DESC`,
      [restaurant.id]
    );
    res.json({ success: true, offerings });
  } catch (err) {
    console.error('getOfferingsBySlug Error:', err);
    res.status(500).json({ success: false, message: 'Server error retrieving offerings.' });
  }
}

/**
 * ADMIN: all offerings (including hidden ones) for the admin's restaurant
 */
async function getAdminOfferings(req, res) {
  try {
    const restId = await resolveAdminRestaurantId(req);
    if (!restId) return res.status(403).json({ success: false, message: 'No restaurant assigned.' });
    if (!req.isSuperAdmin && !validateRestaurantAccess(restId, req)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const offerings = await query(
      'SELECT * FROM restaurant_offerings WHERE restaurant_id = ? ORDER BY display_order ASC, id DESC',
      [restId]
    );
    res.json({ success: true, offerings });
  } catch (err) {
    console.error('getAdminOfferings Error:', err);
    res.status(500).json({ success: false, message: 'Server error retrieving offerings.' });
  }
}

async function createOffering(req, res) {
  const uploadedImage = req.file ? `/uploads/${req.file.filename}` : null;
  try {
    const restId = await resolveAdminRestaurantId(req);
    if (!restId || (!req.isSuperAdmin && !validateRestaurantAccess(restId, req))) {
      removeUploadedFile(uploadedImage);
      return res.status(403).json({ success: false, message: 'Access denied to this restaurant.' });
    }

    let fields;
    try {
      fields = parseOfferingFields(req.body, { requireTitle: true });
    } catch (validationErr) {
      removeUploadedFile(uploadedImage);
      return res.status(400).json({ success: false, message: validationErr.message });
    }

    const imageUrl = uploadedImage || (req.body?.image_url ? req.body.image_url : null);

    const result = await query(
      `INSERT INTO restaurant_offerings
         (restaurant_id, offering_type, title, description, image_url, price, available_time, includes_text, is_veg, is_active, display_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        restId,
        fields.offering_type || 'TODAYS_SPECIAL',
        fields.title,
        fields.description ?? null,
        imageUrl,
        fields.price ?? null,
        fields.available_time ?? null,
        fields.includes_text ?? null,
        fields.is_veg ?? null,
        fields.is_active ?? 1,
        fields.display_order ?? 0
      ]
    );

    const [offering] = await query('SELECT * FROM restaurant_offerings WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, message: 'Offering added.', offering });
  } catch (err) {
    removeUploadedFile(uploadedImage);
    console.error('createOffering Error:', err);
    res.status(500).json({ success: false, message: 'Server error adding offering.' });
  }
}

async function updateOffering(req, res) {
  const uploadedImage = req.file ? `/uploads/${req.file.filename}` : null;
  try {
    const existing = await loadOwnedOffering(req, res);
    if (!existing) {
      removeUploadedFile(uploadedImage);
      return;
    }

    let fields;
    try {
      fields = parseOfferingFields(req.body, { requireTitle: false });
    } catch (validationErr) {
      removeUploadedFile(uploadedImage);
      return res.status(400).json({ success: false, message: validationErr.message });
    }

    const removeImage = req.body?.remove_image === '1' || req.body?.remove_image === true;
    if (uploadedImage) fields.image_url = uploadedImage;
    else if (removeImage) fields.image_url = null;
    else if (req.body?.image_url) fields.image_url = req.body.image_url;

    const columns = Object.keys(fields);
    if (columns.length > 0) {
      await query(
        `UPDATE restaurant_offerings SET ${columns.map(c => `${c} = ?`).join(', ')} WHERE id = ?`,
        [...columns.map(c => fields[c]), existing.id]
      );
    }

    if ('image_url' in fields && existing.image_url && existing.image_url !== fields.image_url) {
      removeUploadedFile(existing.image_url);
    }

    const [offering] = await query('SELECT * FROM restaurant_offerings WHERE id = ?', [existing.id]);
    res.json({ success: true, message: 'Offering updated.', offering });
  } catch (err) {
    removeUploadedFile(uploadedImage);
    console.error('updateOffering Error:', err);
    res.status(500).json({ success: false, message: 'Server error updating offering.' });
  }
}

async function deleteOffering(req, res) {
  try {
    const existing = await loadOwnedOffering(req, res);
    if (!existing) return;

    await query('DELETE FROM restaurant_offerings WHERE id = ?', [existing.id]);
    removeUploadedFile(existing.image_url);
    res.json({ success: true, message: 'Offering deleted.' });
  } catch (err) {
    console.error('deleteOffering Error:', err);
    res.status(500).json({ success: false, message: 'Server error deleting offering.' });
  }
}

module.exports = {
  OFFERING_TYPES,
  getOfferingsBySlug,
  getAdminOfferings,
  createOffering,
  updateOffering,
  deleteOffering
};
