const pool = require('../../config/database');
const { sendSuccess, sendError } = require('../../utils/response');
const { broadcastEvent } = require('../../config/socket');
const { ensureHotelsSchema } = require('./hotelController');

// Default fallback images for standard room categories
const DEFAULT_ROOM_IMAGES = {
  'Standard Room': 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1000&q=80',
  'Standard': 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1000&q=80',
  'Deluxe Room': 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1000&q=80',
  'Deluxe': 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1000&q=80',
  'Executive Suite': 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1000&q=80',
  'Suite': 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1000&q=80',
  'VIP Presidential Suite': 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=1000&q=80',
  'Presidential Suite': 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=1000&q=80',
  'VIP': 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=1000&q=80'
};

const DEFAULT_AMENITIES = [
  'Free High-Speed WiFi',
  'Air Conditioning',
  '50" 4K Smart TV',
  'Mini Bar',
  '24/7 Room Service',
  'Private Bathroom',
  'Safe Locker',
  'Tea/Coffee Maker'
];

let schemaVerified = false;

async function ensureRoomSchema() {
  if (schemaVerified) return;
  try {
    await ensureHotelsSchema();

    // 1. Verify rooms table columns
    const [columns] = await pool.query(`SHOW COLUMNS FROM rooms`);
    const colNames = columns.map(c => c.Field.toLowerCase());

    if (!colNames.includes('hotel_id')) {
      await pool.query(`ALTER TABLE rooms ADD COLUMN hotel_id INT DEFAULT 1`);
    }
    if (!colNames.includes('rate_per_night')) {
      await pool.query(`ALTER TABLE rooms ADD COLUMN rate_per_night DECIMAL(10, 2) DEFAULT 2500.00`);
    }
    if (!colNames.includes('capacity')) {
      await pool.query(`ALTER TABLE rooms ADD COLUMN capacity INT DEFAULT 2`);
    }
    if (!colNames.includes('bed_type')) {
      await pool.query(`ALTER TABLE rooms ADD COLUMN bed_type VARCHAR(50) DEFAULT 'King Bed'`);
    }
    if (!colNames.includes('room_size')) {
      await pool.query(`ALTER TABLE rooms ADD COLUMN room_size VARCHAR(50) DEFAULT '320 sq.ft'`);
    }
    if (!colNames.includes('amenities')) {
      await pool.query(`ALTER TABLE rooms ADD COLUMN amenities TEXT DEFAULT NULL`);
    }
    if (!colNames.includes('description')) {
      await pool.query(`ALTER TABLE rooms ADD COLUMN description TEXT DEFAULT NULL`);
    }
    if (!colNames.includes('image_url')) {
      await pool.query(`ALTER TABLE rooms ADD COLUMN image_url VARCHAR(500) DEFAULT NULL`);
    }
    if (!colNames.includes('maintenance_notes')) {
      await pool.query(`ALTER TABLE rooms ADD COLUMN maintenance_notes TEXT DEFAULT NULL`);
    }

    // 2. Verify room_folios table columns
    const [folioCols] = await pool.query(`SHOW COLUMNS FROM room_folios`);
    const folioColNames = folioCols.map(c => c.Field.toLowerCase());

    if (!folioColNames.includes('hotel_id')) {
      await pool.query(`ALTER TABLE room_folios ADD COLUMN hotel_id INT DEFAULT 1`);
    }
    if (!folioColNames.includes('guest_phone')) {
      await pool.query(`ALTER TABLE room_folios ADD COLUMN guest_phone VARCHAR(20) DEFAULT NULL`);
    }
    if (!folioColNames.includes('guest_email')) {
      await pool.query(`ALTER TABLE room_folios ADD COLUMN guest_email VARCHAR(150) DEFAULT NULL`);
    }
    if (!folioColNames.includes('check_in_date')) {
      await pool.query(`ALTER TABLE room_folios ADD COLUMN check_in_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
    }
    if (!folioColNames.includes('expected_check_out')) {
      await pool.query(`ALTER TABLE room_folios ADD COLUMN expected_check_out TIMESTAMP NULL DEFAULT NULL`);
    }
    if (!folioColNames.includes('check_out_date')) {
      await pool.query(`ALTER TABLE room_folios ADD COLUMN check_out_date TIMESTAMP NULL DEFAULT NULL`);
    }
    if (!folioColNames.includes('breakfast_included')) {
      await pool.query(`ALTER TABLE room_folios ADD COLUMN breakfast_included TINYINT(1) DEFAULT 0`);
    }
    if (!folioColNames.includes('breakfast_price')) {
      await pool.query(`ALTER TABLE room_folios ADD COLUMN breakfast_price DECIMAL(10, 2) DEFAULT 0.00`);
    }
    if (!folioColNames.includes('notes')) {
      await pool.query(`ALTER TABLE room_folios ADD COLUMN notes TEXT DEFAULT NULL`);
    }

    // 3. Seed exactly 7 Initial Operational Records across rooms & folios if empty
    const [roomCount] = await pool.query(`SELECT COUNT(*) as count FROM rooms`);
    if (roomCount[0].count === 0) {
      console.log('🔄 Seeding exactly 7 initial operational records for Accommodation workflows...');

      // Operational Record 1: Normal Active In-House Stay
      const [r1] = await pool.query(
        `INSERT INTO rooms (room_number, floor, room_type, status, rate_per_night, capacity, bed_type, room_size, amenities, description, image_url)
         VALUES ('101', '1st Floor', 'Deluxe Room', 'OCCUPIED', 3200.00, 2, 'King Bed', '360 sq.ft', ?, 'Deluxe Room with courtyard garden view.', 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1000&q=80')`,
        [JSON.stringify(DEFAULT_AMENITIES)]
      );
      await pool.query(
        `INSERT INTO room_folios (room_id, guest_name, guest_phone, guest_email, folio_status, balance, breakfast_included, notes, check_in_date, expected_check_out)
         VALUES (?, 'Mr. Robert Downey', '+91 98765 43210', 'robert@hotel.com', 'OPEN', 0.00, 0, 'Standard stay. Valet parking requested.', NOW() - INTERVAL 1 DAY, NOW() + INTERVAL 2 DAY)`,
        [r1.insertId]
      );

      // Operational Record 2: Breakfast Included Stay
      const [r2] = await pool.query(
        `INSERT INTO rooms (room_number, floor, room_type, status, rate_per_night, capacity, bed_type, room_size, amenities, description, image_url)
         VALUES ('102', '1st Floor', 'Executive Suite', 'OCCUPIED', 5500.00, 3, 'California King Bed', '550 sq.ft', ?, 'Executive suite with private jacuzzi and skyline view.', 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1000&q=80')`,
        [JSON.stringify(DEFAULT_AMENITIES)]
      );
      await pool.query(
        `INSERT INTO room_folios (room_id, guest_name, guest_phone, guest_email, folio_status, balance, breakfast_included, notes, check_in_date, expected_check_out)
         VALUES (?, 'Ms. Emma Watson', '+91 98123 45678', 'emma.w@example.com', 'OPEN', 0.00, 1, 'VIP Package: Complimentary Gourmet Breakfast Included.', NOW() - INTERVAL 2 DAY, NOW() + INTERVAL 1 DAY)`,
        [r2.insertId]
      );

      // Operational Record 3: Breakfast Extra Charge Added Stay
      const [r3] = await pool.query(
        `INSERT INTO rooms (room_number, floor, room_type, status, rate_per_night, capacity, bed_type, room_size, amenities, description, image_url)
         VALUES ('201', '2nd Floor', 'Deluxe Room', 'OCCUPIED', 3200.00, 2, 'King Bed', '360 sq.ft', ?, 'Deluxe accommodation on 2nd floor.', 'https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=1000&q=80')`,
        [JSON.stringify(DEFAULT_AMENITIES)]
      );
      await pool.query(
        `INSERT INTO room_folios (room_id, guest_name, guest_phone, guest_email, folio_status, balance, breakfast_included, breakfast_price, notes, check_in_date, expected_check_out)
         VALUES (?, 'Dr. Rajesh Koothrappali', '+91 98450 11223', 'rajesh@caltech.edu', 'OPEN', 450.00, 0, 450.00, 'Added Extra Charge: Hot Breakfast Buffet (₹450.00) billed to room account.', NOW() - INTERVAL 12 HOUR, NOW() + INTERVAL 1 DAY)`,
        [r3.insertId]
      );

      // Operational Record 4: Extended Stay Workflow
      const [r4] = await pool.query(
        `INSERT INTO rooms (room_number, floor, room_type, status, rate_per_night, capacity, bed_type, room_size, amenities, description, image_url)
         VALUES ('203', '2nd Floor', 'VIP Presidential Suite', 'OCCUPIED', 9500.00, 4, 'Super King Bed', '850 sq.ft', ?, 'Signature luxury residence with panoramic terrace.', 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=1000&q=80')`,
        [JSON.stringify(DEFAULT_AMENITIES)]
      );
      await pool.query(
        `INSERT INTO room_folios (room_id, guest_name, guest_phone, guest_email, folio_status, balance, breakfast_included, notes, check_in_date, expected_check_out)
         VALUES (?, 'Sir Arthur Conan', '+91 99001 88776', 'arthur.c@bakerst.co.uk', 'OPEN', 0.00, 1, 'Extended Stay: Guest extended checkout date by 3 additional nights.', NOW() - INTERVAL 3 DAY, NOW() + INTERVAL 4 DAY)`,
        [r4.insertId]
      );

      // Operational Record 5: Past Completed Check-Out & Closed Folio Record
      const [r5] = await pool.query(
        `INSERT INTO rooms (room_number, floor, room_type, status, rate_per_night, capacity, bed_type, room_size, amenities, description, image_url)
         VALUES ('104', '1st Floor', 'Standard Room', 'VACANT', 2000.00, 2, 'Queen Bed', '280 sq.ft', ?, 'Modern standard room.', 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1000&q=80')`,
        [JSON.stringify(DEFAULT_AMENITIES)]
      );
      await pool.query(
        `INSERT INTO room_folios (room_id, guest_name, guest_phone, guest_email, folio_status, balance, notes, check_in_date, check_out_date, expected_check_out)
         VALUES (?, 'Mr. David Miller', '+91 97711 22334', 'david.m@outlook.com', 'CLOSED', 0.00, 'Checked out successfully. Full payment settled via Card.', NOW() - INTERVAL 4 DAY, NOW() - INTERVAL 1 DAY, NOW() - INTERVAL 1 DAY)`,
        [r5.insertId]
      );

      // Operational Record 6: Room Under Cleaning / Housekeeping
      await pool.query(
        `INSERT INTO rooms (room_number, floor, room_type, status, rate_per_night, capacity, bed_type, room_size, amenities, description, image_url)
         VALUES ('202', '2nd Floor', 'Executive Suite', 'CLEANING', 5500.00, 3, 'California King Bed', '550 sq.ft', ?, 'Executive Suite currently undergoing full sanitization and turnaround.', 'https://images.unsplash.com/photo-1591088398332-8a7791972843?auto=format&fit=crop&w=1000&q=80')`,
        [JSON.stringify(DEFAULT_AMENITIES)]
      );

      // Operational Record 7: Room Under Maintenance
      await pool.query(
        `INSERT INTO rooms (room_number, floor, room_type, status, rate_per_night, capacity, bed_type, room_size, amenities, description, image_url, maintenance_notes)
         VALUES ('301', '3rd Floor', 'Deluxe Room', 'MAINTENANCE', 3200.00, 2, 'King Bed', '360 sq.ft', ?, 'Scheduled preventive HVAC and plumbing upgrade in progress.', 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1000&q=80', 'Scheduled preventive HVAC filter replacement & plumbing fixture upgrade.')`,
        [JSON.stringify(DEFAULT_AMENITIES)]
      );

      // Add a couple of clean vacant inventory rooms for testing check-in
      await pool.query(
        `INSERT INTO rooms (room_number, floor, room_type, status, rate_per_night, capacity, bed_type, room_size, amenities, description, image_url)
         VALUES ('103', '1st Floor', 'Standard Room', 'VACANT', 2000.00, 2, 'Queen Bed', '280 sq.ft', ?, 'Modern standard room tailored for solo & business travelers.', 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1000&q=80')`,
        [JSON.stringify(DEFAULT_AMENITIES)]
      );

      console.log('✅ Exactly 7 initial operational records seeded successfully!');
    }
    schemaVerified = true;
  } catch (err) {
    console.warn('Accommodation schema verification notice:', err.message);
  }
}

/**
 * Format a room row to ensure parsed amenities and fallback image
 */
function formatRoomRow(row) {
  if (!row) return null;
  
  let amenitiesList = [];
  if (row.amenities) {
    try {
      amenitiesList = typeof row.amenities === 'string' ? JSON.parse(row.amenities) : row.amenities;
    } catch (e) {
      amenitiesList = String(row.amenities).split(',').map(s => s.trim()).filter(Boolean);
    }
  } else {
    amenitiesList = DEFAULT_AMENITIES.slice(0, 6);
  }

  const fallbackImage = DEFAULT_ROOM_IMAGES[row.room_type] || DEFAULT_ROOM_IMAGES['Deluxe Room'];
  const image_url = row.image_url && row.image_url.trim() !== '' ? row.image_url : fallbackImage;

  return {
    ...row,
    image_url,
    amenities: Array.isArray(amenitiesList) ? amenitiesList : [],
    rate_per_night: parseFloat(row.rate_per_night || 2500),
    capacity: parseInt(row.capacity || 2, 10),
    bed_type: row.bed_type || 'King Bed',
    room_size: row.room_size || '320 sq.ft',
    description: row.description || `Comfortable ${row.room_type || 'Hotel Room'} situated on the ${row.floor || '1st Floor'}.`,
    folio_balance: parseFloat(row.folio_balance || 0),
    breakfast_included: Boolean(row.breakfast_included),
    breakfast_price: parseFloat(row.breakfast_price || 0)
  };
}

/**
 * GET /api/rooms
 * List rooms with active folio details, filters, and KPI summary stats
 */
async function getRooms(req, res, next) {
  try {
    await ensureRoomSchema();
    const { floor, status, room_type, search } = req.query;

    let query = `
      SELECT 
        r.*,
        f.id AS active_folio_id,
        f.guest_name,
        f.guest_phone,
        f.guest_email,
        f.folio_status,
        COALESCE(f.balance, 0.00) AS folio_balance,
        f.check_in_date,
        f.expected_check_out,
        f.breakfast_included,
        f.breakfast_price,
        f.notes AS folio_notes
      FROM rooms r
      LEFT JOIN room_folios f ON r.id = f.room_id AND f.folio_status = 'OPEN'
      WHERE 1=1
    `;
    const params = [];

    if (floor && floor !== 'ALL') {
      query += ` AND r.floor = ?`;
      params.push(floor);
    }
    if (status && status !== 'ALL') {
      query += ` AND r.status = ?`;
      params.push(status);
    }
    if (room_type && room_type !== 'ALL') {
      query += ` AND r.room_type = ?`;
      params.push(room_type);
    }
    if (search && search.trim()) {
      query += ` AND (r.room_number LIKE ? OR r.room_type LIKE ? OR f.guest_name LIKE ? OR r.floor LIKE ?)`;
      const searchPattern = `%${search.trim()}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    query += ` ORDER BY CAST(REGEXP_REPLACE(r.room_number, '[^0-9]', '') AS UNSIGNED) ASC, r.room_number ASC`;

    const [rows] = await pool.query(query, params);
    const formattedRooms = rows.map(formatRoomRow);

    // Compute summary stats across all rooms
    const [allRooms] = await pool.query(`
      SELECT 
        COUNT(*) as total_rooms,
        SUM(CASE WHEN r.status = 'VACANT' THEN 1 ELSE 0 END) as vacant_count,
        SUM(CASE WHEN r.status = 'OCCUPIED' THEN 1 ELSE 0 END) as occupied_count,
        SUM(CASE WHEN r.status = 'CLEANING' THEN 1 ELSE 0 END) as cleaning_count,
        SUM(CASE WHEN r.status = 'MAINTENANCE' THEN 1 ELSE 0 END) as maintenance_count,
        COALESCE(SUM(f.balance), 0.00) as total_outstanding_balance
      FROM rooms r
      LEFT JOIN room_folios f ON r.id = f.room_id AND f.folio_status = 'OPEN'
    `);

    // Get distinct floors for filtering
    const [floorRows] = await pool.query(`SELECT DISTINCT floor FROM rooms WHERE floor IS NOT NULL ORDER BY floor ASC`);
    const floors = floorRows.map(f => f.floor).filter(Boolean);

    // Get distinct room types for filtering
    const [typeRows] = await pool.query(`SELECT DISTINCT room_type FROM rooms WHERE room_type IS NOT NULL ORDER BY room_type ASC`);
    const roomTypes = typeRows.map(t => t.room_type).filter(Boolean);

    const stats = {
      total: allRooms[0]?.total_rooms || 0,
      vacant: allRooms[0]?.vacant_count || 0,
      occupied: allRooms[0]?.occupied_count || 0,
      cleaning: allRooms[0]?.cleaning_count || 0,
      maintenance: allRooms[0]?.maintenance_count || 0,
      total_balance: parseFloat(allRooms[0]?.total_outstanding_balance || 0),
      occupancy_rate: allRooms[0]?.total_rooms > 0 
        ? Math.round((allRooms[0].occupied_count / allRooms[0].total_rooms) * 100) 
        : 0
    };

    return sendSuccess(res, {
      rooms: formattedRooms,
      stats,
      floors,
      room_types: roomTypes
    }, 'Rooms fetched successfully');
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/rooms/:id
 * Detailed room information with active folio, past folios, and linked restaurant charges
 */
async function getRoomById(req, res, next) {
  try {
    await ensureRoomSchema();
    const { id } = req.params;

    const [rows] = await pool.query(`
      SELECT 
        r.*,
        f.id AS active_folio_id,
        f.guest_name,
        f.guest_phone,
        f.guest_email,
        f.folio_status,
        COALESCE(f.balance, 0.00) AS folio_balance,
        f.check_in_date,
        f.expected_check_out,
        f.breakfast_included,
        f.breakfast_price,
        f.notes AS folio_notes
      FROM rooms r
      LEFT JOIN room_folios f ON r.id = f.room_id AND f.folio_status = 'OPEN'
      WHERE r.id = ?
    `, [id]);

    if (rows.length === 0) {
      return sendError(res, 'Room not found', 404);
    }

    const room = formatRoomRow(rows[0]);

    // Fetch active folio detailed room charges / bills if folio is open
    let activeFolioCharges = [];
    if (room.active_folio_id) {
      const [bills] = await pool.query(`
        SELECT 
          b.id, b.bill_number, b.order_id, b.subtotal, b.tax_amount, 
          b.discount_amount, b.grand_total, b.payment_status, b.created_at,
          o.order_number, o.customer_name, o.order_type
        FROM bills b
        LEFT JOIN restaurant_orders o ON b.order_id = o.id
        WHERE b.room_id = ? AND (b.payment_status = 'ROOM_CHARGED' OR b.created_at >= ?)
        ORDER BY b.created_at DESC
      `, [id, room.check_in_date || '1970-01-01']);
      activeFolioCharges = bills;
    }

    // Fetch past closed folios history
    const [folioHistory] = await pool.query(`
      SELECT * FROM room_folios 
      WHERE room_id = ? 
      ORDER BY created_at DESC 
      LIMIT 5
    `, [id]);

    return sendSuccess(res, {
      ...room,
      active_folio_charges: activeFolioCharges,
      folio_history: folioHistory
    }, 'Room details fetched successfully');
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/rooms
 * Create a new room
 */
async function createRoom(req, res, next) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await ensureRoomSchema();

    const {
      room_number,
      floor = '1st Floor',
      room_type = 'Deluxe Room',
      status = 'VACANT',
      rate_per_night = 2500.00,
      capacity = 2,
      bed_type = 'King Bed',
      room_size = '320 sq.ft',
      amenities,
      description,
      image_url
    } = req.body;

    if (!room_number || String(room_number).trim() === '') {
      return sendError(res, 'Room number is required', 400);
    }

    const cleanRoomNumber = String(room_number).trim();

    const [existing] = await connection.query(`SELECT id FROM rooms WHERE room_number = ?`, [cleanRoomNumber]);
    if (existing.length > 0) {
      return sendError(res, `Room number "${cleanRoomNumber}" already exists.`, 400);
    }

    const amenitiesJson = Array.isArray(amenities) 
      ? JSON.stringify(amenities) 
      : (typeof amenities === 'string' && amenities ? amenities : JSON.stringify(DEFAULT_AMENITIES.slice(0, 6)));

    const fallbackImage = DEFAULT_ROOM_IMAGES[room_type] || DEFAULT_ROOM_IMAGES['Deluxe Room'];
    const finalImage = image_url && image_url.trim() !== '' ? image_url.trim() : fallbackImage;

    const [result] = await connection.query(
      `INSERT INTO rooms (room_number, floor, room_type, status, rate_per_night, capacity, bed_type, room_size, amenities, description, image_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        cleanRoomNumber,
        floor,
        room_type,
        status || 'VACANT',
        parseFloat(rate_per_night) || 2500.00,
        parseInt(capacity, 10) || 2,
        bed_type,
        room_size,
        amenitiesJson,
        description || `${room_type} located on ${floor}.`,
        finalImage
      ]
    );

    const roomId = result.insertId;
    await connection.commit();

    const [newRoomRows] = await pool.query(`SELECT * FROM rooms WHERE id = ?`, [roomId]);
    const formatted = formatRoomRow(newRoomRows[0]);

    broadcastEvent('room_created', { room: formatted });
    return sendSuccess(res, formatted, 'Room created successfully', 201);
  } catch (err) {
    await connection.rollback();
    if (err.code === 'ER_DUP_ENTRY') {
      return sendError(res, `Room number already exists.`, 400);
    }
    next(err);
  } finally {
    connection.release();
  }
}

/**
 * PUT /api/rooms/:id
 * Update room details
 */
async function updateRoom(req, res, next) {
  try {
    await ensureRoomSchema();
    const { id } = req.params;
    const {
      room_number,
      floor,
      room_type,
      rate_per_night,
      capacity,
      bed_type,
      room_size,
      amenities,
      description,
      image_url,
      status
    } = req.body;

    const [existing] = await pool.query(`SELECT * FROM rooms WHERE id = ?`, [id]);
    if (existing.length === 0) {
      return sendError(res, 'Room not found', 404);
    }

    if (room_number) {
      const cleanNum = String(room_number).trim();
      const [dup] = await pool.query(`SELECT id FROM rooms WHERE room_number = ? AND id != ?`, [cleanNum, id]);
      if (dup.length > 0) {
        return sendError(res, `Room number "${cleanNum}" is already in use by another room.`, 400);
      }
    }

    let amenitiesJson = undefined;
    if (amenities !== undefined) {
      amenitiesJson = Array.isArray(amenities) ? JSON.stringify(amenities) : String(amenities);
    }

    await pool.query(
      `UPDATE rooms 
       SET room_number = COALESCE(?, room_number),
           floor = COALESCE(?, floor),
           room_type = COALESCE(?, room_type),
           status = COALESCE(?, status),
           rate_per_night = COALESCE(?, rate_per_night),
           capacity = COALESCE(?, capacity),
           bed_type = COALESCE(?, bed_type),
           room_size = COALESCE(?, room_size),
           amenities = COALESCE(?, amenities),
           description = COALESCE(?, description),
           image_url = COALESCE(?, image_url)
       WHERE id = ?`,
      [
        room_number ? String(room_number).trim() : null,
        floor,
        room_type,
        status,
        rate_per_night ? parseFloat(rate_per_night) : null,
        capacity ? parseInt(capacity, 10) : null,
        bed_type,
        room_size,
        amenitiesJson,
        description,
        image_url,
        id
      ]
    );

    const [updated] = await pool.query(`
      SELECT 
        r.*,
        f.id AS active_folio_id,
        f.guest_name,
        f.guest_phone,
        f.folio_status,
        COALESCE(f.balance, 0.00) AS folio_balance
      FROM rooms r
      LEFT JOIN room_folios f ON r.id = f.room_id AND f.folio_status = 'OPEN'
      WHERE r.id = ?
    `, [id]);

    const formatted = formatRoomRow(updated[0]);
    broadcastEvent('room_updated', { room: formatted });
    return sendSuccess(res, formatted, 'Room updated successfully');
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/rooms/:id/status
 * Update room operational status
 */
async function updateRoomStatus(req, res, next) {
  try {
    await ensureRoomSchema();
    const { id } = req.params;
    const { status, maintenance_notes } = req.body;

    const validStatuses = ['VACANT', 'OCCUPIED', 'CLEANING', 'MAINTENANCE'];
    if (!validStatuses.includes(status)) {
      return sendError(res, `Invalid room status. Valid statuses: ${validStatuses.join(', ')}`, 400);
    }

    const [existing] = await pool.query(`SELECT * FROM rooms WHERE id = ?`, [id]);
    if (existing.length === 0) {
      return sendError(res, 'Room not found', 404);
    }

    // Cannot mark VACANT if open folio exists
    if (status === 'VACANT') {
      const [openFolios] = await pool.query(`SELECT id, guest_name FROM room_folios WHERE room_id = ? AND folio_status = 'OPEN'`, [id]);
      if (openFolios.length > 0) {
        return sendError(res, `Room has an active folio for ${openFolios[0].guest_name}. Please perform guest check-out instead.`, 400);
      }
    }

    await pool.query(
      `UPDATE rooms SET status = ?, maintenance_notes = ? WHERE id = ?`,
      [status, maintenance_notes !== undefined ? maintenance_notes : existing[0].maintenance_notes, id]
    );

    const [updated] = await pool.query(`
      SELECT 
        r.*,
        f.id AS active_folio_id,
        f.guest_name,
        f.guest_phone,
        f.folio_status,
        COALESCE(f.balance, 0.00) AS folio_balance
      FROM rooms r
      LEFT JOIN room_folios f ON r.id = f.room_id AND f.folio_status = 'OPEN'
      WHERE r.id = ?
    `, [id]);

    const formatted = formatRoomRow(updated[0]);
    broadcastEvent('room_status_changed', { room_id: parseInt(id), status, room: formatted });
    return sendSuccess(res, formatted, `Room status changed to ${status}`);
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/rooms/:id
 */
async function deleteRoom(req, res, next) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { id } = req.params;

    const [existing] = await connection.query(`SELECT * FROM rooms WHERE id = ?`, [id]);
    if (existing.length === 0) {
      return sendError(res, 'Room not found', 404);
    }

    if (existing[0].status === 'OCCUPIED') {
      return sendError(res, 'Cannot delete an occupied room. Please check out the guest first.', 400);
    }

    const [openFolios] = await connection.query(`SELECT id FROM room_folios WHERE room_id = ? AND folio_status = 'OPEN'`, [id]);
    if (openFolios.length > 0) {
      return sendError(res, 'Cannot delete room with an active open folio.', 400);
    }

    await connection.query(`UPDATE bills SET room_id = NULL WHERE room_id = ?`, [id]);
    await connection.query(`DELETE FROM room_folios WHERE room_id = ?`, [id]);
    await connection.query(`DELETE FROM rooms WHERE id = ?`, [id]);

    await connection.commit();
    broadcastEvent('room_deleted', { room_id: parseInt(id) });
    return sendSuccess(res, { id: parseInt(id) }, 'Room deleted successfully');
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
}

/**
 * 1. CHECK-IN WORKFLOW
 * POST /api/rooms/:id/check-in
 */
async function checkInGuest(req, res, next) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await ensureRoomSchema();

    const { id } = req.params;
    const {
      guest_name,
      guest_phone,
      guest_email,
      breakfast_included = false,
      expected_check_out,
      notes
    } = req.body;

    if (!guest_name || String(guest_name).trim() === '') {
      return sendError(res, 'Guest name is required for check-in.', 400);
    }

    const [rooms] = await connection.query(`SELECT * FROM rooms WHERE id = ?`, [id]);
    if (rooms.length === 0) {
      return sendError(res, 'Room not found', 404);
    }

    const room = rooms[0];
    if (room.status === 'OCCUPIED') {
      return sendError(res, `Room ${room.room_number} is already occupied.`, 400);
    }
    if (room.status === 'MAINTENANCE') {
      return sendError(res, `Room ${room.room_number} is currently under maintenance and cannot be checked in.`, 400);
    }

    const [openFolios] = await connection.query(`SELECT id FROM room_folios WHERE room_id = ? AND folio_status = 'OPEN'`, [id]);
    if (openFolios.length > 0) {
      return sendError(res, 'An open folio already exists for this room. Please close it first.', 400);
    }

    const expectedDate = expected_check_out ? new Date(expected_check_out) : null;
    const breakfastVal = breakfast_included === true || breakfast_included === 1 || breakfast_included === 'true' ? 1 : 0;

    const [folioRes] = await connection.query(
      `INSERT INTO room_folios (room_id, guest_name, guest_phone, guest_email, folio_status, balance, breakfast_included, notes, check_in_date, expected_check_out)
       VALUES (?, ?, ?, ?, 'OPEN', 0.00, ?, ?, NOW(), ?)`,
      [
        id,
        String(guest_name).trim(),
        guest_phone ? String(guest_phone).trim() : null,
        guest_email ? String(guest_email).trim() : null,
        breakfastVal,
        notes || null,
        expectedDate
      ]
    );

    const folioId = folioRes.insertId;

    // Update room status to OCCUPIED
    await connection.query(`UPDATE rooms SET status = 'OCCUPIED' WHERE id = ?`, [id]);

    await connection.commit();

    const [updatedRoomRows] = await pool.query(`
      SELECT 
        r.*,
        f.id AS active_folio_id,
        f.guest_name,
        f.guest_phone,
        f.guest_email,
        f.folio_status,
        COALESCE(f.balance, 0.00) AS folio_balance,
        f.check_in_date,
        f.expected_check_out,
        f.breakfast_included,
        f.breakfast_price,
        f.notes AS folio_notes
      FROM rooms r
      LEFT JOIN room_folios f ON r.id = f.room_id AND f.id = ?
      WHERE r.id = ?
    `, [folioId, id]);

    const formatted = formatRoomRow(updatedRoomRows[0]);
    broadcastEvent('room_checked_in', { room: formatted, folio_id: folioId });
    broadcastEvent('room_status_changed', { room_id: parseInt(id), status: 'OCCUPIED', room: formatted });

    return sendSuccess(res, formatted, `Guest ${guest_name} successfully checked into Room ${room.room_number}`, 201);
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
}

/**
 * 2. CHECK-OUT WORKFLOW
 * POST /api/rooms/:id/check-out
 */
async function checkOutGuest(req, res, next) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await ensureRoomSchema();

    const { id } = req.params;

    const [rooms] = await connection.query(`SELECT * FROM rooms WHERE id = ?`, [id]);
    if (rooms.length === 0) {
      return sendError(res, 'Room not found', 404);
    }

    const room = rooms[0];

    const [folios] = await connection.query(
      `SELECT * FROM room_folios WHERE room_id = ? AND folio_status = 'OPEN' LIMIT 1`,
      [id]
    );

    if (folios.length === 0) {
      return sendError(res, `No active open folio found for Room ${room.room_number}.`, 400);
    }

    const folio = folios[0];
    const finalBalance = parseFloat(folio.balance || 0);

    // Close folio
    await connection.query(
      `UPDATE room_folios SET folio_status = 'CLOSED', check_out_date = NOW() WHERE id = ?`,
      [folio.id]
    );

    // Set room status to CLEANING for housekeeping turnover
    await connection.query(`UPDATE rooms SET status = 'CLEANING' WHERE id = ?`, [id]);

    await connection.commit();

    const [updatedRoomRows] = await pool.query(`SELECT * FROM rooms WHERE id = ?`, [id]);
    const formatted = formatRoomRow(updatedRoomRows[0]);

    const resultPayload = {
      room: formatted,
      closed_folio: {
        ...folio,
        folio_status: 'CLOSED',
        final_balance: finalBalance
      },
      message: `Room ${room.room_number} check-out completed. Final balance: ₹${finalBalance.toFixed(2)}. Room marked for CLEANING.`
    };

    broadcastEvent('room_checked_out', { room_id: parseInt(id), closed_folio: folio });
    broadcastEvent('room_status_changed', { room_id: parseInt(id), status: 'CLEANING', room: formatted });

    return sendSuccess(res, resultPayload, resultPayload.message);
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
}

/**
 * 3. EXTENDED STAY WORKFLOW
 * POST /api/rooms/:id/extend-stay
 */
async function extendStay(req, res, next) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await ensureRoomSchema();

    const { id } = req.params;
    const { new_check_out_date, extra_nights = 1 } = req.body;

    const [folios] = await connection.query(
      `SELECT * FROM room_folios WHERE room_id = ? AND folio_status = 'OPEN' LIMIT 1`,
      [id]
    );

    if (folios.length === 0) {
      return sendError(res, 'No active open folio found for this room.', 404);
    }

    const folio = folios[0];
    let updatedDate;
    if (new_check_out_date) {
      updatedDate = new Date(new_check_out_date);
    } else {
      const baseDate = folio.expected_check_out ? new Date(folio.expected_check_out) : new Date();
      baseDate.setDate(baseDate.getDate() + parseInt(extra_nights || 1, 10));
      updatedDate = baseDate;
    }

    const timestamp = new Date().toLocaleString();
    const extensionNote = `[${timestamp}] Extended stay until ${updatedDate.toLocaleDateString()}`;
    const newNotes = folio.notes ? `${folio.notes}\n${extensionNote}` : extensionNote;

    await connection.query(
      `UPDATE room_folios SET expected_check_out = ?, notes = ? WHERE id = ?`,
      [updatedDate, newNotes, folio.id]
    );

    await connection.commit();

    const [updatedFolio] = await pool.query(`SELECT * FROM room_folios WHERE id = ?`, [folio.id]);
    return sendSuccess(res, updatedFolio[0], `Stay extended until ${updatedDate.toLocaleDateString()}`);
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
}

/**
 * 4. BREAKFAST EXTRA CHARGE WORKFLOW
 * POST /api/rooms/:id/add-breakfast
 */
async function addBreakfastCharge(req, res, next) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await ensureRoomSchema();

    const { id } = req.params;
    const { price = 450.00, count = 1, package_name = 'Gourmet Breakfast Buffet' } = req.body;

    const [folios] = await connection.query(
      `SELECT * FROM room_folios WHERE room_id = ? AND folio_status = 'OPEN' LIMIT 1`,
      [id]
    );

    if (folios.length === 0) {
      return sendError(res, 'No active open folio found for this room.', 404);
    }

    const folio = folios[0];
    const totalBreakfastCharge = parseFloat(price) * parseInt(count || 1, 10);

    const timestamp = new Date().toLocaleString();
    const breakfastNote = `[${timestamp}] Added Extra Charge: ${package_name} x${count} (₹${totalBreakfastCharge.toFixed(2)})`;
    const newNotes = folio.notes ? `${folio.notes}\n${breakfastNote}` : breakfastNote;

    await connection.query(
      `UPDATE room_folios 
       SET balance = balance + ?, breakfast_price = breakfast_price + ?, notes = ? 
       WHERE id = ?`,
      [totalBreakfastCharge, totalBreakfastCharge, newNotes, folio.id]
    );

    await connection.commit();

    const [updatedFolio] = await pool.query(`SELECT * FROM room_folios WHERE id = ?`, [folio.id]);
    return sendSuccess(res, updatedFolio[0], `Breakfast charge of ₹${totalBreakfastCharge.toFixed(2)} added to room folio.`);
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
}

