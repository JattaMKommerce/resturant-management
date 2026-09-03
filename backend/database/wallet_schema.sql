-- =====================================================================
-- KRATU REWARDS & DOUBLE-ENTRY WALLET SCHEMA
-- Architecture Blueprint: 16-Slide Double-Entry Fintech Specification
-- =====================================================================

-- 1. WALLET ACCOUNTS (Tenant + Customer + Balance Type)
CREATE TABLE IF NOT EXISTS wallet_accounts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  customer_id INT NOT NULL,
  customer_phone VARCHAR(20) NULL,
  balance_type ENUM('PROMOTIONAL_REWARD', 'REFUND_CREDIT') DEFAULT 'PROMOTIONAL_REWARD',
  cached_available_balance DECIMAL(12, 2) DEFAULT 0.00,
  cached_pending_balance DECIMAL(12, 2) DEFAULT 0.00,
  status ENUM('ACTIVE', 'SUSPENDED', 'FROZEN') DEFAULT 'ACTIVE',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_tenant_customer_type (tenant_id, customer_id, balance_type),
  INDEX idx_tenant_status (tenant_id, status),
  INDEX idx_customer_phone (customer_phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. CREDIT LOTS (FIFO Lot Expiry & Redemption Tracking)
CREATE TABLE IF NOT EXISTS credit_lots (
  id INT AUTO_INCREMENT PRIMARY KEY,
  wallet_account_id INT NOT NULL,
  tenant_id INT NOT NULL,
  source_order_id INT NULL,
  original_amount DECIMAL(12, 2) NOT NULL,
  remaining_amount DECIMAL(12, 2) NOT NULL,
  status ENUM('PENDING', 'AVAILABLE', 'EXHAUSTED', 'EXPIRED', 'REVERSED') DEFAULT 'PENDING',
  valid_from DATETIME NULL,
  expires_at DATETIME NOT NULL,
  source_event VARCHAR(64) DEFAULT 'ORDER_CASHBACK',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_lot_account_status (wallet_account_id, status),
  INDEX idx_lot_tenant_expiry (tenant_id, expires_at, status),
  INDEX idx_lot_source_order (source_order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. IMMUTABLE DOUBLE-ENTRY LEDGER TRANSACTIONS
-- Rule: Posted entries are NEVER edited or deleted.
CREATE TABLE IF NOT EXISTS ledger_transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  wallet_account_id INT NOT NULL,
  idempotency_key VARCHAR(128) NOT NULL UNIQUE,
  entry_type ENUM('DEBIT', 'CREDIT') NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  account_category ENUM(
    'CUSTOMER_REWARD_BALANCE', 
    'MERCHANT_REWARD_LIABILITY', 
    'ORDER_SETTLEMENT_BENEFIT', 
    'EXPIRED_BREAKAGE'
  ) NOT NULL,
  event_type ENUM(
    'CASHBACK_PENDING', 
    'CASHBACK_ACTIVATED', 
    'CHECKOUT_RESERVED', 
    'REDEMPTION_COMMITTED', 
    'RESERVATION_RELEASED', 
    'CASHBACK_REVERSED', 
    'CREDIT_EXPIRED', 
    'ADMIN_ADJUSTMENT'
  ) NOT NULL,
  reference_id VARCHAR(64) NULL,
  credit_lot_id INT NULL,
  description TEXT NULL,
  actor VARCHAR(64) DEFAULT 'SYSTEM',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ledger_account (wallet_account_id, created_at),
  INDEX idx_ledger_tenant_cat (tenant_id, account_category, created_at),
  INDEX idx_ledger_ref (reference_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. CHECKOUT RESERVATIONS (Anti-Double-Spend Concurrency Locks)
CREATE TABLE IF NOT EXISTS wallet_reservations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  wallet_account_id INT NOT NULL,
  checkout_id VARCHAR(128) NOT NULL UNIQUE,
  reserved_amount DECIMAL(12, 2) NOT NULL,
  lot_allocations_json JSON NULL,
  status ENUM('RESERVED', 'COMMITTED', 'RELEASED', 'EXPIRED') DEFAULT 'RESERVED',
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_res_account_status (wallet_account_id, status),
  INDEX idx_res_expiry (expires_at, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. WALLET CAMPAIGN RULES (Economics & Fraud Protection Caps)
CREATE TABLE IF NOT EXISTS wallet_campaign_rules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  campaign_name VARCHAR(128) NOT NULL,
  reward_type ENUM('PERCENTAGE', 'FIXED') DEFAULT 'PERCENTAGE',
  reward_value DECIMAL(10, 2) DEFAULT 10.00,
  max_cashback_per_order DECIMAL(10, 2) DEFAULT 100.00,
  min_order_amount DECIMAL(10, 2) DEFAULT 300.00,
  max_redemption_percentage DECIMAL(5, 2) DEFAULT 50.00,
  expiry_days INT DEFAULT 30,
  campaign_budget DECIMAL(12, 2) DEFAULT 10000.00,
  budget_spent DECIMAL(12, 2) DEFAULT 0.00,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_rules_tenant_active (tenant_id, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
