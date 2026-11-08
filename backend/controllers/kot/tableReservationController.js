/**
 * Restaurant table reservations (REQ-051 table reservation, REQ-052 table status,
 * REQ-056 advanced reservation management).
 *
 *  - Staff take bookings (phone, walk-in, in person, WhatsApp); customers book online from the
 *    restaurant page and can look up or cancel their booking from a private link.
 *  - Booking types: regular table, celebration, private dining and group / event. The last two
 *    get longer slots and wait for staff confirmation when booked online.
 *  - Flow: PENDING (to confirm) -> CONFIRMED -> SEATED -> COMPLETED, or CANCELLED / NO_SHOW.
 *    WAITLIST holds walk-ins while the floor is full.
 *  - No double booking: a table can't carry two active bookings whose times overlap, with a
 *    cleaning gap between them. Big parties get tables joined on one floor.
 *  - Floor status: a confirmed booking's tables show RESERVED from an hour before until the
 *    guests are seated (released 30 minutes after the booking time if nobody arrives).
 *
 * Times are the restaurant's wall clock (BUSINESS_UTC_OFFSET, India by default), stored as plain
 * DATETIME values and always read back with DATE_FORMAT so the server's timezone never shifts them.
 */
const crypto = require('crypto');
const pool = require('../../config/database');
const { sendSuccess, sendError } = require('../../utils/response');
const { offsetMinutes } = require('../../utils/businessTime');
const { broadcastEvent, emitToTenant } = require('../../config/socket');

const q = async (sql, params = [], ex = pool) => (await ex.query(sql, params))[0];

const BOOKING_TYPES = {
  TABLE: { label: 'Table booking', minutes: 90, confirmOnline: false },
  CELEBRATION: { label: 'Birthday / celebration', minutes: 120, confirmOnline: false },
  PRIVATE_DINING: { label: 'Private dining', minutes: 150, confirmOnline: true, prefer: 'VIP' },
  GROUP_EVENT: { label: 'Group / event', minutes: 180, confirmOnline: true }
};
const STAFF_SOURCES = ['PHONE', 'WALK_IN', 'IN_PERSON', 'WHATSAPP'];
const HOLDING = ['PENDING', 'CONFIRMED', 'SEATED']; // statuses whose tables are taken
const TRANSITIONS = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  WAITLIST: ['SEATED', 'CANCELLED'],
  CONFIRMED: ['SEATED', 'CANCELLED', 'NO_SHOW'],
  SEATED: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: []
};
const TURNOVER_MIN = 15; // cleaning gap kept between two bookings on one table
const HOLD_BEFORE_MIN = 60; // the table shows RESERVED this long before the booking
const LATE_RELEASE_MIN = 30; // ...and is released this long after it if nobody arrived
const NEAR_TERM_MIN = 30; // bookings this close to now also need the table to be free right now
const ONLINE = { maxParty: 20, maxDaysAhead: 60, minLeadMin: 30, maxActivePerPhone: 3, slotStepMin: 30 };

