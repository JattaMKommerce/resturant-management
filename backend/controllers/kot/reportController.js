const pool = require('../../config/database');
const { sendSuccess, sendError } = require('../../utils/response');

async function getDashboardKPIs(req, res, next) {
  try {
    const todayStr = new Date().toISOString().slice(0, 10);

    const [offlineRevRow] = await pool.query(
      `SELECT COALESCE(SUM(total_amount), 0) as revenue, COUNT(*) as orders
       FROM restaurant_orders 
       WHERE (DATE(created_at) = ? OR DATE(created_at) = CURDATE()) AND order_status != 'CANCELLED'`,
      [todayStr]
    );

    const [onlineRevRow] = await pool.query(
      `SELECT COALESCE(SUM(total_amount), 0) as revenue, COUNT(*) as orders
       FROM orders 
       WHERE (DATE(created_at) = ? OR DATE(created_at) = CURDATE()) AND order_status != 'CANCELLED'`,
      [todayStr]
    );

    const todayRevenue = (parseFloat(offlineRevRow[0]?.revenue) || 0) + (parseFloat(onlineRevRow[0]?.revenue) || 0);
    const todayOrders = (parseInt(offlineRevRow[0]?.orders) || 0) + (parseInt(onlineRevRow[0]?.orders) || 0);

    const [kotRow] = await pool.query(
      `SELECT 
         COUNT(*) as active_kots,
         SUM(CASE WHEN status = 'PREPARING' THEN 1 ELSE 0 END) as preparing_kots,
         SUM(CASE WHEN status = 'READY' THEN 1 ELSE 0 END) as ready_kots,
         SUM(CASE WHEN is_delayed = TRUE AND status IN ('PENDING','ACCEPTED','PREPARING') THEN 1 ELSE 0 END) as delayed_kots,
         SUM(CASE WHEN status = 'SERVED' THEN 1 ELSE 0 END) as completed_kots
       FROM kots
       WHERE (DATE(created_at) = ? OR DATE(created_at) = CURDATE())`,
      [todayStr]
    );

    const [prepTimeRow] = await pool.query(
      `SELECT AVG(TIMESTAMPDIFF(MINUTE, kitchen_received_at, completed_at)) as avg_prep_mins
       FROM kots
       WHERE completed_at IS NOT NULL AND (DATE(created_at) = ? OR DATE(created_at) = CURDATE())`,
      [todayStr]
    );

    // Sales Trend (Hourly today) - Combined Offline + Online
    const [salesTrend] = await pool.query(
      `SELECT hour, SUM(revenue) as revenue, SUM(orders) as orders
       FROM (
         SELECT HOUR(created_at) as hour, SUM(total_amount) as revenue, COUNT(*) as orders
         FROM restaurant_orders
         WHERE (DATE(created_at) = ? OR DATE(created_at) = CURDATE()) AND order_status != 'CANCELLED'
         GROUP BY HOUR(created_at)

         UNION ALL

         SELECT HOUR(created_at) as hour, SUM(total_amount) as revenue, COUNT(*) as orders
         FROM orders
         WHERE (DATE(created_at) = ? OR DATE(created_at) = CURDATE()) AND order_status != 'CANCELLED'
         GROUP BY HOUR(created_at)
       ) combined_trend
       GROUP BY hour
       ORDER BY hour ASC`,
      [todayStr, todayStr]
    );

    // Top Selling Items today - Combined Offline + Online
    const [topItems] = await pool.query(
      `SELECT item_name, SUM(qty_sold) as qty_sold, SUM(total_revenue) as total_revenue
       FROM (
         SELECT oi.item_name, SUM(oi.quantity) as qty_sold, SUM(COALESCE(oi.item_total, oi.unit_price * oi.quantity, 0)) as total_revenue
         FROM order_items oi
         JOIN restaurant_orders o ON oi.order_id = o.id
         WHERE (DATE(o.created_at) = ? OR DATE(o.created_at) = CURDATE()) AND o.order_status != 'CANCELLED'
         GROUP BY oi.item_name

         UNION ALL

         SELECT oi.item_name, SUM(oi.quantity) as qty_sold, SUM(COALESCE(oi.item_total, oi.unit_price * oi.quantity, 0)) as total_revenue
         FROM order_items oi
         JOIN orders ord ON oi.order_id = ord.id
         WHERE (DATE(ord.created_at) = ? OR DATE(ord.created_at) = CURDATE()) AND ord.order_status != 'CANCELLED'
         GROUP BY oi.item_name
       ) combined_items
       GROUP BY item_name
       ORDER BY qty_sold DESC
       LIMIT 5`,
      [todayStr, todayStr]
    );

    return sendSuccess(res, {
      today_revenue: todayRevenue,
      today_orders: todayOrders,
      active_kots: parseInt(kotRow[0]?.active_kots || 0),
      preparing_kots: parseInt(kotRow[0]?.preparing_kots || 0),
      ready_kots: parseInt(kotRow[0]?.ready_kots || 0),
      delayed_kots: parseInt(kotRow[0]?.delayed_kots || 0),
      completed_kots: parseInt(kotRow[0]?.completed_kots || 0),
      avg_prep_time_minutes: Math.round(parseFloat(prepTimeRow[0]?.avg_prep_mins) || 12),
      sales_trend: salesTrend || [],
      top_items: topItems || []
    }, 'Dashboard KPIs loaded');
  } catch (err) {
    next(err);
  }
}

