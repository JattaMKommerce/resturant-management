const https = require('https');
const { pool } = require('../config/db');

// Query helper with error trapping
async function dbQuery(sql, params = []) {
  try {
    const [rows] = await pool.query(sql, params);
    return rows;
  } catch (err) {
    console.error(`aiAssistantController dbQuery error (${sql.slice(0, 60)}...):`, err.message);
    return [];
  }
}

/**
 * Fetch a comprehensive real-time snapshot of the hotel and restaurant operations
 */
async function getLivePlatformSnapshot(restId) {
  try {
    // 1. Restaurant Info
    const restRows = await dbQuery(
      'SELECT id, name, slug, phone, email, tagline, opening_time, closing_time, delivery_radius_km, min_order_amount, is_online_ordering_enabled, website_status FROM restaurants WHERE id = ?',
      [restId]
    );
    const restaurant = restRows[0] || { name: 'The Grand Palace', slug: 'grand-palace' };

    // 2. Accommodation & Rooms
    const roomRows = await dbQuery(
      'SELECT status, count(*) as count FROM rooms WHERE restaurant_id = ? GROUP BY status',
      [restId]
    );
    let totalRooms = 0, vacantRooms = 0, occupiedRooms = 0, cleaningRooms = 0, maintenanceRooms = 0;
    roomRows.forEach(r => {
      const cnt = parseInt(r.count, 10) || 0;
      totalRooms += cnt;
      const s = (r.status || '').toUpperCase();
      if (s === 'AVAILABLE' || s === 'VACANT') vacantRooms += cnt;
      else if (s === 'OCCUPIED' || s === 'BOOKED') occupiedRooms += cnt;
      else if (s === 'CLEANING' || s === 'DIRTY') cleaningRooms += cnt;
      else if (s === 'MAINTENANCE' || s === 'REPAIR' || s === 'OUT_OF_SERVICE') maintenanceRooms += cnt;
    });
    const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;

    // Check-ins & Check-outs today
    const folioRows = await dbQuery(
      `SELECT 
         SUM(CASE WHEN DATE(check_in_date) = CURDATE() THEN 1 ELSE 0 END) as arrivals_today,
         SUM(CASE WHEN DATE(expected_check_out) = CURDATE() OR DATE(check_out_date) = CURDATE() THEN 1 ELSE 0 END) as departures_today,
         SUM(CASE WHEN folio_status = 'OPEN' THEN 1 ELSE 0 END) as in_house_guests,
         SUM(CASE WHEN folio_status = 'OPEN' AND balance > 0 THEN 1 ELSE 0 END) as pending_folios_count,
         SUM(CASE WHEN folio_status = 'OPEN' AND balance > 0 THEN balance ELSE 0 END) as pending_folios_amount
       FROM room_folios WHERE restaurant_id = ?`,
      [restId]
    );
    const folioStats = folioRows[0] || {};
    const arrivalsToday = parseInt(folioStats.arrivals_today, 10) || 0;
    const departuresToday = parseInt(folioStats.departures_today, 10) || 0;
    const inHouseGuests = parseInt(folioStats.in_house_guests, 10) || 0;
    const pendingFoliosCount = parseInt(folioStats.pending_folios_count, 10) || 0;
    const pendingFoliosAmount = parseFloat(folioStats.pending_folios_amount) || 0;

    // 3. Online Storefront & Deliveries
    const onlineOrdersRows = await dbQuery(
      `SELECT 
         SUM(CASE WHEN order_status IN ('PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY') THEN 1 ELSE 0 END) as active_orders,
         SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) as total_today,
         SUM(CASE WHEN DATE(created_at) = CURDATE() AND order_status NOT IN ('CANCELLED', 'REJECTED') THEN total_amount ELSE 0 END) as revenue_today
       FROM orders WHERE restaurant_id = ?`,
      [restId]
    );
    const onlineStats = onlineOrdersRows[0] || {};
    const activeOnlineOrders = parseInt(onlineStats.active_orders, 10) || 0;
    const onlineOrdersToday = parseInt(onlineStats.total_today, 10) || 0;
    const onlineRevenueToday = parseFloat(onlineStats.revenue_today) || 0;

    // Active Offerings (Today's Special, Brunch, Lunch, Dinner, Combos)
    const offeringsRows = await dbQuery(
      'SELECT offering_type, title, price, available_time FROM restaurant_offerings WHERE restaurant_id = ? AND is_active = 1 ORDER BY display_order ASC',
      [restId]
    );
    const offeringsList = offeringsRows.map(o => ({
      type: o.offering_type,
      title: o.title,
      price: o.price ? `₹${o.price}` : null,
      time: o.available_time || null
    }));

    // 4. Offline Restaurant, Dining Tables & KOT
    const tableRows = await dbQuery(
      'SELECT status, count(*) as count FROM restaurant_tables WHERE restaurant_id = ? GROUP BY status',
      [restId]
    );
    let totalTables = 0, occupiedTables = 0, vacantTables = 0;
    tableRows.forEach(t => {
      const cnt = parseInt(t.count, 10) || 0;
      totalTables += cnt;
      const s = (t.status || '').toUpperCase();
      if (s === 'OCCUPIED' || s === 'BILL_REQUESTED') occupiedTables += cnt;
      else vacantTables += cnt;
    });

    // Active KOT tickets in kitchen
    const kotRows = await dbQuery(
      `SELECT count(*) as count FROM kots WHERE restaurant_id = ? AND status IN ('PENDING', 'PREPARING', 'PRINTED')`,
      [restId]
    );
    const activeKots = (kotRows[0] && parseInt(kotRows[0].count, 10)) || 0;

    // Offline billing today
    const billRows = await dbQuery(
      `SELECT count(b.id) as count, COALESCE(SUM(b.grand_total), 0) as revenue 
       FROM bills b 
       LEFT JOIN restaurant_tables t ON b.table_id = t.id 
       WHERE (t.restaurant_id = ? OR t.restaurant_id IS NULL) AND DATE(b.created_at) = CURDATE()`,
      [restId]
    );
    const offlineBillsCount = (billRows[0] && parseInt(billRows[0].count, 10)) || 0;
    const offlineRevenueToday = (billRows[0] && parseFloat(billRows[0].revenue)) || 0;


    return {
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        slug: restaurant.slug,
        phone: restaurant.phone,
        tagline: restaurant.tagline,
        opening_time: restaurant.opening_time,
        closing_time: restaurant.closing_time,
        is_online_ordering_enabled: Boolean(restaurant.is_online_ordering_enabled),
        website_status: restaurant.website_status
      },
      accommodation: {
        total_rooms: totalRooms,
        vacant_rooms: vacantRooms,
        occupied_rooms: occupiedRooms,
        cleaning_rooms: cleaningRooms,
        maintenance_rooms: maintenanceRooms,
        occupancy_rate_percent: occupancyRate,
        arrivals_today: arrivalsToday,
        departures_today: departuresToday,
        in_house_guests: inHouseGuests,
        pending_folios_count: pendingFoliosCount,
        pending_folios_amount_inr: pendingFoliosAmount,
        recommended_rate_tonight: Math.round(1800 * (1 + (occupancyRate / 100) * 0.4))
      },
      online_storefront: {
        active_orders: activeOnlineOrders,
        total_orders_today: onlineOrdersToday,
        revenue_today_inr: onlineRevenueToday,
        delivery_radius_km: restaurant.delivery_radius_km || 10,
        offerings_count: offeringsList.length,
        active_specials_and_combos: offeringsList
      },
      offline_restaurant: {
        total_tables: totalTables,
        occupied_tables: occupiedTables,
        vacant_tables: vacantTables,
        active_kots_in_kitchen: activeKots,
        bills_settled_today: offlineBillsCount,
        offline_revenue_today_inr: offlineRevenueToday
      },
      timestamp: new Date().toISOString()
    };
  } catch (err) {
    console.error('getLivePlatformSnapshot Error:', err);
    return {
      restaurant: { name: 'Hotel & Restaurant' },
      accommodation: {},
      online_storefront: {},
      offline_restaurant: {},
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Call xAI Grok API
 */
function callGrokAPI(apiKey, messages, model = 'grok-2-latest') {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      model,
      messages,
      temperature: 0.3,
      max_tokens: 800
    });

    const req = https.request(
      {
        hostname: 'api.x.ai',
        port: 443,
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'Content-Length': Buffer.byteLength(payload)
        },
        timeout: 15000
      },
      (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const parsed = JSON.parse(body);
              const text = parsed.choices?.[0]?.message?.content || '';
              resolve({ success: true, text });
            } catch (e) {
              reject(new Error(`Failed to parse Grok JSON: ${e.message}`));
            }
          } else {
            let errorMsg = body;
            try {
              const parsed = JSON.parse(body);
              errorMsg = parsed.error || parsed.message || body;
            } catch (e) { }
            reject({ statusCode: res.statusCode, message: errorMsg });
          }
        });
      }
    );

    req.on('error', err => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Grok API request timed out after 15 seconds.'));
    });

    req.write(payload);
    req.end();
  });
}