// ---------------------------------------------------------------------------------------------
// Wall-clock helpers. A "local" Date carries the restaurant's wall-clock time in its UTC fields.
// ---------------------------------------------------------------------------------------------
const pad = (n) => String(n).padStart(2, '0');
const localNow = () => new Date(Date.now() + offsetMinutes() * 60000);
const addMin = (d, mins) => new Date(d.getTime() + mins * 60000);
const toSql = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:00`;
const ymdOf = (d) => toSql(d).slice(0, 10);
const hmOf = (d) => toSql(d).slice(11, 16);

function parseLocal(date, time) {
  const ds = String(date || '');
  const ts = String(time || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ds) || !/^\d{1,2}:\d{2}$/.test(ts)) return null;
  const [y, m, d] = ds.split('-').map(Number);
  const [hh, mm] = ts.split(':').map(Number);
  if (hh > 23 || mm > 59) return null;
  const dt = new Date(Date.UTC(y, m - 1, d, hh, mm));
  return dt.getUTCDate() === d && dt.getUTCMonth() === m - 1 ? dt : null;
}
/** "YYYY-MM-DD HH:MM[:SS]" from MySQL -> local Date. */
function fromSql(s) {
  const m = String(s || '').match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/);
  return m ? parseLocal(m[1], m[2]) : null;
}
function timeOfDay(value, fallback) {
  const m = String(value || '').match(/^(\d{1,2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : fallback;
}

const digits = (p) => String(p || '').replace(/\D/g, '');
const cleanPhone = (p) => {
  const raw = String(p || '').trim();
  const d = digits(raw);
  return d.length >= 10 && d.length <= 15 ? (raw.startsWith('+') ? `+${d}` : d) : null;
};
const text = (v, max) => {
  const s = String(v == null ? '' : v).trim();
  return s ? s.slice(0, max) : null;
};
const restaurantOf = (req) => req.user?.restaurant_id || 1;
const isSuperAdmin = (req) => String(req.user?.role || '').toUpperCase() === 'SUPER_ADMIN';

// ---------------------------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------------------------
let schemaReady = false;
async function ensureTableReservationSchema() {
  if (schemaReady) return;
  await q(`CREATE TABLE IF NOT EXISTS table_reservations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    restaurant_id INT NOT NULL,
    reservation_code VARCHAR(12) NOT NULL,
    manage_token VARCHAR(64) NOT NULL,
    booking_type VARCHAR(20) NOT NULL DEFAULT 'TABLE',
    source VARCHAR(20) NOT NULL DEFAULT 'PHONE',
    status VARCHAR(20) NOT NULL DEFAULT 'CONFIRMED',
    customer_name VARCHAR(120) NOT NULL,
    customer_phone VARCHAR(20) NOT NULL,
    customer_email VARCHAR(160) NULL,
    party_size INT NOT NULL,
    reserved_for DATETIME NOT NULL,
    reserved_until DATETIME NOT NULL,
    duration_minutes INT NOT NULL DEFAULT 90,
    occasion VARCHAR(80) NULL,
    special_requests VARCHAR(500) NULL,
    internal_notes VARCHAR(500) NULL,
    deposit_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    deposit_method VARCHAR(20) NULL,
    deposit_reference VARCHAR(80) NULL,
    cancel_reason VARCHAR(255) NULL,
    confirmed_at DATETIME NULL,
    seated_at DATETIME NULL,
    completed_at DATETIME NULL,
    cancelled_at DATETIME NULL,
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_table_res_code (reservation_code),
    UNIQUE KEY uq_table_res_token (manage_token),
    INDEX idx_table_res_time (restaurant_id, reserved_for),
    INDEX idx_table_res_phone (restaurant_id, customer_phone)
  )`);
  await q(`CREATE TABLE IF NOT EXISTS table_reservation_tables (
    reservation_id INT NOT NULL,
    table_id INT NOT NULL,
    hold_applied TINYINT(1) NOT NULL DEFAULT 0,
    PRIMARY KEY (reservation_id, table_id),
    INDEX idx_table_res_table (table_id)
  )`);
  const tableCols = await q(
    `SELECT COLUMN_NAME AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'restaurant_tables'`
  );
  if (tableCols.length && !tableCols.some((r) => r.c === 'held_for_reservation_id')) {
    await q(`ALTER TABLE restaurant_tables ADD COLUMN held_for_reservation_id INT NULL`);
  }
  const restCols = await q(
    `SELECT COLUMN_NAME AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'restaurants'`
  );
  if (restCols.length && !restCols.some((r) => r.c === 'table_booking_enabled')) {
    await q(`ALTER TABLE restaurants ADD COLUMN table_booking_enabled TINYINT(1) NOT NULL DEFAULT 1`);
  }
  schemaReady = true;
}

// ---------------------------------------------------------------------------------------------
// Floor availability
// ---------------------------------------------------------------------------------------------
/** The restaurant's tables plus every holding booking that touches [from, to). */
async function loadFloor(restaurantId, from, to, ex = pool) {
  const tables = await q(
    `SELECT id, table_number, table_name, floor, section, capacity, table_type, status, held_for_reservation_id
     FROM restaurant_tables
     WHERE (restaurant_id = ? OR restaurant_id IS NULL) AND (is_active = 1 OR is_active IS NULL)
     ORDER BY CAST(REGEXP_REPLACE(table_number, '[^0-9]', '') AS UNSIGNED) ASC, table_number ASC`,
    [restaurantId], ex
  );
  const bookings = await q(
    `SELECT rt.table_id, r.id, r.status,
            DATE_FORMAT(r.reserved_for, '%Y-%m-%d %H:%i') AS starts, DATE_FORMAT(r.reserved_until, '%Y-%m-%d %H:%i') AS ends
     FROM table_reservation_tables rt
     JOIN table_reservations r ON r.id = rt.reservation_id
     WHERE r.restaurant_id = ? AND r.status IN ('PENDING','CONFIRMED','SEATED')
       AND r.reserved_for < ? AND r.reserved_until > ?`,
    [restaurantId, toSql(addMin(to, TURNOVER_MIN)), toSql(addMin(from, -TURNOVER_MIN))], ex
  );
  return {
    tables: tables.map((t) => ({ ...t, capacity: Number(t.capacity) || 0 })),
    bookings: bookings.map((b) => ({ ...b, start: fromSql(b.starts), end: fromSql(b.ends) }))
  };
}

/** Each table with free / busy for [start, end). Pure: works on a loaded floor. */
function tablesFor(floor, start, end, { excludeId = null, ownTableIds = [], now = localNow() } = {}) {
  const nearTerm = start.getTime() < addMin(now, NEAR_TERM_MIN).getTime();
  const own = new Set((ownTableIds || []).map(Number)); // the booking's own tables (e.g. guests already seated there)
  return floor.tables.map((t) => {
    const clash = floor.bookings.find((b) => b.table_id === t.id && Number(b.id) !== Number(excludeId)
      && b.start < addMin(end, TURNOVER_MIN) && b.end > addMin(start, -TURNOVER_MIN));
    let busy = null;
    if (t.status === 'OUT_OF_SERVICE') busy = 'Out of service';
    else if (clash) busy = `Booked ${hmOf(clash.start)}–${hmOf(clash.end)}`;
    else if (nearTerm && !own.has(Number(t.id)) && !['AVAILABLE', 'CLEANING'].includes(t.status)
      && !(t.status === 'RESERVED' && excludeId && Number(t.held_for_reservation_id) === Number(excludeId))) {
      busy = `Now ${String(t.status).replace(/_/g, ' ').toLowerCase()}`;
    }
    return {
      id: t.id, table_number: t.table_number, table_name: t.table_name, floor: t.floor, section: t.section,
      capacity: t.capacity, table_type: t.table_type, status: t.status, free: !busy, busy_reason: busy
    };
  });
}

/** Best tables for a party: the smallest table that fits, else tables joined on one floor. */
function pickTables(tables, partySize, prefer = null) {
  const free = tables.filter((t) => t.free);
  const singles = free.filter((t) => t.capacity >= partySize).sort((a, b) => a.capacity - b.capacity);
  if (prefer) {
    const preferred = singles.find((t) => t.table_type === prefer);
    if (preferred) return [preferred];
  }
  if (singles.length) return [singles[0]];
  let best = null;
  const floors = new Map();
  for (const t of free) {
    const key = t.floor || '';
    if (!floors.has(key)) floors.set(key, []);
    floors.get(key).push(t);
  }
  for (const list of floors.values()) {
    const chosen = [];
    let seats = 0;
    for (const t of [...list].sort((a, b) => b.capacity - a.capacity)) {
      if (seats >= partySize) break;
      chosen.push(t);
      seats += t.capacity;
    }
    if (seats >= partySize && (!best || chosen.length < best.length)) best = chosen;
  }
  return best || [];
}

// ---------------------------------------------------------------------------------------------
// RESERVED status on the floor plan
// ---------------------------------------------------------------------------------------------
/**
 * Puts confirmed bookings that start within the hour on their tables as RESERVED and frees tables
 * whose booking was cancelled, seated elsewhere or never showed up. Each booking holds a table once,
 * so staff can still free a held table by hand. Returns the number of tables changed.
 */
async function syncTableHolds(restaurantId) {
  await ensureTableReservationSchema();
  const now = localNow();
  const due = await q(
    `SELECT rt.table_id, rt.hold_applied, r.id
     FROM table_reservations r JOIN table_reservation_tables rt ON rt.reservation_id = r.id
     WHERE r.restaurant_id = ? AND r.status = 'CONFIRMED' AND r.reserved_for <= ? AND r.reserved_for >= ?
     ORDER BY r.reserved_for ASC`,
    [restaurantId, toSql(addMin(now, HOLD_BEFORE_MIN)), toSql(addMin(now, -LATE_RELEASE_MIN))]
  );
  const want = new Map();
  for (const d of due) if (!want.has(d.table_id)) want.set(d.table_id, d);
  const tables = await q(
    `SELECT id, status, held_for_reservation_id FROM restaurant_tables
     WHERE (restaurant_id = ? OR restaurant_id IS NULL) AND (held_for_reservation_id IS NOT NULL OR id IN (?))`,
    [restaurantId, want.size ? [...want.keys()] : [0]]
  );
  const changed = [];
  for (const t of tables) {
    const target = want.get(t.id);
    if (target) {
      const heldOther = t.status === 'RESERVED' && t.held_for_reservation_id && Number(t.held_for_reservation_id) !== Number(target.id);
      if ((t.status === 'AVAILABLE' && !target.hold_applied) || heldOther) {
        const r = await q(
          `UPDATE restaurant_tables SET status = 'RESERVED', held_for_reservation_id = ? WHERE id = ? AND status IN ('AVAILABLE','RESERVED')`,
          [target.id, t.id]
        );
        await q(`UPDATE table_reservation_tables SET hold_applied = 1 WHERE reservation_id = ? AND table_id = ?`, [target.id, t.id]);
        if (r.affectedRows && t.status !== 'RESERVED') changed.push({ table_id: t.id, status: 'RESERVED' });
      }
    } else if (t.held_for_reservation_id) {
      if (t.status === 'RESERVED') {
        await q(`UPDATE restaurant_tables SET status = 'AVAILABLE', held_for_reservation_id = NULL WHERE id = ? AND status = 'RESERVED'`, [t.id]);
        changed.push({ table_id: t.id, status: 'AVAILABLE' });
      } else {
        await q(`UPDATE restaurant_tables SET held_for_reservation_id = NULL WHERE id = ?`, [t.id]);
      }
    }
  }
  for (const c of changed) broadcastEvent('table_status_changed', c);
  return changed.length;
}

/** Background sweep for every restaurant with bookings around now (runs every couple of minutes). */
async function syncAllTableHolds() {
  try {
    await ensureTableReservationSchema();
    const now = localNow();
    const rows = await q(
      `SELECT DISTINCT restaurant_id FROM table_reservations
       WHERE status = 'CONFIRMED' AND reserved_for BETWEEN ? AND ?
       UNION SELECT DISTINCT restaurant_id FROM restaurant_tables WHERE held_for_reservation_id IS NOT NULL AND restaurant_id IS NOT NULL`,
      [toSql(addMin(now, -LATE_RELEASE_MIN - 60)), toSql(addMin(now, HOLD_BEFORE_MIN + 5))]
    );
    for (const r of rows) await syncTableHolds(r.restaurant_id);
  } catch (err) {
    console.warn('Table hold sweep warning:', err.message);
  }
}

/** Next booking (within 24 hours) on each table, for the floor plan cards. */
async function nextReservationsByTable(restaurantId) {
  await ensureTableReservationSchema();
  const now = localNow();
  const rows = await q(
    `SELECT rt.table_id, r.id, r.reservation_code, r.customer_name, r.party_size, r.status, r.booking_type,
            DATE_FORMAT(r.reserved_for, '%Y-%m-%d') AS date, DATE_FORMAT(r.reserved_for, '%H:%i') AS time
     FROM table_reservation_tables rt JOIN table_reservations r ON r.id = rt.reservation_id
     WHERE r.restaurant_id = ? AND r.status IN ('PENDING','CONFIRMED') AND r.reserved_for >= ? AND r.reserved_for < ?
     ORDER BY r.reserved_for ASC`,
    [restaurantId, toSql(addMin(now, -LATE_RELEASE_MIN)), toSql(addMin(now, 24 * 60))]
  );
  const map = new Map();
  for (const r of rows) if (!map.has(r.table_id)) map.set(r.table_id, r);
  return map;
}

// ---------------------------------------------------------------------------------------------
// Reading bookings
// ---------------------------------------------------------------------------------------------
const SELECT_RES = `SELECT r.id, r.restaurant_id, r.reservation_code, r.booking_type, r.source, r.status,
    r.customer_name, r.customer_phone, r.customer_email, r.party_size, r.duration_minutes,
    DATE_FORMAT(r.reserved_for, '%Y-%m-%d') AS date, DATE_FORMAT(r.reserved_for, '%H:%i') AS time,
    DATE_FORMAT(r.reserved_until, '%Y-%m-%d %H:%i') AS ends_at,
    r.occasion, r.special_requests, r.internal_notes, r.deposit_amount, r.deposit_method, r.deposit_reference,
    r.cancel_reason, DATE_FORMAT(r.seated_at, '%H:%i') AS seated_time, r.created_at
  FROM table_reservations r`;

async function withTables(rows, ex = pool) {
  if (!rows.length) return rows;
  const links = await q(
    `SELECT rt.reservation_id, t.id, t.table_number, t.table_name, t.capacity, t.floor
     FROM table_reservation_tables rt JOIN restaurant_tables t ON t.id = rt.table_id
     WHERE rt.reservation_id IN (?) ORDER BY t.table_number`,
    [rows.map((r) => r.id)], ex
  );
  const now = localNow();
  return rows.map((r) => {
    const start = parseLocal(r.date, r.time);
    return {
      ...r,
      deposit_amount: Number(r.deposit_amount || 0),
      booking_type_label: (BOOKING_TYPES[r.booking_type] || {}).label || r.booking_type,
      tables: links.filter((l) => l.reservation_id === r.id).map(({ reservation_id, ...t }) => t),
      is_late: r.status === 'CONFIRMED' && start && addMin(start, 15) < now
    };
  });
}

async function loadReservation(id, ex = pool) {
  const rows = await q(`${SELECT_RES} WHERE r.id = ?`, [id], ex);
  return rows.length ? (await withTables(rows, ex))[0] : null;
}

function publicView(r, restaurant) {
  return {
    reservation_code: r.reservation_code,
    status: r.status,
    booking_type: r.booking_type,
    booking_type_label: r.booking_type_label,
    customer_name: r.customer_name,
    party_size: r.party_size,
    date: r.date,
    time: r.time,
    occasion: r.occasion,
    special_requests: r.special_requests,
    can_cancel: ['PENDING', 'CONFIRMED', 'WAITLIST'].includes(r.status)
      && parseLocal(r.date, r.time) > localNow(),
    restaurant: restaurant ? { name: restaurant.name, phone: restaurant.phone, address: restaurant.address, slug: restaurant.slug } : null
  };
}

// ---------------------------------------------------------------------------------------------
// Creating / changing bookings
// ---------------------------------------------------------------------------------------------
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function newCode() {
  const bytes = crypto.randomBytes(6);
  return `TR${[...bytes].map((b) => CODE_CHARS[b % CODE_CHARS.length]).join('')}`;
}

function fail(message, status = 400, extra = {}) {
  return { error: message, status, ...extra };
}

/** Serialises bookings per restaurant: locks its table rows for the rest of the transaction. */
async function lockFloor(conn, restaurantId) {
  await conn.query(`SELECT id FROM restaurant_tables WHERE restaurant_id = ? OR restaurant_id IS NULL FOR UPDATE`, [restaurantId]);
}

/** Validates the chosen tables (or picks some) for [start, end). */
function chooseTables(floor, start, end, partySize, { tableIds = null, excludeId = null, ownTableIds = [], prefer = null }) {
  const options = tablesFor(floor, start, end, { excludeId, ownTableIds });
  if (tableIds && tableIds.length) {
    const chosen = [];
    for (const id of tableIds) {
      const t = options.find((o) => Number(o.id) === Number(id));
      if (!t) return { error: 'One of the selected tables was not found.' };
      if (!t.free) return { error: `Table ${t.table_number} is not free then (${t.busy_reason}).`, conflict: true };
      chosen.push(t);
    }
    const seats = chosen.reduce((s, t) => s + t.capacity, 0);
    return { tables: chosen, warning: seats < partySize ? `The selected tables seat ${seats}; the party is ${partySize}.` : null };
  }
  const picked = pickTables(options, partySize, prefer);
  return picked.length ? { tables: picked } : { tables: [], none: true };
}

function parseTableIds(value) {
  if (value == null || value === '') return null;
  const list = (Array.isArray(value) ? value : String(value).split(',')).map((v) => Number(v)).filter((n) => Number.isInteger(n) && n > 0);
  return [...new Set(list)];
}

/** Next free start times on the same day, for "that time is full" answers. */
function alternativeTimes(floor, start, duration, partySize, windowStart, windowEnd, prefer) {
  const out = [];
  const now = localNow();
  for (let t = new Date(windowStart); t <= windowEnd && out.length < 4; t = addMin(t, ONLINE.slotStepMin)) {
    if (Math.abs(t - start) < 60000 || t < addMin(now, ONLINE.minLeadMin)) continue;
    if (pickTables(tablesFor(floor, t, addMin(t, duration)), partySize, prefer).length) out.push(hmOf(t));
  }
  return out;
}

/** Opening window [first seating, last seating] for a date; closing past midnight is supported. */
function seatingWindow(restaurant, date, duration) {
  const open = timeOfDay(restaurant.opening_time, 11 * 60);
  let close = timeOfDay(restaurant.closing_time, 23 * 60);
  if (close <= open) close += 24 * 60;
  const day = parseLocal(date, '00:00');
  const first = addMin(day, open);
  const last = addMin(day, Math.max(open, close - Math.min(duration, 60)));
  return { first, last };
}

async function createReservationCore(restaurantId, input, { online = false, userId = null, restaurant = null } = {}) {
  await ensureTableReservationSchema();
  const name = text(input.customer_name ?? input.name, 120);
  const phone = cleanPhone(input.customer_phone ?? input.phone);
  const email = text(input.customer_email ?? input.email, 160);
  const partySize = Number.parseInt(input.party_size, 10);
  const bookingType = BOOKING_TYPES[String(input.booking_type || 'TABLE').toUpperCase()] ? String(input.booking_type || 'TABLE').toUpperCase() : null;
  if (!name || name.length < 2) return fail('Enter the guest name.');
  if (!phone) return fail('Enter a valid mobile number (at least 10 digits).');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail('Enter a valid email or leave it empty.');
  if (!Number.isInteger(partySize) || partySize < 1 || partySize > (online ? ONLINE.maxParty : 200)) {
    return fail(online ? `Online bookings are for 1 to ${ONLINE.maxParty} guests. For larger groups please call the restaurant.` : 'Party size must be between 1 and 200.');
  }
  if (!bookingType) return fail('Unknown booking type.');
  const type = BOOKING_TYPES[bookingType];

  const waitlist = !online && String(input.status || '').toUpperCase() === 'WAITLIST';
  const now = localNow();
  const start = waitlist ? parseLocal(ymdOf(now), hmOf(now)) : parseLocal(input.date, input.time);
  if (!start) return fail('Choose a valid date and time.');
  const duration = online ? type.minutes : Math.min(720, Math.max(30, Number.parseInt(input.duration_minutes, 10) || type.minutes));
  const end = addMin(start, duration);

  if (online) {
    if (start < addMin(now, ONLINE.minLeadMin)) return fail(`Please book at least ${ONLINE.minLeadMin} minutes ahead, or call the restaurant.`);
    if (start > addMin(now, ONLINE.maxDaysAhead * 1440)) return fail(`Bookings open ${ONLINE.maxDaysAhead} days ahead.`);
    // Seating hours of that day, or of the evening before when the restaurant closes after midnight.
    const win = seatingWindow(restaurant || {}, input.date, duration);
    const eve = seatingWindow(restaurant || {}, ymdOf(addMin(start, -1440)), duration);
    const inside = (w) => start >= w.first && start <= w.last;
    if (!inside(win) && !inside(eve)) return fail(`We take bookings from ${hmOf(win.first)} to ${hmOf(win.last)}.`);
  } else if (!waitlist && start < addMin(now, -120)) {
    return fail('That time has already passed.');
  }

  const source = online ? 'ONLINE' : (STAFF_SOURCES.includes(String(input.source || '').toUpperCase()) ? String(input.source).toUpperCase() : 'PHONE');
  const tableIds = online ? null : parseTableIds(input.table_ids);
  const deposit = online ? 0 : Math.max(0, Math.round(Number(input.deposit_amount || 0) * 100) / 100);
  let status = waitlist ? 'WAITLIST' : (online ? (type.confirmOnline ? 'PENDING' : 'CONFIRMED') : (String(input.status || '').toUpperCase() === 'PENDING' ? 'PENDING' : 'CONFIRMED'));

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await lockFloor(conn, restaurantId);

    // A double-click or retry returns the booking already made instead of a second one.
    const dup = await q(
      `SELECT id FROM table_reservations WHERE restaurant_id = ? AND customer_phone = ? AND reserved_for = ?
         AND status IN ('PENDING','CONFIRMED','WAITLIST') AND created_at >= NOW() - INTERVAL 10 MINUTE LIMIT 1`,
      [restaurantId, phone, toSql(start)], conn
    );
    if (dup.length) {
      await conn.commit();
      return { reservation: await loadReservation(dup[0].id), duplicate: true };
    }
    if (online) {
      const active = await q(
        `SELECT COUNT(*) AS n FROM table_reservations WHERE restaurant_id = ? AND customer_phone = ?
           AND status IN ('PENDING','CONFIRMED') AND reserved_for >= ?`,
        [restaurantId, phone, toSql(now)], conn
      );
      if (Number(active[0].n) >= ONLINE.maxActivePerPhone) {
        await conn.rollback();
        return fail('You already have upcoming bookings with us. Please call the restaurant to book more.', 429);
      }
    }

    let tables = [];
    let warning = null;
    if (!waitlist) {
      const floor = await loadFloor(restaurantId, start, end, conn);
      const pick = chooseTables(floor, start, end, partySize, { tableIds, prefer: type.prefer });
      if (pick.error) {
        await conn.rollback();
        return fail(pick.error, pick.conflict ? 409 : 400);
      }
      if (pick.none) {
        if (!floor.tables.length) {
          // No tables set up yet (REQ-051): the booking still comes in. Online it is a request the
          // restaurant confirms; a staff booking is simply confirmed without a table.
          if (online) status = 'PENDING';
        } else if (online && type.confirmOnline) {
          // Events and private dining are requests: staff arrange the tables when confirming.
          status = 'PENDING';
        } else {
          await conn.rollback();
          const win = seatingWindow(restaurant || { opening_time: null, closing_time: null }, ymdOf(start), duration);
          const alternatives = alternativeTimes(floor, start, duration, partySize, win.first, win.last, type.prefer);
          return fail(
            online
              ? `Sorry, no table for ${partySize} is free at ${hmOf(start)}.${alternatives.length ? ` Free times: ${alternatives.join(', ')}.` : ' Please try another day.'}`
              : `No free table seats ${partySize} at ${hmOf(start)}. Pick tables yourself, choose another time or add the guest to the waitlist.`,
            409, { alternatives }
          );
        }
      }
      tables = pick.tables;
      warning = pick.warning || null;
    }

    let id = null;
    for (let attempt = 0; attempt < 5 && !id; attempt += 1) {
      try {
        const r = await q(
          `INSERT INTO table_reservations
            (restaurant_id, reservation_code, manage_token, booking_type, source, status, customer_name, customer_phone, customer_email,
             party_size, reserved_for, reserved_until, duration_minutes, occasion, special_requests, internal_notes,
             deposit_amount, deposit_method, deposit_reference, confirmed_at, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [restaurantId, newCode(), crypto.randomBytes(24).toString('hex'), bookingType, source, status, name, phone, email,
            partySize, toSql(start), toSql(end), duration, text(input.occasion, 80), text(input.special_requests, 500),
            online ? null : text(input.internal_notes, 500), deposit, deposit ? text(input.deposit_method, 20) || 'CASH' : null,
            deposit ? text(input.deposit_reference, 80) : null, status === 'CONFIRMED' ? toSql(now) : null, userId],
          conn
        );
        id = r.insertId;
      } catch (err) {
        if (err.code !== 'ER_DUP_ENTRY') throw err;
      }
    }
    if (!id) throw new Error('Could not create a booking reference.');
    for (const t of tables) {
      await q(`INSERT INTO table_reservation_tables (reservation_id, table_id) VALUES (?, ?)`, [id, t.id], conn);
    }
    await conn.commit();
    const reservation = await loadReservation(id);
    afterChange(restaurantId, reservation);
    return { reservation, warning };
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    conn.release();
  }
}