async function getSalesReport(req, res, next) {
  try {
    const { startDate, endDate } = req.query;
    let dateFilter = '';
    const params = [];

    if (startDate && endDate) {
      dateFilter = `AND DATE(created_at) BETWEEN ? AND ?`;
      params.push(startDate, endDate, startDate, endDate);
    }

    let query = `
      SELECT date, 
             SUM(total_orders) as total_orders, 
             SUM(net_sales) as net_sales, 
             SUM(total_tax) as total_tax, 
             SUM(total_discount) as total_discount, 
             SUM(total_revenue) as total_revenue,
             ROUND(AVG(avg_order_value), 2) as avg_order_value
      FROM (
        SELECT DATE(created_at) as date, 
               COUNT(*) as total_orders, 
               SUM(subtotal) as net_sales, 
               SUM(tax_amount) as total_tax, 
               SUM(discount_amount) as total_discount, 
               SUM(total_amount) as total_revenue,
               AVG(total_amount) as avg_order_value
        FROM restaurant_orders
        WHERE order_status != 'CANCELLED' ${dateFilter.replace(/created_at/g, 'created_at')}
        GROUP BY DATE(created_at)

        UNION ALL

        SELECT DATE(created_at) as date, 
               COUNT(*) as total_orders, 
               SUM(subtotal) as net_sales, 
               SUM(tax_amount) as total_tax, 
               SUM(discount_amount) as total_discount, 
               SUM(total_amount) as total_revenue,
               AVG(total_amount) as avg_order_value
        FROM orders
        WHERE order_status != 'CANCELLED' ${dateFilter.replace(/created_at/g, 'created_at')}
        GROUP BY DATE(created_at)
      ) combined_sales
      GROUP BY date
      ORDER BY date DESC
    `;

    const [report] = await pool.query(query, params);
    return sendSuccess(res, report, 'Sales report loaded');
  } catch (err) {
    next(err);
  }
}

async function getKOTReport(req, res, next) {
  try {
    const [kots] = await pool.query(
      `SELECT 
         COUNT(*) as total_kots,
         SUM(CASE WHEN status = 'SERVED' THEN 1 ELSE 0 END) as completed_kots,
         SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END) as cancelled_kots,
         SUM(CASE WHEN is_delayed = TRUE THEN 1 ELSE 0 END) as delayed_kots,
         AVG(CASE WHEN completed_at IS NOT NULL THEN TIMESTAMPDIFF(MINUTE, kitchen_received_at, completed_at) ELSE NULL END) as avg_prep_minutes
       FROM kots`
    );

    const data = kots[0] || {};
    const total = parseInt(data.total_kots) || 1;
    const delayed = parseInt(data.delayed_kots) || 0;
    data.on_time_percentage = Math.max(0, Math.round(((total - delayed) / total) * 100));

    return sendSuccess(res, data, 'KOT performance report loaded');
  } catch (err) {
    next(err);
  }
}

