-- Database Schema for Hotel Restaurant Online Ordering & Delivery System
-- Phase 1 + Phase 2: Multi-Restaurant Platform with Delivery Rider System

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  plain_password VARCHAR(255) DEFAULT NULL,
  phone VARCHAR(20) NOT NULL,
  role ENUM('CUSTOMER', 'ADMIN', 'RESTAURANT_ADMIN', 'DRIVER', 'SUPER_ADMIN', 'WAITER', 'KITCHEN', 'CHEF', 'MANAGER') NOT NULL DEFAULT 'CUSTOMER',
  status ENUM('ACTIVE', 'INACTIVE', 'DISABLED') NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 2. Restaurants Table
CREATE TABLE IF NOT EXISTS restaurants (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  logo_url VARCHAR(500) DEFAULT NULL,
  cover_url VARCHAR(500) DEFAULT NULL,
  phone VARCHAR(20) DEFAULT NULL,
  email VARCHAR(150) DEFAULT NULL,
  description TEXT DEFAULT NULL,
  tagline VARCHAR(255) DEFAULT NULL,
  about TEXT DEFAULT NULL,
  address TEXT DEFAULT NULL,
  area VARCHAR(100) DEFAULT NULL,
  city VARCHAR(100) DEFAULT NULL,
  state VARCHAR(100) DEFAULT NULL,
  postal_code VARCHAR(20) DEFAULT NULL,
  latitude DECIMAL(10, 8) DEFAULT NULL,
  longitude DECIMAL(11, 8) DEFAULT NULL,
  opening_time VARCHAR(20) DEFAULT '10:00',
  closing_time VARCHAR(20) DEFAULT '23:00',
  delivery_radius_km DECIMAL(5, 2) NOT NULL DEFAULT 10.00,
  min_order_amount DECIMAL(10, 2) NOT NULL DEFAULT 199.00,
  delivery_fee DECIMAL(10, 2) NOT NULL DEFAULT 49.00,
  tax_percentage DECIMAL(5, 2) NOT NULL DEFAULT 5.00,
  currency VARCHAR(10) NOT NULL DEFAULT 'INR',
  status ENUM('PENDING', 'ACTIVE', 'SUSPENDED') NOT NULL DEFAULT 'PENDING',
  website_status ENUM('DRAFT', 'PUBLISHED', 'UNPUBLISHED') NOT NULL DEFAULT 'DRAFT',
  is_online_ordering_enabled TINYINT(1) NOT NULL DEFAULT 0,
  is_cod_enabled TINYINT(1) NOT NULL DEFAULT 1,
  is_online_payment_enabled TINYINT(1) NOT NULL DEFAULT 1,
  accepts_rider_applications TINYINT(1) NOT NULL DEFAULT 1,
  setup_completed_at TIMESTAMP NULL DEFAULT NULL,
  admin_user_id INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 3. Restaurant Admins Junction Table
CREATE TABLE IF NOT EXISTS restaurant_admins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  restaurant_id INT NOT NULL,
  is_primary TINYINT(1) DEFAULT 0,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_restaurant (user_id, restaurant_id)
);

-- 4. Restaurant Images Table
CREATE TABLE IF NOT EXISTS restaurant_images (
  id INT AUTO_INCREMENT PRIMARY KEY,
  restaurant_id INT NOT NULL,
  image_url VARCHAR(500) NOT NULL,
  image_type ENUM('GALLERY', 'LOGO', 'COVER', 'MENU') DEFAULT 'GALLERY',
  display_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
);

-- 5. Categories Table
CREATE TABLE IF NOT EXISTS categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  restaurant_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT DEFAULT NULL,
  image_url VARCHAR(500) DEFAULT NULL,
  display_order INT DEFAULT 0,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
);

