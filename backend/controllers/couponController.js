const { query } = require('../config/db');
const CouponService = require('../services/CouponService');

function couponErrorStatus(err) {
  return err instanceof CouponService.CouponError ? 400 : 500;
}

async function resolveRestaurantId(input) {
  if (!input) return null;
  if (/^\d+$/.test(String(input))) return parseInt(input, 10);
  const slug = String(input).toLowerCase();
  const [r] = await query(
    'SELECT id FROM restaurants WHERE LOWER(slug) = ? OR LOWER(random_slug) = ? OR LOWER(custom_subdomain_slug) = ? LIMIT 1',
    [slug, slug, slug]
  );
  return r ? r.id : null;
}

/**
 * POST /coupons/validate { restaurantId | restaurantSlug, code, subtotal, customerPhone }
 * Checkout preview. The order itself re-checks the coupon on the server.
 */
async function validateCoupon(req, res) {
  try {
    const restaurantId = await resolveRestaurantId(req.body.restaurantId || req.body.restaurantSlug);
    if (!restaurantId) return res.status(404).json({ success: false, message: 'Restaurant not found.' });
    const subtotal = Number(req.body.subtotal);
    if (!Number.isFinite(subtotal) || subtotal < 0) {
      return res.status(400).json({ success: false, message: 'Cart total is not valid.' });
    }
    const coupon = await CouponService.preview({
      restaurantId,
      code: req.body.code,
      subtotal,
      customerPhone: req.body.customerPhone
    });
    res.json({ success: true, coupon });
  } catch (err) {
    if (couponErrorStatus(err) === 500) console.error('validateCoupon Error:', err);
    res.status(couponErrorStatus(err)).json({ success: false, message: couponErrorStatus(err) === 400 ? err.message : 'Could not check the coupon.' });
  }
}

function adminRestaurantId(req) {
  return req.adminRestaurantId || null;
}

async function listCoupons(req, res) {
  try {
    const restId = adminRestaurantId(req);
    if (!restId) return res.status(400).json({ success: false, message: 'No restaurant selected.' });
    res.json({ success: true, coupons: await CouponService.listCoupons(restId) });
  } catch (err) {
    console.error('listCoupons Error:', err);
    res.status(500).json({ success: false, message: 'Could not load coupons.' });
  }
}

async function createCoupon(req, res) {
  try {
    const restId = adminRestaurantId(req);
    if (!restId) return res.status(400).json({ success: false, message: 'No restaurant selected.' });
    const coupon = await CouponService.createCoupon(restId, req.body || {});
    res.status(201).json({ success: true, message: `Coupon ${coupon.code} created.`, coupon });
  } catch (err) {
    if (couponErrorStatus(err) === 500) console.error('createCoupon Error:', err);
    res.status(couponErrorStatus(err)).json({ success: false, message: couponErrorStatus(err) === 400 ? err.message : 'Could not create the coupon.' });
  }
}

async function updateCoupon(req, res) {
  try {
    const restId = adminRestaurantId(req);
    const coupon = await CouponService.updateCoupon(restId, req.params.id, req.body || {});
    res.json({ success: true, message: `Coupon ${coupon.code} updated.`, coupon });
  } catch (err) {
    if (couponErrorStatus(err) === 500) console.error('updateCoupon Error:', err);
    res.status(couponErrorStatus(err)).json({ success: false, message: couponErrorStatus(err) === 400 ? err.message : 'Could not update the coupon.' });
  }
}

async function deleteCoupon(req, res) {
  try {
    const restId = adminRestaurantId(req);
    const result = await CouponService.deleteCoupon(restId, req.params.id);
    res.json({
      success: true,
      ...result,
      message: result.deactivated ? 'This coupon has been used, so it was switched off instead of deleted.' : 'Coupon deleted.'
    });
  } catch (err) {
    if (couponErrorStatus(err) === 500) console.error('deleteCoupon Error:', err);
    res.status(couponErrorStatus(err)).json({ success: false, message: couponErrorStatus(err) === 400 ? err.message : 'Could not delete the coupon.' });
  }
}

module.exports = { validateCoupon, listCoupons, createCoupon, updateCoupon, deleteCoupon };
