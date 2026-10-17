const bcrypt = require('bcryptjs');
const { query } = require('../config/db');
const NotificationService = require('../services/NotificationService');

// ═══════════════════════════════════════════════
// DASHBOARD KPIs
// ═══════════════════════════════════════════════

async function getSuperAdminKPIs(req, res) {
  try {
    const [totalRestaurants] = await query("SELECT COUNT(*) as count FROM restaurants");
    const [activeRestaurants] = await query("SELECT COUNT(*) as count FROM restaurants WHERE status = 'ACTIVE'");
    const [pendingRestaurants] = await query("SELECT COUNT(*) as count FROM restaurants WHERE status = 'PENDING'");
    const [suspendedRestaurants] = await query("SELECT COUNT(*) as count FROM restaurants WHERE status = 'SUSPENDED'");
    const [publishedWebsites] = await query("SELECT COUNT(*) as count FROM restaurants WHERE website_status = 'PUBLISHED'");
    const [orderingEnabled] = await query("SELECT COUNT(*) as count FROM restaurants WHERE is_online_ordering_enabled = 1");
    const [totalAdmins] = await query("SELECT COUNT(*) as count FROM users WHERE role IN ('ADMIN', 'RESTAURANT_ADMIN')");

    // Online Channel KPIs (orders table)
    const [onlineKpi] = await query(`
      SELECT 
        COALESCE(SUM(CASE WHEN DATE(created_at) = CURDATE() AND order_status NOT IN ('CANCELLED', 'REJECTED') THEN total_amount ELSE 0 END), 0) as today_revenue,
        COUNT(CASE WHEN DATE(created_at) = CURDATE() AND order_status NOT IN ('CANCELLED', 'REJECTED') THEN 1 ELSE NULL END) as today_orders,
        COALESCE(SUM(CASE WHEN created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY) AND order_status NOT IN ('CANCELLED', 'REJECTED') THEN total_amount ELSE 0 END), 0) as weekly_revenue,
        COUNT(CASE WHEN created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY) AND order_status NOT IN ('CANCELLED', 'REJECTED') THEN 1 ELSE NULL END) as weekly_orders,
        COALESCE(SUM(CASE WHEN (created_at >= DATE_SUB(CURDATE(), INTERVAL 29 DAY) OR (YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE()))) AND order_status NOT IN ('CANCELLED', 'REJECTED') THEN total_amount ELSE 0 END), 0) as monthly_revenue,
        COUNT(CASE WHEN (created_at >= DATE_SUB(CURDATE(), INTERVAL 29 DAY) OR (YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE()))) AND order_status NOT IN ('CANCELLED', 'REJECTED') THEN 1 ELSE NULL END) as monthly_orders,
        COALESCE(SUM(CASE WHEN order_status NOT IN ('CANCELLED', 'REJECTED') THEN total_amount ELSE 0 END), 0) as total_revenue,
        COUNT(CASE WHEN order_status NOT IN ('CANCELLED', 'REJECTED') THEN 1 ELSE NULL END) as total_orders
      FROM orders
    `);

    // Offline Channel KPIs (restaurant_orders table)
    const [offlineKpi] = await query(`
      SELECT 
        COALESCE(SUM(CASE WHEN DATE(created_at) = CURDATE() AND order_status != 'CANCELLED' THEN total_amount ELSE 0 END), 0) as today_revenue,
        COUNT(CASE WHEN DATE(created_at) = CURDATE() AND order_status != 'CANCELLED' THEN 1 ELSE NULL END) as today_orders,
        COALESCE(SUM(CASE WHEN created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY) AND order_status != 'CANCELLED' THEN total_amount ELSE 0 END), 0) as weekly_revenue,
        COUNT(CASE WHEN created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY) AND order_status != 'CANCELLED' THEN 1 ELSE NULL END) as weekly_orders,
        COALESCE(SUM(CASE WHEN (created_at >= DATE_SUB(CURDATE(), INTERVAL 29 DAY) OR (YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE()))) AND order_status != 'CANCELLED' THEN total_amount ELSE 0 END), 0) as monthly_revenue,
        COUNT(CASE WHEN (created_at >= DATE_SUB(CURDATE(), INTERVAL 29 DAY) OR (YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE()))) AND order_status != 'CANCELLED' THEN 1 ELSE NULL END) as monthly_orders,
        COALESCE(SUM(CASE WHEN order_status != 'CANCELLED' THEN total_amount ELSE 0 END), 0) as total_revenue,
        COUNT(CASE WHEN order_status != 'CANCELLED' THEN 1 ELSE NULL END) as total_orders
      FROM restaurant_orders
    `);

    const onl = onlineKpi || {};
    const off = offlineKpi || {};

    const todayOnlineRev = parseFloat(onl.today_revenue) || 0;
    const todayOfflineRev = parseFloat(off.today_revenue) || 0;
    const todayTotalRev = todayOnlineRev + todayOfflineRev;

    const todayOnlineOrd = parseInt(onl.today_orders) || 0;
    const todayOfflineOrd = parseInt(off.today_orders) || 0;
    const todayTotalOrd = todayOnlineOrd + todayOfflineOrd;

    const weeklyOnlineRev = parseFloat(onl.weekly_revenue) || 0;
    const weeklyOfflineRev = parseFloat(off.weekly_revenue) || 0;
    const weeklyTotalRev = weeklyOnlineRev + weeklyOfflineRev;

    const weeklyOnlineOrd = parseInt(onl.weekly_orders) || 0;
    const weeklyOfflineOrd = parseInt(off.weekly_orders) || 0;
    const weeklyTotalOrd = weeklyOnlineOrd + weeklyOfflineOrd;

    const monthlyOnlineRev = parseFloat(onl.monthly_revenue) || 0;
    const monthlyOfflineRev = parseFloat(off.monthly_revenue) || 0;
    const monthlyTotalRev = monthlyOnlineRev + monthlyOfflineRev;

    const monthlyOnlineOrd = parseInt(onl.monthly_orders) || 0;
    const monthlyOfflineOrd = parseInt(off.monthly_orders) || 0;
    const monthlyTotalOrd = monthlyOnlineOrd + monthlyOfflineOrd;

    const totalOnlineRev = parseFloat(onl.total_revenue) || 0;
    const totalOfflineRev = parseFloat(off.total_revenue) || 0;
    const totalCombinedRev = totalOnlineRev + totalOfflineRev;

    const totalOnlineOrd = parseInt(onl.total_orders) || 0;
    const totalOfflineOrd = parseInt(off.total_orders) || 0;
    const totalCombinedOrd = totalOnlineOrd + totalOfflineOrd;

    res.json({
      success: true,
      kpis: {
        totalRestaurants: totalRestaurants.count,
        activeRestaurants: activeRestaurants.count,
        pendingRestaurants: pendingRestaurants.count,
        suspendedRestaurants: suspendedRestaurants.count,
        publishedWebsites: publishedWebsites.count,
        orderingEnabled: orderingEnabled.count,
        totalAdmins: totalAdmins.count,
        // Combined Totals
        todayOrders: todayTotalOrd,
        todayRevenue: todayTotalRev,
        weeklyOrders: weeklyTotalOrd,
        weeklyRevenue: weeklyTotalRev,
        monthlyOrders: monthlyTotalOrd,
        monthlyRevenue: monthlyTotalRev,
        totalOrders: totalCombinedOrd,
        totalRevenue: totalCombinedRev,
        // Granular Breakdown
        breakdown: {
          today: {
            online_revenue: todayOnlineRev,
            offline_revenue: todayOfflineRev,
            combined_revenue: todayTotalRev,
            online_orders: todayOnlineOrd,
            offline_orders: todayOfflineOrd,
            total_orders: todayTotalOrd
          },
          weekly: {
            online_revenue: weeklyOnlineRev,
            offline_revenue: weeklyOfflineRev,
            combined_revenue: weeklyTotalRev,
            online_orders: weeklyOnlineOrd,
            offline_orders: weeklyOfflineOrd,
            total_orders: weeklyTotalOrd
          },
          monthly: {
            online_revenue: monthlyOnlineRev,
            offline_revenue: monthlyOfflineRev,
            combined_revenue: monthlyTotalRev,
            online_orders: monthlyOnlineOrd,
            offline_orders: monthlyOfflineOrd,
            total_orders: monthlyTotalOrd
          },
          all_time: {
            online_revenue: totalOnlineRev,
            offline_revenue: totalOfflineRev,
            combined_revenue: totalCombinedRev,
            online_orders: totalOnlineOrd,
            offline_orders: totalOfflineOrd,
            total_orders: totalCombinedOrd
          }
        }
      }
    });
  } catch (err) {
    console.error('getSuperAdminKPIs Error:', err);
    res.status(500).json({ success: false, message: 'Server error retrieving KPIs.' });
  }
}

