const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const dbHost = process.env.DB_HOST || 'localhost';
const dbPort = parseInt(process.env.DB_PORT || '3306');
const dbUser = process.env.DB_USER || 'root';
const dbPassword = process.env.DB_PASSWORD || 'db123';
const dbName = process.env.DB_NAME || 'hotel_db';

async function initDatabase() {
  console.log('🔄 Initializing MySQL Database setup...');
  let connection;
  try {
    const isCloudDb = Boolean(process.env.DATABASE_URL || process.env.MYSQL_URL);
    if (isCloudDb) {
      const uri = process.env.DATABASE_URL || process.env.MYSQL_URL;
      const isRailwayInternal = uri.includes('railway.internal');
      const connConfig = {
        uri,
        multipleStatements: true
      };
      if (process.env.DB_SSL === 'true' && !isRailwayInternal) {
        connConfig.ssl = { rejectUnauthorized: false };
      }
      connection = await mysql.createConnection(connConfig);
      console.log('✅ Connected to Cloud MySQL server via DATABASE_URL');
    } else {
      connection = await mysql.createConnection({
        host: dbHost,
        port: dbPort,
        user: dbUser,
        password: dbPassword,
        multipleStatements: true,
        ssl: (process.env.DB_SSL === 'true' && !dbHost.includes('localhost') && !dbHost.includes('127.0.0.1')) ? { rejectUnauthorized: false } : undefined
      });
      console.log(`✅ Connected to MySQL server at ${dbHost}:${dbPort}`);

      const forceReset = process.argv.includes('--reset') && process.env.NODE_ENV !== 'production';
      if (forceReset) {
        console.log('⚠️  Force reset requested (Development only). Dropping and recreating database...');
        await connection.query(`DROP DATABASE IF EXISTS \`${dbName}\`;`);
      }

      await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\`;`);
      console.log(`✅ Database \`${dbName}\` created or confirmed.`);
      await connection.changeUser({ database: dbName });
    }

    // Read and execute schema
    const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
    const statements = schemaSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 5);

    for (const stmt of statements) {
      try {
        await connection.query(stmt);
      } catch (stmtErr) {
        // Non-fatal warning if statement exists
      }
    }
    console.log('✅ All database tables created successfully.');

    // Run migrations safely
    await runMigrations(connection);

    // Seed data check
    const [userRows] = await connection.query('SELECT COUNT(*) as count FROM users');
    const [menuRows] = await connection.query('SELECT COUNT(*) as count FROM menu_items');

    // Always ensure super admin exists
    await getOrCreateUser(connection, 'Master Super Admin', 'superadmin@gmail.com', 'admin@123', '+91 9999999999', 'SUPER_ADMIN');

    if (userRows[0].count <= 1 || menuRows[0].count === 0 || (forceReset && process.env.NODE_ENV !== 'production')) {
      console.log('🌱 Seeding initial data...');
      await seedData(connection);
      console.log('✅ Seed data inserted successfully!');
    } else {
      console.log('ℹ️ Database already contains data.');
      await ensureRestaurantAdmins(connection);
      await ensureEssentialStaffUsers(connection);
      await seedKOTData(connection);
    }

  } catch (err) {
    console.error('❌ Database initialization error:', err);
    throw err;
  } finally {
    if (connection) await connection.end();
  }
}

async function addColumnIfNotExists(conn, table, column, definition) {
  try {
    const [cols] = await conn.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [table, column]
    );
    if (cols.length === 0) {
      await conn.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
      console.log(`  ↳ Added column ${table}.${column}`);
    }
  } catch (e) {
    console.warn(`Column check warning for ${table}.${column}:`, e.message);
  }
}

async function addIndexIfNotExists(conn, table, indexName, columns) {
  try {
    const [indexes] = await conn.query(
      `SHOW INDEX FROM \`${table}\` WHERE Key_name = ?`,
      [indexName]
    );
    if (indexes.length === 0) {
      await conn.query(`CREATE INDEX \`${indexName}\` ON \`${table}\` (${columns})`);
      console.log(`  ↳ Created index ${table}.${indexName}`);
    }
  } catch (e) {
    // Non-fatal warning if table/index exists or not supported
  }
}