/**
 * Intelligent domain filter: check if the question is related to the restaurant/hotel operations
 */
function isHotelRestaurantTopic(text) {
  if (!text || typeof text !== 'string') return false;
  const lower = text.toLowerCase().trim();

  // Greeting or general operational query
  if (/^(hi|hello|hey|welcome|good morning|good evening|who are you|what can you do|help|status|overview|summary)/i.test(lower)) {
    return true;
  }

  // Keywords across all 3 pillars: Online, Offline, Accommodation
  const keywords = [
    'hotel', 'restaurant', 'room', 'rooms', 'occupancy', 'vacant', 'guest', 'guests', 'checkin', 'check in', 'check-in',
    'checkout', 'check out', 'check-out', 'folio', 'folios', 'balance', 'housekeeping', 'cleaning', 'repair', 'maintenance',
    'online', 'order', 'orders', 'delivery', 'deliveries', 'special', 'specials', 'brunch', 'lunch', 'dinner', 'combo', 'combos',
    'menu', 'food', 'dish', 'dishes', 'kitchen', 'kot', 'table', 'tables', 'bill', 'bills', 'billing', 'waiter', 'chef',
    'revenue', 'sales', 'payment', 'payments', 'earning', 'earnings', 'rate', 'adr', 'price', 'pricing', 'storefront',
    'how is', 'performing', 'performance', 'today', 'tonight', 'lead', 'inquiry', 'inquiries', 'whatsapp', 'staff', 'rider',
    'inventory', 'stock', 'batch', 'supplier', 'recipe'
  ];

  return keywords.some(k => lower.includes(k));
}

