/**
 * Hotel operations beyond the room grid:
 *  REQ-041 reservations (create / modify / cancel / check in)        REQ-042 availability & blocks
 *  REQ-043 check-in details (see accommodationController.checkInGuest) REQ-044/049 folio billing & invoice
 *  REQ-045 seasonal / weekday rates and quotes                         REQ-047 room service requests
 *  REQ-048 guest history
 * Every query is limited to the signed-in user's restaurant (hotelScope); Super Admin sees all.
 */
const crypto = require('crypto');
const pool = require('../../config/database');
const { sendSuccess, sendError } = require('../../utils/response');
const { businessDate } = require('../../utils/businessTime');

const q = async (sql, params = []) => (await pool.query(sql, params))[0];
const YMD = /^\d{4}-\d{2}-\d{2}$/;
const round2 = (v) => Math.round(Number(v || 0) * 100) / 100;

function scope(req) {
  if (String(req.user?.role || '').toUpperCase() === 'SUPER_ADMIN') return null;
  return req.user?.restaurant_id || null;
}
function restaurantOf(req) {
  return req.user?.restaurant_id || 1;
}
function ymd(value) {
  if (!value) return null;
  if (value instanceof Date) return businessDate(value);
  const s = String(value).slice(0, 10);
  return YMD.test(s) ? s : null;
}
function addDays(d, n) {
  const x = new Date(`${d}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
}
function nightsBetween(from, to) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
}
function bad(res, message, status = 400) {
  return sendError(res, message, status);
}

let schemaPromise = null;
async function addCol(table, col, def) {
  const r = await q(
    `SELECT COUNT(*) AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, col]
  );
  if (!Number(r[0]?.n)) await q(`ALTER TABLE \`${table}\` ADD COLUMN \`${col}\` ${def}`);
}
function ensureHotelSchema() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      // Older databases created rooms/folios without a restaurant: everything belonged to #1
      await addCol('rooms', 'restaurant_id', 'INT NOT NULL DEFAULT 1');
      await addCol('room_folios', 'restaurant_id', 'INT NULL DEFAULT 1');
      await q(`CREATE TABLE IF NOT EXISTS room_bookings (
        id INT AUTO_INCREMENT PRIMARY KEY, restaurant_id INT NOT NULL, room_id INT NULL, room_number VARCHAR(50) NULL,
        room_type VARCHAR(100) NULL, price_per_night DECIMAL(10,2) NULL, guest_name VARCHAR(100), guest_phone VARCHAR(30),
        check_in_date DATE, check_out_date DATE, notes TEXT, status VARCHAR(30) DEFAULT 'PENDING_INQUIRY',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
      for (const [c, d] of [
        ['guest_email', 'VARCHAR(150) NULL'], ['adults', 'INT NULL'], ['children', 'INT NULL'],
        ['total_amount', 'DECIMAL(10,2) NULL'], ['tax_amount', 'DECIMAL(10,2) NULL'], ['grand_total', 'DECIMAL(10,2) NULL'],
        ['nightly_rates_json', 'TEXT NULL'], ['advance_amount', 'DECIMAL(10,2) NOT NULL DEFAULT 0'],
        ['source', "VARCHAR(30) NULL"], ['cancel_reason', 'VARCHAR(255) NULL'], ['cancelled_at', 'DATETIME NULL'],
        ['folio_id', 'INT NULL'], ['updated_at', 'DATETIME NULL']
      ]) await addCol('room_bookings', c, d);

      await q(`CREATE TABLE IF NOT EXISTS room_blocks (
        id INT AUTO_INCREMENT PRIMARY KEY, restaurant_id INT NOT NULL, room_id INT NOT NULL,
        from_date DATE NOT NULL, to_date DATE NOT NULL, reason VARCHAR(255) NULL, created_by INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX idx_room_blocks (room_id, from_date, to_date))`);

      await q(`CREATE TABLE IF NOT EXISTS room_rate_rules (
        id INT AUTO_INCREMENT PRIMARY KEY, restaurant_id INT NOT NULL, name VARCHAR(100) NOT NULL,
        room_id INT NULL, room_type VARCHAR(100) NULL, start_date DATE NULL, end_date DATE NULL, weekdays VARCHAR(20) NULL,
        rate_type ENUM('FIXED','PERCENT') NOT NULL DEFAULT 'FIXED', value DECIMAL(10,2) NOT NULL,
        priority INT NOT NULL DEFAULT 0, is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX idx_rate_rules_restaurant (restaurant_id))`);

      await q(`CREATE TABLE IF NOT EXISTS folio_charges (
        id INT AUTO_INCREMENT PRIMARY KEY, folio_id INT NOT NULL, restaurant_id INT NULL,
        charge_type VARCHAR(20) NOT NULL DEFAULT 'EXTRA', description VARCHAR(255) NOT NULL,
        quantity DECIMAL(10,2) NOT NULL DEFAULT 1, unit_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
        amount DECIMAL(10,2) NOT NULL, tax_rate DECIMAL(5,2) NOT NULL DEFAULT 0, tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
        charge_date DATE NULL, created_by INT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_folio_charges (folio_id))`);
      await q(`CREATE TABLE IF NOT EXISTS folio_payments (
        id INT AUTO_INCREMENT PRIMARY KEY, folio_id INT NOT NULL, amount DECIMAL(10,2) NOT NULL,
        method VARCHAR(30) NOT NULL DEFAULT 'CASH', reference VARCHAR(150) NULL, created_by INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX idx_folio_payments (folio_id))`);

      await q(`CREATE TABLE IF NOT EXISTS room_service_requests (
        id INT AUTO_INCREMENT PRIMARY KEY, restaurant_id INT NOT NULL, room_id INT NOT NULL, folio_id INT NULL,
        request_type VARCHAR(20) NOT NULL DEFAULT 'OTHER', details VARCHAR(500) NULL,
        status ENUM('OPEN','IN_PROGRESS','DONE','CANCELLED') NOT NULL DEFAULT 'OPEN', source VARCHAR(10) NOT NULL DEFAULT 'STAFF',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, completed_at DATETIME NULL,
        INDEX idx_service_requests (restaurant_id, status))`);

      for (const [c, d] of [
        ['id_proof_type', 'VARCHAR(30) NULL'], ['id_proof_number', 'VARCHAR(50) NULL'], ['guest_address', 'VARCHAR(255) NULL'],
        ['adults', 'INT NULL'], ['children', 'INT NULL'], ['reservation_id', 'INT NULL'], ['guest_token', 'VARCHAR(64) NULL'],
        ['agreed_rate', 'DECIMAL(10,2) NULL'], ['company_gstin', 'VARCHAR(20) NULL']
      ]) await addCol('room_folios', c, d);
      await addCol('restaurants', 'room_tax_percentage', 'DECIMAL(5,2) NULL DEFAULT NULL');
    })().catch((err) => { schemaPromise = null; throw err; });
  }
  return schemaPromise;
}

// ---- pricing (REQ-045) ------------------------------------------------------------------

/** GST on a night's room rate: hotel override, else the slab (≤ ₹7,500 → 5%, above → 18%). */
function roomTaxRate(nightlyRate, restaurant) {
  if (restaurant && restaurant.room_tax_percentage !== null && restaurant.room_tax_percentage !== undefined) {
    return Number(restaurant.room_tax_percentage);
  }
  return Number(nightlyRate) > 7500 ? 18 : 5;
}

function ruleMatches(rule, room, date) {
  if (!Number(rule.is_active)) return false;
  if (rule.room_id && Number(rule.room_id) !== Number(room.id)) return false;
  if (rule.room_type && rule.room_type !== room.room_type) return false;
  const start = ymd(rule.start_date), end = ymd(rule.end_date);
  if (start && date < start) return false;
  if (end && date > end) return false;
  if (rule.weekdays) {
    const wd = String(new Date(`${date}T00:00:00Z`).getUTCDay());
    if (!String(rule.weekdays).split(',').map((s) => s.trim()).includes(wd)) return false;
  }
  return true;
}

async function quoteStay(room, from, to) {
  const [restaurant] = await q('SELECT id, room_tax_percentage FROM restaurants WHERE id = ?', [room.restaurant_id || 1]);
  const rules = await q('SELECT * FROM room_rate_rules WHERE restaurant_id = ? AND is_active = 1', [room.restaurant_id || 1]);
  const base = Number(room.rate_per_night || 0);
  const nights = [];
  for (let d = from; d < to; d = addDays(d, 1)) {
    const matching = rules.filter((r) => ruleMatches(r, room, d)).sort((a, b) =>
      (b.room_id ? 2 : b.room_type ? 1 : 0) - (a.room_id ? 2 : a.room_type ? 1 : 0) || b.priority - a.priority || b.id - a.id);
    const rule = matching[0];
    let rate = base;
    if (rule) rate = rule.rate_type === 'FIXED' ? Number(rule.value) : base * (1 + Number(rule.value) / 100);
    rate = round2(Math.max(0, rate));
    const taxRate = roomTaxRate(rate, restaurant);
    nights.push({ date: d, rate, rule: rule ? rule.name : null, tax_rate: taxRate, tax: round2(rate * taxRate / 100) });
  }
  const subtotal = round2(nights.reduce((s, n) => s + n.rate, 0));
  const tax = round2(nights.reduce((s, n) => s + n.tax, 0));
  return { nights, nights_count: nights.length, subtotal, tax, total: round2(subtotal + tax) };
}

// ---- availability (REQ-042) -------------------------------------------------------------

/** What stops a room from being sold for [from, to)? Returns null when free. */
async function conflictFor(roomId, from, to, { excludeBookingId = null } = {}) {
  const booking = await q(
    `SELECT id, guest_name, check_in_date, check_out_date, status FROM room_bookings
     WHERE room_id = ? AND status IN ('CONFIRMED', 'CHECKED_IN') AND check_in_date < ? AND check_out_date > ?
       ${excludeBookingId ? 'AND id <> ?' : ''} LIMIT 1`,
    excludeBookingId ? [roomId, to, from, excludeBookingId] : [roomId, to, from]
  );
  if (booking.length) return { type: 'RESERVED', detail: booking[0] };
  const block = await q(
    `SELECT id, reason, from_date, to_date FROM room_blocks WHERE room_id = ? AND from_date < ? AND to_date > ? LIMIT 1`,
    [roomId, to, from]
  );
  if (block.length) return { type: 'BLOCKED', detail: block[0] };
  const folio = await q(
    `SELECT id, guest_name, check_in_date, expected_check_out FROM room_folios
     WHERE room_id = ? AND folio_status = 'OPEN' LIMIT 1`, [roomId]
  );
  if (folio.length) {
    const fIn = ymd(folio[0].check_in_date) || businessDate();
    const fOut = ymd(folio[0].expected_check_out) || addDays(businessDate(), 1);
    if (fIn < to && fOut > from) return { type: 'OCCUPIED', detail: folio[0] };
  }
  return null;
}

/** GET /rooms/availability?from=&to= — every room's state for the range (default tonight) */
async function getAvailability(req, res, next) {
  try {
    await ensureHotelSchema();
    const from = ymd(req.query.from) || businessDate();
    const to = ymd(req.query.to) || addDays(from, 1);
    if (to <= from) return bad(res, 'Check-out must be after check-in.');
    const s = scope(req);
    const rooms = await q(`SELECT * FROM rooms ${s ? 'WHERE restaurant_id = ?' : ''} ORDER BY room_number + 0, room_number`, s ? [s] : []);
    const today = businessDate();
    const out = [];
    for (const room of rooms) {
      const conflict = await conflictFor(room.id, from, to);
      let state = conflict ? conflict.type : 'AVAILABLE';
      const coversToday = from <= today && to > today;
      if (!conflict && coversToday && room.status === 'MAINTENANCE') state = 'MAINTENANCE';
      if (!conflict && coversToday && room.status === 'CLEANING') state = 'CLEANING';
      out.push({
        id: room.id, room_number: room.room_number, room_type: room.room_type, floor: room.floor,
        rate_per_night: Number(room.rate_per_night || 0), capacity: room.capacity, state, detail: conflict ? conflict.detail : null
      });
    }
    const counts = out.reduce((acc, r) => ({ ...acc, [r.state]: (acc[r.state] || 0) + 1 }), {});
    return sendSuccess(res, { from, to, rooms: out, counts }, 'Availability');
  } catch (err) { next(err); }
}

/** GET /rooms/:id/quote?from=&to= */
async function getQuote(req, res, next) {
  try {
    await ensureHotelSchema();
    const from = ymd(req.query.from), to = ymd(req.query.to);
    if (!from || !to || to <= from) return bad(res, 'Choose check-in and check-out dates.');
    if (nightsBetween(from, to) > 90) return bad(res, 'Stays longer than 90 nights must be booked in parts.');
    const [room] = await q('SELECT * FROM rooms WHERE id = ?', [req.params.id]);
    if (!room) return bad(res, 'Room not found.', 404);
    const quote = await quoteStay(room, from, to);
    const conflict = await conflictFor(room.id, from, to);
    return sendSuccess(res, { room_id: room.id, from, to, available: !conflict, conflict, ...quote }, 'Quote');
  } catch (err) { next(err); }
}

// ---- reservations (REQ-041) -------------------------------------------------------------

function cleanGuest(body) {
  const name = String(body.guest_name || '').trim();
  const phone = String(body.guest_phone || '').trim();
  if (!name) throw new Error('Guest name is required.');
  if (phone.replace(/\D/g, '').length < 10) throw new Error('Enter a 10-digit guest phone number.');
  return {
    guest_name: name.slice(0, 100), guest_phone: phone.slice(0, 30),
    guest_email: body.guest_email ? String(body.guest_email).trim().slice(0, 150) : null,
    adults: Math.max(1, parseInt(body.adults, 10) || 1), children: Math.max(0, parseInt(body.children, 10) || 0),
    notes: body.notes ? String(body.notes).slice(0, 1000) : null,
    advance_amount: Math.max(0, Number(body.advance_amount) || 0)
  };
}

async function listReservations(req, res, next) {
  try {
    await ensureHotelSchema();
    const s = scope(req);
    const where = [`rb.status IN ('CONFIRMED','CHECKED_IN','CHECKED_OUT','CANCELLED','NO_SHOW')`];
    const params = [];
    if (s) { where.push('rb.restaurant_id = ?'); params.push(s); }
    if (req.query.status) { where.push('rb.status = ?'); params.push(String(req.query.status).toUpperCase()); }
    if (ymd(req.query.from)) { where.push('rb.check_out_date > ?'); params.push(ymd(req.query.from)); }
    if (ymd(req.query.to)) { where.push('rb.check_in_date < ?'); params.push(ymd(req.query.to)); }
    if (req.query.q) {
      where.push('(rb.guest_name LIKE ? OR rb.guest_phone LIKE ? OR rb.room_number LIKE ?)');
      const like = `%${String(req.query.q).slice(0, 60)}%`;
      params.push(like, like, like);
    }
    const rows = await q(
      `SELECT rb.*, r.room_number AS live_room_number, r.room_type AS live_room_type FROM room_bookings rb
       LEFT JOIN rooms r ON r.id = rb.room_id WHERE ${where.join(' AND ')} ORDER BY rb.check_in_date ASC, rb.id DESC LIMIT 500`,
      params
    );
    return sendSuccess(res, { reservations: rows }, 'Reservations');
  } catch (err) { next(err); }
}

async function saveReservation(req, res, next, existing = null) {
  try {
    await ensureHotelSchema();
    const body = req.body || {};
    let guest;
    try { guest = cleanGuest(existing ? { ...existing, ...body } : body); } catch (e) { return bad(res, e.message); }
    const from = ymd(body.check_in_date ?? existing?.check_in_date);
    const to = ymd(body.check_out_date ?? existing?.check_out_date);
    if (!from || !to || to <= from) return bad(res, 'Check-out must be after check-in.');
    if (!existing && from < businessDate()) return bad(res, 'Check-in cannot be in the past.');
    if (nightsBetween(from, to) > 90) return bad(res, 'Stays longer than 90 nights must be booked in parts.');
    const roomId = parseInt(body.room_id ?? existing?.room_id, 10);
    const [room] = await q('SELECT * FROM rooms WHERE id = ?', [roomId]);
    const s = scope(req);
    if (!room || (s && Number(room.restaurant_id) !== Number(s))) return bad(res, 'Choose a room.', 404);
    if (guest.adults + guest.children > Number(room.capacity || 99) + 1) {
      return bad(res, `Room ${room.room_number} takes up to ${room.capacity} guests.`);
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      // Lock the room row so two people cannot book the same nights at once
      await conn.query('SELECT id FROM rooms WHERE id = ? FOR UPDATE', [room.id]);
      const conflict = await conflictFor(room.id, from, to, { excludeBookingId: existing?.id });
      if (conflict) {
        await conn.rollback();
        const msg = conflict.type === 'RESERVED' ? `Room ${room.room_number} is already reserved for ${conflict.detail.guest_name} on those dates.`
          : conflict.type === 'BLOCKED' ? `Room ${room.room_number} is blocked on those dates${conflict.detail.reason ? ` (${conflict.detail.reason})` : ''}.`
            : `Room ${room.room_number} is occupied on those dates.`;
        return bad(res, msg, 409);
      }
      const quote = await quoteStay(room, from, to);
      const fields = {
        restaurant_id: room.restaurant_id || restaurantOf(req), room_id: room.id, room_number: room.room_number, room_type: room.room_type,
        price_per_night: quote.nights_count ? round2(quote.subtotal / quote.nights_count) : Number(room.rate_per_night || 0),
        ...guest, check_in_date: from, check_out_date: to, total_amount: quote.subtotal, tax_amount: quote.tax, grand_total: quote.total,
        nightly_rates_json: JSON.stringify(quote.nights), status: 'CONFIRMED', source: existing?.source || body.source || 'FRONT_DESK'
      };
      let id = existing?.id;
      if (id) {
        const keys = Object.keys(fields);
        await conn.query(`UPDATE room_bookings SET ${keys.map((k) => `${k} = ?`).join(', ')}, updated_at = NOW() WHERE id = ?`, [...keys.map((k) => fields[k]), id]);
      } else {
        const keys = Object.keys(fields);
        const [ins] = await conn.query(`INSERT INTO room_bookings (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`, keys.map((k) => fields[k]));
        id = ins.insertId;
      }
      await conn.commit();
      const [saved] = await q('SELECT * FROM room_bookings WHERE id = ?', [id]);
      return sendSuccess(res, { reservation: saved, quote }, existing ? 'Reservation updated' : 'Reservation confirmed', existing ? 200 : 201);
    } catch (e) {
      await conn.rollback().catch(() => {});
      throw e;
    } finally {
      conn.release();
    }
  } catch (err) { next(err); }
}

async function createReservation(req, res, next) {
  // Converting a website enquiry: update that row instead of creating another
  if (req.body?.from_inquiry_id) {
    const [inq] = await q('SELECT * FROM room_bookings WHERE id = ?', [req.body.from_inquiry_id]);
    const s = scope(req);
    if (!inq || (s && Number(inq.restaurant_id) !== Number(s))) return bad(res, 'Enquiry not found.', 404);
    return saveReservation(req, res, next, { ...inq, status: 'PENDING_INQUIRY', source: 'WEBSITE' });
  }
  return saveReservation(req, res, next, null);
}

async function updateReservation(req, res, next) {
  const [existing] = await q('SELECT * FROM room_bookings WHERE id = ?', [req.params.id]);
  if (!existing) return bad(res, 'Reservation not found.', 404);
  if (existing.status !== 'CONFIRMED') return bad(res, 'Only upcoming (confirmed) reservations can be changed.');
  return saveReservation(req, res, next, existing);
}

async function cancelReservation(req, res, next) {
  try {
    await ensureHotelSchema();
    const reason = String(req.body?.reason || '').trim().slice(0, 250) || 'Cancelled by front desk';
    const status = req.body?.no_show ? 'NO_SHOW' : 'CANCELLED';
    const upd = await q(
      `UPDATE room_bookings SET status = ?, cancel_reason = ?, cancelled_at = NOW(), updated_at = NOW() WHERE id = ? AND status = 'CONFIRMED'`,
      [status, reason, req.params.id]
    );
    if (!upd.affectedRows) return bad(res, 'Only upcoming (confirmed) reservations can be cancelled.');
    return sendSuccess(res, { id: Number(req.params.id), status }, status === 'NO_SHOW' ? 'Marked as no-show' : 'Reservation cancelled');
  } catch (err) { next(err); }
}

/** POST /rooms/reservations/:id/check-in — opens the folio at the agreed rate (REQ-041/043) */
async function checkInReservation(req, res, next) {
  const conn = await pool.getConnection();
  try {
    await ensureHotelSchema();
    await conn.beginTransaction();
    const [[rb]] = await conn.query('SELECT * FROM room_bookings WHERE id = ? FOR UPDATE', [req.params.id]);
    if (!rb || rb.status !== 'CONFIRMED') { await conn.rollback(); return bad(res, 'Only confirmed reservations can be checked in.'); }
    const [[room]] = await conn.query('SELECT * FROM rooms WHERE id = ? FOR UPDATE', [rb.room_id]);
    if (!room) { await conn.rollback(); return bad(res, 'Room not found.', 404); }
    const [open] = await conn.query(`SELECT id FROM room_folios WHERE room_id = ? AND folio_status = 'OPEN'`, [room.id]);
    if (open.length) { await conn.rollback(); return bad(res, `Room ${room.room_number} still has a guest checked in.`, 409); }
    if (['MAINTENANCE'].includes(room.status)) { await conn.rollback(); return bad(res, `Room ${room.room_number} is under maintenance.`, 409); }
    const b = req.body || {};
    const token = crypto.randomBytes(16).toString('hex');
    const [ins] = await conn.query(
      `INSERT INTO room_folios (restaurant_id, room_id, guest_name, guest_phone, guest_email, folio_status, balance, notes,
         check_in_date, expected_check_out, id_proof_type, id_proof_number, guest_address, adults, children, reservation_id,
         guest_token, agreed_rate, company_gstin)
       VALUES (?, ?, ?, ?, ?, 'OPEN', 0, ?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [room.restaurant_id || restaurantOf(req), room.id, rb.guest_name, rb.guest_phone, rb.guest_email, rb.notes,
        rb.check_out_date, b.id_proof_type || null, b.id_proof_number || null, b.guest_address || null,
        rb.adults, rb.children, rb.id, token, rb.price_per_night, b.company_gstin || null]
    );
    if (Number(rb.advance_amount) > 0) {
      await conn.query(`INSERT INTO folio_payments (folio_id, amount, method, reference, created_by) VALUES (?, ?, 'ADVANCE', ?, ?)`,
        [ins.insertId, rb.advance_amount, `Reservation #${rb.id} advance`, req.user?.id || null]);
      await conn.query('UPDATE room_folios SET balance = balance - ? WHERE id = ?', [rb.advance_amount, ins.insertId]);
    }
    await conn.query(`UPDATE rooms SET status = 'OCCUPIED' WHERE id = ?`, [room.id]);
    await conn.query(`UPDATE room_bookings SET status = 'CHECKED_IN', folio_id = ?, updated_at = NOW() WHERE id = ?`, [ins.insertId, rb.id]);
    await conn.commit();
    return sendSuccess(res, { folio_id: ins.insertId, guest_token: token, room_id: room.id }, `Checked in to Room ${room.room_number}`);
  } catch (err) {
    await conn.rollback().catch(() => {});
    next(err);
  } finally {
    conn.release();
  }
}