/** Bell notification for the restaurant team (online bookings and guest cancellations). */
async function notifyRestaurant(restaurantId, title, r) {
  try {
    const when = `${r.date} ${r.time}`;
    await require('../../services/NotificationService').sendNotification({
      restaurantId,
      title,
      message: `${r.customer_name} · ${r.party_size} guest${r.party_size === 1 ? '' : 's'} · ${when}${r.booking_type_label && r.booking_type !== 'TABLE' ? ` · ${r.booking_type_label}` : ''} · ${r.reservation_code}`,
      type: 'TABLE_BOOKING'
    });
  } catch (e) { /* notifications are best effort */ }
}

function afterChange(restaurantId, reservation) {
  syncTableHolds(restaurantId).catch((err) => console.warn('Table hold sync warning:', err.message));
  emitToTenant(restaurantId, 'admin', 'table_reservation_changed', { id: reservation?.id, status: reservation?.status });
  emitToTenant(restaurantId, 'waiter', 'table_reservation_changed', { id: reservation?.id, status: reservation?.status });
}

// ---------------------------------------------------------------------------------------------
// Staff endpoints (/api/table-reservations)
// ---------------------------------------------------------------------------------------------
/** router.param guard: bookings of another restaurant look "not found". */
async function guardReservation(req, res, next, id) {
  try {
    await ensureTableReservationSchema();
    const rows = await q(`SELECT restaurant_id FROM table_reservations WHERE id = ?`, [id]);
    if (!rows.length || (!isSuperAdmin(req) && Number(rows[0].restaurant_id) !== Number(restaurantOf(req)))) {
      return sendError(res, 'Reservation not found.', 404);
    }
    req.reservationRestaurantId = rows[0].restaurant_id;
    next();
  } catch (err) {
    next(err);
  }
}