// ═══════════════════════════════════════════════
// RESTAURANT MANAGEMENT & REVENUE REPORTING
// ═══════════════════════════════════════════════

async function getAllRestaurants(req, res) {
  try {
    const { status, search } = req.query;

    let sql = `
      SELECT r.*,
        (SELECT COUNT(*) FROM menu_items WHERE restaurant_id = r.id) as menu_items_count,
        (SELECT COUNT(*) FROM categories WHERE restaurant_id = r.id) as categories_count
      FROM restaurants r
    `;
    const params = [];
    const wheres = [];

    if (status) {
      wheres.push('r.status = ?');
      params.push(status);
    }
    if (search) {
      wheres.push('(r.name LIKE ? OR r.slug LIKE ? OR r.city LIKE ?)');
      const s = `%${search}%`;
      params.push(s, s, s);
    }
    if (wheres.length > 0) {
      sql += ' WHERE ' + wheres.join(' AND ');
    }
    sql += ' ORDER BY r.created_at DESC';

    // 1. Fetch filtered restaurants
    const restaurants = await query(sql, params);

    // 2. Fetch all admins mapped to restaurants
    const adminRows = await query(`
      SELECT ra.restaurant_id, ra.is_primary, ra.assigned_at, u.id as user_id, u.name, u.email, u.phone, u.role, u.status
      FROM restaurant_admins ra
      JOIN users u ON u.id = ra.user_id
      ORDER BY ra.is_primary DESC, (CASE WHEN u.role IN ('RESTAURANT_ADMIN', 'ADMIN') THEN 0 ELSE 1 END), u.id ASC
    `);

    const adminsByRest = {};
    for (const a of adminRows) {
      if (!adminsByRest[a.restaurant_id]) adminsByRest[a.restaurant_id] = [];
      adminsByRest[a.restaurant_id].push(a);
    }

    // 3. Online orders aggregation (orders table)
    const onlineAgg = await query(`
      SELECT 
        restaurant_id,
        COALESCE(SUM(CASE WHEN DATE(created_at) = CURDATE() AND order_status NOT IN ('CANCELLED', 'REJECTED') THEN total_amount ELSE 0 END), 0) as today_online_revenue,
        COUNT(CASE WHEN DATE(created_at) = CURDATE() AND order_status NOT IN ('CANCELLED', 'REJECTED') THEN 1 ELSE NULL END) as today_online_orders,
        COALESCE(SUM(CASE WHEN created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY) AND order_status NOT IN ('CANCELLED', 'REJECTED') THEN total_amount ELSE 0 END), 0) as weekly_online_revenue,
        COUNT(CASE WHEN created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY) AND order_status NOT IN ('CANCELLED', 'REJECTED') THEN 1 ELSE NULL END) as weekly_online_orders,
        COALESCE(SUM(CASE WHEN (created_at >= DATE_SUB(CURDATE(), INTERVAL 29 DAY) OR (YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE()))) AND order_status NOT IN ('CANCELLED', 'REJECTED') THEN total_amount ELSE 0 END), 0) as monthly_online_revenue,
        COUNT(CASE WHEN (created_at >= DATE_SUB(CURDATE(), INTERVAL 29 DAY) OR (YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE()))) AND order_status NOT IN ('CANCELLED', 'REJECTED') THEN 1 ELSE NULL END) as monthly_online_orders,
        COALESCE(SUM(CASE WHEN order_status NOT IN ('CANCELLED', 'REJECTED') THEN total_amount ELSE 0 END), 0) as total_online_revenue,
        COUNT(CASE WHEN order_status NOT IN ('CANCELLED', 'REJECTED') THEN 1 ELSE NULL END) as total_online_orders
      FROM orders
      GROUP BY restaurant_id
    `);
    const onlineMap = {};
    for (const row of onlineAgg) {
      onlineMap[row.restaurant_id] = row;
    }

    // 4. Offline orders aggregation (restaurant_orders table)
    const offlineAgg = await query(`
      SELECT 
        restaurant_id,
        COALESCE(SUM(CASE WHEN DATE(created_at) = CURDATE() AND order_status != 'CANCELLED' THEN total_amount ELSE 0 END), 0) as today_offline_revenue,
        COUNT(CASE WHEN DATE(created_at) = CURDATE() AND order_status != 'CANCELLED' THEN 1 ELSE NULL END) as today_offline_orders,
        COALESCE(SUM(CASE WHEN created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY) AND order_status != 'CANCELLED' THEN total_amount ELSE 0 END), 0) as weekly_offline_revenue,
        COUNT(CASE WHEN created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY) AND order_status != 'CANCELLED' THEN 1 ELSE NULL END) as weekly_offline_orders,
        COALESCE(SUM(CASE WHEN (created_at >= DATE_SUB(CURDATE(), INTERVAL 29 DAY) OR (YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE()))) AND order_status != 'CANCELLED' THEN total_amount ELSE 0 END), 0) as monthly_offline_revenue,
        COUNT(CASE WHEN (created_at >= DATE_SUB(CURDATE(), INTERVAL 29 DAY) OR (YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE()))) AND order_status != 'CANCELLED' THEN 1 ELSE NULL END) as monthly_offline_orders,
        COALESCE(SUM(CASE WHEN order_status != 'CANCELLED' THEN total_amount ELSE 0 END), 0) as total_offline_revenue,
        COUNT(CASE WHEN order_status != 'CANCELLED' THEN 1 ELSE NULL END) as total_offline_orders
      FROM restaurant_orders
      GROUP BY restaurant_id
    `);
    const offlineMap = {};
    for (const row of offlineAgg) {
      offlineMap[row.restaurant_id] = row;
    }

    // 5. Merge and enrich each restaurant with multi-channel and multi-period financials
    const enrichedRestaurants = restaurants.map(r => {
      const restAdmins = adminsByRest[r.id] || [];
      // Pick primary admin (is_primary = 1 or first RESTAURANT_ADMIN)
      const primaryAdmin = restAdmins.find(a => a.is_primary === 1) || restAdmins[0] || null;

      const onl = onlineMap[r.id] || {
        today_online_revenue: 0, today_online_orders: 0,
        weekly_online_revenue: 0, weekly_online_orders: 0,
        monthly_online_revenue: 0, monthly_online_orders: 0,
        total_online_revenue: 0, total_online_orders: 0
      };
      const off = offlineMap[r.id] || {
        today_offline_revenue: 0, today_offline_orders: 0,
        weekly_offline_revenue: 0, weekly_offline_orders: 0,
        monthly_offline_revenue: 0, monthly_offline_orders: 0,
        total_offline_revenue: 0, total_offline_orders: 0
      };

      const todayOnlineRev = parseFloat(onl.today_online_revenue) || 0;
      const todayOfflineRev = parseFloat(off.today_offline_revenue) || 0;
      const todayCombinedRev = todayOnlineRev + todayOfflineRev;

      const todayOnlineOrd = parseInt(onl.today_online_orders) || 0;
      const todayOfflineOrd = parseInt(off.today_offline_orders) || 0;
      const todayTotalOrd = todayOnlineOrd + todayOfflineOrd;

      const weeklyOnlineRev = parseFloat(onl.weekly_online_revenue) || 0;
      const weeklyOfflineRev = parseFloat(off.weekly_offline_revenue) || 0;
      const weeklyCombinedRev = weeklyOnlineRev + weeklyOfflineRev;

      const weeklyOnlineOrd = parseInt(onl.weekly_online_orders) || 0;
      const weeklyOfflineOrd = parseInt(off.weekly_offline_orders) || 0;
      const weeklyTotalOrd = weeklyOnlineOrd + weeklyOfflineOrd;

      const monthlyOnlineRev = parseFloat(onl.monthly_online_revenue) || 0;
      const monthlyOfflineRev = parseFloat(off.monthly_offline_revenue) || 0;
      const monthlyCombinedRev = monthlyOnlineRev + monthlyOfflineRev;

      const monthlyOnlineOrd = parseInt(onl.monthly_online_orders) || 0;
      const monthlyOfflineOrd = parseInt(off.monthly_offline_orders) || 0;
      const monthlyTotalOrd = monthlyOnlineOrd + monthlyOfflineOrd;

      const totalOnlineRev = parseFloat(onl.total_online_revenue) || 0;
      const totalOfflineRev = parseFloat(off.total_offline_revenue) || 0;
      const totalCombinedRev = totalOnlineRev + totalOfflineRev;

      const totalOnlineOrd = parseInt(onl.total_online_orders) || 0;
      const totalOfflineOrd = parseInt(off.total_offline_orders) || 0;
      const totalCombinedOrd = totalOnlineOrd + totalOfflineOrd;

      const uniqueAdminNames = [...new Set(restAdmins.map(a => a.name).filter(Boolean))];
      const uniqueAdminEmails = [...new Set(restAdmins.map(a => a.email).filter(Boolean))];
      const uniqueAdminPhones = [...new Set(restAdmins.map(a => a.phone).filter(Boolean))];

      return {
        ...r,
        // Admin Profile
        primary_admin: primaryAdmin ? {
          id: primaryAdmin.user_id,
          name: primaryAdmin.name,
          email: primaryAdmin.email,
          phone: primaryAdmin.phone,
          role: primaryAdmin.role
        } : null,
        admin_names: uniqueAdminNames.join(', ') || 'No Admin Assigned',
        admin_emails: uniqueAdminEmails.join(', ') || '-',
        admin_phones: uniqueAdminPhones.join(', ') || '-',
        admins_list: restAdmins,

        // High-level Flat Revenue Fields
        today_revenue: todayCombinedRev,
        today_orders: todayTotalOrd,
        today_online_revenue: todayOnlineRev,
        today_offline_revenue: todayOfflineRev,
        today_online_orders: todayOnlineOrd,
        today_offline_orders: todayOfflineOrd,

        weekly_revenue: weeklyCombinedRev,
        weekly_orders: weeklyTotalOrd,
        weekly_online_revenue: weeklyOnlineRev,
        weekly_offline_revenue: weeklyOfflineRev,
        weekly_online_orders: weeklyOnlineOrd,
        weekly_offline_orders: weeklyOfflineOrd,

        monthly_revenue: monthlyCombinedRev,
        monthly_orders: monthlyTotalOrd,
        monthly_online_revenue: monthlyOnlineRev,
        monthly_offline_revenue: monthlyOfflineRev,
        monthly_online_orders: monthlyOnlineOrd,
        monthly_offline_orders: monthlyOfflineOrd,

        total_revenue: totalCombinedRev,
        total_orders: totalCombinedOrd,
        total_online_revenue: totalOnlineRev,
        total_offline_revenue: totalOfflineRev,
        total_online_orders: totalOnlineOrd,
        total_offline_orders: totalOfflineOrd,

        // Structured Nested Revenue Matrix
        revenue: {
          today: {
            online: todayOnlineRev,
            offline: todayOfflineRev,
            combined: todayCombinedRev,
            online_orders: todayOnlineOrd,
            offline_orders: todayOfflineOrd,
            total_orders: todayTotalOrd
          },
          weekly: {
            online: weeklyOnlineRev,
            offline: weeklyOfflineRev,
            combined: weeklyCombinedRev,
            online_orders: weeklyOnlineOrd,
            offline_orders: weeklyOfflineOrd,
            total_orders: weeklyTotalOrd
          },
          monthly: {
            online: monthlyOnlineRev,
            offline: monthlyOfflineRev,
            combined: monthlyCombinedRev,
            online_orders: monthlyOnlineOrd,
            offline_orders: monthlyOfflineOrd,
            total_orders: monthlyTotalOrd
          },
          all_time: {
            online: totalOnlineRev,
            offline: totalOfflineRev,
            combined: totalCombinedRev,
            online_orders: totalOnlineOrd,
            offline_orders: totalOfflineOrd,
            total_orders: totalCombinedOrd
          }
        }
      };
    });

    res.json({ success: true, count: enrichedRestaurants.length, restaurants: enrichedRestaurants });
  } catch (err) {
    console.error('getAllRestaurants Error:', err);
    res.status(500).json({ success: false, message: 'Server error retrieving restaurants.' });
  }
}

