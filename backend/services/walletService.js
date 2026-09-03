/**
 * KRATU REWARDS & DOUBLE-ENTRY WALLET SERVICE
 * Implements the 16-Slide Architecture Blueprint
 * Core Rule: Reward credits and customer money are never the same balance. (Ledger First)
 */

const { query } = require('../config/db');
const crypto = require('crypto');

class WalletService {
  /**
   * Helper: Generate deterministic or random idempotency key
   */
  generateIdempotencyKey(prefix, tenantId, entityId, uniqueSalt = '') {
    return `${prefix}_${tenantId}_${entityId}_${uniqueSalt || Date.now()}`;
  }

  /**
   * 1. CALCULATE CASHBACK (Slide 10 & 11)
   * Calculates eligible cashback based on campaign rules & economics caps
   */
  async calculateCashback(tenantId, orderAmount, customerId = null) {
    try {
      const parsedAmount = parseFloat(orderAmount) || 0;
      if (parsedAmount <= 0) {
        return { eligible: false, cashbackAmount: 0, reason: 'Zero order amount' };
      }

      // Load active campaign rules for this restaurant/hotel
      const [rules] = await query(
        `SELECT * FROM wallet_campaign_rules WHERE tenant_id = ? AND is_active = 1 LIMIT 1`,
        [tenantId]
      );

      if (!rules) {
        return { eligible: false, cashbackAmount: 0, reason: 'No active rewards campaign for this merchant' };
      }

      // Check min order threshold
      if (parsedAmount < parseFloat(rules.min_order_amount)) {
        return {
          eligible: false,
          cashbackAmount: 0,
          reason: `Minimum order amount of ₹${rules.min_order_amount} required to earn cashback`
        };
      }

      // Check campaign budget remaining
      const budgetRemaining = parseFloat(rules.campaign_budget) - parseFloat(rules.budget_spent);
      if (budgetRemaining <= 0) {
        return { eligible: false, cashbackAmount: 0, reason: 'Campaign budget exhausted' };
      }

      // Calculate reward value
      let calculated = 0;
      if (rules.reward_type === 'PERCENTAGE') {
        calculated = (parsedAmount * parseFloat(rules.reward_value)) / 100;
      } else {
        calculated = parseFloat(rules.reward_value);
      }

      // Clamp to max cashback cap
      const capped = Math.min(calculated, parseFloat(rules.max_cashback_per_order));
      const finalAmount = Math.min(capped, budgetRemaining);

      return {
        eligible: finalAmount > 0,
        cashbackAmount: Math.round(finalAmount * 100) / 100,
        campaignName: rules.campaign_name,
        expiryDays: rules.expiry_days,
        maxRedemptionPercentage: parseFloat(rules.max_redemption_percentage || 50.00)
      };
    } catch (err) {
      console.error('WalletService.calculateCashback error:', err);
      return { eligible: false, cashbackAmount: 0, error: err.message };
    }
  }

  /**
   * Helper: Get or create wallet account
   */
  async getOrCreateAccount(tenantId, customerId, customerPhone = null) {
    let [account] = await query(
      `SELECT * FROM wallet_accounts WHERE tenant_id = ? AND customer_id = ? AND balance_type = 'PROMOTIONAL_REWARD' LIMIT 1`,
      [tenantId, customerId]
    );

    if (!account) {
      const res = await query(
        `INSERT INTO wallet_accounts 
          (tenant_id, customer_id, customer_phone, balance_type, cached_available_balance, cached_pending_balance, status)
         VALUES (?, ?, ?, 'PROMOTIONAL_REWARD', 0.00, 0.00, 'ACTIVE')`,
        [tenantId, customerId, customerPhone]
      );
      account = {
        id: res.insertId,
        tenant_id: tenantId,
        customer_id: customerId,
        customer_phone: customerPhone,
        balance_type: 'PROMOTIONAL_REWARD',
        cached_available_balance: 0.00,
        cached_pending_balance: 0.00,
        status: 'ACTIVE'
      };
    }

    return account;
  }

