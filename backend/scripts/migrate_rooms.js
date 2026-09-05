const { query } = require('../config/db');

async function migrate() {
  try {
    await query(`CREATE TABLE IF NOT EXISTS room_bookings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      restaurant_id INT NOT NULL,
      room_id INT DEFAULT NULL,
      room_number VARCHAR(50) DEFAULT NULL,
      room_type VARCHAR(100) DEFAULT NULL,
      price_per_night DECIMAL(10,2) DEFAULT NULL,
      guest_name VARCHAR(100),
      guest_phone VARCHAR(30),
      check_in_date VARCHAR(100) DEFAULT NULL,
      check_out_date VARCHAR(100) DEFAULT NULL,
      notes TEXT,
      status VARCHAR(30) DEFAULT 'PENDING_INQUIRY',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_rest_status (restaurant_id, status)
    )`);
    console.log('room_bookings table created successfully.');
  } catch (err) {
    console.error('Error creating room_bookings:', err);
  } finally {
    process.exit(0);
  }
}

migrate();
