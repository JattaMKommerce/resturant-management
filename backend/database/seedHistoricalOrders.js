const mysql = require('mysql2/promise');
require('dotenv').config();

const dbHost = process.env.DB_HOST || 'localhost';
const dbPort = parseInt(process.env.DB_PORT || '3306');
const dbUser = process.env.DB_USER || 'root';
const dbPassword = process.env.DB_PASSWORD || 'db123';
const dbName = process.env.DB_NAME || 'hotel_db';

async function seedHistoricalOrders() {
  console.log('🌱 Seeding rich historical orders for past dates & channels...');
  let connection;
  try {
    connection = await mysql.createConnection({
      host: dbHost,
      port: dbPort,
      user: dbUser,
      password: dbPassword,
      database: dbName
    });

    console.log('✅ Connected to database.');

    // Fetch restaurant
    const [restaurants] = await connection.query('SELECT id FROM restaurants LIMIT 1');
    const restaurantId = restaurants.length > 0 ? restaurants[0].id : 1;

    // Fetch delivery driver
    const [drivers] = await connection.query('SELECT id FROM delivery_drivers LIMIT 1');
    const driverId = drivers.length > 0 ? drivers[0].id : null;

    // Fetch menu items
    const [menuItems] = await connection.query('SELECT id, name, price FROM menu_items LIMIT 10');
    const defaultItem = menuItems[0] || { id: 1, name: 'Butter Chicken Special', price: 349.00 };
    const secondItem = menuItems[1] || { id: 2, name: 'Garlic Naan Basket', price: 99.00 };
    const thirdItem = menuItems[2] || { id: 3, name: 'Hyderabadi Dum Biryani', price: 299.00 };

    // Fetch tables & rooms
    const [tables] = await connection.query('SELECT id, table_number FROM restaurant_tables LIMIT 5');
    const [rooms] = await connection.query('SELECT id, room_number FROM rooms LIMIT 3');

    const now = new Date();
    const getDateOffset = (daysAgo, hours = 14, mins = 30) => {
      const d = new Date(now);
      d.setDate(d.getDate() - daysAgo);
      d.setHours(hours, mins, 0, 0);
      return d.toISOString().slice(0, 19).replace('T', ' ');
    };

    // ═══════════════════════════════════════════════
    // 1. SEED ONLINE HISTORICAL ORDERS
    // ═══════════════════════════════════════════════
    const onlineOrdersData = [
      // Today
      {
        num: 'ORD-ON-101',
        cust: 'Ananya Roy',
        phone: '+91 9876501122',
        addr: 'Flat 402, Green Glen Layout, Bellandur',
        area: 'Bellandur',
        daysAgo: 0,
        hours: 11,
        subtotal: 747.00,
        tax: 37.35,
        fee: 49.00,
        disc: 50.00,
        total: 783.35,
        payMethod: 'ONLINE',
        payStatus: 'COMPLETED',
        status: 'DELIVERED',
        items: [
          { name: defaultItem.name, price: defaultItem.price, qty: 2 },
          { name: secondItem.name, price: secondItem.price, qty: 1 }
        ]
      },
      // Yesterday (1 day ago)
      {
        num: 'ORD-ON-102',
        cust: 'Karthik Nair',
        phone: '+91 9845123980',
        addr: 'Villa 12, Palm Meadows, Whitefield',
        area: 'Whitefield',
        daysAgo: 1,
        hours: 20,
        subtotal: 598.00,
        tax: 29.90,
        fee: 49.00,
        disc: 0.00,
        total: 676.90,
        payMethod: 'ONLINE',
        payStatus: 'COMPLETED',
        status: 'DELIVERED',
        items: [
          { name: thirdItem.name, price: thirdItem.price, qty: 2 }
        ]
      },
      {
        num: 'ORD-ON-103',
        cust: 'Priya Mukherjee',
        phone: '+91 9711223344',
        addr: 'Tower 3, Prestige Tech Vista, Kadubeesanahalli',
        area: 'Kadubeesanahalli',
        daysAgo: 1,
        hours: 13,
        subtotal: 448.00,
        tax: 22.40,
        fee: 49.00,
        disc: 0.00,
        total: 519.40,
        payMethod: 'COD',
        payStatus: 'COMPLETED',
        status: 'DELIVERED',
        items: [
          { name: defaultItem.name, price: defaultItem.price, qty: 1 },
          { name: secondItem.name, price: secondItem.price, qty: 1 }
        ]
      },
      // 2 Days ago
      {
        num: 'ORD-ON-104',
        cust: 'Suresh Menon',
        phone: '+91 9900112233',
        addr: 'House 88, 4th Cross, Indiranagar',
        area: 'Indiranagar',
        daysAgo: 2,
        hours: 19,
        subtotal: 996.00,
        tax: 49.80,
        fee: 49.00,
        disc: 100.00,
        total: 994.80,
        payMethod: 'ONLINE',
        payStatus: 'COMPLETED',
        status: 'DELIVERED',
        items: [
          { name: thirdItem.name, price: thirdItem.price, qty: 3 },
          { name: secondItem.name, price: secondItem.price, qty: 1 }
        ]
      },
      // 3 Days ago
      {
        num: 'ORD-ON-105',
        cust: 'Deepak Verma',
        phone: '+91 9123456780',
        addr: '702, Silver Oak Towers, Marathahalli',
        area: 'Marathahalli',
        daysAgo: 3,
        hours: 21,
        subtotal: 349.00,
        tax: 17.45,
        fee: 49.00,
        disc: 0.00,
        total: 415.45,
        payMethod: 'COD',
        payStatus: 'COMPLETED',
        status: 'DELIVERED',
        items: [
          { name: defaultItem.name, price: defaultItem.price, qty: 1 }
        ]
      },
      // 5 Days ago
      {
        num: 'ORD-ON-106',
        cust: 'Meera Iyer',
        phone: '+91 9886543210',
        addr: 'Apt 101, Brigade Metropolis, Mahadevapura',
        area: 'Mahadevapura',
        daysAgo: 5,
        hours: 14,
        subtotal: 897.00,
        tax: 44.85,
        fee: 49.00,
        disc: 50.00,
        total: 940.85,
        payMethod: 'ONLINE',
        payStatus: 'COMPLETED',
        status: 'DELIVERED',
        items: [
          { name: thirdItem.name, price: thirdItem.price, qty: 3 }
        ]
      },
      // 7 Days ago (Last Week)
      {
        num: 'ORD-ON-107',
        cust: 'Vikas Gupta',
        phone: '+91 9776655443',
        addr: 'Plot 45, HSR Layout Sector 2',
        area: 'HSR Layout',
        daysAgo: 7,
        hours: 20,
        subtotal: 1200.00,
        tax: 60.00,
        fee: 49.00,
        disc: 150.00,
        total: 1159.00,
        payMethod: 'ONLINE',
        payStatus: 'COMPLETED',
        status: 'DELIVERED',
        items: [
          { name: defaultItem.name, price: defaultItem.price, qty: 2 },
          { name: thirdItem.name, price: thirdItem.price, qty: 1 },
          { name: secondItem.name, price: secondItem.price, qty: 2 }
        ]
      },
      // 14 Days ago
      {
        num: 'ORD-ON-108',
        cust: 'Shweta Kulkarni',
        phone: '+91 9665544332',
        addr: 'B-304, Sobha Quartz, Bellandur',
        area: 'Bellandur',
        daysAgo: 14,
        hours: 19,
        subtotal: 648.00,
        tax: 32.40,
        fee: 49.00,
        disc: 0.00,
        total: 729.40,
        payMethod: 'ONLINE',
        payStatus: 'COMPLETED',
        status: 'DELIVERED',
        items: [
          { name: defaultItem.name, price: defaultItem.price, qty: 1 },
          { name: thirdItem.name, price: thirdItem.price, qty: 1 }
        ]
      }
    ];

    for (const ord of onlineOrdersData) {
      const [existing] = await connection.query('SELECT id FROM orders WHERE order_number = ?', [ord.num]);
      if (existing.length === 0) {
        const createdAt = getDateOffset(ord.daysAgo, ord.hours, 15);
        const [res] = await connection.query(
          `INSERT INTO orders (
            order_number, restaurant_id, customer_name, customer_phone,
            delivery_address, delivery_area, subtotal, tax_amount, delivery_fee,
            discount_amount, total_amount, payment_method, payment_status,
            order_status, assigned_driver_id, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            ord.num, restaurantId, ord.cust, ord.phone,
            ord.addr, ord.area, ord.subtotal, ord.tax, ord.fee,
            ord.disc, ord.total, ord.payMethod, ord.payStatus,
            ord.status, driverId, createdAt, createdAt
          ]
        );
        const orderId = res.insertId;

        for (const itm of ord.items) {
          const itemTotal = itm.price * itm.qty;
          await connection.query(
            `INSERT INTO order_items (order_id, item_name, unit_price, quantity, item_total, created_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [orderId, itm.name, itm.price, itm.qty, itemTotal, createdAt]
          );
        }
      }
    }

    // ═══════════════════════════════════════════════
    // 2. SEED OFFLINE RESTAURANT / DINE-IN ORDERS
    // ═══════════════════════════════════════════════
    const offlineOrdersData = [
      // Today
      {
        num: 'KOT-OFF-201',
        tableId: tables[0]?.id || 1,
        roomId: null,
        cust: 'Walk-in Guest (Table 1)',
        phone: '+91 9888111222',
        orderType: 'DINE_IN',
        daysAgo: 0,
        hours: 12,
        subtotal: 648.00,
        tax: 32.40,
        service: 30.00,
        disc: 0.00,
        total: 710.40,
        payStatus: 'PAID',
        status: 'COMPLETED',
        source: 'QR',
        items: [
          { name: defaultItem.name, price: defaultItem.price, qty: 1 },
          { name: thirdItem.name, price: thirdItem.price, qty: 1 }
        ]
      },
      // Yesterday (1 day ago)
      {
        num: 'KOT-OFF-202',
        tableId: tables[1]?.id || 2,
        roomId: null,
        cust: 'Mr. Rajesh & Family',
        phone: '+91 9777123456',
        orderType: 'DINE_IN',
        daysAgo: 1,
        hours: 19,
        subtotal: 1395.00,
        tax: 69.75,
        service: 50.00,
        disc: 100.00,
        total: 1414.75,
        payStatus: 'PAID',
        status: 'COMPLETED',
        source: 'POS',
        items: [
          { name: defaultItem.name, price: defaultItem.price, qty: 2 },
          { name: thirdItem.name, price: thirdItem.price, qty: 2 },
          { name: secondItem.name, price: secondItem.price, qty: 1 }
        ]
      },
      {
        num: 'KOT-OFF-203',
        tableId: null,
        roomId: rooms[0]?.id || 1,
        cust: 'Mr. Robert Downey (Room 101)',
        phone: '+91 9811223344',
        orderType: 'ROOM_SERVICE',
        daysAgo: 1,
        hours: 21,
        subtotal: 598.00,
        tax: 29.90,
        service: 40.00,
        disc: 0.00,
        total: 667.90,
        payStatus: 'ROOM_CHARGED',
        status: 'COMPLETED',
        source: 'WAITER',
        items: [
          { name: thirdItem.name, price: thirdItem.price, qty: 2 }
        ]
      },
      // 2 Days ago
      {
        num: 'KOT-OFF-204',
        tableId: tables[2]?.id || 3,
        roomId: null,
        cust: 'Ms. Sneha Reddy',
        phone: '+91 9988112233',
        orderType: 'DINE_IN',
        daysAgo: 2,
        hours: 13,
        subtotal: 448.00,
        tax: 22.40,
        service: 20.00,
        disc: 0.00,
        total: 490.40,
        payStatus: 'PAID',
        status: 'COMPLETED',
        source: 'QR',
        items: [
          { name: defaultItem.name, price: defaultItem.price, qty: 1 },
          { name: secondItem.name, price: secondItem.price, qty: 1 }
        ]
      },
      // 3 Days ago
      {
        num: 'KOT-OFF-205',
        tableId: null,
        roomId: rooms[1]?.id || 2,
        cust: 'Ms. Emma Watson (Suite 102)',
        phone: '+91 9911223344',
        orderType: 'ROOM_SERVICE',
        daysAgo: 3,
        hours: 20,
        subtotal: 897.00,
        tax: 44.85,
        service: 50.00,
        disc: 0.00,
        total: 991.85,
        payStatus: 'ROOM_CHARGED',
        status: 'COMPLETED',
        source: 'ADMIN',
        items: [
          { name: thirdItem.name, price: thirdItem.price, qty: 3 }
        ]
      },
      // 6 Days ago
      {
        num: 'KOT-OFF-206',
        tableId: tables[3]?.id || 4,
        roomId: null,
        cust: 'Corporate Dinner Table 4',
        phone: '+91 9845098765',
        orderType: 'DINE_IN',
        daysAgo: 6,
        hours: 21,
        subtotal: 2490.00,
        tax: 124.50,
        service: 100.00,
        disc: 200.00,
        total: 2514.50,
        payStatus: 'PAID',
        status: 'COMPLETED',
        source: 'POS',
        items: [
          { name: defaultItem.name, price: defaultItem.price, qty: 4 },
          { name: thirdItem.name, price: thirdItem.price, qty: 3 },
          { name: secondItem.name, price: secondItem.price, qty: 2 }
        ]
      },
      // 10 Days ago
      {
        num: 'KOT-OFF-207',
        tableId: null,
        roomId: null,
        cust: 'Takeaway Counter Order',
        phone: '+91 9776655112',
        orderType: 'TAKEAWAY',
        daysAgo: 10,
        hours: 18,
        subtotal: 349.00,
        tax: 17.45,
        service: 0.00,
        disc: 0.00,
        total: 366.45,
        payStatus: 'PAID',
        status: 'COMPLETED',
        source: 'POS',
        items: [
          { name: defaultItem.name, price: defaultItem.price, qty: 1 }
        ]
      }
    ];

    for (const ord of offlineOrdersData) {
      const [existing] = await connection.query('SELECT id FROM restaurant_orders WHERE order_number = ?', [ord.num]);
      if (existing.length === 0) {
        const createdAt = getDateOffset(ord.daysAgo, ord.hours, 30);
        const [res] = await connection.query(
          `INSERT INTO restaurant_orders (
            order_number, table_id, room_id, customer_name, customer_phone,
            order_type, order_status, subtotal, discount_amount, tax_amount,
            service_charge, total_amount, payment_status, source, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            ord.num, ord.tableId, ord.roomId, ord.cust, ord.phone,
            ord.orderType, ord.status, ord.subtotal, ord.disc, ord.tax,
            ord.service, ord.total, ord.payStatus, ord.source, createdAt, createdAt
          ]
        );
        const orderId = res.insertId;

        for (const itm of ord.items) {
          const itemTotal = itm.price * itm.qty;
          await connection.query(
            `INSERT INTO order_items (order_id, item_name, unit_price, quantity, item_total, created_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [orderId, itm.name, itm.price, itm.qty, itemTotal, createdAt]
          );
        }
      }
    }

    console.log('✅ Successfully seeded rich historical Online and Offline orders for yesterday and past weeks!');
  } catch (err) {
    console.error('❌ Error seeding historical orders:', err);
  } finally {
    if (connection) await connection.end();
  }
}

if (require.main === module) {
  seedHistoricalOrders().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = { seedHistoricalOrders };