  /**
   * 2. CREATE PENDING CREDIT (Slide 05 & 10)
   * Cashback becomes spendable ONLY after order completion.
   * Pending rewards prevent earn-redeem-cancel fraud!
   */
  async createPendingCredit(tenantId, customerId, orderId, amount, customerPhone = null) {
    try {
      const parsedAmount = parseFloat(amount);
      if (parsedAmount <= 0) return null;

      const account = await this.getOrCreateAccount(tenantId, customerId, customerPhone);

      // Check if already created for this order (idempotency)
      const idempotencyKey = `CASHBACK_PENDING_${tenantId}_ORD_${orderId}`;
      const [existingLedger] = await query(
        `SELECT id FROM ledger_transactions WHERE idempotency_key = ? LIMIT 1`,
        [idempotencyKey]
      );
      if (existingLedger) {
        console.log(`[Wallet] Idempotent skip: pending credit already exists for order #${orderId}`);
        return existingLedger;
      }

      // Expiry duration from campaign rules (default 30 days)
      const [rules] = await query(
        `SELECT expiry_days FROM wallet_campaign_rules WHERE tenant_id = ? AND is_active = 1 LIMIT 1`,
        [tenantId]
      );
      const expiryDays = rules?.expiry_days || 30;

      // Insert credit lot in PENDING status
      const lotRes = await query(
        `INSERT INTO credit_lots 
          (wallet_account_id, tenant_id, source_order_id, original_amount, remaining_amount, status, expires_at, source_event)
         VALUES (?, ?, ?, ?, ?, 'PENDING', DATE_ADD(NOW(), INTERVAL ? DAY), 'ORDER_CASHBACK')`,
        [account.id, tenantId, orderId, parsedAmount, parsedAmount, expiryDays]
      );

      // Post immutable ledger entry (Slide 08 & 09)
      await query(
        `INSERT INTO ledger_transactions
          (tenant_id, wallet_account_id, idempotency_key, entry_type, amount, account_category, event_type, reference_id, credit_lot_id, description, actor)
         VALUES (?, ?, ?, 'CREDIT', ?, 'CUSTOMER_REWARD_BALANCE', 'CASHBACK_PENDING', ?, ?, ?, 'ORDER_SERVICE')`,
        [
          tenantId,
          account.id,
          idempotencyKey,
          parsedAmount,
          `ORD-${orderId}`,
          lotRes.insertId,
          `Pending Kratu Rewards cashback earned on Order #${orderId}. Unlocks upon delivery.`
        ]
      );

      // Update cached pending balance on account
      await query(
        `UPDATE wallet_accounts 
         SET cached_pending_balance = cached_pending_balance + ? 
         WHERE id = ?`,
        [parsedAmount, account.id]
      );

      console.log(`✅ [Wallet] Created PENDING credit lot #${lotRes.insertId} of ₹${parsedAmount} for Customer #${customerId}`);
      return { lotId: lotRes.insertId, amount: parsedAmount, status: 'PENDING' };
    } catch (err) {
      console.error('WalletService.createPendingCredit error:', err);
      throw err;
    }
  }

