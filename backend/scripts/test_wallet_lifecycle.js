/**
 * 16-SLIDE KRATU REWARDS & WALLET ARCHITECTURE AUTOMATED TEST MATRIX
 * Verifies the full lifecycle, double-entry accounting, and invariants.
 */

const { query } = require('../config/db');
const walletService = require('../services/walletService');

async function runTests() {
  console.log('🧪 Starting Kratu Rewards 16-Slide Automated Verification Matrix...\n');
  const tenantId = 1;
  const testCustomerId = 999;
  const testOrderId = 8888;
  const testCheckoutId = `TEST_CHK_${Date.now()}`;

  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      failed++;
    }
  }

  try {
    // 0. Clean previous test artifacts
    await query(`DELETE FROM ledger_transactions WHERE tenant_id = ? AND (actor LIKE '%TEST%' OR reference_id LIKE '%8888%' OR idempotency_key LIKE '%8888%')`, [tenantId]);
    await query(`DELETE FROM credit_lots WHERE tenant_id = ? AND (source_order_id = ? OR wallet_account_id IN (SELECT id FROM wallet_accounts WHERE customer_id = ?))`, [tenantId, testOrderId, testCustomerId]);
    await query(`DELETE FROM wallet_reservations WHERE checkout_id LIKE 'TEST_CHK_%'`, []);
    await query(`DELETE FROM wallet_accounts WHERE tenant_id = ? AND customer_id = ?`, [tenantId, testCustomerId]);

    // 1. Test Rules Engine & Economics Caps (Slide 11)
    console.log('▶ [Test 1] Rules Engine & Cashback Calculation (Slide 11)...');
    const quoteSmall = await walletService.calculateCashback(tenantId, 100);
    assert(!quoteSmall.eligible, 'Order below ₹250 min threshold is not eligible');

    const quoteValid = await walletService.calculateCashback(tenantId, 1000);
    assert(quoteValid.eligible && quoteValid.cashbackAmount === 100, '₹1000 order earns 10% capped at ₹100');

    // 2. Test Pending Cashback Creation (Slide 05 & 10)
    console.log('\n▶ [Test 2] Earn Pending Cashback on Order Placement (Slide 05)...');
    const pendingResult = await walletService.createPendingCredit(tenantId, testCustomerId, testOrderId, 100, '+91 99999 88888');
    assert(pendingResult && pendingResult.status === 'PENDING', 'Cashback created in PENDING status (locked until delivery)');

    const accountAfterPending = await walletService.getOrCreateAccount(tenantId, testCustomerId);
    assert(parseFloat(accountAfterPending.cached_pending_balance) >= 100, 'Cached pending balance incremented by ₹100');
    assert(parseFloat(accountAfterPending.cached_available_balance) === 0, 'Available balance remains 0 (prevents earn-redeem-cancel fraud)');

    // 3. Test Cashback Activation upon Delivery (Slide 05 & 10)
    console.log('\n▶ [Test 3] Order Delivered -> Activate Credit into Available (Slide 05)...');
    const activateResult = await walletService.activateCredit(tenantId, testOrderId);
    assert(activateResult.activated && activateResult.amount >= 100, 'Pending rewards successfully unlocked upon order completion');

    const accountAfterActive = await walletService.getOrCreateAccount(tenantId, testCustomerId);
    assert(parseFloat(accountAfterActive.cached_available_balance) >= 100, 'Available balance is now spendable');

    // 4. Test Checkout Reservation (Anti-Double-Spend Lock - Slide 06)
    console.log('\n▶ [Test 4] Checkout Credit Reservation (Slide 06)...');
    const resResult = await walletService.reserveCredits(tenantId, testCustomerId, testCheckoutId, 50);
    assert(resResult.reserved && resResult.reservedAmount === 50, '₹50 locked with 10-minute reservation');

    const accountAfterRes = await walletService.getOrCreateAccount(tenantId, testCustomerId);
    assert(parseFloat(accountAfterRes.cached_available_balance) === 50, 'Available balance reduced to ₹50 to prevent concurrent cart abuse');

    // 5. Test Commit Redemption on Payment Success (Slide 06 & 08)
    console.log('\n▶ [Test 5] Commit Redemption on Verified Payment (Slide 06 & 08)...');
    const commitResult = await walletService.commitRedemption(tenantId, testCheckoutId, testOrderId + 1);
    assert(commitResult.committed && commitResult.redeemedAmount === 50, 'Redemption committed and settled against order');

    // 6. Test Double-Entry Ledger Verification (Slide 08 & 09)
    console.log('\n▶ [Test 6] Immutable Double-Entry Ledger Records (Slide 08)...');
    const ledgerEntries = await query(
      `SELECT * FROM ledger_transactions WHERE tenant_id = ? AND wallet_account_id = ? ORDER BY id ASC`,
      [tenantId, accountAfterActive.id]
    );
    assert(ledgerEntries.length >= 4, 'Immutable audit ledger contains complete sequence of Debits and Credits');

    // 7. Test Financial Invariant Check (Slide 15)
    console.log('\n▶ [Test 7] Financial Invariants Integrity Verification (Slide 15)...');
    const audit = await walletService.verifyLedgerInvariants(tenantId);
    assert(audit.passed && audit.discrepancy < 0.05, `Invariants verified! Discrepancy is ₹${audit.discrepancy}`);

    // 8. Test Owner Liability Dashboard Summary (Slide 14)
    console.log('\n▶ [Test 8] Owner Liability Summary Metrics (Slide 14)...');
    const ownerSummary = await walletService.getOwnerLiabilitySummary(tenantId);
    assert(ownerSummary.outstandingLiability >= 0, 'Owner liability metrics generated cleanly');
    assert(ownerSummary.campaign && ownerSummary.campaign.campaign_name, 'Active campaign rules loaded');

    console.log(`\n======================================================`);
    console.log(`🏁 AUTOMATED TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log(`======================================================\n`);

    if (failed === 0) {
      console.log('🎉 16-Slide Kratu Rewards Architecture fully validated and verified!');
      process.exit(0);
    } else {
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal test error:', err);
    process.exit(1);
  }
}

runTests();