async function listReservations(req, res, next) {
  try {
    await ensureTableReservationSchema();
    const restaurantId = restaurantOf(req);
    await syncTableHolds(restaurantId).catch(() => 0);
    const today = ymdOf(localNow());
    const from = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.from || req.query.date || '')) ? String(req.query.from || req.query.date) : today;
    let to = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.to || '')) ? String(req.query.to) : from;
    if (to < from) to = from;
    const fromD = parseLocal(from, '00:00');
    const toD = addMin(parseLocal(to, '00:00'), 1440);
    if ((toD - fromD) / 86400000 > 62) return sendError(res, 'Choose at most two months at a time.', 400);

    const where = ['r.restaurant_id = ?', 'r.reserved_for >= ?', 'r.reserved_for < ?'];
    const params = [restaurantId, toSql(fromD), toSql(toD)];
    const status = String(req.query.status || '').toUpperCase();
    if (status === 'ACTIVE') where.push(`r.status IN ('PENDING','CONFIRMED','WAITLIST','SEATED')`);
    else if (TRANSITIONS[status]) { where.push('r.status = ?'); params.push(status); }
    const search = text(req.query.search, 60);
    if (search) {
      where.push('(r.customer_name LIKE ? OR r.customer_phone LIKE ? OR r.reservation_code LIKE ?)');
      params.push(`%${search}%`, `%${digits(search) || search}%`, `%${search.toUpperCase()}%`);
    }
    const rows = await withTables(await q(`${SELECT_RES} WHERE ${where.join(' AND ')} ORDER BY r.reserved_for ASC, r.id ASC LIMIT 500`, params));

    // Guest history: earlier visits and no-shows by phone (REQ-056 end-to-end management).
    const phones = [...new Set(rows.map((r) => r.customer_phone))];
    const history = phones.length ? await q(
      `SELECT customer_phone, SUM(status = 'COMPLETED') AS visits, SUM(status = 'NO_SHOW') AS no_shows
       FROM table_reservations WHERE restaurant_id = ? AND customer_phone IN (?) GROUP BY customer_phone`,
      [restaurantId, phones]
    ) : [];
    const hist = new Map(history.map((h) => [h.customer_phone, h]));
    const data = rows.map((r) => ({
      ...r,
      guest_visits: Number(hist.get(r.customer_phone)?.visits || 0),
      guest_no_shows: Number(hist.get(r.customer_phone)?.no_shows || 0)
    }));
    const live = data.filter((r) => !['CANCELLED', 'NO_SHOW'].includes(r.status));
    const summary = {
      bookings: live.filter((r) => r.status !== 'WAITLIST').length,
      guests: live.filter((r) => r.status !== 'WAITLIST').reduce((s, r) => s + Number(r.party_size || 0), 0),
      by_status: Object.keys(TRANSITIONS).reduce((acc, s) => ({ ...acc, [s]: data.filter((r) => r.status === s).length }), {})
    };
    return sendSuccess(res, { from, to, reservations: data, summary, booking_types: BOOKING_TYPES }, 'Reservations loaded');
  } catch (err) {
    next(err);
  }
}