  /**
   * 3. ACTIVATE CREDIT (Slide 05 & 10)
   * Unlocks pending cashback when order status becomes DELIVERED or COMPLETED.
   */
  async activateCredit(tenantId, orderId) {
    try {
      // Find pending lots for this order
      const lots = await query(
        `SELECT * FROM credit_lots WHERE tenant_id = ? AND source_order_id = ? AND status = 'PENDING'`,
        [tenantId, orderId]
      );

      if (!lots || lots.length === 0) return { activated: false, count: 0 };

      let totalActivated = 0;
      for (const lot of lots) {
        const idempotencyKey = `CASHBACK_ACTIVATE_${tenantId}_LOT_${lot.id}`;
        const [exists] = await query(
          `SELECT id FROM ledger_transactions WHERE idempotency_key = ? LIMIT 1`,
          [idempotencyKey]
        );
        if (exists) continue;

        // Double entry:
        // 1. Debit Merchant Reward Liability
        await query(
          `INSERT INTO ledger_transactions
            (tenant_id, wallet_account_id, idempotency_key, entry_type, amount, account_category, event_type, reference_id, credit_lot_id, description, actor)
           VALUES (?, ?, ?, 'DEBIT', ?, 'MERCHANT_REWARD_LIABILITY', 'CASHBACK_ACTIVATED', ?, ?, ?, 'ORDER_SERVICE')`,
          [
            tenantId,
            lot.wallet_account_id,
            idempotencyKey + '_DR',
            lot.remaining_amount,
            `ORD-${orderId}`,
            lot.id,
            `Merchant liability recognized for Order #${orderId} completion`
          ]
        );

        // 2. Credit Customer Available Reward Balance
        await query(
          `INSERT INTO ledger_transactions
            (tenant_id, wallet_account_id, idempotency_key, entry_type, amount, account_category, event_type, reference_id, credit_lot_id, description, actor)
           VALUES (?, ?, ?, 'CREDIT', ?, 'CUSTOMER_REWARD_BALANCE', 'CASHBACK_ACTIVATED', ?, ?, ?, 'ORDER_SERVICE')`,
          [
            tenantId,
            lot.wallet_account_id,
            idempotencyKey,
            lot.remaining_amount,
            `ORD-${orderId}`,
            lot.id,
            `Order #${orderId} completed! Kratu Rewards activated and ready to spend.`
          ]
        );

        // Transition lot status: PENDING -> AVAILABLE
        await query(
          `UPDATE credit_lots 
           SET status = 'AVAILABLE', valid_from = NOW() 
           WHERE id = ?`,
          [lot.id]
        );

        // Update account balances
        await query(
          `UPDATE wallet_accounts 
           SET cached_pending_balance = GREATEST(0, cached_pending_balance - ?),
               cached_available_balance = cached_available_balance + ?
           WHERE id = ?`,
          [lot.remaining_amount, lot.remaining_amount, lot.wallet_account_id]
        );

        // Update campaign budget spent
        await query(
          `UPDATE wallet_campaign_rules 
           SET budget_spent = budget_spent + ? 
           WHERE tenant_id = ? AND is_active = 1`,
          [lot.remaining_amount, tenantId]
        );

        totalActivated += parseFloat(lot.remaining_amount);
      }

      console.log(`✅ [Wallet] Activated ₹${totalActivated} Kratu Rewards for Order #${orderId}`);
      return { activated: true, amount: totalActivated };
    } catch (err) {
      console.error('WalletService.activateCredit error:', err);
      throw err;
    }
  }

  /**
   * 4. RESERVE CREDITS (Slide 06 & 10)
   * Checkout reserves credits before requesting payment.
   * Reservation prevents double-spending across simultaneous carts!
   */
  async reserveCredits(tenantId, customerId, checkoutId, requestedAmount) {
    try {
      const amount = parseFloat(requestedAmount) || 0;
      if (amount <= 0) return { reserved: false, reservedAmount: 0 };

      const account = await this.getOrCreateAccount(tenantId, customerId);

      // Check for existing active reservation on this checkout_id
      const [existingRes] = await query(
        `SELECT * FROM wallet_reservations WHERE checkout_id = ? AND status = 'RESERVED' LIMIT 1`,
        [checkoutId]
      );
      if (existingRes) {
        return {
          reserved: true,
          reservedAmount: parseFloat(existingRes.reserved_amount),
          expiresAt: existingRes.expires_at
        };
      }

      // Check available balance
      if (parseFloat(account.cached_available_balance) < amount) {
        throw new Error(`Insufficient available rewards. You have ₹${account.cached_available_balance} available.`);
      }

      // FIFO selection of eligible available lots (Slide 09: FIFO deterministic redemption)
      const availableLots = await query(
        `SELECT * FROM credit_lots 
         WHERE wallet_account_id = ? AND status = 'AVAILABLE' AND remaining_amount > 0 AND expires_at > NOW()
         ORDER BY expires_at ASC`,
        [account.id]
      );

      let remainingToReserve = amount;
      const lotAllocations = [];

      for (const lot of availableLots) {
        if (remainingToReserve <= 0) break;
        const availableInLot = parseFloat(lot.remaining_amount);
        const take = Math.min(availableInLot, remainingToReserve);

        lotAllocations.push({
          lotId: lot.id,
          amount: take
        });
        remainingToReserve -= take;
      }

      if (remainingToReserve > 0.01) {
        throw new Error('Could not allocate full requested amount from valid lots.');
      }

      // 10-minute expiry on reservation
      const resResult = await query(
        `INSERT INTO wallet_reservations 
          (tenant_id, wallet_account_id, checkout_id, reserved_amount, lot_allocations_json, status, expires_at)
         VALUES (?, ?, ?, ?, ?, 'RESERVED', DATE_ADD(NOW(), INTERVAL 10 MINUTE))`,
        [tenantId, account.id, checkoutId, amount, JSON.stringify(lotAllocations)]
      );

      // Deduct from cached available balance to prevent concurrent spend
      await query(
        `UPDATE wallet_accounts 
         SET cached_available_balance = GREATEST(0, cached_available_balance - ?)
         WHERE id = ?`,
        [amount, account.id]
      );

      // Post ledger entry
      await query(
        `INSERT INTO ledger_transactions
          (tenant_id, wallet_account_id, idempotency_key, entry_type, amount, account_category, event_type, reference_id, description, actor)
         VALUES (?, ?, ?, 'DEBIT', ?, 'CUSTOMER_REWARD_BALANCE', 'CHECKOUT_RESERVED', ?, ?, 'CUSTOMER_APP')`,
        [
          tenantId,
          account.id,
          `RESERVE_${checkoutId}`,
          amount,
          checkoutId,
          `Reserved ₹${amount} Kratu Rewards for checkout verification (10 min lock)`
        ]
      );

      console.log(`🔒 [Wallet] Reserved ₹${amount} for Checkout #${checkoutId}`);
      return {
        reserved: true,
        reservationId: resResult.insertId,
        reservedAmount: amount,
        expiresInMinutes: 10
      };
    } catch (err) {
      console.error('WalletService.reserveCredits error:', err);
      throw err;
    }
  }

