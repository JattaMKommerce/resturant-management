const pool = require('../../config/database');

async function getOperationsOverview(restaurantId = 1) {
  const connection = await pool.getConnection();
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // 1. Tables Breakdown
    const [tables] = await connection.query(
      `SELECT id, table_number, table_name, floor, section, capacity, table_type, status, updated_at
       FROM restaurant_tables
       WHERE is_active = TRUE AND (restaurant_id = ? OR restaurant_id IS NULL)
       ORDER BY table_number ASC`,
      [restaurantId]
    );

    const tableCounts = {
      AVAILABLE: 0,
      OCCUPIED: 0,
      ORDERING: 0,
      RESERVED: 0,
      BILL_REQUESTED: 0,
      BILL_PAID: 0,
      CLEANING: 0,
      OUT_OF_SERVICE: 0,
      ATTENTION: 0
    };

    // Calculate long waiting tables & attention count
    const [longWaitingRows] = await connection.query(
      `SELECT t.id, t.table_number, TIMESTAMPDIFF(MINUTE, MIN(k.kitchen_received_at), NOW()) as waiting_mins
       FROM kots k
       JOIN restaurant_tables t ON k.table_id = t.id
       WHERE k.status IN ('PENDING', 'ACCEPTED', 'PREPARING')
       GROUP BY t.id, t.table_number
       HAVING waiting_mins >= 30`
    );
    const longWaitingTableIds = new Set(longWaitingRows.map(r => r.id));

    // Tables with ready food waiting to be served
    const [readyFoodTablesRows] = await connection.query(
      `SELECT DISTINCT table_id FROM kots WHERE status = 'READY' AND table_id IS NOT NULL`
    );
    const readyFoodTableIds = new Set(readyFoodTablesRows.map(r => r.table_id));

    tables.forEach(t => {
      if (tableCounts[t.status] !== undefined) {
        tableCounts[t.status]++;
      }
      if (
        t.status === 'BILL_REQUESTED' ||
        t.status === 'CLEANING' ||
        longWaitingTableIds.has(t.id) ||
        readyFoodTableIds.has(t.id)
      ) {
        tableCounts.ATTENTION++;
      }
    });

    // 2. Active Orders Breakdown (Combined Offline & Online)
    const [offlineOrdersSummary] = await connection.query(
      `SELECT 
         COUNT(CASE WHEN order_status IN ('PENDING', 'CONFIRMED', 'IN_KITCHEN', 'READY', 'SERVED') THEN 1 END) as active_orders,
         COUNT(CASE WHEN order_status = 'IN_KITCHEN' THEN 1 END) as preparing,
         COUNT(CASE WHEN order_status = 'PENDING' THEN 1 END) as waiting,
         COUNT(CASE WHEN order_status = 'READY' THEN 1 END) as ready,
         COUNT(CASE WHEN order_status = 'SERVED' THEN 1 END) as served,
         COUNT(CASE WHEN payment_status = 'UNPAID' AND order_status != 'CANCELLED' THEN 1 END) as bills_pending
       FROM restaurant_orders
       WHERE created_at >= ?`,
      [todayStart]
    );

    const [onlineOrdersSummary] = await connection.query(
      `SELECT 
         COUNT(CASE WHEN order_status IN ('PENDING', 'ACCEPTED', 'SENT_TO_KITCHEN', 'PREPARING', 'READY_FOR_PICKUP', 'ASSIGNED_TO_DRIVER', 'DRIVER_ACCEPTED', 'PICKED_UP', 'OUT_FOR_DELIVERY') THEN 1 END) as active_orders,
         COUNT(CASE WHEN order_status = 'PENDING' THEN 1 END) as pending,
         COUNT(CASE WHEN order_status IN ('SENT_TO_KITCHEN', 'PREPARING', 'ACCEPTED') THEN 1 END) as in_kitchen,
         COUNT(CASE WHEN order_status = 'READY_FOR_PICKUP' THEN 1 END) as ready,
         COUNT(CASE WHEN order_status IN ('ASSIGNED_TO_DRIVER', 'DRIVER_ACCEPTED', 'PICKED_UP', 'OUT_FOR_DELIVERY') THEN 1 END) as out_for_delivery,
         COUNT(CASE WHEN order_status = 'DELIVERED' THEN 1 END) as delivered
       FROM orders
       WHERE created_at >= ?`,
      [todayStart]
    );

    const offM = offlineOrdersSummary[0] || {};
    const onM = onlineOrdersSummary[0] || {};

    const activeOrdersMetrics = {
      active_orders: (parseInt(offM.active_orders) || 0) + (parseInt(onM.active_orders) || 0),
      preparing: (parseInt(offM.preparing) || 0) + (parseInt(onM.in_kitchen) || 0),
      waiting: (parseInt(offM.waiting) || 0) + (parseInt(onM.pending) || 0),
      ready: (parseInt(offM.ready) || 0) + (parseInt(onM.ready) || 0),
      served: parseInt(offM.served) || 0,
      out_for_delivery: parseInt(onM.out_for_delivery) || 0,
      delivered: parseInt(onM.delivered) || 0,
      bills_pending: parseInt(offM.bills_pending) || 0,
      // Granular Channels
      offline_active: parseInt(offM.active_orders) || 0,
      online_active: parseInt(onM.active_orders) || 0
    };

    // 3. Kitchen Live Status & Performance Metrics (Online + Offline)
    const [activeKots] = await connection.query(
      `SELECT k.*, kd.name as dept_name, kd.code as dept_code, t.table_number,
              COALESCE(ord.order_number, o.order_number, CONCAT('ORD-', k.order_id)) as order_number,
              ord.customer_name as online_customer_name,
              ord.delivery_address as online_delivery_address
       FROM kots k
       JOIN kitchen_departments kd ON k.kitchen_department_id = kd.id
       LEFT JOIN restaurant_tables t ON k.table_id = t.id
       LEFT JOIN restaurant_orders o ON k.order_id = o.id
       LEFT JOIN orders ord ON k.order_id = ord.id
       WHERE k.status IN ('PENDING', 'ACCEPTED', 'PREPARING', 'READY')
         AND k.created_at >= ?
       ORDER BY k.created_at DESC`,
      [todayStart]
    );

    let onTimeCount = 0;
    let gettingLateCount = 0;
    let lateCount = 0;
    let readyKotsCount = 0;
    let totalPrepTimeMins = 0;

    let onlineKotsCount = 0;
    let offlineKotsCount = 0;
    let onlineLateCount = 0;
    let offlineLateCount = 0;

    const now = new Date();

    activeKots.forEach(k => {
      const isOnline = k.order_type === 'ONLINE' || (!k.table_id && !k.room_id);
      if (isOnline) {
        onlineKotsCount++;
      } else {
        offlineKotsCount++;
      }

      if (k.status === 'READY') {
        readyKotsCount++;
      } else {
        const received = new Date(k.kitchen_received_at);
        const target = k.target_completion_at ? new Date(k.target_completion_at) : new Date(received.getTime() + 15 * 60000);
        const totalDurationMs = target.getTime() - received.getTime();
        const elapsedMs = now.getTime() - received.getTime();

        if (now > target) {
          lateCount++;
          if (isOnline) onlineLateCount++; else offlineLateCount++;
        } else if (elapsedMs / totalDurationMs >= 0.75) {
          gettingLateCount++;
        } else {
          onTimeCount++;
        }
      }
    });

    // Average prep time today (for completed/ready KOTs today)
    const [completedKotTimes] = await connection.query(
      `SELECT TIMESTAMPDIFF(MINUTE, kitchen_received_at, completed_at) as prep_mins
       FROM kots
       WHERE completed_at IS NOT NULL AND created_at >= ?`,
      [todayStart]
    );

    if (completedKotTimes.length > 0) {
      const sum = completedKotTimes.reduce((acc, row) => acc + (row.prep_mins || 0), 0);
      totalPrepTimeMins = Math.round(sum / completedKotTimes.length);
    } else {
      totalPrepTimeMins = 15; // default benchmark
    }

    const kitchenMetrics = {
      on_time: onTimeCount,
      getting_late: gettingLateCount,
      late: lateCount,
      ready: readyKotsCount,
      active_kots: activeKots.length,
      offline_kots: offlineKotsCount,
      online_kots: onlineKotsCount,
      offline_late: offlineLateCount,
      online_late: onlineLateCount,
      avg_prep_time_minutes: totalPrepTimeMins,
      target_prep_time_minutes: 15
    };

    // 4. Kitchen Bottleneck Detection
    const [deptKots] = await connection.query(
      `SELECT kd.id as dept_id, kd.name as dept_name, kd.code as dept_code,
              COUNT(k.id) as active_count,
              COUNT(CASE WHEN k.status IN ('PENDING', 'ACCEPTED', 'PREPARING') AND (k.target_completion_at < NOW() OR (k.target_completion_at IS NULL AND TIMESTAMPDIFF(MINUTE, k.kitchen_received_at, NOW()) > 15)) THEN 1 END) as late_count,
              AVG(CASE WHEN k.kitchen_received_at IS NOT NULL THEN TIMESTAMPDIFF(MINUTE, k.kitchen_received_at, NOW()) END) as avg_elapsed_mins
       FROM kitchen_departments kd
       LEFT JOIN kots k ON k.kitchen_department_id = kd.id AND k.status IN ('PENDING', 'ACCEPTED', 'PREPARING') AND k.created_at >= ?
       WHERE kd.is_active = TRUE
       GROUP BY kd.id, kd.name, kd.code`,
      [todayStart]
    );

    let bottleneck = null;
    let highestLateCount = 0;
    let worstDept = null;

    deptKots.forEach(d => {
      const late = parseInt(d.late_count) || 0;
      const active = parseInt(d.active_count) || 0;
      if (late > highestLateCount || (late === highestLateCount && active > (worstDept ? worstDept.active_count : 0))) {
        highestLateCount = late;
        worstDept = d;
      }
    });

    if (worstDept && (highestLateCount > 0 || parseInt(worstDept.active_count) >= 5)) {
      bottleneck = {
        detected: true,
        department_id: worstDept.dept_id,
        department_name: worstDept.dept_name,
        active_kots: parseInt(worstDept.active_count) || 0,
        late_kots: parseInt(worstDept.late_count) || 0,
        avg_prep_mins: Math.round(parseFloat(worstDept.avg_elapsed_mins) || 15),
        status_text: `${worstDept.dept_name} has ${worstDept.late_count} delayed KOTs (${worstDept.active_count} active tickets)`
      };
    } else {
      bottleneck = {
        detected: false,
        department_name: 'All Kitchen Stations',
        status_text: 'All kitchen lines running smoothly within SLA'
      };
    }

    // 5. Active Priority KOTs List
    const [kotItemsRows] = await connection.query(
      `SELECT ki.*, k.kitchen_department_id, k.table_id
       FROM kot_items ki
       JOIN kots k ON ki.kot_id = k.id
       WHERE k.status IN ('PENDING', 'ACCEPTED', 'PREPARING', 'READY')
         AND k.created_at >= ?
       ORDER BY k.created_at DESC`,
      [todayStart]
    );

    const kotMap = {};
    activeKots.forEach(k => {
      const received = new Date(k.kitchen_received_at);
      const target = k.target_completion_at ? new Date(k.target_completion_at) : new Date(received.getTime() + 15 * 60000);
      let urgencyCategory = 'ON_TIME';
      let timerText = '';
      const diffMs = now.getTime() - target.getTime();
      const elapsedMs = now.getTime() - received.getTime();
      const totalDurationMs = target.getTime() - received.getTime();

      if (k.status === 'READY') {
        urgencyCategory = 'READY';
        timerText = 'READY';
      } else if (now > target) {
        urgencyCategory = 'LATE';
        const mins = Math.floor(diffMs / 60000);
        const secs = Math.floor((diffMs % 60000) / 1000);
        timerText = `+${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')} LATE`;
      } else if (elapsedMs / totalDurationMs >= 0.75) {
        urgencyCategory = 'GETTING_LATE';
        const remainMs = target.getTime() - now.getTime();
        const mins = Math.floor(remainMs / 60000);
        const secs = Math.floor((remainMs % 60000) / 1000);
        timerText = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      } else {
        urgencyCategory = 'ON_TIME';
        const remainMs = target.getTime() - now.getTime();
        const mins = Math.floor(remainMs / 60000);
        const secs = Math.floor((remainMs % 60000) / 1000);
        timerText = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      }

      const sortPriority = urgencyCategory === 'LATE' ? 1 : urgencyCategory === 'GETTING_LATE' ? 2 : urgencyCategory === 'ON_TIME' ? 3 : 4;

      const isOnline = k.order_type === 'ONLINE' || (!k.table_id && !k.room_id);
      const rawOrderNum = String(k.order_number || '');
      const cleanDigits = rawOrderNum.replace(/\D/g, '');
      const last5 = cleanDigits.length >= 5 ? cleanDigits.slice(-5) : rawOrderNum.slice(-5) || '-----';

      kotMap[k.id] = {
        id: k.id,
        kot_number: k.kot_number,
        table_number: isOnline ? null : (k.table_number || 'Takeaway'),
        order_type: isOnline ? 'ONLINE' : (k.order_type || 'DINE_IN'),
        order_number: rawOrderNum,
        order_token: last5,
        online_customer_name: k.online_customer_name,
        dept_name: k.dept_name,
        status: k.status,
        urgency_category: urgencyCategory,
        sort_priority: sortPriority,
        timer_text: timerText,
        kitchen_received_at: k.kitchen_received_at,
        items: []
      };
    });

    kotItemsRows.forEach(item => {
      if (kotMap[item.kot_id]) {
        kotMap[item.kot_id].items.push({
          id: item.id,
          name: item.item_name,
          quantity: item.quantity,
          status: item.status
        });
      }
    });

    const priorityKots = Object.values(kotMap).sort((a, b) => a.sort_priority - b.sort_priority || new Date(a.kitchen_received_at) - new Date(b.kitchen_received_at));

    // 6. Inventory Monitoring & Alerts
    const [inventoryRows] = await connection.query(
      `SELECT i.*, c.name as category_name
       FROM inventory_items i
       LEFT JOIN inventory_categories c ON i.category_id = c.id
       ORDER BY i.item_name ASC`
    );

    // Sum used today from stock_transactions
    const [usedTodayRows] = await connection.query(
      `SELECT inventory_item_id, SUM(ABS(change_quantity)) as total_used
       FROM stock_transactions
       WHERE type = 'ORDER_DEDUCTION' AND created_at >= ?
       GROUP BY inventory_item_id`,
      [todayStart]
    );
    const usedTodayMap = {};
    usedTodayRows.forEach(r => usedTodayMap[r.inventory_item_id] = parseFloat(r.total_used) || 0);

    const inventoryList = [];
    const inventoryAlerts = [];
    const lowOrOutOfStockItemIds = [];

    inventoryRows.forEach(inv => {
      const currentStock = parseFloat(inv.current_stock) || 0;
      const minAlert = parseFloat(inv.min_stock_alert) || 0;
      const usedToday = usedTodayMap[inv.id] || 0;

      let status = 'STOCK_OK';
      if (currentStock <= 0) {
        status = 'OUT_OF_STOCK';
        lowOrOutOfStockItemIds.push(inv.id);
      } else if (currentStock <= minAlert) {
        status = 'LOW_STOCK';
        lowOrOutOfStockItemIds.push(inv.id);
      }

      const itemData = {
        id: inv.id,
        item_name: inv.item_name,
        unit: inv.unit,
        current_stock: currentStock,
        used_today: usedToday,
        min_stock_alert: minAlert,
        status
      };

      inventoryList.push(itemData);

      if (status === 'LOW_STOCK' || status === 'OUT_OF_STOCK') {
        inventoryAlerts.push(itemData);
      }
    });

    // 7. Recipe BOM Menu Impact (Informational)
    let menuImpact = [];
    if (lowOrOutOfStockItemIds.length > 0) {
      const placeholders = lowOrOutOfStockItemIds.map(() => '?').join(',');
      const [affectedRows] = await connection.query(
        `SELECT DISTINCT mi.id, mi.name as menu_item_name, ii.item_name as ingredient_name, ii.current_stock
         FROM recipe_ingredients ri
         JOIN recipes r ON ri.recipe_id = r.id
         JOIN menu_items mi ON r.menu_item_id = mi.id
         JOIN inventory_items ii ON ri.inventory_item_id = ii.id
         WHERE ri.inventory_item_id IN (${placeholders}) AND mi.is_active = TRUE`,
        lowOrOutOfStockItemIds
      );

      const impactMap = {};
      affectedRows.forEach(r => {
        if (!impactMap[r.ingredient_name]) {
          impactMap[r.ingredient_name] = {
            ingredient: r.ingredient_name,
            current_stock: parseFloat(r.current_stock) || 0,
            menu_items: []
          };
        }
        impactMap[r.ingredient_name].menu_items.push(r.menu_item_name);
      });
      menuImpact = Object.values(impactMap);
    }

    // 8. Today's Sales & Billing Data (Combined Offline POS & Online Delivery)
    const [offlineSalesRows] = await connection.query(
      `SELECT 
         COALESCE(SUM(b.grand_total), 0) as today_revenue,
         COUNT(b.id) as total_bills,
         COUNT(CASE WHEN b.payment_status IN ('PAID', 'ROOM_CHARGED') THEN 1 END) as paid_bills,
         COUNT(CASE WHEN b.payment_status = 'UNPAID' THEN 1 END) as pending_bills
       FROM bills b
       WHERE b.created_at >= ?`,
      [todayStart]
    );

    const [onlineSalesRows] = await connection.query(
      `SELECT 
         COALESCE(SUM(p.amount), 0) as today_revenue,
         COUNT(p.id) as paid_orders
       FROM payments p
       WHERE p.status = 'SUCCESS' AND p.created_at >= ?`,
      [todayStart]
    );

    const [completedOfflineRows] = await connection.query(
      `SELECT COUNT(id) as count
       FROM restaurant_orders
       WHERE order_status = 'COMPLETED' AND created_at >= ?`,
      [todayStart]
    );

    const [completedOnlineRows] = await connection.query(
      `SELECT COUNT(id) as count
       FROM orders
       WHERE order_status = 'DELIVERED' AND created_at >= ?`,
      [todayStart]
    );

    const [pendingOnlineRows] = await connection.query(
      `SELECT COUNT(id) as count
       FROM orders
       WHERE order_status NOT IN ('DELIVERED', 'CANCELLED') AND payment_status != 'COMPLETED' AND created_at >= ?`,
      [todayStart]
    );

    const offSales = offlineSalesRows[0] || {};
    const onSales = onlineSalesRows[0] || {};
    const completedOfflineCount = parseInt(completedOfflineRows[0]?.count) || 0;
    const completedOnlineCount = parseInt(completedOnlineRows[0]?.count) || 0;
    const totalCompletedOrders = completedOfflineCount + completedOnlineCount;

    const paidBillsCount = (parseInt(offSales.paid_bills) || 0) + (parseInt(onSales.paid_orders) || 0);
    const pendingBillsCount = (parseInt(offSales.pending_bills) || 0) + (parseInt(pendingOnlineRows[0]?.count) || 0);
    const todayRevenue = (parseFloat(offSales.today_revenue) || 0) + (parseFloat(onSales.today_revenue) || 0);
    const avgOrderValue = totalCompletedOrders > 0 
      ? Math.round(todayRevenue / totalCompletedOrders) 
      : (paidBillsCount > 0 ? Math.round(todayRevenue / paidBillsCount) : 0);

    const salesData = {
      today_revenue: todayRevenue,
      completed_orders: totalCompletedOrders,
      average_order_value: avgOrderValue,
      paid_bills: paidBillsCount,
      pending_bills: pendingBillsCount
    };

    // 9. Today's Payment Summary Breakdown (Cash/COD, UPI, Card, Room Charge, Other)
    const [paymentRows] = await connection.query(
      `SELECT payment_method, COALESCE(SUM(amount), 0) as total_amount
       FROM payments
       WHERE status = 'SUCCESS' AND created_at >= ?
       GROUP BY payment_method`,
      [todayStart]
    );

    const paymentBreakdown = {
      CASH: 0,
      UPI: 0,
      CARD: 0,
      ROOM_CHARGE: 0,
      OTHER: 0,
      TOTAL: 0
    };

    paymentRows.forEach(p => {
      const amt = parseFloat(p.total_amount) || 0;
      const method = (p.payment_method || '').toUpperCase();
      if (method === 'CASH' || method === 'COD') {
        paymentBreakdown.CASH += amt;
      } else if (method === 'UPI' || method === 'GPAY' || method === 'PHONEPE') {
        paymentBreakdown.UPI += amt;
      } else if (method === 'CARD' || method === 'DEBIT_CARD' || method === 'CREDIT_CARD' || method === 'POS') {
        paymentBreakdown.CARD += amt;
      } else if (method === 'ROOM_CHARGE' || method === 'ROOM' || method === 'FOLIO') {
        paymentBreakdown.ROOM_CHARGE += amt;
      } else {
        paymentBreakdown.OTHER += amt;
      }
      paymentBreakdown.TOTAL += amt;
    });

    // 10. Top Selling Dishes Today (Combined Online & Offline)
    const [topDishesRows] = await connection.query(
      `SELECT item_name, SUM(total_qty) as total_quantity, SUM(total_rev) as total_revenue
       FROM (
         SELECT oi.item_name, SUM(oi.quantity) as total_qty, SUM(COALESCE(oi.item_total, oi.unit_price * oi.quantity, 0)) as total_rev
         FROM order_items oi
         JOIN orders o ON oi.order_id = o.id
         WHERE o.created_at >= ? AND o.order_status != 'CANCELLED'
         GROUP BY oi.item_name

         UNION ALL

         SELECT oi.item_name, SUM(oi.quantity) as total_qty, SUM(COALESCE(oi.item_total, oi.unit_price * oi.quantity, 0)) as total_rev
         FROM order_items oi
         JOIN restaurant_orders ro ON oi.order_id = ro.id
         WHERE ro.created_at >= ? AND ro.order_status != 'CANCELLED'
         GROUP BY oi.item_name
       ) combined_dishes
       GROUP BY item_name
       ORDER BY total_quantity DESC, total_revenue DESC
       LIMIT 5`,
      [todayStart, todayStart]
    );

    const topDishes = topDishesRows.map(d => ({
      name: d.item_name,
      quantity: parseInt(d.total_quantity) || 0,
      revenue: parseFloat(d.total_revenue) || 0
    }));

    // 11. Waiter Service Summary
    const [waiterStatsRows] = await connection.query(
      `SELECT 
         COUNT(DISTINCT table_id) as active_tables,
         COUNT(id) as total_active_orders,
         COUNT(CASE WHEN order_status = 'READY' THEN 1 END) as ready_pickups
       FROM restaurant_orders
       WHERE order_status IN ('CONFIRMED', 'IN_KITCHEN', 'READY') AND created_at >= ?`,
      [todayStart]
    );
    const waiterSummary = {
      active_tables: waiterStatsRows[0] ? parseInt(waiterStatsRows[0].active_tables) || 0 : 0,
      active_orders: waiterStatsRows[0] ? parseInt(waiterStatsRows[0].total_active_orders) || 0 : 0,
      ready_pickups: waiterStatsRows[0] ? parseInt(waiterStatsRows[0].ready_pickups) || 0 : 0
    };

    // 12. Alerts: Ready Food Alerts & Table Attention Alerts
    const [readyAlertsRows] = await connection.query(
      `SELECT k.id as kot_id, k.kot_number, t.table_number, k.updated_at,
              GROUP_CONCAT(CONCAT(ki.item_name, ' x ', ki.quantity) SEPARATOR ', ') as items_summary
       FROM kots k
       LEFT JOIN restaurant_tables t ON k.table_id = t.id
       JOIN kot_items ki ON ki.kot_id = k.id
       WHERE k.status = 'READY' AND k.created_at >= ?
       GROUP BY k.id, k.kot_number, t.table_number, k.updated_at
       ORDER BY k.updated_at DESC
       LIMIT 10`,
      [todayStart]
    );

    const readyFoodAlerts = readyAlertsRows.map(r => ({
      kot_id: r.kot_id,
      kot_number: r.kot_number,
      table_number: r.table_number || 'N/A',
      items_summary: r.items_summary,
      timestamp: r.updated_at
    }));

    const attentionAlerts = [];

    tables.forEach(t => {
      if (t.status === 'BILL_REQUESTED') {
        attentionAlerts.push({
          table_id: t.id,
          table_number: t.table_number,
          type: 'BILL_REQUESTED',
          message: `Table ${t.table_number} requested the bill.`
        });
      } else if (t.status === 'CLEANING') {
        attentionAlerts.push({
          table_id: t.id,
          table_number: t.table_number,
          type: 'CLEANING_REQUIRED',
          message: `Table ${t.table_number} requires cleaning.`
        });
      } else if (longWaitingTableIds.has(t.id)) {
        attentionAlerts.push({
          table_id: t.id,
          table_number: t.table_number,
          type: 'LONG_WAITING',
          message: `Table ${t.table_number} has been waiting > 30 mins.`
        });
      } else if (readyFoodTableIds.has(t.id)) {
        attentionAlerts.push({
          table_id: t.id,
          table_number: t.table_number,
          type: 'FOOD_READY',
          message: `Table ${t.table_number} has food ready for pickup.`
        });
      }
    });

    // 13. Smart Insights Engine (Rule-Based)
    const smartInsights = [];

    if (topDishes.length > 0) {
      smartInsights.push(`"${topDishes[0].name}" is today's most ordered dish with ${topDishes[0].quantity} portions.`);
    }

    if (lateCount > 0) {
      smartInsights.push(`⚠️ ${lateCount} KOT${lateCount > 1 ? 's are' : ' is'} currently late in the kitchen.`);
    }

    if (inventoryAlerts.length > 0) {
      const names = inventoryAlerts.map(a => a.item_name).slice(0, 2).join(', ');
      smartInsights.push(`📦 ${names}${inventoryAlerts.length > 2 ? ' and others' : ''} ${inventoryAlerts.length > 1 ? 'are' : 'is'} below configured minimum stock level.`);
    }

    if (totalPrepTimeMins > 15) {
      smartInsights.push(`⏱️ Kitchen average preparation time (${totalPrepTimeMins} mins) is above today's target benchmark (15 mins).`);
    } else {
      smartInsights.push(`🟢 Kitchen preparation efficiency is on target at ~${totalPrepTimeMins} minutes average.`);
    }

    if (longWaitingRows.length > 0) {
      smartInsights.push(`🪑 Table ${longWaitingRows[0].table_number} has an unfulfilled order waiting for ${longWaitingRows[0].waiting_mins} minutes.`);
    }

    return {
      timestamp: new Date(),
      restaurant_status: 'OPEN',
      tables: {
        counts: tableCounts,
        total: tables.length,
        items: tables
      },
      orders: activeOrdersMetrics,
      kitchen: kitchenMetrics,
      bottleneck,
      priority_kots: priorityKots,
      inventory: {
        items: inventoryList,
        alerts: inventoryAlerts,
        menu_impact: menuImpact
      },
      sales: {
        today_revenue: todayRevenue,
        completed_orders: totalCompletedOrders,
        average_order_value: avgOrderValue,
        paid_bills: parseInt(salesData.paid_bills) || 0,
        pending_bills: parseInt(salesData.pending_bills) || 0
      },
      payments: paymentBreakdown,
      cash_reconciliation: {
        status: 'NOT_CONFIGURED',
        message: 'Cash Reconciliation Not configured'
      },
      waiter_service: waiterSummary,
      ready_food_alerts: readyFoodAlerts,
      table_attention_alerts: attentionAlerts,
      top_dishes: topDishes,
      smart_insights: smartInsights,
      customer_feedback: {
        status: 'NOT_CONFIGURED',
        message: 'Customer Feedback Not configured'
      }
    };
  } finally {
    connection.release();
  }
}

module.exports = {
  getOperationsOverview
};