// ---- blocks (REQ-042) -------------------------------------------------------------------

async function listBlocks(req, res, next) {
  try {
    await ensureHotelSchema();
    const s = scope(req);
    const rows = await q(
      `SELECT b.*, r.room_number FROM room_blocks b JOIN rooms r ON r.id = b.room_id
       WHERE b.to_date >= ? ${s ? 'AND b.restaurant_id = ?' : ''} ORDER BY b.from_date`,
      s ? [businessDate(), s] : [businessDate()]
    );
    return sendSuccess(res, { blocks: rows }, 'Blocks');
  } catch (err) { next(err); }
}

async function blockRoom(req, res, next) {
  try {
    await ensureHotelSchema();
    const from = ymd(req.body?.from_date), to = ymd(req.body?.to_date);
    if (!from || !to || to <= from) return bad(res, 'Choose a start date and an end date after it.');
    const [room] = await q('SELECT * FROM rooms WHERE id = ?', [req.params.id]);
    if (!room) return bad(res, 'Room not found.', 404);
    const conflict = await conflictFor(room.id, from, to);
    if (conflict && conflict.type !== 'BLOCKED') {
      return bad(res, `Room ${room.room_number} is ${conflict.type === 'RESERVED' ? `reserved for ${conflict.detail.guest_name}` : 'occupied'} in that period.`, 409);
    }
    const ins = await q(`INSERT INTO room_blocks (restaurant_id, room_id, from_date, to_date, reason, created_by) VALUES (?, ?, ?, ?, ?, ?)`,
      [room.restaurant_id || restaurantOf(req), room.id, from, to, String(req.body?.reason || '').slice(0, 250) || null, req.user?.id || null]);
    return sendSuccess(res, { id: ins.insertId }, `Room ${room.room_number} blocked`, 201);
  } catch (err) { next(err); }
}