async function getRestaurantById(req, res) {
  try {
    const { id } = req.params;
    const rows = await query('SELECT * FROM restaurants WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Restaurant not found.' });
    }

    const restaurant = rows[0];

    // Fetch admins
    const admins = await query(
      `SELECT u.id, u.name, u.email, u.phone, u.status, u.role, ra.is_primary, ra.assigned_at
       FROM restaurant_admins ra
       JOIN users u ON u.id = ra.user_id
       WHERE ra.restaurant_id = ?
       ORDER BY ra.is_primary DESC, u.id ASC`,
      [id]
    );

    // Online Order Summary
    const [onlineSummary] = await query(
      `SELECT 
        COALESCE(SUM(CASE WHEN DATE(created_at) = CURDATE() AND order_status NOT IN ('CANCELLED', 'REJECTED') THEN total_amount ELSE 0 END), 0) as today_revenue,
        COUNT(CASE WHEN DATE(created_at) = CURDATE() AND order_status NOT IN ('CANCELLED', 'REJECTED') THEN 1 ELSE NULL END) as today_orders,
        COALESCE(SUM(CASE WHEN created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY) AND order_status NOT IN ('CANCELLED', 'REJECTED') THEN total_amount ELSE 0 END), 0) as weekly_revenue,
        COUNT(CASE WHEN created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY) AND order_status NOT IN ('CANCELLED', 'REJECTED') THEN 1 ELSE NULL END) as weekly_orders,
        COALESCE(SUM(CASE WHEN (created_at >= DATE_SUB(CURDATE(), INTERVAL 29 DAY) OR (YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE()))) AND order_status NOT IN ('CANCELLED', 'REJECTED') THEN total_amount ELSE 0 END), 0) as monthly_revenue,
        COUNT(CASE WHEN (created_at >= DATE_SUB(CURDATE(), INTERVAL 29 DAY) OR (YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE()))) AND order_status NOT IN ('CANCELLED', 'REJECTED') THEN 1 ELSE NULL END) as monthly_orders,
        COALESCE(SUM(CASE WHEN order_status NOT IN ('CANCELLED', 'REJECTED') THEN total_amount ELSE 0 END), 0) as total_revenue,
        COUNT(CASE WHEN order_status NOT IN ('CANCELLED', 'REJECTED') THEN 1 ELSE NULL END) as total_orders
       FROM orders WHERE restaurant_id = ?`,
      [id]
    );

    // Offline Order Summary
    const [offlineSummary] = await query(
      `SELECT 
        COALESCE(SUM(CASE WHEN DATE(created_at) = CURDATE() AND order_status != 'CANCELLED' THEN total_amount ELSE 0 END), 0) as today_revenue,
        COUNT(CASE WHEN DATE(created_at) = CURDATE() AND order_status != 'CANCELLED' THEN 1 ELSE NULL END) as today_orders,
        COALESCE(SUM(CASE WHEN created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY) AND order_status != 'CANCELLED' THEN total_amount ELSE 0 END), 0) as weekly_revenue,
        COUNT(CASE WHEN created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY) AND order_status != 'CANCELLED' THEN 1 ELSE NULL END) as weekly_orders,
        COALESCE(SUM(CASE WHEN (created_at >= DATE_SUB(CURDATE(), INTERVAL 29 DAY) OR (YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE()))) AND order_status != 'CANCELLED' THEN total_amount ELSE 0 END), 0) as monthly_revenue,
        COUNT(CASE WHEN (created_at >= DATE_SUB(CURDATE(), INTERVAL 29 DAY) OR (YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE()))) AND order_status != 'CANCELLED' THEN 1 ELSE NULL END) as monthly_orders,
        COALESCE(SUM(CASE WHEN order_status != 'CANCELLED' THEN total_amount ELSE 0 END), 0) as total_revenue,
        COUNT(CASE WHEN order_status != 'CANCELLED' THEN 1 ELSE NULL END) as total_orders
       FROM restaurant_orders WHERE restaurant_id = ?`,
      [id]
    );

    const onl = onlineSummary || {};
    const off = offlineSummary || {};

    const todayOnlineRev = parseFloat(onl.today_revenue) || 0;
    const todayOfflineRev = parseFloat(off.today_revenue) || 0;
    const todayCombinedRev = todayOnlineRev + todayOfflineRev;

    const weeklyOnlineRev = parseFloat(onl.weekly_revenue) || 0;
    const weeklyOfflineRev = parseFloat(off.weekly_revenue) || 0;
    const weeklyCombinedRev = weeklyOnlineRev + weeklyOfflineRev;

    const monthlyOnlineRev = parseFloat(onl.monthly_revenue) || 0;
    const monthlyOfflineRev = parseFloat(off.monthly_revenue) || 0;
    const monthlyCombinedRev = monthlyOnlineRev + monthlyOfflineRev;

    const totalOnlineRev = parseFloat(onl.total_revenue) || 0;
    const totalOfflineRev = parseFloat(off.total_revenue) || 0;
    const totalCombinedRev = totalOnlineRev + totalOfflineRev;

    const todayTotalOrd = (parseInt(onl.today_orders) || 0) + (parseInt(off.today_orders) || 0);
    const weeklyTotalOrd = (parseInt(onl.weekly_orders) || 0) + (parseInt(off.weekly_orders) || 0);
    const monthlyTotalOrd = (parseInt(onl.monthly_orders) || 0) + (parseInt(off.monthly_orders) || 0);
    const totalCombinedOrd = (parseInt(onl.total_orders) || 0) + (parseInt(off.total_orders) || 0);

    const primaryAdmin = admins.find(a => a.is_primary === 1) || admins[0] || null;

    res.json({
      success: true,
      restaurant: {
        ...restaurant,
        primary_admin: primaryAdmin,
        admins,
        revenue: {
          today: { online: todayOnlineRev, offline: todayOfflineRev, combined: todayCombinedRev, online_orders: parseInt(onl.today_orders) || 0, offline_orders: parseInt(off.today_orders) || 0, total_orders: todayTotalOrd },
          weekly: { online: weeklyOnlineRev, offline: weeklyOfflineRev, combined: weeklyCombinedRev, online_orders: parseInt(onl.weekly_orders) || 0, offline_orders: parseInt(off.weekly_orders) || 0, total_orders: weeklyTotalOrd },
          monthly: { online: monthlyOnlineRev, offline: monthlyOfflineRev, combined: monthlyCombinedRev, online_orders: parseInt(onl.monthly_orders) || 0, offline_orders: parseInt(off.monthly_orders) || 0, total_orders: monthlyTotalOrd },
          all_time: { online: totalOnlineRev, offline: totalOfflineRev, combined: totalCombinedRev, online_orders: parseInt(onl.total_orders) || 0, offline_orders: parseInt(off.total_orders) || 0, total_orders: totalCombinedOrd }
        },
        orderSummary: {
          total_orders: totalCombinedOrd,
          total_revenue: totalCombinedRev,
          today_orders: todayTotalOrd,
          today_revenue: todayCombinedRev,
          online: onl,
          offline: off
        }
      }
    });
  } catch (err) {
    console.error('getRestaurantById Error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
}

async function createRestaurant(req, res) {
  try {
    const { name, phone, email, address, city, state, area, postal_code } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: 'Restaurant name is required.' });
    }

    let slugBase = name.toLowerCase().trim()
      .replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');
    if (!slugBase) slugBase = 'restaurant';

    let slug = slugBase;
    const existing = await query('SELECT id FROM restaurants WHERE slug = ?', [slug]);
    if (existing.length > 0) {
      slug = `${slugBase}-${Math.floor(1000 + Math.random() * 9000)}`;
    }

    const result = await query(
      `INSERT INTO restaurants (name, slug, custom_subdomain_slug, custom_subdomain_enabled, phone, email, address, city, state, area, postal_code,
        status, website_status, is_online_ordering_enabled)
       VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, 'PENDING', 'DRAFT', 0)`,
      [name, slug, slug, phone || null, email || null, address || null, city || null, state || null, area || null, postal_code || null]
    );

    // Auto-provision 7-Day Free Trial
    try {
      const subscriptionService = require('../services/SubscriptionService');
      await subscriptionService.provisionHotelTrial(result.insertId);
    } catch (trialErr) {
      console.warn('Trial auto-provisioning warning:', trialErr.message);
    }

    const newRest = await query('SELECT * FROM restaurants WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, message: 'Restaurant created.', restaurant: newRest[0] });
  } catch (err) {
    console.error('createRestaurant Error:', err);
    res.status(500).json({ success: false, message: 'Server error creating restaurant.' });
  }
}