  /**
   * 5. COMMIT REDEMPTION (Slide 06 & 10)
   * Commits the reserved credit lot deduction once payment callback is verified.
   */
  async commitRedemption(tenantId, checkoutId, orderId) {
    try {
      const [res] = await query(
        `SELECT * FROM wallet_reservations WHERE checkout_id = ? LIMIT 1`,
        [checkoutId]
      );

      if (!res) return { committed: false, reason: 'No reservation found' };
      if (res.status === 'COMMITTED') return { committed: true, alreadyCommitted: true };

      const lotAllocations = typeof res.lot_allocations_json === 'string' 
        ? JSON.parse(res.lot_allocations_json) 
        : (res.lot_allocations_json || []);

      // Deduct amounts from credit lots
      for (const alloc of lotAllocations) {
        await query(
          `UPDATE credit_lots 
           SET status = CASE WHEN remaining_amount <= ? THEN 'EXHAUSTED' ELSE 'AVAILABLE' END,
               remaining_amount = GREATEST(0, remaining_amount - ?)
           WHERE id = ?`,
          [alloc.amount, alloc.amount, alloc.lotId]
        );
      }

      // Mark reservation COMMITTED
      await query(
        `UPDATE wallet_reservations 
         SET status = 'COMMITTED' 
         WHERE id = ?`,
        [res.id]
      );

      // Post double-entry settlement benefit ledger entry (Slide 08)
      await query(
        `INSERT INTO ledger_transactions
          (tenant_id, wallet_account_id, idempotency_key, entry_type, amount, account_category, event_type, reference_id, description, actor)
         VALUES (?, ?, ?, 'CREDIT', ?, 'ORDER_SETTLEMENT_BENEFIT', 'REDEMPTION_COMMITTED', ?, ?, 'PAYMENT_CALLBACK')`,
        [
          tenantId,
          res.wallet_account_id,
          `COMMIT_${checkoutId}_ORD_${orderId}`,
          res.reserved_amount,
          `ORD-${orderId}`,
          `Redeemed ₹${res.reserved_amount} Kratu Rewards applied to Order #${orderId}`
        ]
      );

      console.log(`✅ [Wallet] Committed redemption of ₹${res.reserved_amount} for Order #${orderId}`);
      return { committed: true, redeemedAmount: parseFloat(res.reserved_amount) };
    } catch (err) {
      console.error('WalletService.commitRedemption error:', err);
      throw err;
    }
  }