async function unblock(req, res, next) {
  try {
    await ensureHotelSchema();
    await q('DELETE FROM room_blocks WHERE id = ?', [req.params.id]);
    return sendSuccess(res, { id: Number(req.params.id) }, 'Block removed');
  } catch (err) { next(err); }
}

// ---- rate rules (REQ-045) ---------------------------------------------------------------

function parseRule(body) {
  const name = String(body.name || '').trim();
  if (!name) throw new Error('Give the rate a name, e.g. "Weekend" or "Diwali season".');
  const rateType = String(body.rate_type || 'FIXED').toUpperCase();
  if (!['FIXED', 'PERCENT'].includes(rateType)) throw new Error('Rate type must be FIXED or PERCENT.');
  const value = Number(body.value);
  if (!Number.isFinite(value) || (rateType === 'FIXED' && value < 0) || (rateType === 'PERCENT' && value <= -100)) {
    throw new Error(rateType === 'FIXED' ? 'Enter the price per night.' : 'Enter a percentage, e.g. 20 or -15.');
  }
  const weekdays = body.weekdays === undefined || body.weekdays === null || body.weekdays === ''
    ? null
    : (Array.isArray(body.weekdays) ? body.weekdays : String(body.weekdays).split(',')).map((d) => parseInt(d, 10)).filter((d) => d >= 0 && d <= 6);
  const start = ymd(body.start_date), end = ymd(body.end_date);
  if (start && end && end < start) throw new Error('The end date must be after the start date.');
  return {
    name: name.slice(0, 100), room_id: body.room_id ? parseInt(body.room_id, 10) : null, room_type: body.room_type || null,
    start_date: start, end_date: end, weekdays: weekdays && weekdays.length ? weekdays.join(',') : null,
    rate_type: rateType, value, priority: parseInt(body.priority, 10) || 0,
    is_active: body.is_active === undefined ? 1 : (['1', 'true', true, 1].includes(body.is_active) ? 1 : 0)
  };
}