/**
 * 5. HOUSEKEEPING WORKFLOW (Complete Cleaning)
 * POST /api/rooms/:id/complete-cleaning
 */
async function completeCleaning(req, res, next) {
  try {
    await ensureRoomSchema();
    const { id } = req.params;

    const [rooms] = await pool.query(`SELECT * FROM rooms WHERE id = ?`, [id]);
    if (rooms.length === 0) {
      return sendError(res, 'Room not found', 404);
    }

    await pool.query(`UPDATE rooms SET status = 'VACANT' WHERE id = ?`, [id]);

    const [updated] = await pool.query(`SELECT * FROM rooms WHERE id = ?`, [id]);
    const formatted = formatRoomRow(updated[0]);

    broadcastEvent('room_status_changed', { room_id: parseInt(id), status: 'VACANT', room: formatted });
    return sendSuccess(res, formatted, `Room ${rooms[0].room_number} cleaning completed. Room is now VACANT and ready for check-in.`);
  } catch (err) {
    next(err);
  }
}

/**
 * 6. MAINTENANCE WORKFLOW (Set / Complete Maintenance)
 * POST /api/rooms/:id/set-maintenance
 * POST /api/rooms/:id/complete-maintenance
 */
async function setMaintenance(req, res, next) {
  try {
    await ensureRoomSchema();
    const { id } = req.params;
    const { notes } = req.body;

    const [rooms] = await pool.query(`SELECT * FROM rooms WHERE id = ?`, [id]);
    if (rooms.length === 0) return sendError(res, 'Room not found', 404);

    if (rooms[0].status === 'OCCUPIED') {
      return sendError(res, 'Cannot place occupied room into maintenance. Please reassign guest first.', 400);
    }

    await pool.query(
      `UPDATE rooms SET status = 'MAINTENANCE', maintenance_notes = ? WHERE id = ?`,
      [notes || 'Scheduled maintenance and inspection.', id]
    );

    const [updated] = await pool.query(`SELECT * FROM rooms WHERE id = ?`, [id]);
    const formatted = formatRoomRow(updated[0]);

    broadcastEvent('room_status_changed', { room_id: parseInt(id), status: 'MAINTENANCE', room: formatted });
    return sendSuccess(res, formatted, `Room ${rooms[0].room_number} marked as MAINTENANCE.`);
  } catch (err) {
    next(err);
  }
}