/** Counts for the sidebar badge and dashboard: today's bookings and requests waiting to be confirmed. */
async function getReservationSummary(req, res, next) {
  try {
    await ensureTableReservationSchema();
    const rid = restaurantOf(req);
    const now = localNow();
    const today = ymdOf(now);
    const dayStart = toSql(parseLocal(today, '00:00'));
    const dayEnd = toSql(addMin(parseLocal(today, '00:00'), 1440));
    const [t] = await q(
      `SELECT COUNT(*) AS bookings, COALESCE(SUM(party_size), 0) AS guests,
              SUM(status = 'SEATED') AS seated, SUM(status = 'WAITLIST') AS waitlist
       FROM table_reservations WHERE restaurant_id = ? AND reserved_for >= ? AND reserved_for < ?
         AND status IN ('PENDING','CONFIRMED','SEATED','WAITLIST','COMPLETED')`, [rid, dayStart, dayEnd]
    );
    const [p] = await q(
      `SELECT COUNT(*) AS n, DATE_FORMAT(MIN(reserved_for), '%Y-%m-%d') AS first_date FROM table_reservations
       WHERE restaurant_id = ? AND status = 'PENDING' AND reserved_until >= ?`, [rid, toSql(now)]
    );
    const [u] = await q(
      `SELECT COUNT(*) AS n FROM table_reservations WHERE restaurant_id = ? AND status IN ('PENDING','CONFIRMED')
         AND reserved_for >= ? AND reserved_for < ?`, [rid, toSql(now), toSql(addMin(now, 7 * 1440))]
    );
    const [tables] = await q(`SELECT COUNT(*) AS n FROM restaurant_tables WHERE (restaurant_id = ? OR restaurant_id IS NULL) AND (is_active = 1 OR is_active IS NULL)`, [rid]);
    return sendSuccess(res, {
      today: { date: today, bookings: Number(t.bookings || 0), guests: Number(t.guests || 0), seated: Number(t.seated || 0), waitlist: Number(t.waitlist || 0) },
      pending_requests: Number(p.n || 0),
      first_pending_date: p.first_date || null,
      upcoming_7_days: Number(u.n || 0),
      has_tables: Number(tables.n || 0) > 0
    }, 'Booking summary');
  } catch (err) {
    next(err);
  }
}