async function runMigrations(conn) {
  console.log('🔄 Running idempotent migrations...');

  // Users columns
  await addColumnIfNotExists(conn, 'users', 'plain_password', "VARCHAR(255) DEFAULT NULL");
  try {
    await conn.query(`ALTER TABLE users MODIFY COLUMN role VARCHAR(50) NOT NULL DEFAULT 'CUSTOMER'`);
  } catch (e) {}

  // Restaurants columns
  await addColumnIfNotExists(conn, 'restaurants', 'status', "ENUM('PENDING','ACTIVE','SUSPENDED') NOT NULL DEFAULT 'PENDING'");
  await addColumnIfNotExists(conn, 'restaurants', 'website_status', "ENUM('DRAFT','PUBLISHED','UNPUBLISHED') NOT NULL DEFAULT 'DRAFT'");
  await addColumnIfNotExists(conn, 'restaurants', 'tagline', "VARCHAR(255) DEFAULT NULL");
  await addColumnIfNotExists(conn, 'restaurants', 'about', "TEXT DEFAULT NULL");
  await addColumnIfNotExists(conn, 'restaurants', 'description', "TEXT DEFAULT NULL");
  await addColumnIfNotExists(conn, 'restaurants', 'area', "VARCHAR(100) DEFAULT NULL");
  await addColumnIfNotExists(conn, 'restaurants', 'city', "VARCHAR(100) DEFAULT NULL");
  await addColumnIfNotExists(conn, 'restaurants', 'state', "VARCHAR(100) DEFAULT NULL");
  await addColumnIfNotExists(conn, 'restaurants', 'postal_code', "VARCHAR(20) DEFAULT NULL");
  await addColumnIfNotExists(conn, 'restaurants', 'opening_time', "VARCHAR(20) DEFAULT '10:00'");
  await addColumnIfNotExists(conn, 'restaurants', 'closing_time', "VARCHAR(20) DEFAULT '23:00'");
  await addColumnIfNotExists(conn, 'restaurants', 'admin_user_id', "INT DEFAULT NULL");
  await addColumnIfNotExists(conn, 'restaurants', 'accepts_rider_applications', "TINYINT(1) NOT NULL DEFAULT 1");
  await addColumnIfNotExists(conn, 'restaurants', 'razorpay_key_id', "VARCHAR(255) DEFAULT NULL");
  await addColumnIfNotExists(conn, 'restaurants', 'razorpay_key_secret', "VARCHAR(255) DEFAULT NULL");
  await addColumnIfNotExists(conn, 'restaurants', 'razorpay_enabled', "TINYINT(1) NOT NULL DEFAULT 0");
  await addColumnIfNotExists(conn, 'restaurants', 'upi_id', "VARCHAR(100) DEFAULT NULL");
  await addColumnIfNotExists(conn, 'restaurants', 'upi_name', "VARCHAR(150) DEFAULT NULL");

  // Delivery Drivers columns
  await addColumnIfNotExists(conn, 'delivery_drivers', 'full_name', "VARCHAR(150) DEFAULT NULL");
  await addColumnIfNotExists(conn, 'delivery_drivers', 'mobile', "VARCHAR(20) DEFAULT NULL");
  await addColumnIfNotExists(conn, 'delivery_drivers', 'email', "VARCHAR(150) DEFAULT NULL");
  await addColumnIfNotExists(conn, 'delivery_drivers', 'date_of_birth', "DATE DEFAULT NULL");
  await addColumnIfNotExists(conn, 'delivery_drivers', 'home_city', "VARCHAR(100) DEFAULT NULL");
  await addColumnIfNotExists(conn, 'delivery_drivers', 'current_city', "VARCHAR(100) DEFAULT NULL");
  await addColumnIfNotExists(conn, 'delivery_drivers', 'current_address', "TEXT DEFAULT NULL");
  await addColumnIfNotExists(conn, 'delivery_drivers', 'emergency_contact', "VARCHAR(20) DEFAULT NULL");
  await addColumnIfNotExists(conn, 'delivery_drivers', 'selfie_path', "VARCHAR(500) DEFAULT NULL");
  await addColumnIfNotExists(conn, 'delivery_drivers', 'account_status', "ENUM('ACTIVE', 'SUSPENDED', 'DEACTIVATED') NOT NULL DEFAULT 'ACTIVE'");
  await addColumnIfNotExists(conn, 'delivery_drivers', 'last_location_at', "TIMESTAMP NULL DEFAULT NULL");

  try {
    await conn.query(`ALTER TABLE delivery_drivers MODIFY COLUMN vehicle_type VARCHAR(50) NOT NULL DEFAULT 'Bike'`);
    await conn.query(`ALTER TABLE rider_applications MODIFY COLUMN vehicle_type VARCHAR(50) NOT NULL DEFAULT 'Bike'`);
    await conn.query(`ALTER TABLE delivery_drivers MODIFY COLUMN availability_status ENUM('OFFLINE', 'AVAILABLE', 'BUSY') DEFAULT 'OFFLINE'`);
  } catch (e) {}

  // Orders columns & ENUM updates
  await addColumnIfNotExists(conn, 'orders', 'customer_identity_id', "INT DEFAULT NULL");
  await addColumnIfNotExists(conn, 'orders', 'delivery_failure_reason', "TEXT DEFAULT NULL");
  await addColumnIfNotExists(conn, 'orders', 'cod_collected_by', "INT DEFAULT NULL");
  await addColumnIfNotExists(conn, 'orders', 'cod_collected_at', "TIMESTAMP NULL DEFAULT NULL");

  try {
    await conn.query(`ALTER TABLE orders MODIFY COLUMN order_status ENUM(
      'PENDING','ACCEPTED','SENT_TO_KITCHEN','PREPARING','READY_FOR_PICKUP',
      'ASSIGNED_TO_DRIVER','DRIVER_ACCEPTED','PICKED_UP','OUT_FOR_DELIVERY',
      'DELIVERED','REJECTED','CANCELLED','DELIVERY_FAILED'
    ) NOT NULL DEFAULT 'PENDING'`);

    await conn.query(`ALTER TABLE orders MODIFY COLUMN payment_status ENUM('PENDING','COMPLETED','FAILED','REFUNDED') NOT NULL DEFAULT 'PENDING'`);
    await conn.query(`ALTER TABLE payments MODIFY COLUMN payment_method VARCHAR(50) NOT NULL DEFAULT 'CASH'`);
    await conn.query(`ALTER TABLE restaurant_orders MODIFY COLUMN payment_status VARCHAR(50) NOT NULL DEFAULT 'UNPAID'`);
    await conn.query(`ALTER TABLE bills MODIFY COLUMN payment_status VARCHAR(50) NOT NULL DEFAULT 'UNPAID'`);
    await conn.query(`ALTER TABLE users MODIFY COLUMN role VARCHAR(50) NOT NULL DEFAULT 'CUSTOMER'`);
    await addColumnIfNotExists(conn, 'restaurant_orders', 'restaurant_id', 'INT NOT NULL DEFAULT 1');
    await addColumnIfNotExists(conn, 'restaurant_tables', 'restaurant_id', 'INT NOT NULL DEFAULT 1');
  } catch (e) {}

  // Menu items columns
  await addColumnIfNotExists(conn, 'menu_items', 'kitchen_department_id', "INT DEFAULT NULL");
  await addColumnIfNotExists(conn, 'menu_items', 'tax_percentage', "DECIMAL(5, 2) DEFAULT 5.00");
  await addColumnIfNotExists(conn, 'menu_items', 'is_available_online', "TINYINT(1) DEFAULT 1");
  await addColumnIfNotExists(conn, 'menu_items', 'is_active', "TINYINT(1) DEFAULT 1");

  // KOTs ENUM migration & Online Order FK relaxation
  try {
    await conn.query(`ALTER TABLE kots MODIFY COLUMN order_type ENUM('DINE_IN','ROOM_SERVICE','TAKEAWAY','ONLINE','DELIVERY') DEFAULT 'DINE_IN'`);
  } catch (e) {}
  try {
    await conn.query(`ALTER TABLE kots DROP FOREIGN KEY kots_ibfk_1`);
  } catch (e) {}
  try {
    await conn.query(`ALTER TABLE kot_items DROP FOREIGN KEY kot_items_ibfk_2`);
  } catch (e) {}
  await addColumnIfNotExists(conn, 'kots', 'online_order_id', "INT DEFAULT NULL");
  await addColumnIfNotExists(conn, 'kot_items', 'online_order_item_id', "INT DEFAULT NULL");

  // Order items columns
  await addColumnIfNotExists(conn, 'order_items', 'status', "VARCHAR(30) DEFAULT 'PENDING'");
  await addColumnIfNotExists(conn, 'order_items', 'tax_amount', "DECIMAL(10, 2) DEFAULT 0.00");
  await addColumnIfNotExists(conn, 'order_items', 'kitchen_department_id', "INT DEFAULT NULL");
  await addColumnIfNotExists(conn, 'order_items', 'prep_time_minutes', "INT DEFAULT 15");

  // Phone column length fix for +91 formatting
  try {
    await conn.query(`ALTER TABLE users MODIFY COLUMN phone VARCHAR(30) NOT NULL`);
    await conn.query(`ALTER TABLE restaurants MODIFY COLUMN phone VARCHAR(30) DEFAULT NULL`);
  } catch (e) {}

  // Payments columns
  await addColumnIfNotExists(conn, 'payments', 'bill_id', "INT DEFAULT NULL");

  // Payments columns
  await addColumnIfNotExists(conn, 'payments', 'collected_by', "INT DEFAULT NULL");
  await addColumnIfNotExists(conn, 'payments', 'collected_at', "TIMESTAMP NULL DEFAULT NULL");

  // Notifications columns
  await addColumnIfNotExists(conn, 'notifications', 'restaurant_id', "INT DEFAULT NULL");
  await addColumnIfNotExists(conn, 'notifications', 'customer_identity_id', "INT DEFAULT NULL");

  // Table creations (idempotent via IF NOT EXISTS)
  const tableCreations = [
    `CREATE TABLE IF NOT EXISTS rider_applications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      rider_id INT DEFAULT NULL,
      restaurant_id INT NOT NULL,
      full_name VARCHAR(150) NOT NULL,
      mobile VARCHAR(20) NOT NULL,
      email VARCHAR(150) NOT NULL,
      date_of_birth DATE DEFAULT NULL,
      home_city VARCHAR(100) DEFAULT NULL,
      current_city VARCHAR(100) DEFAULT NULL,
      current_address TEXT DEFAULT NULL,
      emergency_contact VARCHAR(20) DEFAULT NULL,
      vehicle_type ENUM('Bike','Scooter','Cycle','EV','Other') NOT NULL DEFAULT 'Bike',
      vehicle_number VARCHAR(30) DEFAULT NULL,
      application_status ENUM('PENDING','UNDER_REVIEW','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING',
      submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      reviewed_by INT DEFAULT NULL,
      reviewed_at TIMESTAMP NULL DEFAULT NULL,
      rejection_reason TEXT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS rider_documents (
      id INT AUTO_INCREMENT PRIMARY KEY,
      application_id INT NOT NULL,
      rider_id INT DEFAULT NULL,
      document_type ENUM('SELFIE','AADHAAR_FRONT','AADHAAR_BACK','DRIVING_LICENSE_FRONT','DRIVING_LICENSE_BACK','PAN','VEHICLE_RC','INSURANCE') NOT NULL,
      file_path VARCHAR(500) NOT NULL,
      original_file_name VARCHAR(255) DEFAULT NULL,
      mime_type VARCHAR(100) DEFAULT NULL,
      file_size INT DEFAULT NULL,
      verification_status ENUM('PENDING','VERIFIED','REJECTED') NOT NULL DEFAULT 'PENDING',
      verified_by INT DEFAULT NULL,
      verified_at TIMESTAMP NULL DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS driver_restaurant_assignments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      driver_id INT NOT NULL,
      restaurant_id INT NOT NULL,
      application_id INT DEFAULT NULL,
      status ENUM('ACTIVE','SUSPENDED','REMOVED') NOT NULL DEFAULT 'ACTIVE',
      approved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      approved_by INT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_driver_restaurant (driver_id, restaurant_id)
    )`,
    `CREATE TABLE IF NOT EXISTS driver_location_history (
      id INT AUTO_INCREMENT PRIMARY KEY,
      driver_id INT NOT NULL,
      order_id INT DEFAULT NULL,
      latitude DECIMAL(10,8) NOT NULL,
      longitude DECIMAL(11,8) NOT NULL,
      recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS audit_trail (
      id INT AUTO_INCREMENT PRIMARY KEY,
      actor_id INT DEFAULT NULL,
      actor_role VARCHAR(50) DEFAULT NULL,
      action VARCHAR(100) NOT NULL,
      entity_type VARCHAR(50) NOT NULL,
      entity_id INT DEFAULT NULL,
      metadata JSON DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`
  ];

  for (const sql of tableCreations) {
    try { await conn.query(sql); } catch (e) {}
  }

  // Tenant Query Optimization Indexes
  console.log('🔄 Ensuring tenant query indexes exist...');
  await addIndexIfNotExists(conn, 'orders', 'idx_orders_tenant_status', '`restaurant_id`, `order_status`, `created_at`');
  await addIndexIfNotExists(conn, 'orders', 'idx_orders_customer_id', '`customer_identity_id`');
  await addIndexIfNotExists(conn, 'orders', 'idx_orders_driver_id', '`driver_id`');
  await addIndexIfNotExists(conn, 'restaurant_orders', 'idx_rest_orders_tenant_status', '`restaurant_id`, `order_status`, `created_at`');
  await addIndexIfNotExists(conn, 'restaurant_tables', 'idx_tables_tenant_status', '`restaurant_id`, `status`');
  await addIndexIfNotExists(conn, 'kots', 'idx_kots_tenant_status', '`restaurant_id`, `status`');
  await addIndexIfNotExists(conn, 'menu_items', 'idx_menu_tenant_active', '`restaurant_id`, `is_active`');
  await addIndexIfNotExists(conn, 'categories', 'idx_cat_tenant_active', '`restaurant_id`, `is_active`');
  await addIndexIfNotExists(conn, 'rider_applications', 'idx_rider_app_tenant_status', '`restaurant_id`, `application_status`');

  console.log('✅ Phase 1 + Phase 2 migrations applied.');
}