-- 6. Menu Items Table
CREATE TABLE IF NOT EXISTS menu_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  restaurant_id INT NOT NULL,
  category_id INT NOT NULL,
  name VARCHAR(150) NOT NULL,
  description TEXT DEFAULT NULL,
  price DECIMAL(10, 2) NOT NULL,
  discounted_price DECIMAL(10, 2) DEFAULT NULL,
  image_url VARCHAR(500) DEFAULT NULL,
  is_veg TINYINT(1) DEFAULT 1,
  prep_time_minutes INT DEFAULT 15,
  batch_capacity INT DEFAULT 10,
  ingredients TEXT DEFAULT NULL,
  tags VARCHAR(255) DEFAULT NULL,
  is_bestseller TINYINT(1) DEFAULT 0,
  is_recommended TINYINT(1) DEFAULT 0,
  is_available TINYINT(1) DEFAULT 1,
  display_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

-- 7. Customer Identities Table (Guest Cookie Identity)
CREATE TABLE IF NOT EXISTS customer_identities (
  id INT AUTO_INCREMENT PRIMARY KEY,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  customer_name VARCHAR(100) DEFAULT NULL,
  customer_phone VARCHAR(20) DEFAULT NULL,
  last_restaurant_id INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 8. Delivery Drivers Table (Phase 2  expanded)
CREATE TABLE IF NOT EXISTS delivery_drivers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  full_name VARCHAR(150) NOT NULL,
  mobile VARCHAR(20) NOT NULL,
  email VARCHAR(150) DEFAULT NULL,
  date_of_birth DATE DEFAULT NULL,
  home_city VARCHAR(100) DEFAULT NULL,
  current_city VARCHAR(100) DEFAULT NULL,
  current_address TEXT DEFAULT NULL,
  emergency_contact VARCHAR(20) DEFAULT NULL,
  vehicle_type ENUM('Bike', 'Scooter', 'Cycle', 'EV', 'Other') NOT NULL DEFAULT 'Bike',
  vehicle_number VARCHAR(30) NOT NULL,
  license_number VARCHAR(50) DEFAULT NULL,
  selfie_path VARCHAR(500) DEFAULT NULL,
  account_status ENUM('ACTIVE', 'SUSPENDED', 'DEACTIVATED') NOT NULL DEFAULT 'ACTIVE',
  availability_status ENUM('OFFLINE', 'AVAILABLE', 'BUSY') DEFAULT 'OFFLINE',
  current_latitude DECIMAL(10, 8) DEFAULT NULL,
  current_longitude DECIMAL(11, 8) DEFAULT NULL,
  last_location_at TIMESTAMP NULL DEFAULT NULL,
  is_active TINYINT(1) DEFAULT 1,
  approval_status ENUM('PENDING', 'APPROVED', 'REJECTED') DEFAULT 'PENDING',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 9. Rider Applications Table (Phase 2)
CREATE TABLE IF NOT EXISTS rider_applications (
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
  vehicle_type ENUM('Bike', 'Scooter', 'Cycle', 'EV', 'Other') NOT NULL DEFAULT 'Bike',
  vehicle_number VARCHAR(30) DEFAULT NULL,
  password_hash VARCHAR(255) DEFAULT NULL,
  plain_password VARCHAR(255) DEFAULT NULL,
  application_status ENUM('PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reviewed_by INT DEFAULT NULL,
  reviewed_at TIMESTAMP NULL DEFAULT NULL,
  rejection_reason TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
  FOREIGN KEY (rider_id) REFERENCES delivery_drivers(id) ON DELETE SET NULL,
  FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
);

-- 10. Rider Documents Table (Phase 2)
CREATE TABLE IF NOT EXISTS rider_documents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  application_id INT NOT NULL,
  rider_id INT DEFAULT NULL,
  document_type ENUM('SELFIE', 'AADHAAR_FRONT', 'AADHAAR_BACK', 'DRIVING_LICENSE_FRONT', 'DRIVING_LICENSE_BACK', 'PAN', 'VEHICLE_RC', 'INSURANCE') NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  original_file_name VARCHAR(255) DEFAULT NULL,
  mime_type VARCHAR(100) DEFAULT NULL,
  file_size INT DEFAULT NULL,
  verification_status ENUM('PENDING', 'VERIFIED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
  verified_by INT DEFAULT NULL,
  verified_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (application_id) REFERENCES rider_applications(id) ON DELETE CASCADE,
  FOREIGN KEY (rider_id) REFERENCES delivery_drivers(id) ON DELETE SET NULL,
  FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL
);

-- 11. Driver Restaurant Assignments (Phase 2)
CREATE TABLE IF NOT EXISTS driver_restaurant_assignments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  driver_id INT NOT NULL,
  restaurant_id INT NOT NULL,
  application_id INT DEFAULT NULL,
  status ENUM('ACTIVE', 'SUSPENDED', 'REMOVED') NOT NULL DEFAULT 'ACTIVE',
  approved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  approved_by INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (driver_id) REFERENCES delivery_drivers(id) ON DELETE CASCADE,
  FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
  FOREIGN KEY (application_id) REFERENCES rider_applications(id) ON DELETE SET NULL,
  FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE KEY unique_driver_restaurant (driver_id, restaurant_id)
);

-- 12. Driver Location History (Phase 2 - limited retention for active deliveries)
CREATE TABLE IF NOT EXISTS driver_location_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  driver_id INT NOT NULL,
  order_id INT DEFAULT NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (driver_id) REFERENCES delivery_drivers(id) ON DELETE CASCADE
);