async function updateRestaurantStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['ACTIVE', 'SUSPENDED', 'PENDING'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status.' });
    }

    await query('UPDATE restaurants SET status = ? WHERE id = ?', [status, id]);

    // Also synchronize admin users belonging to this restaurant
    try {
      if (status === 'ACTIVE') {
        await query(`
          UPDATE users u
          JOIN restaurant_admins ra ON ra.user_id = u.id
          SET u.status = 'ACTIVE'
          WHERE ra.restaurant_id = ?
        `, [id]);
      } else if (status === 'SUSPENDED') {
        await query(`
          UPDATE users u
          JOIN restaurant_admins ra ON ra.user_id = u.id
          SET u.status = 'DISABLED'
          WHERE ra.restaurant_id = ?
        `, [id]);
      }
    } catch (uErr) {}

    const [updatedRest] = await query('SELECT * FROM restaurants WHERE id = ?', [id]);
    res.json({ success: true, message: `Restaurant status updated to ${status}.`, restaurant: updatedRest });
  } catch (err) {
    console.error('updateRestaurantStatus Error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// ═══════════════════════════════════════════════
// RESTAURANT ADMIN MANAGEMENT
// ═══════════════════════════════════════════════

async function createRestaurantAdmin(req, res) {
  try {
    const { name, email, password, phone, restaurant_id } = req.body;

    if (!name || !email || !password || !phone) {
      return res.status(400).json({ success: false, message: 'Name, email, password, and phone are required.' });
    }

    const existing = await query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'Email already registered.' });
    }

    const hash = await bcrypt.hash(password, 10);
    const result = await query(
      `INSERT INTO users (name, email, password_hash, plain_password, phone, role, status)
       VALUES (?, ?, ?, ?, ?, 'RESTAURANT_ADMIN', 'ACTIVE')`,
      [name, email, hash, password, phone]
    );

    const userId = result.insertId;

    // If restaurant_id provided, assign immediately
    if (restaurant_id) {
      await query(
        'INSERT INTO restaurant_admins (user_id, restaurant_id, is_primary) VALUES (?, ?, 1)',
        [userId, restaurant_id]
      );
    }

    res.status(201).json({
      success: true,
      message: 'Restaurant admin created.',
      admin: { id: userId, name, email, phone, role: 'RESTAURANT_ADMIN' }
    });
  } catch (err) {
    console.error('createRestaurantAdmin Error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
}

async function assignRestaurantAdmin(req, res) {
  try {
    const { user_id, restaurant_id, is_primary } = req.body;

    if (!user_id || !restaurant_id) {
      return res.status(400).json({ success: false, message: 'user_id and restaurant_id are required.' });
    }

    // Check user exists and is admin role
    const users = await query('SELECT id, role FROM users WHERE id = ?', [user_id]);
    if (users.length === 0) return res.status(404).json({ success: false, message: 'User not found.' });

    const restaurants = await query('SELECT id FROM restaurants WHERE id = ?', [restaurant_id]);
    if (restaurants.length === 0) return res.status(404).json({ success: false, message: 'Restaurant not found.' });

    // If setting as primary, clear other primaries for this restaurant
    if (is_primary) {
      await query('UPDATE restaurant_admins SET is_primary = 0 WHERE restaurant_id = ?', [restaurant_id]);
    }

    await query(
      'INSERT INTO restaurant_admins (user_id, restaurant_id, is_primary) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE is_primary = VALUES(is_primary)',
      [user_id, restaurant_id, is_primary ? 1 : 0]
    );

    // Update user role to RESTAURANT_ADMIN if not already
    await query("UPDATE users SET role = 'RESTAURANT_ADMIN' WHERE id = ? AND role NOT IN ('SUPER_ADMIN', 'RESTAURANT_ADMIN')", [user_id]);
    // Also update admin_user_id on restaurant for backward compatibility
    if (is_primary) {
      await query('UPDATE restaurants SET admin_user_id = ? WHERE id = ?', [user_id, restaurant_id]);
    }

    res.json({ success: true, message: 'Admin assigned to restaurant.' });
  } catch (err) {
    console.error('assignRestaurantAdmin Error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
}

async function removeRestaurantAdmin(req, res) {
  try {
    const { id } = req.params; // restaurant_admins.id
    await query('DELETE FROM restaurant_admins WHERE id = ?', [id]);
    res.json({ success: true, message: 'Admin assignment removed.' });
  } catch (err) {
    console.error('removeRestaurantAdmin Error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
}

async function getAllAdmins(req, res) {
  try {
    // 1. Fetch all admins
    const admins = await query(
      `SELECT u.id as user_id, u.name, u.email, u.phone, u.plain_password, u.status, u.role, u.created_at
       FROM users u
       WHERE u.role IN ('ADMIN', 'RESTAURANT_ADMIN')
       ORDER BY u.created_at DESC`
    );

    // 2. Fetch deduplicated restaurant assignments
    const restLinks = await query(`
      SELECT 
        ur.user_id,
        r.id as restaurant_id,
        r.name as restaurant_name,
        r.slug as restaurant_slug,
        r.city as restaurant_city,
        r.status as restaurant_status,
        MAX(ur.is_primary) as is_primary
      FROM (
        SELECT user_id, restaurant_id, is_primary FROM restaurant_admins
        UNION ALL
        SELECT admin_user_id as user_id, id as restaurant_id, 1 as is_primary 
        FROM restaurants WHERE admin_user_id IS NOT NULL
      ) ur
      JOIN users u ON u.id = ur.user_id
      JOIN restaurants r ON r.id = ur.restaurant_id
      WHERE u.role IN ('ADMIN', 'RESTAURANT_ADMIN')
      GROUP BY ur.user_id, r.id
      ORDER BY is_primary DESC, r.name ASC
    `);

    // 3. Online orders aggregation (orders table)
    const onlineAgg = await query(`
      SELECT 
        restaurant_id,
        COALESCE(SUM(CASE WHEN DATE(created_at) = CURDATE() AND order_status NOT IN ('CANCELLED', 'REJECTED') THEN total_amount ELSE 0 END), 0) as today_online_revenue,
        COUNT(CASE WHEN DATE(created_at) = CURDATE() AND order_status NOT IN ('CANCELLED', 'REJECTED') THEN 1 ELSE NULL END) as today_online_orders,
        COALESCE(SUM(CASE WHEN created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY) AND order_status NOT IN ('CANCELLED', 'REJECTED') THEN total_amount ELSE 0 END), 0) as weekly_online_revenue,
        COUNT(CASE WHEN created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY) AND order_status NOT IN ('CANCELLED', 'REJECTED') THEN 1 ELSE NULL END) as weekly_online_orders,
        COALESCE(SUM(CASE WHEN (created_at >= DATE_SUB(CURDATE(), INTERVAL 29 DAY) OR (YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE()))) AND order_status NOT IN ('CANCELLED', 'REJECTED') THEN total_amount ELSE 0 END), 0) as monthly_online_revenue,
        COUNT(CASE WHEN (created_at >= DATE_SUB(CURDATE(), INTERVAL 29 DAY) OR (YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE()))) AND order_status NOT IN ('CANCELLED', 'REJECTED') THEN 1 ELSE NULL END) as monthly_online_orders,
        COALESCE(SUM(CASE WHEN order_status NOT IN ('CANCELLED', 'REJECTED') THEN total_amount ELSE 0 END), 0) as total_online_revenue,
        COUNT(CASE WHEN order_status NOT IN ('CANCELLED', 'REJECTED') THEN 1 ELSE NULL END) as total_online_orders
      FROM orders
      GROUP BY restaurant_id
    `);
    const onlineMap = {};
    for (const row of onlineAgg) onlineMap[row.restaurant_id] = row;

    // 4. Offline orders aggregation (restaurant_orders table)
    const offlineAgg = await query(`
      SELECT 
        restaurant_id,
        COALESCE(SUM(CASE WHEN DATE(created_at) = CURDATE() AND order_status != 'CANCELLED' THEN total_amount ELSE 0 END), 0) as today_offline_revenue,
        COUNT(CASE WHEN DATE(created_at) = CURDATE() AND order_status != 'CANCELLED' THEN 1 ELSE NULL END) as today_offline_orders,
        COALESCE(SUM(CASE WHEN created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY) AND order_status != 'CANCELLED' THEN total_amount ELSE 0 END), 0) as weekly_offline_revenue,
        COUNT(CASE WHEN created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY) AND order_status != 'CANCELLED' THEN 1 ELSE NULL END) as weekly_offline_orders,
        COALESCE(SUM(CASE WHEN (created_at >= DATE_SUB(CURDATE(), INTERVAL 29 DAY) OR (YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE()))) AND order_status != 'CANCELLED' THEN total_amount ELSE 0 END), 0) as monthly_offline_revenue,
        COUNT(CASE WHEN (created_at >= DATE_SUB(CURDATE(), INTERVAL 29 DAY) OR (YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE()))) AND order_status != 'CANCELLED' THEN 1 ELSE NULL END) as monthly_offline_orders,
        COALESCE(SUM(CASE WHEN order_status != 'CANCELLED' THEN total_amount ELSE 0 END), 0) as total_offline_revenue,
        COUNT(CASE WHEN order_status != 'CANCELLED' THEN 1 ELSE NULL END) as total_offline_orders
      FROM restaurant_orders
      GROUP BY restaurant_id
    `);
    const offlineMap = {};
    for (const row of offlineAgg) offlineMap[row.restaurant_id] = row;

    // 5. Build restaurant list per user with individual financial metrics
    const restsByUser = {};
    for (const link of restLinks) {
      if (!restsByUser[link.user_id]) restsByUser[link.user_id] = [];
      const onl = onlineMap[link.restaurant_id] || {
        today_online_revenue: 0, today_online_orders: 0,
        weekly_online_revenue: 0, weekly_online_orders: 0,
        monthly_online_revenue: 0, monthly_online_orders: 0,
        total_online_revenue: 0, total_online_orders: 0
      };
      const off = offlineMap[link.restaurant_id] || {
        today_offline_revenue: 0, today_offline_orders: 0,
        weekly_offline_revenue: 0, weekly_offline_orders: 0,
        monthly_offline_revenue: 0, monthly_offline_orders: 0,
        total_offline_revenue: 0, total_offline_orders: 0
      };

      const tOnlRev = parseFloat(onl.today_online_revenue) || 0;
      const tOffRev = parseFloat(off.today_offline_revenue) || 0;
      const wOnlRev = parseFloat(onl.weekly_online_revenue) || 0;
      const wOffRev = parseFloat(off.weekly_offline_revenue) || 0;
      const mOnlRev = parseFloat(onl.monthly_online_revenue) || 0;
      const mOffRev = parseFloat(off.monthly_offline_revenue) || 0;
      const totOnlRev = parseFloat(onl.total_online_revenue) || 0;
      const totOffRev = parseFloat(off.total_offline_revenue) || 0;

      const tOnlOrd = parseInt(onl.today_online_orders) || 0;
      const tOffOrd = parseInt(off.today_offline_orders) || 0;
      const wOnlOrd = parseInt(onl.weekly_online_orders) || 0;
      const wOffOrd = parseInt(off.weekly_offline_orders) || 0;
      const mOnlOrd = parseInt(onl.monthly_online_orders) || 0;
      const mOffOrd = parseInt(off.monthly_offline_orders) || 0;
      const totOnlOrd = parseInt(onl.total_online_orders) || 0;
      const totOffOrd = parseInt(off.total_offline_orders) || 0;

      restsByUser[link.user_id].push({
        id: link.restaurant_id,
        name: link.restaurant_name,
        slug: link.restaurant_slug,
        city: link.restaurant_city,
        status: link.restaurant_status,
        is_primary: link.is_primary,
        today_online_revenue: tOnlRev,
        today_offline_revenue: tOffRev,
        today_revenue: tOnlRev + tOffRev,
        today_orders: tOnlOrd + tOffOrd,
        weekly_online_revenue: wOnlRev,
        weekly_offline_revenue: wOffRev,
        weekly_revenue: wOnlRev + wOffRev,
        weekly_orders: wOnlOrd + wOffOrd,
        monthly_online_revenue: mOnlRev,
        monthly_offline_revenue: mOffRev,
        monthly_revenue: mOnlRev + mOffRev,
        monthly_orders: mOnlOrd + mOffOrd,
        total_online_revenue: totOnlRev,
        total_offline_revenue: totOffRev,
        total_revenue: totOnlRev + totOffRev,
        total_orders: totOnlOrd + totOffOrd,
        revenue: {
          today: { online: tOnlRev, offline: tOffRev, combined: tOnlRev + tOffRev, online_orders: tOnlOrd, offline_orders: tOffOrd, total_orders: tOnlOrd + tOffOrd },
          weekly: { online: wOnlRev, offline: wOffRev, combined: wOnlRev + wOffRev, online_orders: wOnlOrd, offline_orders: wOffOrd, total_orders: wOnlOrd + wOffOrd },
          monthly: { online: mOnlRev, offline: mOffRev, combined: mOnlRev + mOffRev, online_orders: mOnlOrd, offline_orders: mOffOrd, total_orders: mOnlOrd + mOffOrd },
          all_time: { online: totOnlRev, offline: totOffRev, combined: totOnlRev + totOffRev, online_orders: totOnlOrd, offline_orders: totOffOrd, total_orders: totOnlOrd + totOffOrd }
        }
      });
    }

    // 6. Enrich each admin with aggregated revenue and per-channel figures
    const enrichedAdmins = admins.map(a => {
      const myRests = restsByUser[a.user_id] || [];

      let todayOnlineRev = 0, todayOfflineRev = 0, todayOnlineOrd = 0, todayOfflineOrd = 0;
      let weeklyOnlineRev = 0, weeklyOfflineRev = 0, weeklyOnlineOrd = 0, weeklyOfflineOrd = 0;
      let monthlyOnlineRev = 0, monthlyOfflineRev = 0, monthlyOnlineOrd = 0, monthlyOfflineOrd = 0;
      let totalOnlineRev = 0, totalOfflineRev = 0, totalOnlineOrd = 0, totalOfflineOrd = 0;

      for (const r of myRests) {
        todayOnlineRev += r.today_online_revenue;
        todayOfflineRev += r.today_offline_revenue;
        todayOnlineOrd += r.revenue.today.online_orders;
        todayOfflineOrd += r.revenue.today.offline_orders;

        weeklyOnlineRev += r.weekly_online_revenue;
        weeklyOfflineRev += r.weekly_offline_revenue;
        weeklyOnlineOrd += r.revenue.weekly.online_orders;
        weeklyOfflineOrd += r.revenue.weekly.offline_orders;

        monthlyOnlineRev += r.monthly_online_revenue;
        monthlyOfflineRev += r.monthly_offline_revenue;
        monthlyOnlineOrd += r.revenue.monthly.online_orders;
        monthlyOfflineOrd += r.revenue.monthly.offline_orders;

        totalOnlineRev += r.total_online_revenue;
        totalOfflineRev += r.total_offline_revenue;
        totalOnlineOrd += r.revenue.all_time.online_orders;
        totalOfflineOrd += r.revenue.all_time.offline_orders;
      }

      const todayTotalRev = todayOnlineRev + todayOfflineRev;
      const todayTotalOrd = todayOnlineOrd + todayOfflineOrd;

      const weeklyTotalRev = weeklyOnlineRev + weeklyOfflineRev;
      const weeklyTotalOrd = weeklyOnlineOrd + weeklyOfflineOrd;

      const monthlyTotalRev = monthlyOnlineRev + monthlyOfflineRev;
      const monthlyTotalOrd = monthlyOnlineOrd + monthlyOfflineOrd;

      const totalCombinedRev = totalOnlineRev + totalOfflineRev;
      const totalCombinedOrd = totalOnlineOrd + totalOfflineOrd;

      const restNames = myRests.map(r => r.name);
      const restIds = myRests.map(r => r.id);
      const restSlugs = myRests.map(r => r.slug);

      return {
        ...a,
        restaurant_name: restNames[0] || 'Unassigned',
        restaurant_names: restNames.join(', ') || 'Unassigned',
        restaurant_ids: restIds.join(','),
        restaurant_slugs: restSlugs.join(','),
        restaurants_count: myRests.length,
        restaurants: myRests,

        // Financial Metrics Flat Fields
        today_revenue: todayTotalRev,
        today_orders: todayTotalOrd,
        today_online_revenue: todayOnlineRev,
        today_offline_revenue: todayOfflineRev,
        today_online_orders: todayOnlineOrd,
        today_offline_orders: todayOfflineOrd,

        weekly_revenue: weeklyTotalRev,
        weekly_orders: weeklyTotalOrd,
        weekly_online_revenue: weeklyOnlineRev,
        weekly_offline_revenue: weeklyOfflineRev,
        weekly_online_orders: weeklyOnlineOrd,
        weekly_offline_orders: weeklyOfflineOrd,

        monthly_revenue: monthlyTotalRev,
        monthly_orders: monthlyTotalOrd,
        monthly_online_revenue: monthlyOnlineRev,
        monthly_offline_revenue: monthlyOfflineRev,
        monthly_online_orders: monthlyOnlineOrd,
        monthly_offline_orders: monthlyOfflineOrd,

        total_revenue: totalCombinedRev,
        total_orders: totalCombinedOrd,
        total_online_revenue: totalOnlineRev,
        total_offline_revenue: totalOfflineRev,
        total_online_orders: totalOnlineOrd,
        total_offline_orders: totalOfflineOrd,

        revenue: {
          today: {
            online: todayOnlineRev,
            offline: todayOfflineRev,
            combined: todayTotalRev,
            online_orders: todayOnlineOrd,
            offline_orders: todayOfflineOrd,
            total_orders: todayTotalOrd
          },
          weekly: {
            online: weeklyOnlineRev,
            offline: weeklyOfflineRev,
            combined: weeklyTotalRev,
            online_orders: weeklyOnlineOrd,
            offline_orders: weeklyOfflineOrd,
            total_orders: weeklyTotalOrd
          },
          monthly: {
            online: monthlyOnlineRev,
            offline: monthlyOfflineRev,
            combined: monthlyTotalRev,
            online_orders: monthlyOnlineOrd,
            offline_orders: monthlyOfflineOrd,
            total_orders: monthlyTotalOrd
          },
          all_time: {
            online: totalOnlineRev,
            offline: totalOfflineRev,
            combined: totalCombinedRev,
            online_orders: totalOnlineOrd,
            offline_orders: totalOfflineOrd,
            total_orders: totalCombinedOrd
          }
        }
      };
    });

    res.json({ success: true, count: enrichedAdmins.length, admins: enrichedAdmins });
  } catch (err) {
    console.error('getAllAdmins Error:', err);
    res.status(500).json({ success: false, message: 'Server error retrieving admin list.' });
  }
}

async function updateAdminStatus(req, res) {
  try {
    const { userId } = req.params;
    const { status } = req.body;

    if (!['ACTIVE', 'DISABLED'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value.' });
    }

    await query("UPDATE users SET status = ? WHERE id = ? AND role IN ('ADMIN', 'RESTAURANT_ADMIN')", [status, userId]);

    await NotificationService.sendNotification({
      userId,
      title: 'Account Status Update',
      message: `Your admin account status was changed to ${status} by Super Admin.`,
      type: 'SYSTEM'
    });

    res.json({ success: true, message: `Admin account status updated to ${status}.` });
  } catch (err) {
    console.error('updateAdminStatus Error:', err);
    res.status(500).json({ success: false, message: 'Server error updating admin status.' });
  }
}

// ═══════════════════════════════════════════════
// DRIVER MANAGEMENT (Preserved for Phase 2)
// ═══════════════════════════════════════════════

async function getAllDrivers(req, res) {
  try {
    const drivers = await query(
      `SELECT d.id as driver_id, d.user_id, d.vehicle_type, d.vehicle_number, d.license_number,
              d.approval_status, d.availability_status, d.is_active, d.created_at,
              u.name, u.email, u.phone, u.plain_password, u.status as user_status,
              GROUP_CONCAT(DISTINCT r.name SEPARATOR ', ') as restaurant_name
       FROM delivery_drivers d
       JOIN users u ON d.user_id = u.id
       LEFT JOIN driver_restaurant_assignments dra ON dra.driver_id = d.id AND dra.status = 'ACTIVE'
       LEFT JOIN restaurants r ON dra.restaurant_id = r.id
       GROUP BY d.id
       ORDER BY d.id DESC`
    );
    res.json({ success: true, count: drivers.length, drivers });
  } catch (err) {
    console.error('getAllDrivers Error:', err);
    res.status(500).json({ success: false, message: 'Server error retrieving drivers.' });
  }
}

async function updateDriverStatus(req, res) {
  try {
    const { driverId } = req.params;
    const { userStatus, approvalStatus } = req.body;

    const drivers = await query('SELECT user_id FROM delivery_drivers WHERE id = ?', [driverId]);
    if (drivers.length === 0) {
      return res.status(404).json({ success: false, message: 'Driver not found.' });
    }

    const userId = drivers[0].user_id;

    if (userStatus && ['ACTIVE', 'DISABLED'].includes(userStatus)) {
      await query('UPDATE users SET status = ? WHERE id = ?', [userStatus, userId]);
    }
    if (approvalStatus && ['PENDING', 'APPROVED', 'REJECTED'].includes(approvalStatus)) {
      await query('UPDATE delivery_drivers SET approval_status = ? WHERE id = ?', [approvalStatus, driverId]);
    }

    let notifMsg = 'Your delivery driver profile has been updated.';
    if (approvalStatus === 'APPROVED') notifMsg = '🎉 Your driver application has been APPROVED!';
    else if (approvalStatus === 'REJECTED') notifMsg = 'Your driver application was rejected.';
    else if (userStatus === 'DISABLED') notifMsg = 'Your driver account has been disabled.';
    else if (userStatus === 'ACTIVE') notifMsg = 'Your driver account has been enabled.';

    await NotificationService.sendNotification({
      userId, title: 'Driver Status Update', message: notifMsg, type: 'SYSTEM'
    });

    res.json({ success: true, message: 'Driver status updated successfully.' });
  } catch (err) {
    console.error('updateDriverStatus Error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// ═══════════════════════════════════════════════
// PLATFORM ORDERS
// ═══════════════════════════════════════════════

async function getAllPlatformOrders(req, res) {
  try {
    const { status, restaurant_id, search, date } = req.query;
    let sql = `
      SELECT o.*, r.name as restaurant_name, r.slug as restaurant_slug
      FROM orders o
      JOIN restaurants r ON o.restaurant_id = r.id
    `;
    const params = [];
    const wheres = [];

    if (status) { wheres.push('o.order_status = ?'); params.push(status); }
    if (restaurant_id) { wheres.push('o.restaurant_id = ?'); params.push(restaurant_id); }
    if (date) { wheres.push('DATE(o.created_at) = ?'); params.push(date); }
    if (search) {
      wheres.push('(o.order_number LIKE ? OR o.customer_name LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    if (wheres.length > 0) sql += ' WHERE ' + wheres.join(' AND ');
    sql += ' ORDER BY o.created_at DESC LIMIT 100';

    const orders = await query(sql, params);
    res.json({ success: true, count: orders.length, orders });
  } catch (err) {
    console.error('getAllPlatformOrders Error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
}

async function toggleCustomSubdomain(req, res) {
  try {
    const { id } = req.params;
    const { enabled, custom_subdomain_slug } = req.body;

    const [rest] = await query('SELECT * FROM restaurants WHERE id = ?', [id]);
    if (!rest) return res.status(404).json({ success: false, message: 'Restaurant not found.' });

    const newEnabled = enabled !== undefined ? (enabled ? 1 : 0) : (rest.custom_subdomain_enabled ? 0 : 1);
    const newCustomSlug = custom_subdomain_slug || rest.custom_subdomain_slug || rest.slug;

    await query(
      'UPDATE restaurants SET custom_subdomain_enabled = ?, custom_subdomain_slug = ? WHERE id = ?',
      [newEnabled, newCustomSlug, id]
    );

    res.json({
      success: true,
      message: `Custom subdomain ${newEnabled ? 'enabled (₹99/mo plan)' : 'disabled (random slug mode)'}.`,
      custom_subdomain_enabled: newEnabled,
      custom_subdomain_slug: newCustomSlug
    });
  } catch (err) {
    console.error('toggleCustomSubdomain Error:', err);
    res.status(500).json({ success: false, message: 'Server error updating subdomain.' });
  }
}

// ═══════════════════════════════════════════════
// RESTAURANT FEATURE CONTROLS & MODULAR PROVISIONING
// ═══════════════════════════════════════════════

const DEFAULT_FEATURE_KEYS = [
  'online_ordering',
  'delivery_fleet',
  'rewards_wallet',
  'table_dine_in',
  'kds_kot',
  'pos_billing',
  'inventory_stock',
  'reports_analytics',
  'hotel_accommodations',
  'custom_subdomain'
];

async function ensureFeatureRow(restaurantId) {
  const [row] = await query('SELECT * FROM restaurant_feature_controls WHERE restaurant_id = ?', [restaurantId]);
  if (!row) {
    await query(
      `INSERT IGNORE INTO restaurant_feature_controls (restaurant_id) VALUES (?)`,
      [restaurantId]
    );
    const [fresh] = await query('SELECT * FROM restaurant_feature_controls WHERE restaurant_id = ?', [restaurantId]);
    return fresh;
  }
  return row;
}

async function getAllRestaurantsWithFeatures(req, res) {
  try {
    const sql = `
      SELECT 
        r.id, r.name, r.slug, r.status, r.website_status, r.phone, r.email,
        COALESCE(f.online_ordering, 1) as online_ordering,
        COALESCE(f.delivery_fleet, 1) as delivery_fleet,
        COALESCE(f.rewards_wallet, 1) as rewards_wallet,
        COALESCE(f.table_dine_in, 1) as table_dine_in,
        COALESCE(f.kds_kot, 1) as kds_kot,
        COALESCE(f.pos_billing, 1) as pos_billing,
        COALESCE(f.inventory_stock, 1) as inventory_stock,
        COALESCE(f.reports_analytics, 1) as reports_analytics,
        COALESCE(f.hotel_accommodations, 1) as hotel_accommodations,
        COALESCE(f.custom_subdomain, 1) as custom_subdomain
      FROM restaurants r
      LEFT JOIN restaurant_feature_controls f ON r.id = f.restaurant_id
      ORDER BY r.id ASC
    `;
    const rows = await query(sql);

    const formatted = rows.map(r => {
      let activeCount = 0;
      DEFAULT_FEATURE_KEYS.forEach(k => {
        if (r[k] === 1) activeCount++;
      });
      return {
        id: r.id,
        name: r.name,
        slug: r.slug,
        status: r.status,
        website_status: r.website_status,
        phone: r.phone,
        email: r.email,
        active_features_count: activeCount,
        total_features_count: DEFAULT_FEATURE_KEYS.length,
        features: {
          online_ordering: r.online_ordering,
          delivery_fleet: r.delivery_fleet,
          rewards_wallet: r.rewards_wallet,
          table_dine_in: r.table_dine_in,
          kds_kot: r.kds_kot,
          pos_billing: r.pos_billing,
          inventory_stock: r.inventory_stock,
          reports_analytics: r.reports_analytics,
          hotel_accommodations: r.hotel_accommodations,
          custom_subdomain: r.custom_subdomain
        }
      };
    });

    res.json({ success: true, restaurants: formatted });
  } catch (err) {
    console.error('getAllRestaurantsWithFeatures Error:', err);
    res.status(500).json({ success: false, message: 'Server error retrieving restaurant features.' });
  }
}

async function getRestaurantFeatures(req, res) {
  try {
    const { id } = req.params;
    const [rest] = await query('SELECT id, name, slug FROM restaurants WHERE id = ?', [id]);
    if (!rest) return res.status(404).json({ success: false, message: 'Restaurant not found.' });

    const row = await ensureFeatureRow(id);
    const features = {};
    DEFAULT_FEATURE_KEYS.forEach(k => {
      features[k] = row[k] !== undefined ? row[k] : 1;
    });

    res.json({
      success: true,
      restaurant: rest,
      features
    });
  } catch (err) {
    console.error('getRestaurantFeatures Error:', err);
    res.status(500).json({ success: false, message: 'Server error retrieving features.' });
  }
}

async function updateRestaurantFeatures(req, res) {
  try {
    const { id } = req.params;
    const [rest] = await query('SELECT id, name, slug FROM restaurants WHERE id = ?', [id]);
    if (!rest) return res.status(404).json({ success: false, message: 'Restaurant not found.' });

    await ensureFeatureRow(id);

    const updateFields = [];
    const updateParams = [];

    for (const key of DEFAULT_FEATURE_KEYS) {
      if (req.body[key] !== undefined) {
        const val = req.body[key] ? 1 : 0;
        updateFields.push(`${key} = ?`);
        updateParams.push(val);
      }
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid feature fields provided.' });
    }

    updateParams.push(id);
    await query(
      `UPDATE restaurant_feature_controls SET ${updateFields.join(', ')} WHERE restaurant_id = ?`,
      updateParams
    );

    // Fetch complete updated feature set
    const freshRow = await ensureFeatureRow(id);
    const fullFeatures = {};
    DEFAULT_FEATURE_KEYS.forEach(k => {
      fullFeatures[k] = freshRow[k];
    });

    // If custom_subdomain is toggled, sync restaurants.custom_subdomain_enabled
    if (req.body.custom_subdomain !== undefined) {
      await query('UPDATE restaurants SET custom_subdomain_enabled = ? WHERE id = ?', [req.body.custom_subdomain ? 1 : 0, id]);
    }
    // If online_ordering is toggled, sync restaurants.is_online_ordering_enabled
    if (req.body.online_ordering !== undefined) {
      await query('UPDATE restaurants SET is_online_ordering_enabled = ? WHERE id = ?', [req.body.online_ordering ? 1 : 0, id]);
    }

    // Broadcast socket event for real-time instant UI update
    try {
      const io = NotificationService.getSocketIO ? NotificationService.getSocketIO() : null;
      if (io) {
        io.emit('restaurant_features_updated', {
          restaurantId: parseInt(id, 10),
          features: fullFeatures
        });
      }
    } catch (e) {}

    res.json({
      success: true,
      message: 'Feature controls updated successfully.',
      restaurant: rest,
      features: fullFeatures
    });
  } catch (err) {
    console.error('updateRestaurantFeatures Error:', err);
    res.status(500).json({ success: false, message: 'Server error updating features.' });
  }
}

async function bulkSetRestaurantFeatures(req, res) {
  try {
    const { id } = req.params;
    const { preset } = req.body; // 'full', 'food_dining_only', 'cloud_kitchen', 'disable_all'

    const [rest] = await query('SELECT id, name, slug FROM restaurants WHERE id = ?', [id]);
    if (!rest) return res.status(404).json({ success: false, message: 'Restaurant not found.' });

    await ensureFeatureRow(id);

    let targetFeatures = {};
    if (preset === 'full') {
      DEFAULT_FEATURE_KEYS.forEach(k => { targetFeatures[k] = 1; });
    } else if (preset === 'food_dining_only') {
      DEFAULT_FEATURE_KEYS.forEach(k => { targetFeatures[k] = 1; });
      targetFeatures.hotel_accommodations = 0;
    } else if (preset === 'cloud_kitchen') {
      DEFAULT_FEATURE_KEYS.forEach(k => { targetFeatures[k] = 0; });
      targetFeatures.online_ordering = 1;
      targetFeatures.delivery_fleet = 1;
      targetFeatures.rewards_wallet = 1;
      targetFeatures.inventory_stock = 1;
      targetFeatures.reports_analytics = 1;
      targetFeatures.pos_billing = 1;
    } else if (preset === 'disable_all') {
      DEFAULT_FEATURE_KEYS.forEach(k => { targetFeatures[k] = 0; });
    } else {
      return res.status(400).json({ success: false, message: 'Unknown preset profile.' });
    }

    const setClauses = DEFAULT_FEATURE_KEYS.map(k => `${k} = ?`).join(', ');
    const setValues = DEFAULT_FEATURE_KEYS.map(k => targetFeatures[k]);
    setValues.push(id);

    await query(
      `UPDATE restaurant_feature_controls SET ${setClauses} WHERE restaurant_id = ?`,
      setValues
    );

    // Sync sub-flags
    if (targetFeatures.custom_subdomain !== undefined) {
      await query('UPDATE restaurants SET custom_subdomain_enabled = ? WHERE id = ?', [targetFeatures.custom_subdomain, id]);
    }
    if (targetFeatures.online_ordering !== undefined) {
      await query('UPDATE restaurants SET is_online_ordering_enabled = ? WHERE id = ?', [targetFeatures.online_ordering, id]);
    }

    // Broadcast socket event
    try {
      const io = NotificationService.getSocketIO ? NotificationService.getSocketIO() : null;
      if (io) {
        io.emit('restaurant_features_updated', {
          restaurantId: parseInt(id, 10),
          features: targetFeatures
        });
      }
    } catch (e) {}

    res.json({
      success: true,
      message: `Preset profile "${preset}" applied successfully.`,
      features: targetFeatures
    });
  } catch (err) {
    console.error('bulkSetRestaurantFeatures Error:', err);
    res.status(500).json({ success: false, message: 'Server error applying feature preset.' });
  }
}

module.exports = {
  getSuperAdminKPIs,
  getAllRestaurants,
  getRestaurantById,
  createRestaurant,
  updateRestaurantStatus,
  createRestaurantAdmin,
  assignRestaurantAdmin,
  removeRestaurantAdmin,
  getAllAdmins,
  updateAdminStatus,
  getAllDrivers,
  updateDriverStatus,
  getAllPlatformOrders,
  toggleCustomSubdomain,
  getAllRestaurantsWithFeatures,
  getRestaurantFeatures,
  updateRestaurantFeatures,
  bulkSetRestaurantFeatures
};
