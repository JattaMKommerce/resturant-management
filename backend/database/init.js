const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const dbHost = process.env.DB_HOST || 'localhost';
const dbPort = parseInt(process.env.DB_PORT || '3306');
const dbUser = process.env.DB_USER || 'root';
const dbPassword = process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : '';
const dbName = process.env.DB_NAME || 'hotel_db';

function isValidUri(uri) {
  if (!uri || typeof uri !== 'string') return false;
  const trimmed = uri.trim();
  if (trimmed.startsWith('mysql://:@') || trimmed === 'mysql://:@:/' || trimmed.length < 12) return false;
  try {
    const parsed = new URL(trimmed);
    return Boolean(parsed.hostname && parsed.hostname.length > 0 && parsed.hostname !== ':');
  } catch (e) {
    return false;
  }
}

async function initDatabase(options = {}) {
  console.log('🔄 Initializing MySQL Database setup...');
  const forceReset = (options === true || options.forceReset || process.argv.includes('--reset')) && process.env.NODE_ENV !== 'production';
  let connection;
  try {
    const rawUri = process.env.DATABASE_URL || process.env.MYSQL_URL;
    const uri = isValidUri(rawUri) ? rawUri.trim() : null;

        if (uri) {
          const isRailwayInternal = uri.includes('railway.internal');
          const isLocalhost = uri.includes('localhost') || uri.includes('127.0.0.1');
          const connConfig = {
            uri,
            multipleStatements: true
          };
          if (process.env.DB_SSL === 'true' && !isRailwayInternal && !isLocalhost) {
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

        // Seed / Ensure menu for all restaurants in database
        const [allRestaurants] = await connection.query('SELECT id FROM restaurants');
        if (allRestaurants.length === 0) {
          await ensureRestaurantMenu(connection, 1);
        } else {
          for (const r of allRestaurants) {
            await ensureRestaurantMenu(connection, r.id);
          }
        }

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
      } catch (e) { }

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

      // Rider Applications columns
      await addColumnIfNotExists(conn, 'rider_applications', 'password_hash', "VARCHAR(255) DEFAULT NULL");
      await addColumnIfNotExists(conn, 'rider_applications', 'plain_password', "VARCHAR(255) DEFAULT NULL");

      try {
        await conn.query(`ALTER TABLE delivery_drivers MODIFY COLUMN vehicle_type VARCHAR(50) NOT NULL DEFAULT 'Bike'`);
        await conn.query(`ALTER TABLE rider_applications MODIFY COLUMN vehicle_type VARCHAR(50) NOT NULL DEFAULT 'Bike'`);
        await conn.query(`ALTER TABLE delivery_drivers MODIFY COLUMN availability_status ENUM('OFFLINE', 'AVAILABLE', 'BUSY') DEFAULT 'OFFLINE'`);
      } catch (e) { }

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
      } catch (e) { }

      // Menu items columns
      await addColumnIfNotExists(conn, 'menu_items', 'kitchen_department_id', "INT DEFAULT NULL");
      await addColumnIfNotExists(conn, 'menu_items', 'tax_percentage', "DECIMAL(5, 2) DEFAULT 5.00");
      await addColumnIfNotExists(conn, 'menu_items', 'is_available_online', "TINYINT(1) DEFAULT 1");
      await addColumnIfNotExists(conn, 'menu_items', 'is_active', "TINYINT(1) DEFAULT 1");

      // KOTs ENUM migration & Online Order FK relaxation
      try {
        await conn.query(`ALTER TABLE kots MODIFY COLUMN order_type ENUM('DINE_IN','ROOM_SERVICE','TAKEAWAY','ONLINE','DELIVERY') DEFAULT 'DINE_IN'`);
      } catch (e) { }
      try {
        await conn.query(`ALTER TABLE kots DROP FOREIGN KEY kots_ibfk_1`);
      } catch (e) { }
      try {
        await conn.query(`ALTER TABLE kot_items DROP FOREIGN KEY kot_items_ibfk_2`);
      } catch (e) { }
      await addColumnIfNotExists(conn, 'kots', 'online_order_id', "INT DEFAULT NULL");
      await addColumnIfNotExists(conn, 'kot_items', 'online_order_item_id', "INT DEFAULT NULL");

      // Order items columns
      await addColumnIfNotExists(conn, 'order_items', 'status', "VARCHAR(30) DEFAULT 'PENDING'");
      await addColumnIfNotExists(conn, 'order_items', 'tax_amount', "DECIMAL(10, 2) DEFAULT 0.00");
      await addColumnIfNotExists(conn, 'order_items', 'kitchen_department_id', "INT DEFAULT NULL");
      await addColumnIfNotExists(conn, 'order_items', 'prep_time_minutes', "INT DEFAULT 15");

      // Phone column length fix for +91 formatting and plain_password
      await addColumnIfNotExists(conn, 'users', 'plain_password', "VARCHAR(255) DEFAULT NULL");
      try {
        await conn.query(`ALTER TABLE users MODIFY COLUMN phone VARCHAR(30) NOT NULL`);
        await conn.query(`ALTER TABLE restaurants MODIFY COLUMN phone VARCHAR(30) DEFAULT NULL`);
      } catch (e) { }

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
        try { await conn.query(sql); } catch (e) { }
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
      } catch (e) { }
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

        // 3. Ensure Driver Accounts are approved and active
        await conn.query(`UPDATE delivery_drivers SET approval_status = 'APPROVED', account_status = 'ACTIVE', is_active = 1`);
        console.log('✅ Approved and activated all delivery drivers');

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
      } catch (e) { }

      let driver1Id;
      const [d1Rows] = await conn.query('SELECT id FROM delivery_drivers WHERE user_id = ?', [driver1UserId]);
      if (d1Rows.length > 0) {
        driver1Id = d1Rows[0].id;
        await conn.query(`UPDATE delivery_drivers SET approval_status = 'APPROVED', account_status = 'ACTIVE' WHERE id = ?`, [driver1Id]);
      } else {
        const [d1Res] = await conn.query(
          `INSERT INTO delivery_drivers (user_id, full_name, mobile, email, vehicle_type, vehicle_number, license_number, is_active, approval_status, account_status, availability_status, current_latitude, current_longitude) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'APPROVED', 'ACTIVE', 'AVAILABLE', 12.97500000, 77.59800000)`,
          [driver1UserId, 'Vikram Singh (Rider)', '+91 9988776655', 'driver1@hotel.com', 'Bike', 'KA-01-EQ-4589', 'DL-KA-2022-0941']
        );
        driver1Id = d1Res.insertId;
      }

      // Ensure all registered drivers have APPROVED status
      await conn.query(`UPDATE delivery_drivers SET approval_status = 'APPROVED', account_status = 'ACTIVE' WHERE approval_status = 'PENDING'`);

      // Ensure driver assignment
      await conn.query(
        `INSERT IGNORE INTO driver_restaurant_assignments (driver_id, restaurant_id, status) VALUES (?, ?, 'ACTIVE')`,
        [driver1Id, restaurant1Id]
      );

      // Seed KOT offline restaurant & hotel room data
      await seedKOTData(conn);
    }

    async function ensureRestaurantMenu(conn, restaurantId = 1) {
      console.log('🍕 Ensuring categories and menu items exist for restaurant', restaurantId);
      const categoriesData = [
        { name: 'Starters', description: 'Delicious appetizers and tandoori sizzlers', display_order: 1, image_url: 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?auto=format&fit=crop&w=400&q=80' },
        { name: 'Main Course Indian', description: 'Rich royal Indian gravies and curries', display_order: 2, image_url: 'https://images.unsplash.com/photo-1589302168068-964664d93dc0?auto=format&fit=crop&w=400&q=80' },
        { name: 'Biryani & Rice', description: 'Aromatic basmati rice cooked with authentic royal spices', display_order: 3, image_url: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=400&q=80' },
        { name: 'Tandoori Breads', description: 'Freshly baked in traditional clay oven', display_order: 4, image_url: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=400&q=80' },
        { name: 'Chinese & Asian', description: 'Wok tossed noodles, fried rice, and starters', display_order: 5, image_url: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=400&q=80' },
        { name: 'Beverages & Mocktails', description: 'Refreshing coolers and authentic Indian drinks', display_order: 6, image_url: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=400&q=80' },
        { name: 'Desserts', description: 'Sweet traditional delicacies and ice creams', display_order: 7, image_url: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=400&q=80' }
      ];

      const catMap = {};
      for (const cat of categoriesData) {
        let [rows] = await conn.query('SELECT id FROM categories WHERE restaurant_id = ? AND name = ?', [restaurantId, cat.name]);
        let catId;
        if (rows.length === 0) {
          const [res] = await conn.query(
            'INSERT INTO categories (restaurant_id, name, description, image_url, display_order, is_active) VALUES (?, ?, ?, ?, ?, 1)',
            [restaurantId, cat.name, cat.description, cat.image_url, cat.display_order]
          );
          catId = res.insertId;
          try {
            await conn.query('INSERT INTO menu_categories (id, name, display_order, is_active) VALUES (?, ?, ?, 1) ON DUPLICATE KEY UPDATE name=VALUES(name)', [catId, cat.name, cat.display_order]);
          } catch (e) { }
        } else {
          catId = rows[0].id;
        }
        catMap[cat.name] = catId;
      }

      const menuItemsData = [
        {
          category: 'Starters',
          name: 'Paneer Tikka Angara',
          description: 'Charcoal grilled cottage cheese cubes marinated in Kashmiri red chili and royal spices.',
          price: 280,
          discounted_price: 250,
          image_url: 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?auto=format&fit=crop&w=600&q=80',
          is_veg: 1,
          prep_time_minutes: 15,
          ingredients: 'Paneer, Mustard Oil, Yogurt, Kashmiri Chili, Spices',
          tags: 'Bestseller, Tandoor, Spicy',
          is_bestseller: 1,
          is_recommended: 1
        },
        {
          category: 'Starters',
          name: 'Murgh Malai Kebab',
          description: 'Succulent chicken tenders marinated with cream cheese, cardamom, and gentle spices.',
          price: 340,
          discounted_price: 310,
          image_url: 'https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?auto=format&fit=crop&w=600&q=80',
          is_veg: 0,
          prep_time_minutes: 20,
          ingredients: 'Chicken Boneless, Cream, Cheese, Green Cardamom, Spices',
          tags: 'Chef Special, Mild, Non-Veg',
          is_bestseller: 1,
          is_recommended: 1
        },
        {
          category: 'Starters',
          name: 'Tandoori Mushroom Galouti',
          description: 'Melt-in-mouth smoked button mushrooms stuffed with spiced cottage cheese and herbs.',
          price: 260,
          discounted_price: 230,
          image_url: 'https://images.unsplash.com/photo-1628294895950-9805252327bc?auto=format&fit=crop&w=600&q=80',
          is_veg: 1,
          prep_time_minutes: 15,
          ingredients: 'Button Mushrooms, Cottage Cheese, Herbs, Spices',
          tags: 'Vegetarian, Starter',
          is_bestseller: 0,
          is_recommended: 1
        },
        {
          category: 'Main Course Indian',
          name: 'Old Delhi Butter Chicken',
          description: 'Tandoori roasted chicken slow-cooked in a silky, rich tomato and creamy cashew gravy.',
          price: 380,
          discounted_price: 350,
          image_url: 'https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?auto=format&fit=crop&w=600&q=80',
          is_veg: 0,
          prep_time_minutes: 25,
          ingredients: 'Chicken, Tomatoes, Fresh Cream, Butter, Cashews, Kasturi Methi',
          tags: 'Bestseller, Royal, Classic',
          is_bestseller: 1,
          is_recommended: 1
        },
        {
          category: 'Main Course Indian',
          name: 'Paneer Butter Masala',
          description: 'Fresh paneer cubes simmered in a luscious butter tomato gravy with hint of sweet fenugreek.',
          price: 290,
          discounted_price: 260,
          image_url: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=600&q=80',
          is_veg: 1,
          prep_time_minutes: 20,
          ingredients: 'Paneer, Butter, Tomatoes, Cream, Garam Masala',
          tags: 'Popular, Vegetarian, Rich',
          is_bestseller: 1,
          is_recommended: 1
        },
        {
          category: 'Main Course Indian',
          name: 'Dal Makhani Royal',
          description: 'Black lentils slow cooked overnight on charcoal embers with fresh cream and butter.',
          price: 240,
          discounted_price: 210,
          image_url: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=600&q=80',
          is_veg: 1,
          prep_time_minutes: 15,
          ingredients: 'Black Urad Dal, Kidney Beans, Butter, Cream, Spices',
          tags: 'Classic, Creamy, Vegetarian',
          is_bestseller: 1,
          is_recommended: 0
        },
        {
          category: 'Biryani & Rice',
          name: 'Hyderabadi Dum Chicken Biryani',
          description: 'Long-grain fragrant basmati rice layered with spiced chicken, caramelized onions, and saffron.',
          price: 320,
          discounted_price: 290,
          image_url: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=600&q=80',
          is_veg: 0,
          prep_time_minutes: 25,
          ingredients: 'Basmati Rice, Marinated Chicken, Saffron, Fried Onions, Ghee',
          tags: 'Must Try, Hyderabadi, Authentic',
          is_bestseller: 1,
          is_recommended: 1
        },
        {
          category: 'Biryani & Rice',
          name: 'Royal Veg Dum Biryani',
          description: 'Fragrant basmati rice layered with fresh garden vegetables, paneer cubes, mint, and pure ghee.',
          price: 240,
          discounted_price: 210,
          image_url: 'https://images.unsplash.com/photo-1642821373181-696a54913e93?auto=format&fit=crop&w=600&q=80',
          is_veg: 1,
          prep_time_minutes: 20,
          ingredients: 'Basmati Rice, Vegetables, Paneer, Mint, Saffron',
          tags: 'Vegetarian, Saffron, Dum',
          is_bestseller: 0,
          is_recommended: 1
        },
        {
          category: 'Tandoori Breads',
          name: 'Butter Garlic Naan',
          description: 'Crispy clay oven bread topped with minced garlic and brushed with aromatic melted butter.',
          price: 60,
          discounted_price: null,
          image_url: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=600&q=80',
          is_veg: 1,
          prep_time_minutes: 8,
          ingredients: 'Wheat Flour, Garlic, Butter, Coriander',
          tags: 'Tandoor, Bread',
          is_bestseller: 1,
          is_recommended: 1
        },
        {
          category: 'Chinese & Asian',
          name: 'Chilli Chicken Gravy',
          description: 'Crisp chicken chunks tossed with bell peppers, onions, soy sauce, and fiery green chilies.',
          price: 310,
          discounted_price: 280,
          image_url: 'https://images.unsplash.com/photo-1525755662778-989d0524087e?auto=format&fit=crop&w=600&q=80',
          is_veg: 0,
          prep_time_minutes: 18,
          ingredients: 'Chicken, Capsicum, Onion, Soy Sauce, Green Chili',
          tags: 'Indo-Chinese, Spicy',
          is_bestseller: 1,
          is_recommended: 0
        },
        {
          category: 'Chinese & Asian',
          name: 'Hakka Veg Noodles',
          description: 'Wok tossed noodles loaded with crunchy julienned veggies, scallions, and Asian seasonings.',
          price: 190,
          discounted_price: 170,
          image_url: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=600&q=80',
          is_veg: 1,
          prep_time_minutes: 15,
          ingredients: 'Noodles, Cabbage, Bell Peppers, Carrots, Soy Sauce',
          tags: 'Kids Friendly, Indo-Chinese',
          is_bestseller: 0,
          is_recommended: 1
        },
        {
          category: 'Beverages & Mocktails',
          name: 'Virgin Mint Mojito',
          description: 'Sparkling cooler with muddled fresh garden mint, lime wedges, and brown sugar crystals.',
          price: 140,
          discounted_price: 120,
          image_url: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80',
          is_veg: 1,
          prep_time_minutes: 5,
          ingredients: 'Fresh Mint, Lime, Soda, Sugar, Ice',
          tags: 'Refreshing, Cold, Mocktail',
          is_bestseller: 1,
          is_recommended: 1
        },
        {
          category: 'Beverages & Mocktails',
          name: 'Fresh Lime Soda (Sweet & Salt)',
          description: 'Crisp club soda with freshly squeezed lime juice, rock salt, and sugar syrup.',
          price: 80,
          discounted_price: null,
          image_url: 'https://images.unsplash.com/photo-1534353473418-4cfa6c56fd38?auto=format&fit=crop&w=600&q=80',
          is_veg: 1,
          prep_time_minutes: 5,
          ingredients: 'Fresh Lime, Soda, Rock Salt, Sugar',
          tags: 'Classic, Beverage',
          is_bestseller: 0,
          is_recommended: 0
        },
        {
          category: 'Desserts',
          name: 'Royal Gulab Jamun (2 Pcs)',
          description: 'Deep-fried golden milk solids steeped in warm cardamom and rose petal infused sugar syrup.',
          price: 120,
          discounted_price: 99,
          image_url: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=600&q=80',
          is_veg: 1,
          prep_time_minutes: 5,
          ingredients: 'Khoya, Rose Water, Cardamom, Sugar Syrup, Pistachio',
          tags: 'Dessert, Sweet, Hot',
          is_bestseller: 1,
          is_recommended: 1
        }
      ];

      for (const item of menuItemsData) {
        const catId = catMap[item.category];
        if (!catId) continue;
        const [existing] = await conn.query(
          'SELECT id FROM menu_items WHERE restaurant_id = ? AND name = ?',
          [restaurantId, item.name]
        );
        if (existing.length === 0) {
          await conn.query(
            `INSERT INTO menu_items (
          restaurant_id, category_id, name, description, price, discounted_price,
          image_url, is_veg, prep_time_minutes, ingredients, tags,
          is_bestseller, is_recommended, is_available, display_order, is_active, is_available_online
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, 1, 1)`,
            [
              restaurantId, catId, item.name, item.description, item.price, item.discounted_price,
              item.image_url, item.is_veg, item.prep_time_minutes, item.ingredients, item.tags,
              item.is_bestseller, item.is_recommended
            ]
          );
        }
      }
      console.log('✅ Categories and menu items seeded successfully!');
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
        } catch (e) { }
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
        } catch (e) { }
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
        } catch (e) { }
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
        await seedHistoricalOrders(conn);
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