async function ensureRestaurantAdmins(conn) {
  try {
    const [restaurants] = await conn.query('SELECT id, admin_user_id FROM restaurants WHERE admin_user_id IS NOT NULL');
    for (const rest of restaurants) {
      const [existing] = await conn.query(
        'SELECT id FROM restaurant_admins WHERE user_id = ? AND restaurant_id = ?',
        [rest.admin_user_id, rest.id]
      );
      if (existing.length === 0) {
        await conn.query(
          'INSERT INTO restaurant_admins (user_id, restaurant_id, is_primary) VALUES (?, ?, 1)',
          [rest.admin_user_id, rest.id]
        );
      }
    }
  } catch (e) {}
}

async function ensureEssentialStaffUsers(conn) {
  try {
    const chefHash = await bcrypt.hash('123456789', 10);

    // 1. Chef User
    const [chefRows] = await conn.query('SELECT id FROM users WHERE email = ?', ['chef@hotel.com']);
    let chefId;
    if (chefRows.length === 0) {
      const [res] = await conn.query(
        `INSERT INTO users (name, email, password_hash, plain_password, phone, role, status) VALUES (?, ?, ?, ?, ?, 'KITCHEN', 'ACTIVE')`,
        ['Head Chef Sanjeev', 'chef@hotel.com', chefHash, '123456789', '+91 9876500001']
      );
      chefId = res.insertId;
      console.log('✅ Created Chef user: chef@hotel.com (Password: 123456789)');
    } else {
      chefId = chefRows[0].id;
      await conn.query(
        `UPDATE users SET password_hash = ?, plain_password = '123456789', role = 'KITCHEN', status = 'ACTIVE' WHERE id = ?`,
        [chefHash, chefId]
      );
      console.log('✅ Updated Chef credentials: chef@hotel.com (Password: 123456789)');
    }

    // 2. Waiter User
    const [waiterRows] = await conn.query('SELECT id FROM users WHERE email = ?', ['waiter@hotel.com']);
    let waiterId;
    if (waiterRows.length === 0) {
      const [res] = await conn.query(
        `INSERT INTO users (name, email, password_hash, plain_password, phone, role, status) VALUES (?, ?, ?, ?, ?, 'WAITER', 'ACTIVE')`,
        ['Service Staff Ramesh', 'waiter@hotel.com', chefHash, '123456789', '+91 9876500002']
      );
      waiterId = res.insertId;
      console.log('✅ Created Waiter user: waiter@hotel.com (Password: 123456789)');
    } else {
      waiterId = waiterRows[0].id;
      await conn.query(
        `UPDATE users SET password_hash = ?, plain_password = '123456789', role = 'WAITER', status = 'ACTIVE' WHERE id = ?`,
        [chefHash, waiterId]
      );
      console.log('✅ Updated Waiter credentials: waiter@hotel.com (Password: 123456789)');
    }

    // Ensure restaurant 1 link
    await conn.query('INSERT IGNORE INTO restaurant_admins (user_id, restaurant_id, is_primary) VALUES (?, 1, 0)', [chefId]);
    await conn.query('INSERT IGNORE INTO restaurant_admins (user_id, restaurant_id, is_primary) VALUES (?, 1, 0)', [waiterId]);
  } catch (e) {
    console.warn('ensureEssentialStaffUsers warning:', e.message);
  }
}