async function listRates(req, res, next) {
  try {
    await ensureHotelSchema();
    const s = scope(req) || restaurantOf(req);
    const [restaurant] = await q('SELECT room_tax_percentage FROM restaurants WHERE id = ?', [s]);
    const rules = await q('SELECT * FROM room_rate_rules WHERE restaurant_id = ? ORDER BY is_active DESC, start_date IS NULL, start_date, id', [s]);
    return sendSuccess(res, { rules, room_tax_percentage: restaurant ? restaurant.room_tax_percentage : null }, 'Rates');
  } catch (err) { next(err); }
}

async function createRate(req, res, next) {
  try {
    await ensureHotelSchema();
    let rule;
    try { rule = parseRule(req.body || {}); } catch (e) { return bad(res, e.message); }
    const keys = Object.keys(rule);
    const ins = await q(`INSERT INTO room_rate_rules (restaurant_id, ${keys.join(', ')}) VALUES (?, ${keys.map(() => '?').join(', ')})`,
      [restaurantOf(req), ...keys.map((k) => rule[k])]);
    return sendSuccess(res, { id: ins.insertId }, 'Rate saved', 201);
  } catch (err) { next(err); }
}

async function updateRate(req, res, next) {
  try {
    await ensureHotelSchema();
    let rule;
    try { rule = parseRule(req.body || {}); } catch (e) { return bad(res, e.message); }
    const keys = Object.keys(rule);
    await q(`UPDATE room_rate_rules SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`, [...keys.map((k) => rule[k]), req.params.id]);
    return sendSuccess(res, { id: Number(req.params.id) }, 'Rate updated');
  } catch (err) { next(err); }
}

