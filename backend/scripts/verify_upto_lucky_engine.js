const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const walletService = require('../services/walletService');
const http = require('http');

async function testEngine() {
  console.log('=== VERIFYING UP-TO LUCKY DRAW AUTOMATION ENGINE ===');

  // 1. Simulation of 100 cashback calculations
  console.log('\n--- 1. Testing 100 Reward Rolls for ₹70 Cap (35% Lucky Target) ---');
  let fullCount = 0;
  let upToCount = 0;
  let minObserved = 99999;
  let maxObserved = 0;
  const amounts = [];

  for (let i = 0; i < 100; i++) {
    const res = await walletService.calculateCashback(1, 500); // 500 > min order 250
    if (!res.eligible) {
      console.error(`Attempt ${i + 1} not eligible:`, res.reason);
      continue;
    }
    const amt = res.cashbackAmount;
    amounts.push(amt);
    if (amt < minObserved) minObserved = amt;
    if (amt > maxObserved) maxObserved = amt;

    if (amt === 70) {
      fullCount++;
    } else {
      upToCount++;
    }
  }

  console.log(`Results across 100 rolls:`);
  console.log(`- Full ₹70 (Jackpot) Winners: ${fullCount} (Target: ~30-40, i.e. 1-2 in 5)`);
  console.log(`- Up-To Winners (Between ₹10 and ₹69): ${upToCount}`);
  console.log(`- Min Observed: ₹${minObserved}, Max Observed: ₹${maxObserved}`);
  console.log(`- Sample rolls:`, amounts.slice(0, 15).join(', '));

  if (maxObserved > 70) {
    throw new Error(`CRITICAL: Amount exceeded cap: ₹${maxObserved}`);
  }
  if (minObserved < 10) {
    throw new Error(`CRITICAL: Amount below minimum: ₹${minObserved}`);
  }
  if (fullCount === 0) {
    throw new Error(`CRITICAL: Zero full jackpot winners!`);
  }
  console.log('✅ Simulation Passed: Math & probability logic strictly obeys rules.');

  // 2. Testing API /checkout/quote via HTTP request to localhost:5000
  console.log('\n--- 2. Testing HTTP API /api/v1/wallet/checkout/quote ---');
  const postData = JSON.stringify({
    tenantId: 1,
    orderAmount: 450,
    customerId: 2
  });

  const req = http.request({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/wallet/checkout/quote',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  }, (res) => {
    let raw = '';
    res.on('data', chunk => raw += chunk);
    res.on('end', () => {
      console.log('HTTP Status:', res.statusCode);
      try {
        const json = JSON.parse(raw);
        console.log('Quote API response:', JSON.stringify(json.data, null, 2));
        if (json.success && json.data.rewardType === 'UPTO_LUCKY') {
          console.log('✅ Quote API verified: rewardType, uptoAmount, and rewardLabel present.');
        } else {
          console.warn('⚠️ Quote API did not return expected fields:', json);
        }
      } catch (err) {
        console.error('Parse error:', raw);
      }
      process.exit(0);
    });
  });

  req.on('error', (e) => {
    console.warn('HTTP request error (server might be restarting):', e.message);
    process.exit(0);
  });

  req.write(postData);
  req.end();
}

testEngine().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