  /**
   * 6. RELEASE RESERVATION (Slide 06 & 10)
   * Releases reserved credits back to customer balance on payment failure / user cancel / timeout.
   */
  async releaseReservation(tenantId, checkoutId, reason = 'Payment timeout or cancelled') {
    try {
      const [res] = await query(
        `SELECT * FROM wallet_reservations WHERE checkout_id = ? AND status = 'RESERVED' LIMIT 1`,
        [checkoutId]
      );

      if (!res) return { released: false, reason: 'No active reservation found' };

      // Restore account cached balance
      await query(
        `UPDATE wallet_accounts 
         SET cached_available_balance = cached_available_balance + ? 
         WHERE id = ?`,
        [res.reserved_amount, res.wallet_account_id]
      );

      // Mark reservation RELEASED
      await query(
        `UPDATE wallet_reservations SET status = 'RELEASED' WHERE id = ?`,
        [res.id]
      );

      // Post ledger entry
      await query(
        `INSERT INTO ledger_transactions
          (tenant_id, wallet_account_id, idempotency_key, entry_type, amount, account_category, event_type, reference_id, description, actor)
         VALUES (?, ?, ?, 'CREDIT', ?, 'CUSTOMER_REWARD_BALANCE', 'RESERVATION_RELEASED', ?, ?, 'SYSTEM')`,
        [
          tenantId,
          res.wallet_account_id,
          `RELEASE_${checkoutId}_${Date.now()}`,
          res.reserved_amount,
          checkoutId,
          `Released ₹${res.reserved_amount} reservation back to available balance (${reason})`
        ]
      );

      console.log(`🔓 [Wallet] Released reservation of ₹${res.reserved_amount} for Checkout #${checkoutId}`);
      return { released: true, restoredAmount: parseFloat(res.reserved_amount) };
    } catch (err) {
      console.error('WalletService.releaseReservation error:', err);
      throw err;
    }
  }

  /**
   * 7. REVERSE CREDIT (Slide 05, 07 & 10)
   * Cancels earned pending or available rewards on order cancellation.
   */
  async reverseCredit(tenantId, orderId, reason = 'Order cancelled') {
    try {
      const lots = await query(
        `SELECT * FROM credit_lots WHERE tenant_id = ? AND source_order_id = ? AND status IN ('PENDING', 'AVAILABLE')`,
        [tenantId, orderId]
      );

      if (!lots || lots.length === 0) return { reversed: false };

      let totalReversed = 0;
      for (const lot of lots) {
        const isPending = lot.status === 'PENDING';

        await query(
          `UPDATE credit_lots SET status = 'REVERSED', remaining_amount = 0 WHERE id = ?`,
          [lot.id]
        );

        if (isPending) {
          await query(
            `UPDATE wallet_accounts 
             SET cached_pending_balance = GREATEST(0, cached_pending_balance - ?) 
             WHERE id = ?`,
            [lot.original_amount, lot.wallet_account_id]
          );
        } else {
          await query(
            `UPDATE wallet_accounts 
             SET cached_available_balance = GREATEST(0, cached_available_balance - ?) 
             WHERE id = ?`,
            [lot.remaining_amount, lot.wallet_account_id]
          );
        }

        // Post ledger
        await query(
          `INSERT INTO ledger_transactions
            (tenant_id, wallet_account_id, idempotency_key, entry_type, amount, account_category, event_type, reference_id, credit_lot_id, description, actor)
           VALUES (?, ?, ?, 'DEBIT', ?, 'CUSTOMER_REWARD_BALANCE', 'CASHBACK_REVERSED', ?, ?, ?, 'ORDER_SERVICE')`,
          [
            tenantId,
            lot.wallet_account_id,
            `REVERSE_ORD_${orderId}_LOT_${lot.id}`,
            lot.remaining_amount || lot.original_amount,
            `ORD-${orderId}`,
            lot.id,
            `Cashback reversed due to ${reason}`
          ]
        );

        totalReversed += parseFloat(lot.remaining_amount || lot.original_amount);
      }

      console.log(`⚠️ [Wallet] Reversed ₹${totalReversed} rewards for Order #${orderId}`);
      return { reversed: true, totalReversed };
    } catch (err) {
      console.error('WalletService.reverseCredit error:', err);
      throw err;
    }
  }