async function deleteRate(req, res, next) {
  try {
    await ensureHotelSchema();
    await q('DELETE FROM room_rate_rules WHERE id = ?', [req.params.id]);
    return sendSuccess(res, { id: Number(req.params.id) }, 'Rate removed');
  } catch (err) { next(err); }
}

async function setRoomTax(req, res, next) {
  try {
    await ensureHotelSchema();
    const raw = req.body?.room_tax_percentage;
    const v = raw === null || raw === '' || raw === undefined ? null : Number(raw);
    if (v !== null && (!Number.isFinite(v) || v < 0 || v > 40)) return bad(res, 'Enter a GST rate between 0 and 40, or leave empty for the standard slabs.');
    await q('UPDATE restaurants SET room_tax_percentage = ? WHERE id = ?', [v, restaurantOf(req)]);
    return sendSuccess(res, { room_tax_percentage: v }, v === null ? 'Using the standard GST slabs' : `Room GST set to ${v}%`);
  } catch (err) { next(err); }
}

// ---- folio billing (REQ-044 / REQ-049) --------------------------------------------------

/** Room-night charges for a folio: the agreed rate (reservation) or the rate rules. */
async function roomChargesFor(folio, room, untilDate) {
  const from = ymd(folio.check_in_date) || businessDate();
  let to = untilDate || ymd(folio.check_out_date) || businessDate();
  if (to <= from) to = addDays(from, 1); // a same-day stay is one night
  const quote = await quoteStay(room, from, to);
  if (folio.agreed_rate !== null && folio.agreed_rate !== undefined && folio.reservation_id) {
    const [restaurant] = await q('SELECT room_tax_percentage FROM restaurants WHERE id = ?', [room.restaurant_id || 1]);
    const rate = Number(folio.agreed_rate);
    const taxRate = roomTaxRate(rate, restaurant);
    quote.nights = quote.nights.map((n) => ({ ...n, rate, rule: 'Booked rate', tax_rate: taxRate, tax: round2(rate * taxRate / 100) }));
  }
  return quote.nights;
}