-- 13. Audit Trail (Phase 2)
CREATE TABLE IF NOT EXISTS audit_trail (
  id INT AUTO_INCREMENT PRIMARY KEY,
  actor_id INT DEFAULT NULL,
  actor_role VARCHAR(50) DEFAULT NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id INT DEFAULT NULL,
  metadata JSON DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 14. Orders Table (Phase 2 - extended status)
CREATE TABLE IF NOT EXISTS orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_number VARCHAR(50) NOT NULL UNIQUE,
  restaurant_id INT NOT NULL,
  customer_identity_id INT DEFAULT NULL,
  customer_id INT DEFAULT NULL,
  customer_name VARCHAR(100) NOT NULL,
  customer_phone VARCHAR(20) NOT NULL,
  delivery_address TEXT NOT NULL,
  delivery_area VARCHAR(100) NOT NULL,
  delivery_landmark VARCHAR(150) DEFAULT NULL,
  delivery_instructions TEXT DEFAULT NULL,
  customer_latitude DECIMAL(10, 8) DEFAULT NULL,
  customer_longitude DECIMAL(11, 8) DEFAULT NULL,
  distance_km DECIMAL(6, 2) DEFAULT NULL,
  subtotal DECIMAL(10, 2) NOT NULL,
  tax_amount DECIMAL(10, 2) NOT NULL,
  delivery_fee DECIMAL(10, 2) NOT NULL,
  discount_amount DECIMAL(10, 2) DEFAULT 0.00,
  total_amount DECIMAL(10, 2) NOT NULL,
  payment_method ENUM('COD', 'ONLINE') NOT NULL DEFAULT 'COD',
  payment_status ENUM('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED') NOT NULL DEFAULT 'PENDING',
  order_status ENUM(
    'PENDING',
    'ACCEPTED',
    'SENT_TO_KITCHEN',
    'PREPARING',
    'READY_FOR_PICKUP',
    'ASSIGNED_TO_DRIVER',
    'DRIVER_ACCEPTED',
    'PICKED_UP',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
    'REJECTED',
    'CANCELLED',
    'DELIVERY_FAILED'
  ) NOT NULL DEFAULT 'PENDING',
  assigned_driver_id INT DEFAULT NULL,
  delivery_failure_reason TEXT DEFAULT NULL,
  cod_collected_by INT DEFAULT NULL,
  cod_collected_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (restaurant_id) REFERENCES restaurants(id),
  FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (assigned_driver_id) REFERENCES delivery_drivers(id) ON DELETE SET NULL
);

-- 15. Order Items Table (Price Snapshots & KOT Items)
CREATE TABLE IF NOT EXISTS order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  menu_item_id INT DEFAULT NULL,
  item_name VARCHAR(150) NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  quantity INT NOT NULL,
  item_total DECIMAL(10, 2) NOT NULL,
  special_instructions TEXT DEFAULT NULL,
  tax_amount DECIMAL(10, 2) DEFAULT 0.00,
  kitchen_department_id INT DEFAULT NULL,
  prep_time_minutes INT DEFAULT 15,
  batch_capacity INT DEFAULT 10,
  number_of_batches INT DEFAULT 1,
  estimated_prep_time_minutes INT DEFAULT 15,
  status ENUM('PENDING', 'PREPARING', 'READY', 'SERVED', 'CANCELLED') DEFAULT 'PENDING',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_order_items_order_id (order_id),
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE SET NULL
);