async function getMenuReport(req, res, next) {
  try {
    const [topSelling] = await pool.query(
      `SELECT item_name, category_name, SUM(quantity_sold) as quantity_sold, SUM(total_revenue) as total_revenue
       FROM (
         SELECT oi.item_name, COALESCE(c.name, mc.name, 'Main Menu') as category_name, 
                SUM(oi.quantity) as quantity_sold, 
                SUM(COALESCE(oi.item_total, oi.unit_price * oi.quantity, 0)) as total_revenue
         FROM order_items oi
         LEFT JOIN menu_items m ON oi.menu_item_id = m.id
         LEFT JOIN categories c ON m.category_id = c.id
         LEFT JOIN menu_categories mc ON m.category_id = mc.id
         JOIN restaurant_orders o ON oi.order_id = o.id
         WHERE o.order_status != 'CANCELLED'
         GROUP BY oi.item_name, c.name, mc.name

         UNION ALL

         SELECT oi.item_name, COALESCE(c.name, mc.name, 'Online Menu') as category_name, 
                SUM(oi.quantity) as quantity_sold, 
                SUM(COALESCE(oi.item_total, oi.unit_price * oi.quantity, 0)) as total_revenue
         FROM order_items oi
         LEFT JOIN menu_items m ON oi.menu_item_id = m.id
         LEFT JOIN categories c ON m.category_id = c.id
         LEFT JOIN menu_categories mc ON m.category_id = mc.id
         JOIN orders ord ON oi.order_id = ord.id
         WHERE ord.order_status != 'CANCELLED'
         GROUP BY oi.item_name, c.name, mc.name
       ) combined_menu
       GROUP BY item_name, category_name
       ORDER BY quantity_sold DESC, total_revenue DESC`
    );

    return sendSuccess(res, topSelling, 'Menu performance report loaded');
  } catch (err) {
    next(err);
  }
}

async function getExpiryReport(req, res, next) {
  try {
    const { status } = req.query; // 'ALL', 'EXPIRING_7', 'EXPIRING_30', 'EXPIRED'

    let query = `
      SELECT b.*, ii.item_name, ii.unit, c.name as category_name, s.name as supplier_ref_name,
             DATEDIFF(b.expiry_date, CURRENT_DATE()) as days_diff
      FROM inventory_batches b
      JOIN inventory_items ii ON b.inventory_item_id = ii.id
      JOIN inventory_categories c ON ii.category_id = c.id
      LEFT JOIN suppliers s ON b.supplier_id = s.id
      WHERE b.current_quantity > 0
    `;

    if (status === 'EXPIRED') {
      query += ` AND b.expiry_date < CURRENT_DATE()`;
    } else if (status === 'EXPIRING_7') {
      query += ` AND b.expiry_date >= CURRENT_DATE() AND b.expiry_date <= DATE_ADD(CURRENT_DATE(), INTERVAL 7 DAY)`;
    } else if (status === 'EXPIRING_30') {
      query += ` AND b.expiry_date > DATE_ADD(CURRENT_DATE(), INTERVAL 7 DAY) AND b.expiry_date <= DATE_ADD(CURRENT_DATE(), INTERVAL 30 DAY)`;
    }

    query += ` ORDER BY b.expiry_date ASC`;

    const [rows] = await pool.query(query);

    const report = rows.map(b => {
      const daysDiff = parseInt(b.days_diff);
      let expStatus = 'SAFE';
      let daysText = `${daysDiff} days remaining`;

      if (daysDiff < 0) {
        expStatus = 'EXPIRED';
        const absDays = Math.abs(daysDiff);
        daysText = `Expired by ${absDays} day${absDays === 1 ? '' : 's'}`;
      } else if (daysDiff === 0) {
        expStatus = 'EXPIRING_7';
        daysText = 'Expired today';
      } else if (daysDiff <= 7) {
        expStatus = 'EXPIRING_7';
        daysText = `${daysDiff} day${daysDiff === 1 ? '' : 's'} remaining`;
      } else if (daysDiff <= 30) {
        expStatus = 'EXPIRING_30';
        daysText = `${daysDiff} days remaining`;
      }

      const currQty = parseFloat(b.current_quantity);
      const price = parseFloat(b.unit_price);
      const estValue = currQty * price;

      return {
        id: b.id,
        batch_number: b.batch_number,
        item_name: b.item_name,
        category_name: b.category_name,
        supplier: b.supplier_ref_name || b.supplier_name || 'General Supplier',
        current_quantity: currQty,
        unit: b.unit,
        unit_price: price,
        estimated_value: estValue,
        purchase_date: b.purchase_date,
        expiry_date: b.expiry_date,
        days_remaining: daysDiff,
        days_text: daysText,
        status: expStatus
      };
    });

    return sendSuccess(res, report, 'Expiry report loaded');
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getDashboardKPIs,
  getSalesReport,
  getKOTReport,
  getMenuReport,
  getExpiryReport
};