async function getOrCreateUser(conn, name, email, password, phone, role) {
  const [rows] = await conn.query('SELECT id FROM users WHERE email = ?', [email]);
  if (rows.length > 0) return rows[0].id;
  const hash = await bcrypt.hash(password, 10);
  const [res] = await conn.query(
    `INSERT INTO users (name, email, password_hash, plain_password, phone, role, status) VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE')`,
    [name, email, hash, password, phone, role]
  );
  return res.insertId;
}

async function seedData(conn) {
  const admin1Id = await getOrCreateUser(conn, 'Grand Palace Admin', 'admin@hotel.com', 'admin123', '+91 9876543210', 'RESTAURANT_ADMIN');
  const customerId = await getOrCreateUser(conn, 'Rahul Sharma', 'customer@hotel.com', 'customer123', '+91 9812345678', 'CUSTOMER');
  const driver1UserId = await getOrCreateUser(conn, 'Vikram Singh (Rider)', 'driver1@hotel.com', 'driver123', '+91 9988776655', 'DRIVER');
  const driver2UserId = await getOrCreateUser(conn, 'Amit Kumar (Rider)', 'driver2@hotel.com', 'driver123', '+91 9988776644', 'DRIVER');
  const chef1UserId = await getOrCreateUser(conn, 'Head Chef Sanjeev', 'chef@hotel.com', 'chef123', '+91 9876500001', 'KITCHEN');
  const waiter1UserId = await getOrCreateUser(conn, 'Service Staff Ramesh', 'waiter@hotel.com', 'waiter123', '+91 9876500002', 'WAITER');

  let restaurant1Id;
  const [restRows] = await conn.query('SELECT id FROM restaurants WHERE slug = "grand-palace"');
  if (restRows.length > 0) {
    restaurant1Id = restRows[0].id;
  } else {
    const [restRes] = await conn.query(
      `INSERT INTO restaurants (
        name, slug, admin_user_id, logo_url, cover_url, phone, email, address,
        description, tagline, about, area, city, state, postal_code,
        latitude, longitude, opening_time, closing_time, delivery_radius_km, min_order_amount,
        delivery_fee, tax_percentage, currency, status, website_status,
        is_online_ordering_enabled, is_cod_enabled, is_online_payment_enabled, accepts_rider_applications, setup_completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW())`,
      [
        'The Grand Palace Restaurant & Dining',
        'grand-palace',
        admin1Id,
        'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=300&q=80',
        'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80',
        '+91 80 2345 6789',
        'dining@grandpalace.com',
        'No. 42, M.G. Road, Near Brigade Junction, Central Bengaluru, Karnataka 560001',
        'Experience the finest Indian cuisine at The Grand Palace.',
        'Where Every Meal is a Royal Experience',
        'The Grand Palace Restaurant has been serving authentic Indian cuisine since 2018.',
        'M.G. Road', 'Bengaluru', 'Karnataka', '560001',
        12.97160000, 77.59460000,
        '10:00', '23:30',
        10.00, 199.00, 49.00, 5.00, 'INR',
        'ACTIVE', 'PUBLISHED', 1, 1, 1
      ]
    );
    restaurant1Id = restRes.insertId;
  }

  try {
    await conn.query(
      'INSERT IGNORE INTO restaurant_admins (user_id, restaurant_id, is_primary) VALUES (?, ?, 1)',
      [admin1Id, restaurant1Id]
    );
  } catch (e) {}

  let driver1Id;
  const [d1Rows] = await conn.query('SELECT id FROM delivery_drivers WHERE user_id = ?', [driver1UserId]);
  if (d1Rows.length > 0) {
    driver1Id = d1Rows[0].id;
  } else {
    const [d1Res] = await conn.query(
      `INSERT INTO delivery_drivers (user_id, full_name, mobile, email, vehicle_type, vehicle_number, license_number, is_active, account_status, availability_status, current_latitude, current_longitude) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'ACTIVE', 'AVAILABLE', 12.97500000, 77.59800000)`,
      [driver1UserId, 'Vikram Singh (Rider)', '+91 9988776655', 'driver1@hotel.com', 'Bike', 'KA-01-EQ-4589', 'DL-KA-2022-0941']
    );
    driver1Id = d1Res.insertId;
  }

  // Ensure driver assignment
  await conn.query(
    `INSERT IGNORE INTO driver_restaurant_assignments (driver_id, restaurant_id, status) VALUES (?, ?, 'ACTIVE')`,
    [driver1Id, restaurant1Id]
  );

  // Seed KOT offline restaurant & hotel room data
  await seedKOTData(conn);
}