-- 16. Order Status History Table
CREATE TABLE IF NOT EXISTS order_status_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  status VARCHAR(50) NOT NULL,
  notes TEXT DEFAULT NULL,
  changed_by_user_id INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

-- 17. Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT DEFAULT NULL,
  restaurant_id INT DEFAULT NULL,
  order_id INT DEFAULT NULL,
  customer_identity_id INT DEFAULT NULL,
  title VARCHAR(150) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(50) DEFAULT 'ORDER_UPDATE',
  is_read TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

-- 18. Payments Table
CREATE TABLE IF NOT EXISTS payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  payment_method ENUM('COD', 'ONLINE', 'CASH', 'CARD', 'UPI', 'ROOM_CHARGE', 'OTHER') NOT NULL,
  transaction_id VARCHAR(100) DEFAULT NULL,
  razorpay_order_id VARCHAR(100) DEFAULT NULL,
  razorpay_payment_id VARCHAR(100) DEFAULT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  status ENUM('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED') NOT NULL DEFAULT 'PENDING',
  collected_by INT DEFAULT NULL,
  collected_at TIMESTAMP NULL DEFAULT NULL,
  payload_json TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================
-- OFFLINE RESTAURANT & KOT MANAGEMENT SYSTEM TABLES
-- =========================================================================