/** Called by check-out: posts the room nights to the folio once. */
async function postRoomCharges(conn, folio, room, userId) {
  await ensureHotelSchema();
  const [existing] = await conn.query(`SELECT COUNT(*) AS n FROM folio_charges WHERE folio_id = ? AND charge_type = 'ROOM'`, [folio.id]);
  if (Number(existing[0].n) > 0) return 0;
  const nights = await roomChargesFor(folio, room, businessDate());
  let total = 0;
  for (const n of nights) {
    await conn.query(
      `INSERT INTO folio_charges (folio_id, restaurant_id, charge_type, description, quantity, unit_amount, amount, tax_rate, tax_amount, charge_date, created_by)
       VALUES (?, ?, 'ROOM', ?, 1, ?, ?, ?, ?, ?, ?)`,
      [folio.id, room.restaurant_id || null, `Room ${room.room_number} - night of ${n.date}${n.rule && n.rule !== 'Booked rate' ? ` (${n.rule})` : ''}`,
        n.rate, n.rate, n.tax_rate, n.tax, n.date, userId || null]
    );
    total += n.rate + n.tax;
  }
  await conn.query('UPDATE room_folios SET balance = balance + ? WHERE id = ?', [round2(total), folio.id]);
  return round2(total);
}

/** GET /rooms/folios/:folioId/invoice */
async function getFolioInvoice(req, res, next) {
  try {
    await ensureHotelSchema();
    const [folio] = await q('SELECT * FROM room_folios WHERE id = ?', [req.params.folioId]);
    if (!folio) return bad(res, 'Folio not found.', 404);
    const [room] = await q('SELECT * FROM rooms WHERE id = ?', [folio.room_id]);
    const [restaurant] = await q('SELECT id, name, address, phone, email, gstin, logo_url FROM restaurants WHERE id = ?', [room?.restaurant_id || folio.restaurant_id || 1]);
    let charges = await q('SELECT * FROM folio_charges WHERE folio_id = ? ORDER BY charge_date, id', [folio.id]);
    let provisional = false;
    if (folio.folio_status === 'OPEN' && !charges.some((c) => c.charge_type === 'ROOM')) {
      // Guest still in: show the room nights so far (up to the expected check-out) as provisional
      const until = ymd(folio.expected_check_out) && ymd(folio.expected_check_out) > businessDate() ? ymd(folio.expected_check_out) : businessDate();
      const nights = await roomChargesFor(folio, room, until);
      charges = [...nights.map((n) => ({
        charge_type: 'ROOM', description: `Room ${room.room_number} - night of ${n.date}`, quantity: 1, unit_amount: n.rate,
        amount: n.rate, tax_rate: n.tax_rate, tax_amount: n.tax, charge_date: n.date, provisional: true
      })), ...charges];
      provisional = true;
    }
    const payments = await q('SELECT * FROM folio_payments WHERE folio_id = ? ORDER BY id', [folio.id]);
    const sum = (arr, k) => round2(arr.reduce((s, c) => s + Number(c[k] || 0), 0));
    const subtotal = sum(charges, 'amount');
    const tax = sum(charges, 'tax_amount');
    const paid = sum(payments, 'amount');
    const byRate = {};
    for (const c of charges) {
      const r = Number(c.tax_rate || 0);
      if (!r) continue;
      byRate[r] = byRate[r] || { rate: r, taxable: 0, cgst: 0, sgst: 0 };
      byRate[r].taxable = round2(byRate[r].taxable + Number(c.amount));
      const half = round2(Number(c.tax_amount) / 2);
      byRate[r].cgst = round2(byRate[r].cgst + half);
      byRate[r].sgst = round2(byRate[r].sgst + Number(c.tax_amount) - half);
    }
    return sendSuccess(res, {
      invoice_number: `HTL-${folio.id}`,
      provisional,
      folio: {
        id: folio.id, status: folio.folio_status, guest_name: folio.guest_name, guest_phone: folio.guest_phone, guest_email: folio.guest_email,
        guest_address: folio.guest_address, company_gstin: folio.company_gstin, adults: folio.adults, children: folio.children,
        check_in_date: folio.check_in_date, check_out_date: folio.check_out_date, expected_check_out: folio.expected_check_out
      },
      room: room ? { id: room.id, room_number: room.room_number, room_type: room.room_type } : null,
      hotel: restaurant || null,
      charges, payments, subtotal, tax, tax_breakdown: Object.values(byRate),
      total: round2(subtotal + tax), paid, balance_due: round2(subtotal + tax - paid),
      legacy_notes: charges.length === 0 ? folio.notes : null
    }, 'Invoice');
  } catch (err) { next(err); }
}