async function getReservation(req, res, next) {
  try {
    const r = await loadReservation(req.params.id);
    return sendSuccess(res, r, 'Reservation loaded');
  } catch (err) {
    next(err);
  }
}

async function checkAvailability(req, res, next) {
  try {
    await ensureTableReservationSchema();
    const restaurantId = restaurantOf(req);
    const start = parseLocal(req.query.date, req.query.time);
    if (!start) return sendError(res, 'Choose a valid date and time.', 400);
    const type = BOOKING_TYPES[String(req.query.booking_type || 'TABLE').toUpperCase()] || BOOKING_TYPES.TABLE;
    const duration = Math.min(720, Math.max(30, Number.parseInt(req.query.duration_minutes, 10) || type.minutes));
    const partySize = Math.max(1, Number.parseInt(req.query.party_size, 10) || 2);
    const excludeId = Number.parseInt(req.query.exclude_id, 10) || null;
    const end = addMin(start, duration);
    const floor = await loadFloor(restaurantId, start, end);
    const tables = tablesFor(floor, start, end, { excludeId });
    const suggested = pickTables(tables, partySize, type.prefer).map((t) => t.id);
    return sendSuccess(res, {
      date: ymdOf(start), time: hmOf(start), end_time: hmOf(end), duration_minutes: duration, party_size: partySize,
      tables, suggested_table_ids: suggested, free_count: tables.filter((t) => t.free).length
    }, 'Availability loaded');
  } catch (err) {
    next(err);
  }
}

async function createReservation(req, res, next) {
  try {
    const result = await createReservationCore(restaurantOf(req), req.body || {}, { userId: req.user?.id || null });
    if (result.error) return res.status(result.status).json({ success: false, message: result.error, alternatives: result.alternatives || [] });
    const msg = result.duplicate ? 'This booking was already made.'
      : `Booked ${result.reservation.reservation_code}${result.warning ? `. Note: ${result.warning}` : ''}`;
    return sendSuccess(res, result.reservation, msg, result.duplicate ? 200 : 201);
  } catch (err) {
    next(err);
  }
}

async function updateReservation(req, res, next) {
  const conn = await pool.getConnection();
  try {
    const id = Number(req.params.id);
    const body = req.body || {};
    await conn.beginTransaction();
    const restaurantId = req.reservationRestaurantId || restaurantOf(req);
    await lockFloor(conn, restaurantId);
    const current = await loadReservation(id, conn);
    if (!['PENDING', 'CONFIRMED', 'WAITLIST', 'SEATED'].includes(current.status)) {
      await conn.rollback();
      return sendError(res, `A ${current.status.toLowerCase().replace('_', '-')} booking can't be changed.`, 400);
    }
    const name = body.customer_name !== undefined ? text(body.customer_name, 120) : current.customer_name;
    const phone = body.customer_phone !== undefined ? cleanPhone(body.customer_phone) : current.customer_phone;
    const email = body.customer_email !== undefined ? text(body.customer_email, 160) : current.customer_email;
    const partySize = body.party_size !== undefined ? Number.parseInt(body.party_size, 10) : current.party_size;
    const bookingType = body.booking_type !== undefined ? String(body.booking_type).toUpperCase() : current.booking_type;
    if (!name || name.length < 2) { await conn.rollback(); return sendError(res, 'Enter the guest name.', 400); }
    if (!phone) { await conn.rollback(); return sendError(res, 'Enter a valid mobile number (at least 10 digits).', 400); }
    if (!Number.isInteger(partySize) || partySize < 1 || partySize > 200) { await conn.rollback(); return sendError(res, 'Party size must be between 1 and 200.', 400); }
    if (!BOOKING_TYPES[bookingType]) { await conn.rollback(); return sendError(res, 'Unknown booking type.', 400); }

    const seated = current.status === 'SEATED';
    const start = seated ? parseLocal(current.date, current.time)
      : parseLocal(body.date !== undefined ? body.date : current.date, body.time !== undefined ? body.time : current.time);
    if (!start) { await conn.rollback(); return sendError(res, 'Choose a valid date and time.', 400); }
    const duration = Math.min(720, Math.max(30, Number.parseInt(body.duration_minutes, 10) || current.duration_minutes));
    const end = addMin(start, duration);
    const timeChanged = toSql(start) !== `${current.date} ${current.time}:00` || duration !== current.duration_minutes;

    // Tables: the ones asked for, else keep the current ones if they still work, else pick again.
    let tables = current.tables;
    let warning = null;
    const askedIds = parseTableIds(body.table_ids);
    if (current.status !== 'WAITLIST' || (askedIds && askedIds.length)) {
      const floor = await loadFloor(restaurantId, start, end, conn);
      const opts = { excludeId: id, ownTableIds: current.tables.map((t) => t.id) };
      let pick;
      if (askedIds && askedIds.length) {
        pick = chooseTables(floor, start, end, partySize, { ...opts, tableIds: askedIds });
        if (pick.error) {
          await conn.rollback();
          return sendError(res, pick.error, pick.conflict ? 409 : 400);
        }
      } else {
        // Keep the current tables while they are free and big enough, otherwise pick again.
        const keep = current.tables.length ? chooseTables(floor, start, end, partySize, { ...opts, tableIds: current.tables.map((t) => t.id) }) : null;
        const keepOk = keep && !keep.error && !keep.warning;
        const again = keepOk || seated ? null : chooseTables(floor, start, end, partySize, { ...opts, prefer: BOOKING_TYPES[bookingType].prefer });
        if (keepOk || (seated && keep && !keep.error)) pick = keep;
        else if (again && !again.none) pick = again;
        else if (keep && !keep.error) pick = keep; // still free, just tight: keep them with a note
        else if (current.status === 'PENDING' || !floor.tables.length) pick = { tables: [] }; // a request may wait for tables; no table plan needs none
        else {
          await conn.rollback();
          return sendError(res, `No free table seats ${partySize} at ${hmOf(start)}. Pick tables yourself or choose another time.`, 409);
        }
      }
      tables = pick.tables;
      warning = pick.warning || null;
    }

    await q(
      `UPDATE table_reservations SET customer_name = ?, customer_phone = ?, customer_email = ?, party_size = ?, booking_type = ?,
         reserved_for = ?, reserved_until = ?, duration_minutes = ?, occasion = ?, special_requests = ?, internal_notes = ?,
         deposit_amount = ?, deposit_method = ?, deposit_reference = ?
       WHERE id = ?`,
      [name, phone, email, partySize, bookingType, toSql(start), toSql(end), duration,
        body.occasion !== undefined ? text(body.occasion, 80) : current.occasion,
        body.special_requests !== undefined ? text(body.special_requests, 500) : current.special_requests,
        body.internal_notes !== undefined ? text(body.internal_notes, 500) : current.internal_notes,
        body.deposit_amount !== undefined ? Math.max(0, Math.round(Number(body.deposit_amount || 0) * 100) / 100) : current.deposit_amount,
        body.deposit_method !== undefined ? text(body.deposit_method, 20) : current.deposit_method,
        body.deposit_reference !== undefined ? text(body.deposit_reference, 80) : current.deposit_reference,
        id],
      conn
    );
    const sameTables = tables.map((t) => t.id).sort().join(',') === current.tables.map((t) => t.id).sort().join(',');
    if (!sameTables || timeChanged) {
      await q(`DELETE FROM table_reservation_tables WHERE reservation_id = ?`, [id], conn);
      for (const t of tables) await q(`INSERT INTO table_reservation_tables (reservation_id, table_id) VALUES (?, ?)`, [id, t.id], conn);
    }
    if (seated && !sameTables) {
      const newIds = tables.map((t) => t.id);
      await q(`UPDATE restaurant_tables SET status = 'OCCUPIED', held_for_reservation_id = NULL WHERE id IN (?) AND status IN ('AVAILABLE','RESERVED','CLEANING')`, [newIds], conn);
    }
    await conn.commit();
    const reservation = await loadReservation(id);
    afterChange(restaurantId, reservation);
    return sendSuccess(res, reservation, `Booking updated${warning ? `. Note: ${warning}` : ''}`);
  } catch (err) {
    await conn.rollback().catch(() => {});
    next(err);
  } finally {
    conn.release();
  }
}