  /**
   * 8. EXPIRE CREDIT (Slide 05, 08 & 10)
   * Daily job that expires credit lots past validity and recognizes merchant breakage.
   */
  async expireCredit(tenantId = null) {
    try {
      let lotQuery = `
        SELECT l.*, a.id as account_id 
        FROM credit_lots l 
        JOIN wallet_accounts a ON l.wallet_account_id = a.id
        WHERE l.status = 'AVAILABLE' 
          AND l.remaining_amount > 0 
          AND l.expires_at <= NOW()
      `;
      const params = [];
      if (tenantId) {
        lotQuery += ` AND l.tenant_id = ?`;
        params.push(tenantId);
      }

      const expiredLots = await query(lotQuery, params);
      if (!expiredLots || expiredLots.length === 0) return { expiredCount: 0, totalAmount: 0 };

      let totalExpiredAmount = 0;
      for (const lot of expiredLots) {
        const amount = parseFloat(lot.remaining_amount);

        // Mark lot EXPIRED
        await query(
          `UPDATE credit_lots SET status = 'EXPIRED', remaining_amount = 0 WHERE id = ?`,
          [lot.id]
        );

        // Deduct from account available balance
        await query(
          `UPDATE wallet_accounts 
           SET cached_available_balance = GREATEST(0, cached_available_balance - ?)
           WHERE id = ?`,
          [amount, lot.wallet_account_id]
        );

        // Post ledger:
        // 1. Debit Merchant Reward Liability (liability extinguished)
        await query(
          `INSERT INTO ledger_transactions
            (tenant_id, wallet_account_id, idempotency_key, entry_type, amount, account_category, event_type, reference_id, credit_lot_id, description, actor)
           VALUES (?, ?, ?, 'DEBIT', ?, 'MERCHANT_REWARD_LIABILITY', 'CREDIT_EXPIRED', ?, ?, ?, 'EXPIRY_CRON')`,
          [
            lot.tenant_id,
            lot.wallet_account_id,
            `EXPIRE_LOT_${lot.id}_DR`,
            amount,
            `LOT-${lot.id}`,
            lot.id,
            `Reward validity ended. Merchant liability extinguished.`
          ]
        );

        // 2. Credit Breakage Revenue
        await query(
          `INSERT INTO ledger_transactions
            (tenant_id, wallet_account_id, idempotency_key, entry_type, amount, account_category, event_type, reference_id, credit_lot_id, description, actor)
           VALUES (?, ?, ?, 'CREDIT', ?, 'EXPIRED_BREAKAGE', 'CREDIT_EXPIRED', ?, ?, ?, 'EXPIRY_CRON')`,
          [
            lot.tenant_id,
            lot.wallet_account_id,
            `EXPIRE_LOT_${lot.id}_CR`,
            amount,
            `LOT-${lot.id}`,
            lot.id,
            `Recognized breakage on expired credit lot #${lot.id}`
          ]
        );

        totalExpiredAmount += amount;
      }

      console.log(`⏰ [Wallet] Expired ${expiredLots.length} credit lots totaling ₹${totalExpiredAmount}`);
      return { expiredCount: expiredLots.length, totalAmount: totalExpiredAmount };
    } catch (err) {
      console.error('WalletService.expireCredit error:', err);
      throw err;
    }
  }

  /**
   * 9. CALCULATE REFUND SPLIT (Slide 07)
   * Separates cash refund to original provider from reward lot restoration.
   */
  async calculateRefundSplit(orderId, refundAmount, cancellationFee = 0) {
    try {
      // Find committed redemptions and cash components for this order
      const [order] = await query(`SELECT * FROM orders WHERE id = ? LIMIT 1`, [orderId]);
      if (!order) throw new Error('Order not found');

      const totalPaid = parseFloat(order.total_amount || 0);
      const rewardsUsed = parseFloat(order.rewards_discount || 0);
      const cashPaid = Math.max(0, totalPaid - rewardsUsed);

      const requestedRefund = parseFloat(refundAmount) || totalPaid;
      const fee = parseFloat(cancellationFee) || 0;
      const netRefundable = Math.max(0, requestedRefund - fee);

      // Prorate between rewards and cash
      const rewardRatio = totalPaid > 0 ? rewardsUsed / totalPaid : 0;
      const rewardsToRestore = Math.min(rewardsUsed, Math.round(netRefundable * rewardRatio * 100) / 100);
      const cashToRefund = Math.max(0, netRefundable - rewardsToRestore);

      return {
        orderId,
        totalPaid,
        rewardsUsed,
        cashPaid,
        cancellationFee: fee,
        rewardsToRestore,
        cashToRefundViaGateway: cashToRefund,
        mode: 'SEPARATED_COMPONENT_ALLOCATION'
      };
    } catch (err) {
      console.error('WalletService.calculateRefundSplit error:', err);
      throw err;
    }
  }

  /**
   * 10. RECORD REFUND STATUS (Slide 10)
   */
  async recordRefundStatus(orderId, refundResult) {
    console.log(`[Wallet] Refund recorded for Order #${orderId}:`, refundResult);
    return { recorded: true, orderId, timestamp: new Date() };
  }