async function completeMaintenance(req, res, next) {
  try {
    await ensureRoomSchema();
    const { id } = req.params;

    const [rooms] = await pool.query(`SELECT * FROM rooms WHERE id = ?`, [id]);
    if (rooms.length === 0) return sendError(res, 'Room not found', 404);

    await pool.query(`UPDATE rooms SET status = 'VACANT', maintenance_notes = NULL WHERE id = ?`, [id]);

    const [updated] = await pool.query(`SELECT * FROM rooms WHERE id = ?`, [id]);
    const formatted = formatRoomRow(updated[0]);

    broadcastEvent('room_status_changed', { room_id: parseInt(id), status: 'VACANT', room: formatted });
    return sendSuccess(res, formatted, `Maintenance completed for Room ${rooms[0].room_number}. Room is now VACANT.`);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/rooms/guests/list
 */
async function getGuests(req, res, next) {
  try {
    await ensureRoomSchema();
    const { status, search } = req.query;

    let query = `
      SELECT 
        f.id AS folio_id,
        f.guest_name,
        f.guest_phone,
        f.guest_email,
        f.folio_status,
        COALESCE(f.balance, 0.00) AS balance,
        f.check_in_date,
        f.expected_check_out,
        f.check_out_date,
        f.breakfast_included,
        f.breakfast_price,
        f.notes,
        r.id AS room_id,
        r.room_number,
        r.floor,
        r.room_type,
        r.rate_per_night,
        r.status AS room_status
      FROM room_folios f
      JOIN rooms r ON f.room_id = r.id
      WHERE 1=1
    `;
    const params = [];

    if (status === 'IN_HOUSE') {
      query += ` AND f.folio_status = 'OPEN'`;
    } else if (status === 'CHECKED_OUT') {
      query += ` AND f.folio_status = 'CLOSED'`;
    }

    if (search && search.trim()) {
      query += ` AND (f.guest_name LIKE ? OR f.guest_phone LIKE ? OR f.guest_email LIKE ? OR r.room_number LIKE ?)`;
      const p = `%${search.trim()}%`;
      params.push(p, p, p, p);
    }

    query += ` ORDER BY CASE WHEN f.folio_status = 'OPEN' THEN 0 ELSE 1 END, f.check_in_date DESC`;

    const [rows] = await pool.query(query, params);

    const formattedGuests = rows.map(g => ({
      ...g,
      balance: parseFloat(g.balance || 0),
      rate_per_night: parseFloat(g.rate_per_night || 0),
      breakfast_included: Boolean(g.breakfast_included),
      breakfast_price: parseFloat(g.breakfast_price || 0)
    }));

    return sendSuccess(res, formattedGuests, 'Guests retrieved successfully');
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/rooms/folios/all
 */
async function getAllFolios(req, res, next) {
  try {
    await ensureRoomSchema();
    const { status, search } = req.query;

    let query = `
      SELECT 
        f.id,
        f.room_id,
        f.guest_name,
        f.guest_phone,
        f.guest_email,
        f.folio_status,
        COALESCE(f.balance, 0.00) AS balance,
        f.check_in_date,
        f.expected_check_out,
        f.check_out_date,
        f.breakfast_included,
        f.breakfast_price,
        f.notes,
        f.created_at,
        r.room_number,
        r.floor,
        r.room_type,
        r.rate_per_night,
        r.status AS room_status,
        (SELECT COUNT(*) FROM bills b WHERE b.room_id = f.room_id AND b.created_at >= f.check_in_date) AS charge_count
      FROM room_folios f
      JOIN rooms r ON f.room_id = r.id
      WHERE 1=1
    `;
    const params = [];

    if (status && status !== 'ALL') {
      query += ` AND f.folio_status = ?`;
      params.push(status);
    }

    if (search && search.trim()) {
      query += ` AND (f.guest_name LIKE ? OR r.room_number LIKE ? OR f.guest_phone LIKE ?)`;
      const p = `%${search.trim()}%`;
      params.push(p, p, p);
    }

    query += ` ORDER BY CASE WHEN f.folio_status = 'OPEN' THEN 0 ELSE 1 END, f.created_at DESC`;

    const [rows] = await pool.query(query, params);
    const formattedFolios = rows.map(f => ({
      ...f,
      balance: parseFloat(f.balance || 0),
      rate_per_night: parseFloat(f.rate_per_night || 0),
      breakfast_included: Boolean(f.breakfast_included),
      breakfast_price: parseFloat(f.breakfast_price || 0),
      charge_count: parseInt(f.charge_count || 0, 10)
    }));

    return sendSuccess(res, formattedFolios, 'Folios retrieved successfully');
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/rooms/folios/:folioId/charge
 */
async function addFolioCharge(req, res, next) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { folioId } = req.params;
    const { description, amount } = req.body;

    const numAmount = parseFloat(amount);
    if (!description || isNaN(numAmount) || numAmount <= 0) {
      return sendError(res, 'Valid description and positive amount are required.', 400);
    }

    const [folios] = await connection.query(`SELECT * FROM room_folios WHERE id = ?`, [folioId]);
    if (folios.length === 0) return sendError(res, 'Folio not found', 404);

    const folio = folios[0];
    if (folio.folio_status !== 'OPEN') {
      return sendError(res, 'Cannot add charges to a closed folio', 400);
    }

    await connection.query(`UPDATE room_folios SET balance = balance + ? WHERE id = ?`, [numAmount, folioId]);

    const timestamp = new Date().toLocaleString();
    const noteEntry = `[${timestamp}] Added charge: ${description} (₹${numAmount.toFixed(2)})`;
    const newNotes = folio.notes ? `${folio.notes}\n${noteEntry}` : noteEntry;
    await connection.query(`UPDATE room_folios SET notes = ? WHERE id = ?`, [newNotes, folioId]);

    await connection.commit();

    const [updated] = await pool.query(`SELECT * FROM room_folios WHERE id = ?`, [folioId]);
    return sendSuccess(res, updated[0], `Charge of ₹${numAmount.toFixed(2)} added to folio.`);
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
}

/**
 * POST /api/rooms/folios/:folioId/settle
 */
async function settleFolio(req, res, next) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { folioId } = req.params;
    const { amount, payment_method = 'CASH' } = req.body;

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return sendError(res, 'Valid positive payment amount required.', 400);
    }

    const [folios] = await connection.query(`SELECT * FROM room_folios WHERE id = ?`, [folioId]);
    if (folios.length === 0) return sendError(res, 'Folio not found', 404);

    const folio = folios[0];
    const currentBalance = parseFloat(folio.balance || 0);
    const newBalance = Math.max(0, currentBalance - numAmount);

    const timestamp = new Date().toLocaleString();
    const noteEntry = `[${timestamp}] Payment received: ₹${numAmount.toFixed(2)} via ${payment_method}`;
    const newNotes = folio.notes ? `${folio.notes}\n${noteEntry}` : noteEntry;

    await connection.query(
      `UPDATE room_folios SET balance = ?, notes = ? WHERE id = ?`,
      [newBalance, newNotes, folioId]
    );

    await connection.commit();
    const [updated] = await pool.query(`SELECT * FROM room_folios WHERE id = ?`, [folioId]);
    return sendSuccess(res, updated[0], `Payment of ₹${numAmount.toFixed(2)} recorded.`);
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
}

/**
 * GET /api/rooms/:id/folio
 */
async function getRoomFolio(req, res, next) {
  try {
    await ensureRoomSchema();
    const { id } = req.params;

    const [rooms] = await pool.query(`SELECT * FROM rooms WHERE id = ?`, [id]);
    if (rooms.length === 0) return sendError(res, 'Room not found', 404);

    const room = formatRoomRow(rooms[0]);

    const [folios] = await pool.query(`
      SELECT * FROM room_folios 
      WHERE room_id = ? 
      ORDER BY CASE WHEN folio_status = 'OPEN' THEN 0 ELSE 1 END, created_at DESC 
      LIMIT 1
    `, [id]);

    if (folios.length === 0) {
      return sendSuccess(res, { room, folio: null, charges: [] }, 'No folio on record for this room');
    }

    const folio = folios[0];

    const [charges] = await pool.query(`
      SELECT 
        b.id, b.bill_number, b.order_id, b.subtotal, b.tax_amount, 
        b.discount_amount, b.service_charge, b.grand_total, b.payment_status, b.created_at,
        o.order_number, o.customer_name, o.order_type
      FROM bills b
      LEFT JOIN restaurant_orders o ON b.order_id = o.id
      WHERE b.room_id = ? AND b.created_at >= ?
      ORDER BY b.created_at DESC
    `, [id, folio.check_in_date || folio.created_at]);

    return sendSuccess(res, {
      room,
      folio: {
        ...folio,
        balance: parseFloat(folio.balance || 0),
        breakfast_included: Boolean(folio.breakfast_included),
        breakfast_price: parseFloat(folio.breakfast_price || 0)
      },
      charges
    }, 'Room folio fetched successfully');
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/rooms/stats/summary
 */
async function getRoomStats(req, res, next) {
  try {
    await ensureRoomSchema();
    const hotelId = parseInt(req.query.hotel_id || '1', 10);
    const [allRooms] = await pool.query(`
      SELECT 
        COUNT(*) as total_rooms,
        SUM(CASE WHEN r.status = 'VACANT' THEN 1 ELSE 0 END) as vacant_count,
        SUM(CASE WHEN r.status = 'OCCUPIED' THEN 1 ELSE 0 END) as occupied_count,
        SUM(CASE WHEN r.status IN ('CLEANING', 'CLEANING_IN_PROGRESS') THEN 1 ELSE 0 END) as cleaning_count,
        SUM(CASE WHEN r.status IN ('MAINTENANCE', 'OUT_OF_ORDER') THEN 1 ELSE 0 END) as maintenance_count,
        SUM(CASE WHEN r.status = 'RESERVED' THEN 1 ELSE 0 END) as reserved_count,
        COALESCE(SUM(f.balance), 0.00) as total_outstanding_balance
      FROM rooms r
      LEFT JOIN room_folios f ON r.id = f.room_id AND f.folio_status = 'OPEN'
      WHERE r.hotel_id = ? OR ? = 0
    `, [hotelId, hotelId]);

    const stats = {
      total: allRooms[0]?.total_rooms || 0,
      vacant: allRooms[0]?.vacant_count || 0,
      occupied: allRooms[0]?.occupied_count || 0,
      cleaning: allRooms[0]?.cleaning_count || 0,
      maintenance: allRooms[0]?.maintenance_count || 0,
      reserved: allRooms[0]?.reserved_count || 0,
      total_balance: parseFloat(allRooms[0]?.total_outstanding_balance || 0),
      occupancy_rate: allRooms[0]?.total_rooms > 0 
        ? Math.round((allRooms[0].occupied_count / allRooms[0].total_rooms) * 100) 
        : 0
    };

    return sendSuccess(res, stats, 'Room statistics fetched');
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/accommodation/dashboard
 * Scoped Accommodation Dashboard Summary
 */
async function getAccommodationDashboard(req, res, next) {
  try {
    await ensureRoomSchema();
    const hotelId = parseInt(req.query.hotel_id || '1', 10);

    // 1. Primary Room Overview
    const [roomCounts] = await pool.query(`
      SELECT 
        COUNT(*) as total_rooms,
        SUM(CASE WHEN status = 'OCCUPIED' THEN 1 ELSE 0 END) as occupied_rooms,
        SUM(CASE WHEN status = 'VACANT' THEN 1 ELSE 0 END) as available_rooms,
        SUM(CASE WHEN status = 'RESERVED' THEN 1 ELSE 0 END) as reserved_rooms,
        SUM(CASE WHEN status IN ('CLEANING', 'CLEANING_IN_PROGRESS') THEN 1 ELSE 0 END) as cleaning_rooms,
        SUM(CASE WHEN status IN ('MAINTENANCE', 'OUT_OF_ORDER') THEN 1 ELSE 0 END) as maintenance_rooms
      FROM rooms
      WHERE hotel_id = ? OR ? = 0
    `, [hotelId, hotelId]);

    const overview = {
      total_rooms: parseInt(roomCounts[0]?.total_rooms || 0, 10),
      occupied_rooms: parseInt(roomCounts[0]?.occupied_rooms || 0, 10),
      available_rooms: parseInt(roomCounts[0]?.available_rooms || 0, 10),
      reserved_rooms: parseInt(roomCounts[0]?.reserved_rooms || 0, 10),
      cleaning_rooms: parseInt(roomCounts[0]?.cleaning_rooms || 0, 10),
      maintenance_rooms: parseInt(roomCounts[0]?.maintenance_rooms || 0, 10)
    };

    // 2. Today's Operations
    const [todayOps] = await pool.query(`
      SELECT
        COUNT(CASE WHEN DATE(check_in_date) = CURDATE() OR booking_status = 'CHECKED_IN' THEN 1 END) as today_checkins,
        COUNT(CASE WHEN DATE(check_out_date) = CURDATE() OR booking_status = 'CHECKED_OUT' THEN 1 END) as today_checkouts
      FROM bookings
      WHERE (hotel_id = ? OR ? = 0)
    `, [hotelId, hotelId]);

    const today_operations = {
      today_checkins: parseInt(todayOps[0]?.today_checkins || 0, 10),
      today_checkouts: parseInt(todayOps[0]?.today_checkouts || 0, 10)
    };

    // 3. Attention Required Lists
    const [cleaningNeeded] = await pool.query(`
      SELECT id, room_number, floor, room_type, status, updated_at
      FROM rooms
      WHERE (hotel_id = ? OR ? = 0) AND status IN ('CLEANING', 'CLEANING_IN_PROGRESS')
      ORDER BY updated_at ASC LIMIT 6
    `, [hotelId, hotelId]);

    const [maintenanceIssues] = await pool.query(`
      SELECT id, room_number, floor, room_type, status, maintenance_notes, updated_at
      FROM rooms
      WHERE (hotel_id = ? OR ? = 0) AND status IN ('MAINTENANCE', 'OUT_OF_ORDER')
      ORDER BY updated_at ASC LIMIT 6
    `, [hotelId, hotelId]);

    const [pendingPayments] = await pool.query(`
      SELECT f.id, f.room_id, r.room_number, f.guest_name, f.guest_phone, f.balance
      FROM room_folios f
      JOIN rooms r ON f.room_id = r.id
      WHERE (f.hotel_id = ? OR ? = 0) AND f.folio_status = 'OPEN' AND f.balance > 0
      ORDER BY f.balance DESC LIMIT 6
    `, [hotelId, hotelId]);

    const [overdueCheckouts] = await pool.query(`
      SELECT f.id, f.room_id, r.room_number, f.guest_name, f.guest_phone, f.expected_check_out
      FROM room_folios f
      JOIN rooms r ON f.room_id = r.id
      WHERE (f.hotel_id = ? OR ? = 0) AND f.folio_status = 'OPEN' AND f.expected_check_out IS NOT NULL AND f.expected_check_out < NOW()
      ORDER BY f.expected_check_out ASC LIMIT 6
    `, [hotelId, hotelId]);

    // 4. Upcoming Activity (Next 3 to 5 activities)
    const [upcomingActivities] = await pool.query(`
      SELECT 
        b.id,
        b.booking_number,
        b.guest_name,
        b.guest_phone,
        COALESCE(r.room_number, 'Unassigned') as room_number,
        b.booking_source,
        b.booking_status,
        CASE 
          WHEN b.booking_status = 'CONFIRMED' THEN 'Check-in'
          WHEN b.booking_status = 'CHECKED_IN' THEN 'Check-out'
          ELSE 'Reservation'
        END as activity_type,
        CASE 
          WHEN b.booking_status = 'CONFIRMED' THEN b.check_in_date
          ELSE b.check_out_date
        END as activity_time
      FROM bookings b
      LEFT JOIN rooms r ON b.room_id = r.id
      WHERE (b.hotel_id = ? OR ? = 0) AND b.booking_status IN ('CONFIRMED', 'CHECKED_IN')
      ORDER BY activity_time ASC LIMIT 5
    `, [hotelId, hotelId]);

    // 5. Recent Activity Feed
    const [recentActivity] = await pool.query(`
      SELECT 
        b.id,
        b.booking_number,
        b.guest_name,
        b.booking_source,
        b.booking_status,
        b.total_amount,
        b.payment_status,
        COALESCE(r.room_number, 'Room Assigned') as room_number,
        b.created_at,
        CONCAT('Booking #', b.booking_number, ' created for ', b.guest_name, ' (', b.booking_source, ')') as description
      FROM bookings b
      LEFT JOIN rooms r ON b.room_id = r.id
      WHERE (b.hotel_id = ? OR ? = 0)
      ORDER BY b.created_at DESC LIMIT 6
    `, [hotelId, hotelId]);

    return sendSuccess(res, {
      hotel_id: hotelId,
      overview,
      today_operations,
      attention_required: {
        cleaning_needed: cleaningNeeded,
        maintenance_issues: maintenanceIssues,
        pending_payments: pendingPayments,
        overdue_checkouts: overdueCheckouts
      },
      upcoming_activities: upcomingActivities,
      recent_activities: recentActivity
    }, 'Accommodation dashboard data fetched successfully');
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/accommodation/bookings
 */
async function getBookings(req, res, next) {
  try {
    await ensureRoomSchema();
    const hotelId = parseInt(req.query.hotel_id || '1', 10);
    const { source, status, search } = req.query;

    let sql = `
      SELECT b.*, r.room_number, r.floor, r.status as current_room_status, h.name as hotel_name
      FROM bookings b
      LEFT JOIN rooms r ON b.room_id = r.id
      LEFT JOIN hotels h ON b.hotel_id = h.id
      WHERE (b.hotel_id = ? OR ? = 0)
    `;
    const params = [hotelId, hotelId];

    if (source && source !== 'ALL') {
      sql += ` AND b.booking_source = ?`;
      params.push(source);
    }
    if (status && status !== 'ALL') {
      sql += ` AND b.booking_status = ?`;
      params.push(status);
    }
    if (search && search.trim()) {
      sql += ` AND (b.guest_name LIKE ? OR b.booking_number LIKE ? OR b.guest_phone LIKE ? OR r.room_number LIKE ?)`;
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term);
    }

    sql += ` ORDER BY b.check_in_date DESC`;

    const [rows] = await pool.query(sql, params);
    return sendSuccess(res, rows, 'Bookings fetched successfully');
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/accommodation/bookings
 */
async function createBooking(req, res, next) {
  try {
    await ensureRoomSchema();
    const {
      hotel_id = 1,
      room_id,
      guest_name,
      guest_phone,
      guest_email,
      guest_type = 'DOMESTIC',
      booking_source = 'WALK_IN',
      check_in_date,
      check_out_date,
      adults = 2,
      children = 0,
      room_type = 'Deluxe Room',
      rate_per_night = 2500,
      total_amount = 2500,
      paid_amount = 0,
      payment_status = 'PENDING',
      special_requests = ''
    } = req.body;

    if (!guest_name || !check_in_date || !check_out_date) {
      return sendError(res, 'Guest name, check-in date, and check-out date are required.', 400);
    }

    const bookingNum = `BK-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

    const [result] = await pool.query(`
      INSERT INTO bookings (
        hotel_id, booking_number, room_id, guest_name, guest_phone, guest_email,
        guest_type, booking_source, booking_status, check_in_date, check_out_date,
        adults, children, room_type, rate_per_night, total_amount, paid_amount,
        payment_status, special_requests
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'CONFIRMED', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      hotel_id, bookingNum, room_id || null, guest_name, guest_phone, guest_email,
      guest_type, booking_source, check_in_date, check_out_date,
      adults, children, room_type, rate_per_night, total_amount, paid_amount,
      payment_status, special_requests
    ]);

    // If room assigned and it was vacant, mark RESERVED
    if (room_id) {
      await pool.query(`UPDATE rooms SET status = 'RESERVED' WHERE id = ? AND status = 'VACANT'`, [room_id]);
    }

    // Create Notification
    await pool.query(`
      INSERT INTO accommodation_notifications (hotel_id, notification_type, title, message, severity)
      VALUES (?, 'BOOKING_NEW', ?, ?, 'INFO')
    `, [
      hotel_id,
      `New ${booking_source} Booking #${bookingNum}`,
      `Reservation received for ${guest_name} (${room_type}).`
    ]);

    return sendSuccess(res, { id: result.insertId, booking_number: bookingNum }, 'Booking created successfully', 201);
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/accommodation/bookings/:id/status
 */
async function updateBookingStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { booking_status, room_id } = req.body;

    const [booking] = await pool.query('SELECT * FROM bookings WHERE id = ?', [id]);
    if (booking.length === 0) return sendError(res, 'Booking not found', 404);

    await pool.query('UPDATE bookings SET booking_status = ?, room_id = COALESCE(?, room_id) WHERE id = ?', [
      booking_status, room_id || null, id
    ]);

    if (booking_status === 'CANCELLED' && booking[0].room_id) {
      await pool.query(`UPDATE rooms SET status = 'VACANT' WHERE id = ? AND status = 'RESERVED'`, [booking[0].room_id]);
      
      await pool.query(`
        INSERT INTO accommodation_notifications (hotel_id, notification_type, title, message, severity)
        VALUES (?, 'BOOKING_CANCELLED', ?, ?, 'WARNING')
      `, [
        booking[0].hotel_id,
        `Booking Cancelled #${booking[0].booking_number}`,
        `Booking for ${booking[0].guest_name} was cancelled.`
      ]);
    }

    return sendSuccess(res, { id, booking_status }, 'Booking status updated successfully');
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/accommodation/notifications
 */
async function getAccommodationNotifications(req, res, next) {
  try {
    const hotelId = parseInt(req.query.hotel_id || '1', 10);
    const [rows] = await pool.query(`
      SELECT * FROM accommodation_notifications
      WHERE hotel_id = ? OR ? = 0
      ORDER BY created_at DESC LIMIT 30
    `, [hotelId, hotelId]);

    const [unread] = await pool.query(`
      SELECT COUNT(*) as unread_count FROM accommodation_notifications
      WHERE (hotel_id = ? OR ? = 0) AND is_read = 0
    `, [hotelId, hotelId]);

    return sendSuccess(res, {
      notifications: rows,
      unread_count: unread[0]?.unread_count || 0
    }, 'Notifications fetched');
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/accommodation/notifications/mark-read
 */
async function markNotificationsRead(req, res, next) {
  try {
    const hotelId = parseInt(req.body.hotel_id || '1', 10);
    await pool.query(`
      UPDATE accommodation_notifications SET is_read = 1
      WHERE hotel_id = ? OR ? = 0
    `, [hotelId, hotelId]);

    return sendSuccess(res, null, 'Notifications marked as read');
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/accommodation/payments
 */
async function getAccommodationPayments(req, res, next) {
  try {
    const hotelId = parseInt(req.query.hotel_id || '1', 10);
    const [rows] = await pool.query(`
      SELECT p.*, r.room_number, f.guest_name as folio_guest_name, f.balance as current_folio_balance
      FROM accommodation_payments p
      LEFT JOIN rooms r ON p.room_id = r.id
      LEFT JOIN room_folios f ON p.folio_id = f.id
      WHERE p.hotel_id = ? OR ? = 0
      ORDER BY p.paid_at DESC LIMIT 50
    `, [hotelId, hotelId]);

    return sendSuccess(res, rows, 'Payments fetched successfully');
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/accommodation/payments/record
 * Record a demo/verified payment (e.g. UPI QR, Card, Cash) and update folio balance
 */
async function recordAccommodationPayment(req, res, next) {
  try {
    const {
      hotel_id = 1,
      folio_id,
      room_id,
      guest_name,
      amount,
      payment_method = 'UPI',
      payment_provider = 'GOOGLE_PAY',
      payment_status = 'PAID',
      notes = ''
    } = req.body;

    if (!amount || amount <= 0) {
      return sendError(res, 'A valid positive payment amount is required', 400);
    }

    const txRef = `TXN-${payment_provider.slice(0, 3)}-${Date.now().toString().slice(-6)}`;

    const [result] = await pool.query(`
      INSERT INTO accommodation_payments (
        hotel_id, folio_id, room_id, guest_name, amount, payment_method,
        payment_provider, payment_status, transaction_ref, is_demo_payment, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
    `, [
      hotel_id, folio_id || null, room_id || null, guest_name || 'Guest',
      amount, payment_method, payment_provider, payment_status, txRef, notes
    ]);

    // If linked to an open folio, deduct balance
    if (folio_id) {
      await pool.query(`
        UPDATE room_folios 
        SET balance = GREATEST(0.00, balance - ?),
            notes = CONCAT(COALESCE(notes, ''), ' | Payment ₹', ?, ' via ', ?, ' (', ?, ')')
        WHERE id = ?
      `, [amount, amount, payment_method, txRef, folio_id]);
    }

    return sendSuccess(res, {
      payment_id: result.insertId,
      transaction_ref: txRef,
      amount,
      payment_method,
      payment_provider,
      payment_status
    }, 'Payment recorded successfully');
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/accommodation/guest-document
 */
async function saveGuestDocument(req, res, next) {
  try {
    const {
      hotel_id = 1,
      folio_id,
      booking_id,
      guest_name,
      guest_type = 'DOMESTIC',
      id_type,
      id_number,
      nationality,
      passport_number,
      passport_country,
      passport_issue_date,
      passport_expiry_date,
      visa_number,
      visa_type,
      visa_issue_date,
      visa_expiry_date,
      arrival_date_india,
      arrival_place_india
    } = req.body;

    const [result] = await pool.query(`
      INSERT INTO guest_documents (
        hotel_id, folio_id, booking_id, guest_name, guest_type,
        id_type, id_number, nationality, passport_number, passport_country,
        passport_issue_date, passport_expiry_date, visa_number, visa_type,
        visa_issue_date, visa_expiry_date, arrival_date_india, arrival_place_india
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      hotel_id, folio_id || null, booking_id || null, guest_name, guest_type,
      id_type || null, id_number || null, nationality || null, passport_number || null, passport_country || null,
      passport_issue_date || null, passport_expiry_date || null, visa_number || null, visa_type || null,
      visa_issue_date || null, visa_expiry_date || null, arrival_date_india || null, arrival_place_india || null
    ]);

    return sendSuccess(res, { id: result.insertId }, 'Guest identity document recorded');
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getRooms,
  getRoomById,
  createRoom,
  updateRoom,
  updateRoomStatus,
  deleteRoom,
  checkInGuest,
  checkOutGuest,
  extendStay,
  addBreakfastCharge,
  completeCleaning,
  setMaintenance,
  completeMaintenance,
  getRoomFolio,
  getRoomStats,
  getGuests,
  getAllFolios,
  addFolioCharge,
  settleFolio,
  getAccommodationDashboard,
  getBookings,
  createBooking,
  updateBookingStatus,
  getAccommodationNotifications,
  markNotificationsRead,
  getAccommodationPayments,
  recordAccommodationPayment,
  saveGuestDocument,
  ensureRoomSchema
};