async function changeReservationStatus(req, res, next) {
  const conn = await pool.getConnection();
  try {
    const id = Number(req.params.id);
    const target = String(req.body?.status || '').toUpperCase();
    const reason = text(req.body?.reason, 255);
    await conn.beginTransaction();
    const restaurantId = req.reservationRestaurantId || restaurantOf(req);
    await lockFloor(conn, restaurantId);
    const current = await loadReservation(id, conn);
    if (!(TRANSITIONS[current.status] || []).includes(target)) {
      await conn.rollback();
      const allowed = TRANSITIONS[current.status] || [];
      return sendError(res, `A ${current.status.toLowerCase()} booking can't be marked ${target.toLowerCase() || '(none)'}${allowed.length ? `. Allowed: ${allowed.join(', ').toLowerCase()}` : ''}.`, 400);
    }
    const now = localNow();
    let tables = current.tables;

    if (target === 'CONFIRMED' || target === 'SEATED') {
      // Seating a walk-in from the waitlist starts the clock now.
      const start = target === 'SEATED' && current.status === 'WAITLIST' ? parseLocal(ymdOf(now), hmOf(now)) : parseLocal(current.date, current.time);
      const end = addMin(start, current.duration_minutes);
      const askedIds = parseTableIds(req.body?.table_ids);
      if ((askedIds && askedIds.length) || !tables.length) {
        const floor = await loadFloor(restaurantId, start, end, conn);
        const pick = chooseTables(floor, start, end, current.party_size, {
          tableIds: askedIds, excludeId: id, ownTableIds: tables.map((t) => t.id), prefer: (BOOKING_TYPES[current.booking_type] || {}).prefer
        });
        const noPlan = pick.none && !floor.tables.length; // restaurant doesn't use a table plan
        if (pick.error || (pick.none && !noPlan)) {
          await conn.rollback();
          return sendError(res, pick.error || `No free table seats ${current.party_size} right now. Choose tables yourself.`, pick.conflict || pick.none ? 409 : 400);
        }
        tables = pick.tables || [];
        await q(`DELETE FROM table_reservation_tables WHERE reservation_id = ?`, [id], conn);
        for (const t of tables) await q(`INSERT INTO table_reservation_tables (reservation_id, table_id) VALUES (?, ?)`, [id, t.id], conn);
      }
      if (target === 'SEATED' && current.status === 'WAITLIST') {
        await q(`UPDATE table_reservations SET reserved_for = ?, reserved_until = ? WHERE id = ?`, [toSql(start), toSql(end), id], conn);
      }
    }

    const stamp = { CONFIRMED: 'confirmed_at', SEATED: 'seated_at', COMPLETED: 'completed_at', CANCELLED: 'cancelled_at', NO_SHOW: 'cancelled_at' }[target];
    await q(
      `UPDATE table_reservations SET status = ?, ${stamp} = ?, cancel_reason = COALESCE(?, cancel_reason) WHERE id = ?`,
      [target, toSql(now), ['CANCELLED', 'NO_SHOW'].includes(target) ? (reason || (target === 'NO_SHOW' ? 'Guest did not arrive' : 'Cancelled by staff')) : null, id],
      conn
    );

    const tableIds = tables.map((t) => t.id);
    const changedTables = [];
    if (target === 'SEATED' && tableIds.length) {
      const free = await q(`SELECT id FROM restaurant_tables WHERE id IN (?) AND status IN ('AVAILABLE','RESERVED','CLEANING')`, [tableIds], conn);
      if (free.length) {
        await q(`UPDATE restaurant_tables SET status = 'OCCUPIED', held_for_reservation_id = NULL WHERE id IN (?)`, [free.map((t) => t.id)], conn);
        changedTables.push(...free.map((t) => ({ table_id: t.id, status: 'OCCUPIED' })));
      }
    }
    if (target === 'COMPLETED' && tableIds.length) {
      // Tables without a running order go to cleaning; an open bill keeps its table as it is.
      const idle = await q(
        `SELECT t.id FROM restaurant_tables t WHERE t.id IN (?) AND t.status = 'OCCUPIED'
           AND NOT EXISTS (SELECT 1 FROM restaurant_orders o WHERE o.table_id = t.id AND o.order_status NOT IN ('COMPLETED','CANCELLED'))`,
        [tableIds], conn
      );
      if (idle.length) {
        await q(`UPDATE restaurant_tables SET status = 'CLEANING' WHERE id IN (?)`, [idle.map((t) => t.id)], conn);
        changedTables.push(...idle.map((t) => ({ table_id: t.id, status: 'CLEANING' })));
      }
    }
    await conn.commit();
    for (const c of changedTables) broadcastEvent('table_status_changed', c);
    const reservation = await loadReservation(id);
    afterChange(restaurantId, reservation);
    const words = { CONFIRMED: 'confirmed', SEATED: 'seated', COMPLETED: 'completed', CANCELLED: 'cancelled', NO_SHOW: 'marked as no-show' };
    return sendSuccess(res, reservation, `Booking ${reservation.reservation_code} ${words[target]}`);
  } catch (err) {
    await conn.rollback().catch(() => {});
    next(err);
  } finally {
    conn.release();
  }
}