/**
 * High-precision local fallback response generator using the live snapshot data
 * Used when xAI credit account is being topped up or experiencing upstream rate limit
 */
function generateLiveLocalResponse(query, snapshot) {
  const q = (query || '').toLowerCase();
  const restName = snapshot.restaurant.name || 'Your Hotel';
  const acc = snapshot.accommodation || {};
  const online = snapshot.online_storefront || {};
  const offline = snapshot.offline_restaurant || {};

  // 1. Off-topic guardrail
  if (!isHotelRestaurantTopic(q)) {
    return `I am your **${restName}** Operations Copilot. I only monitor and answer questions regarding **${restName}'s**:\n\n• **Online Storefront & Deliveries** (orders, specials, delivery status)\n• **Offline Restaurant & KOT** (dining tables, kitchen tickets, in-house billing)\n• **Hotel Accommodation** (rooms tonight, check-ins, check-outs, folios & housekeeping)\n\nPlease feel free to ask anything about your hotel or restaurant operations!`;
  }

  // 2. Room / Accommodation questions
  if (q.includes('room') || q.includes('occupan') || q.includes('vacan') || q.includes('stay') || q.includes('hotel') || q.includes('tonight')) {
    return `### 🏨 Accommodation Status for **${restName}**\n\n` +
      `• **Tonight's Availability**: **${acc.vacant_rooms ?? 0} of ${acc.total_rooms ?? 0} Rooms Available** (${acc.occupancy_rate_percent ?? 0}% occupancy)\n` +
      `• **Occupied Rooms**: ${acc.occupied_rooms ?? 0} rooms currently occupied\n` +
      `• **Housekeeping Status**: ${acc.cleaning_rooms ?? 0} cleaning in progress • ${acc.maintenance_rooms ?? 0} under repair\n` +
      `• **Front Desk Movements Today**: ${acc.arrivals_today ?? 0} check-ins • ${acc.departures_today ?? 0} check-outs (${acc.in_house_guests ?? 0} in-house guests)\n` +
      `• **Pending Folios**: ${acc.pending_folios_count ?? 0} folios awaiting settlement (₹${Number(acc.pending_folios_amount_inr ?? 0).toLocaleString('en-IN')} pending)\n` +
      `• **Smart Dynamic Rate**: Optimal base charge tonight is **₹${Number(acc.recommended_rate_tonight ?? 1800).toLocaleString('en-IN')}/night**.`;
  }

  // 3. Online orders / Delivery / Specials / Combos
  if (q.includes('online') || q.includes('delivery') || q.includes('special') || q.includes('combo') || q.includes('brunch') || q.includes('lunch') || q.includes('dinner')) {
    const specialsText = (online.active_specials_and_combos || []).length > 0
      ? online.active_specials_and_combos.map(s => `  - **${s.title}** (${s.type}): ${s.price || 'Regular'} ${s.time ? `[${s.time}]` : ''}`).join('\n')
      : '  - No active specials or combos configured right now. You can add them in Setup Wizard or Settings.';

    return `### 🌐 Online Storefront Status for **${restName}**\n\n` +
      `• **Live Orders**: **${online.active_orders ?? 0} active orders** currently being prepared or out for delivery\n` +
      `• **Today's Online Sales**: ₹${Number(online.revenue_today_inr ?? 0).toLocaleString('en-IN')} (${online.total_orders_today ?? 0} orders received today)\n` +
      `• **Delivery Coverage**: ${online.delivery_radius_km ?? 10} km radius around the restaurant\n` +
      `• **Today's Specials & Value Combos (${online.offerings_count ?? 0} Active)**:\n${specialsText}\n\n` +
      `*Customers can see these featured cards directly at the top of your digital menu.*`;
  }

  // 4. Dining tables / KOT / Kitchen / Offline
  if (q.includes('table') || q.includes('kot') || q.includes('kitchen') || q.includes('dine') || q.includes('offline') || q.includes('bill')) {
    return `### 🍽️ Offline Restaurant & KOT for **${restName}**\n\n` +
      `• **Dining Tables**: **${offline.occupied_tables ?? 0} of ${offline.total_tables ?? 0} Tables Occupied** (${offline.vacant_tables ?? 0} vacant & ready)\n` +
      `• **Kitchen Orders (KOT)**: **${offline.active_kots_in_kitchen ?? 0} active KOT tickets** currently printing or in preparation in the kitchen\n` +
      `• **Offline Bills Today**: ₹${Number(offline.offline_revenue_today_inr ?? 0).toLocaleString('en-IN')} across ${offline.bills_settled_today ?? 0} settled dining bills.`;
  }

  // 5. Payment / Revenue / Performance questions
  if (q.includes('perform') || q.includes('revenue') || q.includes('sale') || q.includes('money') || q.includes('payment') || q.includes('folio') || q.includes('summary')) {
    const totalRev = (online.revenue_today_inr || 0) + (offline.offline_revenue_today_inr || 0);
    return `### ⚡ Executive Daily Briefing for **${restName}**\n\n` +
      `Here is your 360° operational snapshot across all 3 pillars:\n\n` +
      `**1. Hotel Accommodation**:\n` +
      `• ${acc.vacant_rooms ?? 0}/${acc.total_rooms ?? 0} Rooms Left (${acc.occupancy_rate_percent ?? 0}% occupancy)\n` +
      `• ${acc.arrivals_today ?? 0} Check-ins • ${acc.departures_today ?? 0} Check-outs • ${acc.in_house_guests ?? 0} In-House Guests\n` +
      `• ₹${Number(acc.pending_folios_amount_inr ?? 0).toLocaleString('en-IN')} pending across ${acc.pending_folios_count ?? 0} room folios\n\n` +
      `**2. Online Storefront**:\n` +
      `• ${online.active_orders ?? 0} active orders in progress\n` +
      `• ₹${Number(online.revenue_today_inr ?? 0).toLocaleString('en-IN')} online revenue today\n` +
      `• ${online.offerings_count ?? 0} active Today's Specials / Combos featured on website\n\n` +
      `**3. Offline Dining & Kitchen**:\n` +
      `• ${offline.occupied_tables ?? 0}/${offline.total_tables ?? 0} tables occupied • ${offline.active_kots_in_kitchen ?? 0} KOTs in kitchen\n` +
      `• ₹${Number(offline.offline_revenue_today_inr ?? 0).toLocaleString('en-IN')} dining revenue settled today\n\n` +
      `**Total Combined Revenue Today**: **₹${Number(totalRev).toLocaleString('en-IN')}**`;
  }

  // General default overview
  return `### 👋 Hello! I am your AI Operations Copilot for **${restName}**\n\n` +
    `I am actively monitoring all systems in real time:\n\n` +
    `• **🏨 Accommodation**: ${acc.vacant_rooms ?? 0}/${acc.total_rooms ?? 0} rooms available tonight (${acc.occupancy_rate_percent ?? 0}% occupancy)\n` +
    `• **🌐 Online Storefront**: ${online.active_orders ?? 0} active orders • ₹${Number(online.revenue_today_inr ?? 0).toLocaleString('en-IN')} sales today\n` +
    `• **🍽️ Offline & KOT**: ${offline.occupied_tables ?? 0}/${offline.total_tables ?? 0} tables occupied • ${offline.active_kots_in_kitchen ?? 0} KOTs in kitchen\n\n` +
    `You can ask me anything about your rooms, check-ins, online orders, today's specials, dining tables, or pending payments!`;
}