async function seedKOTData(conn) {
  console.log('🍽️ Ensuring KOT tables, kitchen departments, and room folios exist...');
  const crypto = require('crypto');

  // 1. Roles
  const roles = [
    ['ADMIN', 'System Administrator'],
    ['MANAGER', 'Restaurant Manager'],
    ['WAITER', 'Service Staff / Waiter'],
    ['KITCHEN', 'Chef / Kitchen Staff'],
    ['CASHIER', 'Billing Cashier'],
    ['INVENTORY_MANAGER', 'Inventory Manager']
  ];
  for (const [name, desc] of roles) {
    try {
      await conn.query(
        `INSERT INTO roles (name, description) VALUES (?, ?) ON DUPLICATE KEY UPDATE description = VALUES(description)`,
        [name, desc]
      );
    } catch (e) {}
  }

  // 2. Kitchen Departments
  const kitchenDepts = [
    ['Indian Kitchen', 'INDIAN', 'Main course Indian curry and tandoor items'],
    ['Chinese Kitchen', 'CHINESE', 'Wok noodles, rice, and dim sums'],
    ['Bakery & Dessert', 'BAKERY', 'Pastries, cakes, and sweet dishes'],
    ['Beverage Bar', 'BEVERAGE', 'Hot & cold drinks, juices, mocktails']
  ];
  for (const [name, code, desc] of kitchenDepts) {
    try {
      await conn.query(
        `INSERT INTO kitchen_departments (name, code, description) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE description = VALUES(description)`,
        [name, code, desc]
      );
    } catch (e) {}
  }

  // 3. Menu Categories (KOT)
  const categories = [
    ['Starters', 1],
    ['Soups & Salads', 2],
    ['Main Course Indian', 3],
    ['Chinese Specialties', 4],
    ['Breads & Rice', 5],
    ['Beverages', 6],
    ['Desserts', 7]
  ];
  for (const [catName, order] of categories) {
    try {
      await conn.query(
        `INSERT INTO menu_categories (name, display_order) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE display_order = VALUES(display_order)`,
        [catName, order]
      );
    } catch (e) {}
  }

  // 4. Restaurant Tables
  const [tableCount] = await conn.query('SELECT COUNT(*) as count FROM restaurant_tables');
  if (tableCount[0].count === 0) {
    const tablesData = [
      ['T01', 'Table 1', 'Main Dining', 'Section A', 2, 'STANDARD'],
      ['T02', 'Table 2', 'Main Dining', 'Section A', 4, 'STANDARD'],
      ['T03', 'Table 3', 'Main Dining', 'Section B', 4, 'BOOTH'],
      ['T04', 'Table 4', 'Terrace Floor', 'Outdoor', 6, 'OUTDOOR'],
      ['T05', 'Table 5 (VIP)', 'VIP Lounge', 'VIP Area', 8, 'VIP']
    ];
    for (const [tNum, tName, floor, section, capacity, type] of tablesData) {
      const qrToken = crypto.randomBytes(32).toString('hex');
      const [tableRes] = await conn.query(
        `INSERT INTO restaurant_tables (table_number, table_name, floor, section, capacity, table_type, qr_token, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'AVAILABLE')
         ON DUPLICATE KEY UPDATE table_name = VALUES(table_name), capacity = VALUES(capacity)`,
        [tNum, tName, floor, section, capacity, type, qrToken]
      );
      const tableId = tableRes.insertId;
      if (tableId) {
        await conn.query(
          `INSERT INTO table_qr_codes (table_id, qr_token, status) VALUES (?, ?, 'ACTIVE')`,
          [tableId, qrToken]
        );
      }
    }
  }

  // 5. Hotel Rooms & Room Folios
  const rooms = [
    ['101', '1st Floor', 'Deluxe Room', 'OCCUPIED', 'Mr. Robert Downey'],
    ['102', '1st Floor', 'Executive Suite', 'OCCUPIED', 'Ms. Emma Watson'],
    ['201', '2nd Floor', 'Deluxe Room', 'VACANT', 'Unassigned']
  ];
  for (const [rNum, floor, type, status, guest] of rooms) {
    const [roomRes] = await conn.query(
      `INSERT INTO rooms (room_number, floor, room_type, status) VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE status = VALUES(status)`,
      [rNum, floor, type, status]
    );
    const roomId = roomRes.insertId || (await conn.query(`SELECT id FROM rooms WHERE room_number = ?`, [rNum]))[0][0]?.id;
    if (roomId && status === 'OCCUPIED') {
      const [existingFolio] = await conn.query('SELECT id FROM room_folios WHERE room_id = ? AND folio_status = "OPEN"', [roomId]);
      if (existingFolio.length === 0) {
        await conn.query(
          `INSERT INTO room_folios (room_id, guest_name, folio_status, balance) VALUES (?, ?, 'OPEN', 0.00)`,
          [roomId, guest]
        );
      }
    }
  }

  // 6. Inventory Categories & Items
  const [invCatRes] = await conn.query(
    `INSERT INTO inventory_categories (name) VALUES ('Raw Ingredients') ON DUPLICATE KEY UPDATE name=name`
  );
  const invCatId = invCatRes.insertId || 1;

  const inventoryItems = [
    [invCatId, 'Basmati Rice', 'kg', 100.000, 10.000, 120.00],
    [invCatId, 'Fresh Chicken', 'kg', 50.000, 5.000, 240.00],
    [invCatId, 'Cooking Oil', 'l', 40.000, 8.000, 150.00],
    [invCatId, 'Indian Spices Mix', 'g', 5000.000, 500.000, 0.80],
    [invCatId, 'Fresh Lemons', 'pcs', 100.000, 20.000, 5.00],
    [invCatId, 'Fresh Milk', 'l', 30.000, 5.000, 60.00]
  ];
  for (const [cId, name, unit, stock, alertVal, cost] of inventoryItems) {
    const [existing] = await conn.query(`SELECT id FROM inventory_items WHERE item_name = ? LIMIT 1`, [name]);
    if (existing.length === 0) {
      await conn.query(
        `INSERT INTO inventory_items (category_id, item_name, unit, current_stock, min_stock_alert, unit_cost)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [cId, name, unit, stock, alertVal, cost]
      );
    }
  }

  try {
    const { seedIntelligence } = require('./seedIntelligence');
    await seedIntelligence();
  } catch (e) {
    console.warn('Intelligence seed warning:', e.message);
  }

  try {
    const { seedHistoricalOrders } = require('./seedHistoricalOrders');
    await seedHistoricalOrders();
  } catch (e) {
    console.warn('Historical orders seed warning:', e.message);
  }

  console.log('✅ KOT seed data verified.');
}

if (require.main === module) {
  initDatabase().then(() => {
    console.log('🎉 Database initialization complete!');
    process.exit(0);
  }).catch(err => {
    console.error('Fatal:', err);
    process.exit(1);
  });
}

module.exports = { initDatabase };