-- 19. Roles Table (KOT)
CREATE TABLE IF NOT EXISTS roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  description VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 20. Hotel Rooms & Folios (Room Account Billing Integration)
CREATE TABLE IF NOT EXISTS rooms (
  id INT AUTO_INCREMENT PRIMARY KEY,
  room_number VARCHAR(20) NOT NULL UNIQUE,
  floor VARCHAR(20) DEFAULT '1st Floor',
  room_type VARCHAR(50) DEFAULT 'Deluxe',
  status ENUM('VACANT', 'OCCUPIED', 'CLEANING', 'MAINTENANCE') DEFAULT 'OCCUPIED',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS room_folios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  room_id INT NOT NULL,
  guest_name VARCHAR(100) NOT NULL,
  folio_status ENUM('OPEN', 'CLOSED') DEFAULT 'OPEN',
  balance DECIMAL(10, 2) DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 21. Restaurant Tables & QR Codes
CREATE TABLE IF NOT EXISTS restaurant_tables (
  id INT AUTO_INCREMENT PRIMARY KEY,
  table_number VARCHAR(20) NOT NULL UNIQUE,
  table_name VARCHAR(50) NOT NULL,
  floor VARCHAR(50) DEFAULT 'Main Dining',
  section VARCHAR(50) DEFAULT 'General',
  capacity INT DEFAULT 4,
  table_type ENUM('STANDARD', 'BOOTH', 'VIP', 'OUTDOOR') DEFAULT 'STANDARD',
  status ENUM('AVAILABLE', 'OCCUPIED', 'ORDERING', 'RESERVED', 'BILL_REQUESTED', 'BILL_PAID', 'CLEANING', 'OUT_OF_SERVICE') DEFAULT 'AVAILABLE',
  is_active BOOLEAN DEFAULT TRUE,
  qr_token VARCHAR(64) NOT NULL UNIQUE,
  qr_status ENUM('ACTIVE', 'INACTIVE') DEFAULT 'ACTIVE',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_qr_token (qr_token),
  INDEX idx_table_status (status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS table_qr_codes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  table_id INT NOT NULL,
  qr_token VARCHAR(64) NOT NULL,
  status ENUM('ACTIVE', 'INACTIVE') DEFAULT 'ACTIVE',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (table_id) REFERENCES restaurant_tables(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 22. Kitchen Departments
CREATE TABLE IF NOT EXISTS kitchen_departments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  code VARCHAR(20) NOT NULL UNIQUE,
  description VARCHAR(255),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 23. Menu Categories (KOT)
CREATE TABLE IF NOT EXISTS menu_categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 24. Modifiers
CREATE TABLE IF NOT EXISTS modifier_groups (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  is_required BOOLEAN DEFAULT FALSE,
  min_selection INT DEFAULT 0,
  max_selection INT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS modifier_options (
  id INT AUTO_INCREMENT PRIMARY KEY,
  modifier_group_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  price_adjustment DECIMAL(10, 2) DEFAULT 0.00,
  is_available BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (modifier_group_id) REFERENCES modifier_groups(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS menu_item_modifiers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  menu_item_id INT NOT NULL,
  modifier_group_id INT NOT NULL,
  FOREIGN KEY (modifier_group_id) REFERENCES modifier_groups(id) ON DELETE CASCADE,
  UNIQUE KEY unique_item_modifier (menu_item_id, modifier_group_id)
) ENGINE=InnoDB;

-- 25. Offline Restaurant Orders
CREATE TABLE IF NOT EXISTS restaurant_orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_number VARCHAR(30) NOT NULL UNIQUE,
  table_id INT NULL,
  room_id INT NULL,
  customer_name VARCHAR(100) DEFAULT 'Guest',
  customer_phone VARCHAR(20),
  order_type ENUM('DINE_IN', 'ROOM_SERVICE', 'TAKEAWAY') DEFAULT 'DINE_IN',
  order_status ENUM('PENDING', 'CONFIRMED', 'IN_KITCHEN', 'READY', 'SERVED', 'COMPLETED', 'CANCELLED') DEFAULT 'PENDING',
  subtotal DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  discount_amount DECIMAL(10, 2) DEFAULT 0.00,
  tax_amount DECIMAL(10, 2) DEFAULT 0.00,
  service_charge DECIMAL(10, 2) DEFAULT 0.00,
  total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  payment_status ENUM('UNPAID', 'PAID', 'ROOM_CHARGED') DEFAULT 'UNPAID',
  source ENUM('QR', 'POS', 'WAITER', 'ADMIN') DEFAULT 'QR',
  idempotency_key VARCHAR(64) UNIQUE NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (table_id) REFERENCES restaurant_tables(id) ON DELETE SET NULL,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL,
  INDEX idx_order_status (order_status),
  INDEX idx_order_created (created_at)
) ENGINE=InnoDB;

-- 26. Order Item Modifiers
CREATE TABLE IF NOT EXISTS order_item_modifiers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_item_id INT NOT NULL,
  option_name VARCHAR(100) NOT NULL,
  price_adjustment DECIMAL(10, 2) DEFAULT 0.00
) ENGINE=InnoDB;

-- 27. KOTs (Kitchen Order Tickets)
CREATE TABLE IF NOT EXISTS kots (
  id INT AUTO_INCREMENT PRIMARY KEY,
  restaurant_id INT NOT NULL DEFAULT 1,
  kot_number VARCHAR(30) NOT NULL UNIQUE,
  order_id INT NOT NULL,
  table_id INT NULL,
  room_id INT NULL,
  kitchen_department_id INT NOT NULL,
  order_type ENUM('DINE_IN', 'ROOM_SERVICE', 'TAKEAWAY', 'ONLINE', 'DELIVERY') DEFAULT 'DINE_IN',
  status ENUM('PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED', 'CANCELLED') DEFAULT 'PENDING',
  kitchen_received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  target_completion_at TIMESTAMP NULL,
  completed_at TIMESTAMP NULL,
  is_delayed BOOLEAN DEFAULT FALSE,
  delayed_alert_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES restaurant_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (table_id) REFERENCES restaurant_tables(id) ON DELETE SET NULL,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL,
  FOREIGN KEY (kitchen_department_id) REFERENCES kitchen_departments(id),
  INDEX idx_kot_status (status),
  INDEX idx_kot_dept (kitchen_department_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS kot_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  kot_id INT NOT NULL,
  order_item_id INT NOT NULL,
  item_name VARCHAR(100) NOT NULL,
  quantity INT NOT NULL,
  special_instructions TEXT,
  modifiers_json JSON NULL,
  status ENUM('PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED', 'CANCELLED') DEFAULT 'PENDING',
  prep_time_minutes INT DEFAULT 15,
  batch_capacity INT DEFAULT 10,
  number_of_batches INT DEFAULT 1,
  estimated_prep_time_minutes INT DEFAULT 15,
  inventory_deducted BOOLEAN DEFAULT FALSE,
  started_at TIMESTAMP NULL DEFAULT NULL,
  expected_finish_at TIMESTAMP NULL DEFAULT NULL,
  ready_at TIMESTAMP NULL DEFAULT NULL,
  FOREIGN KEY (kot_id) REFERENCES kots(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS kot_status_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  kot_id INT NOT NULL,
  old_status VARCHAR(30),
  new_status VARCHAR(30) NOT NULL,
  changed_by_user_id INT NULL,
  reason VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (kot_id) REFERENCES kots(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 28. Bills (Offline Dining Billing)
CREATE TABLE IF NOT EXISTS bills (
  id INT AUTO_INCREMENT PRIMARY KEY,
  bill_number VARCHAR(30) NOT NULL UNIQUE,
  order_id INT NOT NULL UNIQUE,
  table_id INT NULL,
  room_id INT NULL,
  subtotal DECIMAL(10, 2) NOT NULL,
  discount_amount DECIMAL(10, 2) DEFAULT 0.00,
  tax_amount DECIMAL(10, 2) DEFAULT 0.00,
  service_charge DECIMAL(10, 2) DEFAULT 0.00,
  grand_total DECIMAL(10, 2) NOT NULL,
  payment_status ENUM('UNPAID', 'PAID', 'ROOM_CHARGED') DEFAULT 'UNPAID',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES restaurant_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (table_id) REFERENCES restaurant_tables(id) ON DELETE SET NULL,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 29. Inventory, Recipes & BOM
CREATE TABLE IF NOT EXISTS inventory_categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS inventory_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  category_id INT NOT NULL,
  item_name VARCHAR(100) NOT NULL,
  unit VARCHAR(20) NOT NULL DEFAULT 'kg',
  current_stock DECIMAL(10, 3) DEFAULT 0.000,
  min_stock_alert DECIMAL(10, 3) DEFAULT 5.000,
  unit_cost DECIMAL(10, 2) DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES inventory_categories(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS recipes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  menu_item_id INT NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  recipe_id INT NOT NULL,
  inventory_item_id INT NOT NULL,
  quantity DECIMAL(10, 3) NOT NULL,
  unit VARCHAR(20) NOT NULL,
  wastage_percentage DECIMAL(5, 2) DEFAULT 0.00,
  FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
  FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS suppliers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  contact_person VARCHAR(100),
  phone VARCHAR(20),
  email VARCHAR(100),
  address TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS inventory_batches (
  id INT AUTO_INCREMENT PRIMARY KEY,
  inventory_item_id INT NOT NULL,
  batch_number VARCHAR(50) NOT NULL UNIQUE,
  supplier_id INT NULL,
  supplier_name VARCHAR(100) NULL,
  initial_quantity DECIMAL(10, 3) NOT NULL DEFAULT 0.000,
  current_quantity DECIMAL(10, 3) NOT NULL DEFAULT 0.000,
  unit_price DECIMAL(10, 2) DEFAULT 0.00,
  purchase_date DATE NOT NULL,
  expiry_date DATE NOT NULL,
  notes VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id) ON DELETE CASCADE,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL,
  INDEX idx_batch_expiry (expiry_date),
  INDEX idx_batch_item (inventory_item_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS stock_transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  inventory_item_id INT NOT NULL,
  batch_id INT NULL,
  change_quantity DECIMAL(10, 3) NOT NULL,
  type ENUM('ORDER_DEDUCTION', 'MANUAL_ADJUSTMENT', 'RESTOCK', 'WASTAGE', 'EXPIRED_DISPOSAL') NOT NULL,
  reference_id VARCHAR(100) NOT NULL,
  notes VARCHAR(255),
  reason VARCHAR(50) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id) ON DELETE CASCADE,
  FOREIGN KEY (batch_id) REFERENCES inventory_batches(id) ON DELETE SET NULL,
  UNIQUE KEY unique_stock_ref (inventory_item_id, reference_id)
) ENGINE=InnoDB;

-- 30. Audit Logs (KOT)
CREATE TABLE IF NOT EXISTS audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  action VARCHAR(100) NOT NULL,
  entity VARCHAR(50) NOT NULL,
  entity_id INT NULL,
  metadata_json JSON NULL,
  ip_address VARCHAR(45) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- =========================================================================
-- SAAS SUBSCRIPTION, PAYMENT & ACCESS CONTROL TABLES
-- =========================================================================

-- 31. Subscription Plans
CREATE TABLE IF NOT EXISTS subscription_plans (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  description TEXT DEFAULT NULL,
  price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  duration_days INT NOT NULL DEFAULT 30,
  max_orders_per_month INT DEFAULT NULL,
  max_menu_items INT DEFAULT NULL,
  max_staff_accounts INT DEFAULT NULL,
  features_json JSON NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  display_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 32. Hotel Subscriptions
CREATE TABLE IF NOT EXISTS hotel_subscriptions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  restaurant_id INT NOT NULL,
  plan_id INT NOT NULL,
  subscription_type ENUM('TRIAL', 'PAID') NOT NULL DEFAULT 'PAID',
  status ENUM('PENDING', 'PENDING_APPROVAL', 'ACTIVE', 'EXPIRED', 'SUSPENDED', 'CANCELLED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
  starts_at TIMESTAMP NULL DEFAULT NULL,
  expires_at TIMESTAMP NULL DEFAULT NULL,
  approved_by_user_id INT DEFAULT NULL,
  approved_at TIMESTAMP NULL DEFAULT NULL,
  rejected_by_user_id INT DEFAULT NULL,
  rejected_at TIMESTAMP NULL DEFAULT NULL,
  rejection_reason TEXT DEFAULT NULL,
  auto_renew TINYINT(1) NOT NULL DEFAULT 0,
  notes TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
  FOREIGN KEY (plan_id) REFERENCES subscription_plans(id),
  FOREIGN KEY (approved_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (rejected_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_rest_sub_status (restaurant_id, status),
  INDEX idx_sub_expiry (expires_at)
) ENGINE=InnoDB;

-- 33. Subscription Payments
CREATE TABLE IF NOT EXISTS subscription_payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  subscription_id INT NOT NULL,
  restaurant_id INT NOT NULL,
  plan_id INT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'INR',
  payment_method ENUM('RAZORPAY', 'MANUAL_OFFLINE', 'SUPERADMIN_MANUAL') NOT NULL,
  gateway_order_id VARCHAR(100) DEFAULT NULL,
  gateway_payment_id VARCHAR(100) DEFAULT NULL,
  transaction_reference VARCHAR(150) NOT NULL UNIQUE,
  offline_proof_note TEXT DEFAULT NULL,
  status ENUM('PENDING', 'SUCCESS', 'FAILED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
  verified_at TIMESTAMP NULL DEFAULT NULL,
  verified_by_user_id INT DEFAULT NULL,
  gateway_response_json JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (subscription_id) REFERENCES hotel_subscriptions(id) ON DELETE CASCADE,
  FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
  FOREIGN KEY (plan_id) REFERENCES subscription_plans(id),
  FOREIGN KEY (verified_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_sub_pay_status (status)
) ENGINE=InnoDB;

-- 34. Subscription History & Audit Trail
CREATE TABLE IF NOT EXISTS subscription_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  restaurant_id INT NOT NULL,
  subscription_id INT NULL,
  plan_id INT NOT NULL,
  action ENUM('ASSIGNED', 'PAYMENT_RECEIVED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'RENEWED', 'EXTENDED', 'EXPIRED', 'REACTIVATED', 'SUSPENDED', 'CANCELLED') NOT NULL,
  previous_status VARCHAR(50) DEFAULT NULL,
  new_status VARCHAR(50) NOT NULL,
  starts_at TIMESTAMP NULL DEFAULT NULL,
  expires_at TIMESTAMP NULL DEFAULT NULL,
  actor_user_id INT NULL,
  notes TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
  FOREIGN KEY (plan_id) REFERENCES subscription_plans(id),
  FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