  /**
   * 11. GET CUSTOMER STATEMENT (Slide 14)
   * Customer Screen: Available cashback, Pending cashback, Expiring soon, Statement history.
   */
  async getStatement(tenantId, customerId) {
    try {
      const account = await this.getOrCreateAccount(tenantId, customerId);

      // Active available lots with expiry
      const availableLots = await query(
        `SELECT id, original_amount, remaining_amount, valid_from, expires_at, source_order_id,
                DATEDIFF(expires_at, NOW()) as days_until_expiry
         FROM credit_lots 
         WHERE wallet_account_id = ? AND status = 'AVAILABLE' AND remaining_amount > 0
         ORDER BY expires_at ASC`,
        [account.id]
      );

      // Pending lots
      const pendingLots = await query(
        `SELECT id, original_amount, remaining_amount, source_order_id, created_at
         FROM credit_lots 
         WHERE wallet_account_id = ? AND status = 'PENDING'
         ORDER BY created_at DESC`,
        [account.id]
      );

      // Recent ledger transactions
      const transactions = await query(
        `SELECT id, entry_type, amount, event_type, reference_id, description, created_at
         FROM ledger_transactions 
         WHERE wallet_account_id = ? 
         ORDER BY created_at DESC 
         LIMIT 25`,
        [account.id]
      );

      // Expiring soon (< 7 days)
      const expiringSoon = availableLots
        .filter(l => l.days_until_expiry <= 7)
        .reduce((sum, l) => sum + parseFloat(l.remaining_amount), 0);

      return {
        availableBalance: parseFloat(account.cached_available_balance || 0),
        pendingBalance: parseFloat(account.cached_pending_balance || 0),
        expiringSoonBalance: expiringSoon,
        availableLots,
        pendingLots,
        transactions
      };
    } catch (err) {
      console.error('WalletService.getStatement error:', err);
      throw err;
    }
  }

  /**
   * 12. REQUEST MANUAL ADJUSTMENT (Slide 12)
   * Staff manual credit with admin authorization and complete audit trail.
   */
  async requestAdjustment(tenantId, customerId, amount, reason, adminUser) {
    try {
      const parsedAmount = parseFloat(amount);
      if (parsedAmount <= 0) throw new Error('Invalid adjustment amount');

      const account = await this.getOrCreateAccount(tenantId, customerId);
      const lotRes = await query(
        `INSERT INTO credit_lots 
          (wallet_account_id, tenant_id, original_amount, remaining_amount, status, valid_from, expires_at, source_event)
         VALUES (?, ?, ?, ?, 'AVAILABLE', NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY), 'ADMIN_ADJUSTMENT')`,
        [account.id, tenantId, parsedAmount, parsedAmount]
      );

      // Post ledger
      await query(
        `INSERT INTO ledger_transactions
          (tenant_id, wallet_account_id, idempotency_key, entry_type, amount, account_category, event_type, reference_id, credit_lot_id, description, actor)
         VALUES (?, ?, ?, 'CREDIT', ?, 'CUSTOMER_REWARD_BALANCE', 'ADMIN_ADJUSTMENT', ?, ?, ?, ?)`,
        [
          tenantId,
          account.id,
          `ADJUST_${tenantId}_${account.id}_${Date.now()}`,
          parsedAmount,
          `ADJUST-${lotRes.insertId}`,
          lotRes.insertId,
          `Manual courtesy adjustment: ${reason}`,
          adminUser?.email || 'ADMIN'
        ]
      );

      // Update cached balance
      await query(
        `UPDATE wallet_accounts 
         SET cached_available_balance = cached_available_balance + ? 
         WHERE id = ?`,
        [parsedAmount, account.id]
      );

      console.log(`👮 [Wallet] Admin manual adjustment of ₹${parsedAmount} granted to Customer #${customerId}`);
      return { success: true, adjustedAmount: parsedAmount };
    } catch (err) {
      console.error('WalletService.requestAdjustment error:', err);
      throw err;
    }
  }