// ---- guest history (REQ-048) ------------------------------------------------------------

async function getGuestHistory(req, res, next) {
  try {
    await ensureHotelSchema();
    const digits = String(req.query.phone || '').replace(/\D/g, '').slice(-10);
    if (digits.length < 10) return bad(res, 'Enter the guest\'s 10-digit phone number.');
    const s = scope(req);
    const stays = await q(
      `SELECT f.*, r.room_number, r.room_type FROM room_folios f JOIN rooms r ON r.id = f.room_id
       WHERE f.guest_phone LIKE ? ${s ? 'AND r.restaurant_id = ?' : ''} ORDER BY f.check_in_date DESC`,
      s ? [`%${digits}`, s] : [`%${digits}`]
    );
    const reservations = await q(
      `SELECT * FROM room_bookings WHERE guest_phone LIKE ? ${s ? 'AND restaurant_id = ?' : ''} ORDER BY check_in_date DESC`,
      s ? [`%${digits}`, s] : [`%${digits}`]
    );
    const spend = stays.length
      ? (await q(`SELECT COALESCE(SUM(amount + tax_amount), 0) AS total FROM folio_charges WHERE folio_id IN (${stays.map(() => '?').join(',')})`, stays.map((x) => x.id)))[0].total
      : 0;
    const nights = stays.reduce((n, x) => {
      const a = ymd(x.check_in_date), b = ymd(x.check_out_date) || ymd(x.expected_check_out);
      return n + (a && b ? Math.max(1, nightsBetween(a, b)) : 0);
    }, 0);
    const profile = stays[0] || reservations[0] || null;
    return sendSuccess(res, {
      guest: profile ? { name: profile.guest_name, phone: profile.guest_phone, email: profile.guest_email, address: profile.guest_address || null } : null,
      stays_count: stays.length, nights, total_spend: round2(spend), stays, reservations
    }, 'Guest history');
  } catch (err) { next(err); }
}

// ---- room service requests (REQ-047) ----------------------------------------------------

const REQUEST_TYPES = ['FOOD', 'HOUSEKEEPING', 'LAUNDRY', 'AMENITIES', 'MAINTENANCE', 'OTHER'];

async function listServiceRequests(req, res, next) {
  try {
    await ensureHotelSchema();
    const s = scope(req);
    const status = req.query.status ? String(req.query.status).toUpperCase() : null;
    const rows = await q(
      `SELECT sr.*, r.room_number, f.guest_name FROM room_service_requests sr
       JOIN rooms r ON r.id = sr.room_id LEFT JOIN room_folios f ON f.id = sr.folio_id
       WHERE 1=1 ${s ? 'AND sr.restaurant_id = ?' : ''} ${status ? 'AND sr.status = ?' : `AND sr.status IN ('OPEN','IN_PROGRESS')`}
       ORDER BY sr.id DESC LIMIT 200`,
      [...(s ? [s] : []), ...(status ? [status] : [])]
    );
    return sendSuccess(res, { requests: rows }, 'Service requests');
  } catch (err) { next(err); }
}