// ---------------------------------------------------------------------------------------------
// Customer endpoints (no login): book from the restaurant page, view / cancel from a private link
// ---------------------------------------------------------------------------------------------
async function restaurantForBooking(slug) {
  await ensureTableReservationSchema();
  const s = String(slug || '').toLowerCase();
  if (!s) return null;
  const rows = await q(
    `SELECT id, name, slug, phone, address, opening_time, closing_time, status, table_booking_enabled
     FROM restaurants WHERE LOWER(slug) = ? OR LOWER(custom_subdomain_slug) = ? OR LOWER(random_slug) = ? LIMIT 1`,
    [s, s, s]
  );
  const r = rows[0];
  if (!r || r.status === 'SUSPENDED') return null;
  return r;
}

const publicTypes = () => Object.entries(BOOKING_TYPES).map(([key, t]) => ({ key, label: t.label, minutes: t.minutes, needs_confirmation: t.confirmOnline }));

async function getPublicBookingInfo(req, res, next) {
  try {
    const r = await restaurantForBooking(req.params.slug);
    if (!r) return sendError(res, 'Restaurant not found.', 404);
    const today = ymdOf(localNow());
    return sendSuccess(res, {
      restaurant: { name: r.name, slug: r.slug, phone: r.phone, address: r.address },
      enabled: Number(r.table_booking_enabled) !== 0,
      booking_types: publicTypes(),
      max_party: ONLINE.maxParty,
      first_date: today,
      last_date: ymdOf(addMin(parseLocal(today, '00:00'), ONLINE.maxDaysAhead * 1440))
    }, 'Booking info loaded');
  } catch (err) {
    next(err);
  }
}

async function getPublicSlots(req, res, next) {
  try {
    const r = await restaurantForBooking(req.params.slug);
    if (!r) return sendError(res, 'Restaurant not found.', 404);
    if (Number(r.table_booking_enabled) === 0) return sendError(res, 'Online table booking is switched off. Please call the restaurant.', 403);
    const date = String(req.query.date || '');
    if (!parseLocal(date, '00:00')) return sendError(res, 'Choose a valid date.', 400);
    const partySize = Math.min(ONLINE.maxParty, Math.max(1, Number.parseInt(req.query.party_size, 10) || 2));
    const typeKey = BOOKING_TYPES[String(req.query.booking_type || 'TABLE').toUpperCase()] ? String(req.query.booking_type || 'TABLE').toUpperCase() : 'TABLE';
    const type = BOOKING_TYPES[typeKey];
    const win = seatingWindow(r, date, type.minutes);
    const now = localNow();
    const floor = await loadFloor(r.id, win.first, addMin(win.last, type.minutes));
    const slots = [];
    for (let t = new Date(win.first); t <= win.last; t = addMin(t, ONLINE.slotStepMin)) {
      if (t < addMin(now, ONLINE.minLeadMin) || t > addMin(now, ONLINE.maxDaysAhead * 1440)) continue;
      // No table plan yet: every time within opening hours can be requested.
      const noPlan = !floor.tables.length;
      const fits = noPlan || pickTables(tablesFor(floor, t, addMin(t, type.minutes), { now }), partySize, type.prefer).length > 0;
      // Events / private dining can be requested even when tables must be rearranged.
      slots.push({ time: hmOf(t), date: ymdOf(t), available: fits || type.confirmOnline, needs_confirmation: Boolean(type.confirmOnline || noPlan) });
    }
    return sendSuccess(res, { date, party_size: partySize, booking_type: typeKey, slots, requests_only: !floor.tables.length }, 'Slots loaded');
  } catch (err) {
    next(err);
  }
}

async function createPublicReservation(req, res, next) {
  try {
    const r = await restaurantForBooking(req.params.slug);
    if (!r) return sendError(res, 'Restaurant not found.', 404);
    if (Number(r.table_booking_enabled) === 0) return sendError(res, 'Online table booking is switched off. Please call the restaurant.', 403);
    const result = await createReservationCore(r.id, req.body || {}, { online: true, restaurant: r });
    if (result.error) return res.status(result.status).json({ success: false, message: result.error, alternatives: result.alternatives || [] });
    if (!result.duplicate) {
      await notifyRestaurant(r.id, result.reservation.status === 'PENDING' ? 'Table booking request: please confirm' : 'New table booking', result.reservation);
    }
    const tokenRow = await q(`SELECT manage_token FROM table_reservations WHERE id = ?`, [result.reservation.id]);
    const view = publicView(result.reservation, r);
    const message = view.status === 'PENDING'
      ? `Request ${view.reservation_code} received. The restaurant will confirm it shortly.`
      : `Table booked for ${view.party_size} on ${view.date} at ${view.time}. Your booking reference is ${view.reservation_code}.`;
    return sendSuccess(res, { ...view, manage_token: tokenRow[0].manage_token }, message, result.duplicate ? 200 : 201);
  } catch (err) {
    next(err);
  }
}

async function reservationByToken(token) {
  await ensureTableReservationSchema();
  if (!/^[a-f0-9]{48}$/.test(String(token || ''))) return null;
  const rows = await q(`SELECT id, restaurant_id FROM table_reservations WHERE manage_token = ?`, [token]);
  if (!rows.length) return null;
  const reservation = await loadReservation(rows[0].id);
  const rest = await q(`SELECT name, slug, phone, address FROM restaurants WHERE id = ?`, [rows[0].restaurant_id]);
  return { reservation, restaurant: rest[0] || null };
}

async function getPublicReservation(req, res, next) {
  try {
    const found = await reservationByToken(req.params.token);
    if (!found) return sendError(res, 'This booking link is not valid.', 404);
    return sendSuccess(res, publicView(found.reservation, found.restaurant), 'Booking loaded');
  } catch (err) {
    next(err);
  }
}

async function cancelPublicReservation(req, res, next) {
  try {
    const found = await reservationByToken(req.params.token);
    if (!found) return sendError(res, 'This booking link is not valid.', 404);
    const r = found.reservation;
    if (!publicView(r, null).can_cancel) return sendError(res, 'This booking can no longer be cancelled online. Please call the restaurant.', 400);
    const reason = text(req.body?.reason, 200);
    await q(
      `UPDATE table_reservations SET status = 'CANCELLED', cancelled_at = ?, cancel_reason = ?
       WHERE id = ? AND status IN ('PENDING','CONFIRMED','WAITLIST')`,
      [toSql(localNow()), `Cancelled by guest${reason ? `: ${reason}` : ''}`, r.id]
    );
    const updated = await loadReservation(r.id);
    afterChange(r.restaurant_id, updated);
    await notifyRestaurant(r.restaurant_id, 'Guest cancelled a table booking', updated);
    return sendSuccess(res, publicView(updated, found.restaurant), `Booking ${r.reservation_code} cancelled`);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  BOOKING_TYPES,
  ensureTableReservationSchema,
  syncTableHolds,
  syncAllTableHolds,
  nextReservationsByTable,
  guardReservation,
  listReservations,
  getReservationSummary,
  getReservation,
  checkAvailability,
  createReservation,
  updateReservation,
  changeReservationStatus,
  getPublicBookingInfo,
  getPublicSlots,
  createPublicReservation,
  getPublicReservation,
  cancelPublicReservation,
  // exported for tests
  _internal: { pickTables, tablesFor, seatingWindow, parseLocal }
};
