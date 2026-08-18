const pool = require('../config/database');

async function seedIntelligence() {
  console.log('Seeding recipes, inventory batches, and transactions...');
  
  // 1. Ensure inventory items exist
  const invItems = [
    ['Raw Ingredients', 'Basmati Rice', 'kg', 85.000, 10.000, 120.00],
    ['Raw Ingredients', 'Fresh Chicken', 'kg', 42.500, 8.000, 240.00],
    ['Raw Ingredients', 'Cooking Oil', 'l', 35.000, 8.000, 150.00],
    ['Raw Ingredients', 'Indian Spices Mix', 'g', 4200.000, 500.000, 0.80],
    ['Raw Ingredients', 'Fresh Paneer', 'kg', 25.000, 5.000, 320.00],
    ['Raw Ingredients', 'Fresh Button Mushrooms', 'kg', 18.000, 3.000, 180.00],
    ['Raw Ingredients', 'Fresh Lemons', 'pcs', 90.000, 20.000, 5.00],
    ['Raw Ingredients', 'Fresh Milk', 'l', 28.000, 5.000, 60.00]
  ];

  for (const [catName, name, unit, stock, alertVal, cost] of invItems) {
    const [existing] = await pool.query('SELECT id FROM inventory_items WHERE item_name = ?', [name]);
    if (existing.length === 0) {
      await pool.query(
        'INSERT INTO inventory_items (category_id, item_name, unit, current_stock, min_stock_alert, unit_cost) VALUES (1, ?, ?, ?, ?, ?)',
        [name, unit, stock, alertVal, cost]
      );
    }
  }

  // Fetch inventory map
  const [allInv] = await pool.query('SELECT id, item_name FROM inventory_items');
  const invMap = {};
  allInv.forEach(i => invMap[i.item_name] = i.id);

  // 2. Seed Recipes & Ingredients (BOM)
  const [allMenu] = await pool.query('SELECT id, name FROM menu_items');
  const menuMap = {};
  allMenu.forEach(m => menuMap[m.name] = m.id);

  const recipes = [
    {
      menu_name: 'Paneer Tikka Angara',
      ingredients: [
        { name: 'Fresh Paneer', qty: 0.250, unit: 'kg' },
        { name: 'Cooking Oil', qty: 0.030, unit: 'l' },
        { name: 'Indian Spices Mix', qty: 25.000, unit: 'g' }
      ]
    },
    {
      menu_name: 'Murgh Malai Kebab',
      ingredients: [
        { name: 'Fresh Chicken', qty: 0.300, unit: 'kg' },
        { name: 'Fresh Milk', qty: 0.050, unit: 'l' },
        { name: 'Indian Spices Mix', qty: 20.000, unit: 'g' }
      ]
    },
    {
      menu_name: 'Old Delhi Butter Chicken',
      ingredients: [
        { name: 'Fresh Chicken', qty: 0.350, unit: 'kg' },
        { name: 'Cooking Oil', qty: 0.050, unit: 'l' },
        { name: 'Fresh Milk', qty: 0.100, unit: 'l' },
        { name: 'Indian Spices Mix', qty: 30.000, unit: 'g' }
      ]
    },
    {
      menu_name: 'Hyderabadi Dum Chicken Biryani',
      ingredients: [
        { name: 'Basmati Rice', qty: 0.350, unit: 'kg' },
        { name: 'Fresh Chicken', qty: 0.300, unit: 'kg' },
        { name: 'Cooking Oil', qty: 0.040, unit: 'l' },
        { name: 'Indian Spices Mix', qty: 35.000, unit: 'g' }
      ]
    },
    {
      menu_name: 'Tandoori Mushroom Galouti',
      ingredients: [
        { name: 'Fresh Button Mushrooms', qty: 0.250, unit: 'kg' },
        { name: 'Cooking Oil', qty: 0.025, unit: 'l' },
        { name: 'Indian Spices Mix', qty: 20.000, unit: 'g' }
      ]
    },
    {
      menu_name: 'Paneer Butter Masala',
      ingredients: [
        { name: 'Fresh Paneer', qty: 0.250, unit: 'kg' },
        { name: 'Cooking Oil', qty: 0.040, unit: 'l' },
        { name: 'Fresh Milk', qty: 0.080, unit: 'l' },
        { name: 'Indian Spices Mix', qty: 25.000, unit: 'g' }
      ]
    }
  ];

  for (const r of recipes) {
    const menuItemId = menuMap[r.menu_name];
    if (!menuItemId) continue;

    let [recRows] = await pool.query('SELECT id FROM recipes WHERE menu_item_id = ?', [menuItemId]);
    let recipeId = recRows[0]?.id;

    if (!recipeId) {
      const [insRec] = await pool.query(
        'INSERT INTO recipes (menu_item_id) VALUES (?)',
        [menuItemId]
      );
      recipeId = insRec.insertId;
    }

    for (const ing of r.ingredients) {
      const invId = invMap[ing.name];
      if (!invId) continue;

      const [existingIng] = await pool.query(
        'SELECT id FROM recipe_ingredients WHERE recipe_id = ? AND inventory_item_id = ?',
        [recipeId, invId]
      );

      if (existingIng.length === 0) {
        await pool.query(
          'INSERT INTO recipe_ingredients (recipe_id, inventory_item_id, quantity, unit) VALUES (?, ?, ?, ?)',
          [recipeId, invId, ing.qty, ing.unit]
        );
      }
    }
  }

  // 3. Seed Suppliers & Inventory Batches
  const [suppRows] = await pool.query('SELECT id FROM suppliers LIMIT 1');
  let supplierId = suppRows[0]?.id;
  if (!supplierId) {
    const [insSupp] = await pool.query('INSERT INTO suppliers (name, contact_person, phone, email, address) VALUES ("Royal Agro Supplies Ltd", "Rajesh Kumar", "+91 9845012345", "orders@royalagro.com", "Main Market Hubli")');
    supplierId = insSupp.insertId;
  }

  const [batchCount] = await pool.query('SELECT COUNT(*) as count FROM inventory_batches');
  if (batchCount[0].count === 0) {
    const now = new Date();
    const batches = [
      [invMap['Basmati Rice'], 'BATCH-RICE-2026-01', supplierId, 50.000, 50.000, 120.00, new Date(now.getTime() - 10*86400000), new Date(now.getTime() + 180*86400000)],
      [invMap['Basmati Rice'], 'BATCH-RICE-2026-02', supplierId, 35.000, 35.000, 115.00, new Date(now.getTime() - 40*86400000), new Date(now.getTime() + 150*86400000)],
      [invMap['Fresh Chicken'], 'BATCH-CHK-2026-08', supplierId, 25.000, 25.000, 240.00, new Date(now.getTime() - 1*86400000), new Date(now.getTime() + 4*86400000)],
      [invMap['Fresh Chicken'], 'BATCH-CHK-2026-07', supplierId, 17.500, 17.500, 230.00, new Date(now.getTime() - 3*86400000), new Date(now.getTime() + 2*86400000)],
      [invMap['Fresh Paneer'], 'BATCH-PAN-2026-03', supplierId, 25.000, 25.000, 320.00, new Date(now.getTime() - 2*86400000), new Date(now.getTime() + 6*86400000)],
      [invMap['Fresh Button Mushrooms'], 'BATCH-MSH-2026-01', supplierId, 18.000, 18.000, 180.00, new Date(now.getTime() - 1*86400000), new Date(now.getTime() + 5*86400000)],
      [invMap['Cooking Oil'], 'BATCH-OIL-2026-04', supplierId, 35.000, 35.000, 150.00, new Date(now.getTime() - 15*86400000), new Date(now.getTime() + 90*86400000)],
      [invMap['Indian Spices Mix'], 'BATCH-SPC-2026-02', supplierId, 4200.000, 4200.000, 0.80, new Date(now.getTime() - 20*86400000), new Date(now.getTime() + 120*86400000)]
    ];

    for (const b of batches) {
      if (!b[0]) continue;
      await pool.query(
        'INSERT INTO inventory_batches (inventory_item_id, batch_number, supplier_id, initial_quantity, current_quantity, unit_price, purchase_date, expiry_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        b
      );
    }
  }

  // 4. Seed Stock Transactions (Consumption History & Wastage)
  const [txCount] = await pool.query('SELECT COUNT(*) as count FROM stock_transactions');
  if (txCount[0].count === 0) {
    const now = new Date();
    // Daily consumption over last 7 days
    const consumptions = [
      [invMap['Fresh Chicken'], -7.500, 'ORDER_DEDUCTION', 'Dinner Service KOTs', new Date(now.getTime() - 6*86400000)],
      [invMap['Fresh Chicken'], -8.200, 'ORDER_DEDUCTION', 'Dinner Service KOTs', new Date(now.getTime() - 5*86400000)],
      [invMap['Fresh Chicken'], -6.800, 'ORDER_DEDUCTION', 'Dinner Service KOTs', new Date(now.getTime() - 4*86400000)],
      [invMap['Fresh Chicken'], -9.000, 'ORDER_DEDUCTION', 'Dinner Service KOTs', new Date(now.getTime() - 3*86400000)],
      [invMap['Fresh Chicken'], -10.500, 'ORDER_DEDUCTION', 'Dinner Service KOTs', new Date(now.getTime() - 2*86400000)],
      [invMap['Fresh Chicken'], -8.000, 'ORDER_DEDUCTION', 'Dinner Service KOTs', new Date(now.getTime() - 1*86400000)],
      [invMap['Fresh Chicken'], -7.500, 'ORDER_DEDUCTION', 'Live Kitchen Orders', now],
      
      [invMap['Basmati Rice'], -12.000, 'ORDER_DEDUCTION', 'Biryani & Rice Prep', new Date(now.getTime() - 6*86400000)],
      [invMap['Basmati Rice'], -14.500, 'ORDER_DEDUCTION', 'Biryani & Rice Prep', new Date(now.getTime() - 4*86400000)],
      [invMap['Basmati Rice'], -15.000, 'ORDER_DEDUCTION', 'Biryani & Rice Prep', new Date(now.getTime() - 2*86400000)],
      [invMap['Basmati Rice'], -10.000, 'ORDER_DEDUCTION', 'Live Kitchen Orders', now],

      [invMap['Fresh Paneer'], -4.500, 'ORDER_DEDUCTION', 'Tikka & Curry Prep', new Date(now.getTime() - 3*86400000)],
      [invMap['Fresh Paneer'], -5.000, 'ORDER_DEDUCTION', 'Live Kitchen Orders', now],

      // Wastage entries
      [invMap['Fresh Chicken'], -1.200, 'WASTAGE', 'Trimming & Prep Spoilage', new Date(now.getTime() - 2*86400000)],
      [invMap['Fresh Lemons'], -5.000, 'WASTAGE', 'Expired & Overripe', new Date(now.getTime() - 3*86400000)]
    ];

    for (const [itemId, qty, type, reason, date] of consumptions) {
      if (!itemId) continue;
      await pool.query(
        'INSERT INTO stock_transactions (inventory_item_id, change_quantity, type, reason, reference_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [itemId, qty, type, reason, 'TX-' + Math.floor(100000 + Math.random() * 900000), date]
      );
    }
  }

  console.log('✅ Intelligence seed complete!');
}

module.exports = { seedIntelligence };

if (require.main === module) {
  seedIntelligence().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
}