/**
 * POST /api/admin/ai/chat
 */
async function chatWithAssistant(req, res) {
  try {
    const { messages = [], message = '', focus = '' } = req.body;
    const focusLabel = typeof focus === 'string' ? focus.trim().slice(0, 80) : '';
    let userQuery = message;
    if (!userQuery && Array.isArray(messages) && messages.length > 0) {
      const last = messages[messages.length - 1];
      userQuery = last?.content || '';
    }

    if (!userQuery || !userQuery.trim()) {
      return res.status(400).json({ success: false, message: 'Message content is required.' });
    }

    // Determine target restaurant ID
    let restId = req.adminRestaurantId;
    if (!restId && (req.query?.slug || req.headers['x-restaurant-slug'])) {
      const targetSlug = req.query?.slug || req.headers['x-restaurant-slug'];
      const rows = await dbQuery('SELECT id FROM restaurants WHERE slug = ?', [targetSlug]);
      if (rows.length > 0) restId = rows[0].id;
    }
    if (!restId) {
      const [firstRest] = await dbQuery('SELECT id FROM restaurants ORDER BY id ASC LIMIT 1');
      restId = firstRest ? firstRest.id : 1;
    }

    // Fetch real-time snapshot
    const snapshot = await getLivePlatformSnapshot(restId);
    const restName = snapshot.restaurant.name || 'The Grand Palace';

    // Domain Boundary Enforcement:
    // If clearly asking about something completely unrelated to hotel/restaurant:
    if (!isHotelRestaurantTopic(userQuery)) {
      return res.json({
        success: true,
        reply: `I am Your AI Assistant for **${restName}**. I am strictly programmed to monitor and answer questions regarding **${restName}'s** hotel accommodation, online storefront & deliveries, and offline dining & KOT operations.\n\nPlease ask about your rooms, check-ins, online orders, dining tables, today's specials, or revenue!`,
        restaurant_name: restName,
        is_off_topic: true,
        provider: 'guardian-policy'
      });
    }

    const apiKey = process.env.GROK_API_KEY || process.env.XAI_API_KEY;

    const systemPrompt = `You are "Your AI Assistant", the private executive operations assistant for "${restName}".
You monitor 100% of this hotel & restaurant platform in real-time. Never mention Grok, xAI, or any underlying model/provider; if asked what you are, say you are the owner's AI Assistant for "${restName}".

=== REAL-TIME LIVE DATA SNAPSHOT FOR ${restName} ===
${JSON.stringify(snapshot, null, 2)}
=====================================================

STRICT INSTRUCTIONS:
1. WELCOME & IDENTITY: You represent "${restName}". Greet the admin courteously with the restaurant name "${restName}".
2. STRICT DOMAIN SCOPE: You MUST ONLY answer questions regarding ${restName}'s operations:
   - ONLINE STOREFRONT: active delivery orders, delivery radius, today's specials/combos, menu, online sales.
   - OFFLINE DINING & KOT: table occupancies, kitchen tickets (KOT), in-house billing, waiter service.
   - ACCOMMODATION: rooms tonight (vacant/occupied), occupancy rate, check-ins/check-outs, in-house guests, pending folios and amounts, housekeeping statuses.
3. If asked about external topics (programming, politics, unrelated trivia), politely decline and redirect back to ${restName}'s operations.
4. TONE: Sharp, executive, hospitality-focused, concise. Use markdown formatting with bullet points and bold headers. Use Indian Rupees symbol (₹) for money.
5. Base all answers strictly on the live snapshot provided above.${focusLabel ? `
6. FOCUSED CARD VIEW: The owner opened this chat by clicking the "${focusLabel}" card, so they want to understand THAT section right now. Answer specifically and only about "${focusLabel}" — give the current numbers, what they mean, and the 1–2 best next actions for it. If they ask about a different area, answer briefly but remind them this focused view is about "${focusLabel}".` : ''}`;

    const chatHistory = [
      { role: 'system', content: systemPrompt }
    ];

    // Add prior conversation if passed
    if (Array.isArray(messages) && messages.length > 1) {
      messages.slice(-5, -1).forEach(m => {
        if (m.role === 'user' || m.role === 'assistant') {
          chatHistory.push({ role: m.role, content: m.content });
        }
      });
    }
    chatHistory.push({ role: 'user', content: userQuery });

    // Call Grok API
    try {
      const grokResponse = await callGrokAPI(apiKey, chatHistory, 'grok-2-latest');
      return res.json({
        success: true,
        reply: grokResponse.text,
        restaurant_name: restName,
        provider: 'xai-grok-2',
        snapshot
      });
    } catch (grokErr) {
      // If Grok API returned an error (e.g. 403 credit pending or network timeout),
      // seamlessly synthesize the high-fidelity live snapshot response!
      console.warn(`Grok API call fallback triggered (${grokErr.message || grokErr.statusCode}). Providing live local OS intelligence response.`);
      const fallbackReply = generateLiveLocalResponse(userQuery, snapshot);
      return res.json({
        success: true,
        reply: fallbackReply,
        restaurant_name: restName,
        provider: 'grok-operations-engine',
        notice: grokErr.statusCode === 403 ? 'Answering from live system intelligence.' : undefined,
        snapshot
      });
    }
  } catch (err) {
    console.error('chatWithAssistant Error:', err);
    res.status(500).json({ success: false, message: 'Server error processing AI chat.' });
  }
}

/**
 * GET /api/admin/ai/snapshot
 */
async function getAISnapshot(req, res) {
  try {
    let restId = req.adminRestaurantId;
    if (!restId && (req.query?.slug || req.headers['x-restaurant-slug'])) {
      const targetSlug = req.query?.slug || req.headers['x-restaurant-slug'];
      const rows = await dbQuery('SELECT id FROM restaurants WHERE slug = ?', [targetSlug]);
      if (rows.length > 0) restId = rows[0].id;
    }
    if (!restId) {
      const [firstRest] = await dbQuery('SELECT id FROM restaurants ORDER BY id ASC LIMIT 1');
      restId = firstRest ? firstRest.id : 1;
    }
    const snapshot = await getLivePlatformSnapshot(restId);
    res.json({ success: true, snapshot });
  } catch (err) {
    console.error('getAISnapshot Error:', err);
    res.status(500).json({ success: false, message: 'Server error fetching platform snapshot.' });
  }
}

module.exports = {
  chatWithAssistant,
  getAISnapshot,
  getLivePlatformSnapshot
};