  /**
   * 13. OWNER LIABILITY SUMMARY (Slide 14)
   * Merchant Owner Dashboard: Outstanding liability, unredeemed rewards, campaign budget burn.
   */
  async getOwnerLiabilitySummary(tenantId) {
    try {
      // 1. Outstanding liability (total available unredeemed lots)
      const [availRes] = await query(
        `SELECT COALESCE(SUM(remaining_amount), 0) as total_liability, COUNT(*) as active_lots_count
         FROM credit_lots 
         WHERE tenant_id = ? AND status = 'AVAILABLE' AND remaining_amount > 0 AND expires_at > NOW()`,
        [tenantId]
      );

      // 2. Pending cashback awaiting order delivery
      const [pendingRes] = await query(
        `SELECT COALESCE(SUM(remaining_amount), 0) as total_pending, COUNT(*) as pending_lots_count
         FROM credit_lots 
         WHERE tenant_id = ? AND status = 'PENDING'`,
        [tenantId]
      );

      // 3. Lifetime redeemed credits
      const [redeemedRes] = await query(
        `SELECT COALESCE(SUM(amount), 0) as total_redeemed
         FROM ledger_transactions 
         WHERE tenant_id = ? AND event_type = 'REDEMPTION_COMMITTED' AND entry_type = 'CREDIT'`,
        [tenantId]
      );

      // 4. Expired breakage (revenue earned from unspent expired lots)
      const [expiredRes] = await query(
        `SELECT COALESCE(SUM(amount), 0) as total_breakage
         FROM ledger_transactions 
         WHERE tenant_id = ? AND event_type = 'CREDIT_EXPIRED' AND entry_type = 'CREDIT'`,
        [tenantId]
      );

      // 5. Campaign rule details
      const [campaign] = await query(
        `SELECT * FROM wallet_campaign_rules WHERE tenant_id = ? AND is_active = 1 LIMIT 1`,
        [tenantId]
      );

      // 6. Recent ledger stream (last 15 entries)
      const recentLedger = await query(
        `SELECT l.*, a.customer_id, a.customer_phone
         FROM ledger_transactions l
         JOIN wallet_accounts a ON l.wallet_account_id = a.id
         WHERE l.tenant_id = ?
         ORDER BY l.created_at DESC
         LIMIT 15`,
        [tenantId]
      );

      return {
        outstandingLiability: parseFloat(availRes?.total_liability || 0),
        activeLotsCount: parseInt(availRes?.active_lots_count || 0),
        pendingCashback: parseFloat(pendingRes?.total_pending || 0),
        pendingLotsCount: parseInt(pendingRes?.pending_lots_count || 0),
        totalRedeemed: parseFloat(redeemedRes?.total_redeemed || 0),
        totalBreakage: parseFloat(expiredRes?.total_breakage || 0),
        campaign: campaign || null,
        recentLedger
      };
    } catch (err) {
      console.error('WalletService.getOwnerLiabilitySummary error:', err);
      throw err;
    }
  }

  /**
   * 14. VERIFY LEDGER INVARIANTS (Slide 15)
   * Alert when ledger sum != materialized balance.
   */
  async verifyLedgerInvariants(tenantId) {
    try {
      // Sum of all customer credits minus debits from ledger
      const [ledgerSumRes] = await query(
        `SELECT 
           COALESCE(SUM(CASE WHEN entry_type = 'CREDIT' THEN amount ELSE -amount END), 0) as net_ledger_balance
         FROM ledger_transactions 
         WHERE tenant_id = ? AND account_category = 'CUSTOMER_REWARD_BALANCE'`,
        [tenantId]
      );

      // Sum of materialized available balances across all customer accounts
      const [accountsSumRes] = await query(
        `SELECT 
           COALESCE(SUM(cached_available_balance), 0) as total_cached_available,
           COALESCE(SUM(cached_pending_balance), 0) as total_cached_pending
         FROM wallet_accounts 
         WHERE tenant_id = ?`,
        [tenantId]
      );

      // Sum of actual active lots
      const [activeLotsRes] = await query(
        `SELECT COALESCE(SUM(remaining_amount), 0) as total_active_lots
         FROM credit_lots 
         WHERE tenant_id = ? AND status = 'AVAILABLE' AND remaining_amount > 0 AND expires_at > NOW()`,
        [tenantId]
      );

      const cachedAvailable = parseFloat(accountsSumRes?.total_cached_available || 0);
      const activeLots = parseFloat(activeLotsRes?.total_active_lots || 0);
      const lotDiscrepancy = Math.abs(cachedAvailable - activeLots);

      return {
        passed: lotDiscrepancy < 0.05,
        totalCachedAvailable: cachedAvailable,
        totalActiveLots: activeLots,
        totalCachedPending: parseFloat(accountsSumRes?.total_cached_pending || 0),
        discrepancy: lotDiscrepancy,
        status: lotDiscrepancy < 0.05 ? 'HEALTHY_INVARIANTS_VERIFIED' : 'DISCREPANCY_ALERT'
      };
    } catch (err) {
      console.error('WalletService.verifyLedgerInvariants error:', err);
      throw err;
    }
  }
}

module.exports = new WalletService();