async function createServiceRequest(req, res, next) {
  try {
    await ensureHotelSchema();
    const type = String(req.body?.request_type || 'OTHER').toUpperCase();
    if (!REQUEST_TYPES.includes(type)) return bad(res, 'Choose what the guest needs.');
    const [room] = await q('SELECT * FROM rooms WHERE id = ?', [req.params.id]);
    if (!room) return bad(res, 'Room not found.', 404);
    const [folio] = await q(`SELECT id FROM room_folios WHERE room_id = ? AND folio_status = 'OPEN' LIMIT 1`, [room.id]);
    const ins = await q(`INSERT INTO room_service_requests (restaurant_id, room_id, folio_id, request_type, details, source) VALUES (?, ?, ?, ?, ?, 'STAFF')`,
      [room.restaurant_id || restaurantOf(req), room.id, folio ? folio.id : null, type, String(req.body?.details || '').slice(0, 500) || null]);
    notifyRequest(room, type, req.body?.details);
    return sendSuccess(res, { id: ins.insertId }, 'Request logged', 201);
  } catch (err) { next(err); }
}

async function updateServiceRequest(req, res, next) {
  try {
    await ensureHotelSchema();
    const status = String(req.body?.status || '').toUpperCase();
    if (!['OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED'].includes(status)) return bad(res, 'Unknown status.');
    await q(`UPDATE room_service_requests SET status = ?, completed_at = ${status === 'DONE' ? 'NOW()' : 'NULL'} WHERE id = ?`, [status, req.params.id]);
    return sendSuccess(res, { id: Number(req.params.id), status }, 'Request updated');
  } catch (err) { next(err); }
}

function notifyRequest(room, type, details) {
  try {
    const { sendNotification } = require('../../services/NotificationService');
    sendNotification({
      restaurantId: room.restaurant_id,
      title: `Room ${room.room_number}: ${type.toLowerCase()} request`,
      message: details ? String(details).slice(0, 140) : `Room ${room.room_number} needs ${type.toLowerCase()}.`,
      type: 'ROOM_SERVICE'
    }).catch(() => {});
  } catch (e) { /* notifications are best effort */ }
}

/** Guest page: GET /stay/:token (public, the link is private to the guest's stay) */
async function getGuestStay(req, res) {
  try {
    await ensureHotelSchema();
    const token = String(req.params.token || '');
    if (!/^[a-f0-9]{32}$/.test(token)) return res.status(404).json({ success: false, message: 'This link is not valid.' });
    const [stay] = await q(
      `SELECT f.id, f.guest_name, f.folio_status, f.expected_check_out, r.room_number, r.restaurant_id, rs.name AS hotel_name, rs.phone AS hotel_phone, rs.slug AS hotel_slug
       FROM room_folios f JOIN rooms r ON r.id = f.room_id JOIN restaurants rs ON rs.id = r.restaurant_id WHERE f.guest_token = ?`,
      [token]
    );
    if (!stay || stay.folio_status !== 'OPEN') return res.status(404).json({ success: false, message: 'This stay has ended or the link is not valid.' });
    const requests = await q(`SELECT id, request_type, details, status, created_at FROM room_service_requests WHERE folio_id = ? ORDER BY id DESC LIMIT 20`, [stay.id]);
    res.json({
      success: true,
      stay: { guest_first_name: String(stay.guest_name || '').split(' ')[0], room_number: stay.room_number, hotel_name: stay.hotel_name, hotel_phone: stay.hotel_phone, hotel_slug: stay.hotel_slug, expected_check_out: stay.expected_check_out },
      requests,
      request_types: REQUEST_TYPES
    });
  } catch (err) {
    console.error('getGuestStay Error:', err);
    res.status(500).json({ success: false, message: 'Could not load your stay.' });
  }
}

/** Guest request: POST /stay/:token/requests { request_type, details } */
async function createGuestRequest(req, res) {
  try {
    await ensureHotelSchema();
    const token = String(req.params.token || '');
    const type = String(req.body?.request_type || '').toUpperCase();
    if (!/^[a-f0-9]{32}$/.test(token)) return res.status(404).json({ success: false, message: 'This link is not valid.' });
    if (!REQUEST_TYPES.includes(type)) return res.status(400).json({ success: false, message: 'Choose what you need.' });
    const [stay] = await q(
      `SELECT f.id, f.room_id, f.folio_status, r.restaurant_id, r.room_number FROM room_folios f JOIN rooms r ON r.id = f.room_id WHERE f.guest_token = ?`, [token]);
    if (!stay || stay.folio_status !== 'OPEN') return res.status(404).json({ success: false, message: 'This stay has ended.' });
    const [[recent]] = await pool.query(`SELECT COUNT(*) AS n FROM room_service_requests WHERE folio_id = ? AND created_at > NOW() - INTERVAL 10 MINUTE`, [stay.id]);
    if (Number(recent.n) >= 5) return res.status(429).json({ success: false, message: 'You have sent several requests just now. The team will be with you shortly.' });
    const details = String(req.body?.details || '').trim().slice(0, 500) || null;
    const ins = await q(`INSERT INTO room_service_requests (restaurant_id, room_id, folio_id, request_type, details, source) VALUES (?, ?, ?, ?, ?, 'GUEST')`,
      [stay.restaurant_id, stay.room_id, stay.id, type, details]);
    notifyRequest({ restaurant_id: stay.restaurant_id, room_number: stay.room_number }, type, details);
    res.status(201).json({ success: true, id: ins.insertId, message: 'Request sent. The team has been notified.' });
  } catch (err) {
    console.error('createGuestRequest Error:', err);
    res.status(500).json({ success: false, message: 'Could not send your request.' });
  }
}

module.exports = {
  ensureHotelSchema, quoteStay, conflictFor, postRoomCharges, roomTaxRate,
  getAvailability, getQuote,
  listReservations, createReservation, updateReservation, cancelReservation, checkInReservation,
  listBlocks, blockRoom, unblock,
  listRates, createRate, updateRate, deleteRate, setRoomTax,
  getFolioInvoice, getGuestHistory,
  listServiceRequests, createServiceRequest, updateServiceRequest,
  getGuestStay, createGuestRequest
};
