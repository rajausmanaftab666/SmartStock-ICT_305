-- ============================================================================
-- SmartStock — database schema (PostgreSQL 17)
--
-- Ported from the MySQL definition in §3.1 of the build specification. The
-- differences are mechanical, not structural:
--   AUTO_INCREMENT                -> SERIAL
--   ENUM('a','b')                 -> CREATE TYPE ... AS ENUM
--   DATETIME                      -> TIMESTAMPTZ
--   ON UPDATE CURRENT_TIMESTAMP   -> a shared set_updated_at() trigger
--   inline INDEX ...              -> separate CREATE INDEX statements
--
-- CHECK constraints are the last line of defence for the business rules that
-- can be expressed declaratively (BR3, BR9, BR18). They are not the primary
-- enforcement — the service layer is — but they mean a bug in application code
-- cannot leave the database in a state the rules forbid.
--
-- Table order matters: suppliers must exist before users (FK), and both must
-- exist before products.
-- ============================================================================

DROP TABLE IF EXISTS purchase_order_items CASCADE;
DROP TABLE IF EXISTS purchase_orders CASCADE;
DROP TABLE IF EXISTS stock_movements CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS settings CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS suppliers CASCADE;
DROP TABLE IF EXISTS session CASCADE;

DROP SEQUENCE IF EXISTS po_number_seq;

DROP TYPE IF EXISTS po_status CASCADE;
DROP TYPE IF EXISTS movement_reason CASCADE;
DROP TYPE IF EXISTS movement_type CASCADE;
DROP TYPE IF EXISTS entity_status CASCADE;
DROP TYPE IF EXISTS user_role CASCADE;

DROP FUNCTION IF EXISTS set_updated_at() CASCADE;

-- ---------------------------------------------------------------------------
-- Enumerated types
-- ---------------------------------------------------------------------------

CREATE TYPE user_role AS ENUM ('admin', 'staff', 'manager', 'supplier');

CREATE TYPE entity_status AS ENUM ('active', 'inactive');

CREATE TYPE movement_type AS ENUM ('IN', 'OUT');

CREATE TYPE movement_reason AS ENUM (
  'po_receipt',
  'opening_balance',
  'count_correction',
  'customer_return',
  'sale_dispatch',
  'damaged',
  'expired',
  'internal_use'
);

CREATE TYPE po_status AS ENUM (
  'draft',
  'pending_approval',
  'approved',
  'rejected',
  'shipped',
  'partially_received',
  'received',
  'cancelled'
);

-- ---------------------------------------------------------------------------
-- Shared updated_at trigger (MySQL's ON UPDATE CURRENT_TIMESTAMP)
-- ---------------------------------------------------------------------------

CREATE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- suppliers
-- ---------------------------------------------------------------------------

CREATE TABLE suppliers (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(150) NOT NULL,
  contact_person  VARCHAR(100),
  email           VARCHAR(150),
  phone           VARCHAR(30),
  address         VARCHAR(255),
  lead_time_days  INTEGER NOT NULL DEFAULT 7,
  status          entity_status NOT NULL DEFAULT 'active',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT suppliers_lead_time_range CHECK (lead_time_days BETWEEN 0 AND 365)
);

CREATE TRIGGER suppliers_set_updated_at
  BEFORE UPDATE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_suppliers_status ON suppliers (status);

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------

CREATE TABLE users (
  id             SERIAL PRIMARY KEY,
  name           VARCHAR(100) NOT NULL,
  email          VARCHAR(150) NOT NULL UNIQUE,
  password_hash  VARCHAR(255) NOT NULL,
  role           user_role NOT NULL,
  supplier_id    INTEGER REFERENCES suppliers (id),
  status         entity_status NOT NULL DEFAULT 'active',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- BR18: supplier users are linked to exactly one supplier company; every
  -- other role must not carry a supplier_id at all.
  CONSTRAINT users_supplier_link CHECK (
    (role = 'supplier' AND supplier_id IS NOT NULL)
    OR (role <> 'supplier' AND supplier_id IS NULL)
  )
);

CREATE TRIGGER users_set_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_users_role ON users (role);
CREATE INDEX idx_users_status ON users (status);
CREATE INDEX idx_users_supplier ON users (supplier_id);

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------

CREATE TABLE categories (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL UNIQUE,
  description VARCHAR(255),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------

CREATE TABLE products (
  id                 SERIAL PRIMARY KEY,
  sku                VARCHAR(50) NOT NULL UNIQUE,
  name               VARCHAR(150) NOT NULL,
  description        TEXT,
  category_id        INTEGER NOT NULL REFERENCES categories (id),
  supplier_id        INTEGER NOT NULL REFERENCES suppliers (id),
  unit               VARCHAR(20) NOT NULL DEFAULT 'pcs',
  unit_price         NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  quantity_in_stock  INTEGER NOT NULL DEFAULT 0,
  min_stock_level    INTEGER NOT NULL DEFAULT 0,
  status             entity_status NOT NULL DEFAULT 'active',
  created_by         INTEGER NOT NULL REFERENCES users (id),
  updated_by         INTEGER REFERENCES users (id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- BR3: no code path may drive a balance below zero.
  CONSTRAINT products_stock_non_negative CHECK (quantity_in_stock >= 0),
  CONSTRAINT products_min_level_non_negative CHECK (min_stock_level >= 0),
  CONSTRAINT products_price_non_negative CHECK (unit_price >= 0)
);

CREATE TRIGGER products_set_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_products_supplier ON products (supplier_id);
CREATE INDEX idx_products_category ON products (category_id);
CREATE INDEX idx_products_status ON products (status);
-- BR15 is evaluated on every dashboard, badge and alert screen.
CREATE INDEX idx_products_low_stock ON products (status, quantity_in_stock, min_stock_level);

-- ---------------------------------------------------------------------------
-- stock_movements — the ledger. Append only; rows are never updated.
-- ---------------------------------------------------------------------------

CREATE TABLE stock_movements (
  id               SERIAL PRIMARY KEY,
  product_id       INTEGER NOT NULL REFERENCES products (id),
  type             movement_type NOT NULL,
  reason           movement_reason NOT NULL,
  quantity_change  INTEGER NOT NULL,
  balance_after    INTEGER NOT NULL,
  reference        VARCHAR(60),
  note             VARCHAR(255),
  user_id          INTEGER NOT NULL REFERENCES users (id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- BR2: the sign of quantity_change always agrees with the direction.
  CONSTRAINT movements_sign_matches_type CHECK (
    (type = 'IN' AND quantity_change > 0) OR (type = 'OUT' AND quantity_change < 0)
  ),
  CONSTRAINT movements_balance_non_negative CHECK (balance_after >= 0)
);

CREATE INDEX idx_movements_product ON stock_movements (product_id, created_at DESC);
CREATE INDEX idx_movements_date ON stock_movements (created_at DESC);
CREATE INDEX idx_movements_reason ON stock_movements (reason);

-- ---------------------------------------------------------------------------
-- purchase_orders
-- ---------------------------------------------------------------------------

-- BR13: po_number is generated from a dedicated sequence so numbers are unique
-- and gap-tolerant even under concurrent creation.
CREATE SEQUENCE po_number_seq START WITH 1;

CREATE TABLE purchase_orders (
  id                SERIAL PRIMARY KEY,
  po_number         VARCHAR(20) NOT NULL UNIQUE,
  supplier_id       INTEGER NOT NULL REFERENCES suppliers (id),
  status            po_status NOT NULL DEFAULT 'draft',
  order_date        DATE NOT NULL,
  expected_date     DATE,
  total_amount      NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  notes             VARCHAR(500),
  created_by        INTEGER NOT NULL REFERENCES users (id),
  approved_by       INTEGER REFERENCES users (id),
  approved_at       TIMESTAMPTZ,
  rejection_reason  VARCHAR(255),
  submitted_at      TIMESTAMPTZ,
  shipped_at        TIMESTAMPTZ,
  received_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- BR8: the approver is never the person who raised the order.
  CONSTRAINT po_approver_not_raiser CHECK (approved_by IS NULL OR approved_by <> created_by),
  CONSTRAINT po_total_non_negative CHECK (total_amount >= 0),
  CONSTRAINT po_expected_after_order CHECK (expected_date IS NULL OR expected_date >= order_date)
);

CREATE TRIGGER purchase_orders_set_updated_at
  BEFORE UPDATE ON purchase_orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_po_status ON purchase_orders (status);
CREATE INDEX idx_po_supplier ON purchase_orders (supplier_id);
CREATE INDEX idx_po_order_date ON purchase_orders (order_date DESC);
CREATE INDEX idx_po_created_by ON purchase_orders (created_by);

-- ---------------------------------------------------------------------------
-- purchase_order_items
-- ---------------------------------------------------------------------------

CREATE TABLE purchase_order_items (
  id                 SERIAL PRIMARY KEY,
  purchase_order_id  INTEGER NOT NULL REFERENCES purchase_orders (id) ON DELETE CASCADE,
  product_id         INTEGER NOT NULL REFERENCES products (id),
  quantity           INTEGER NOT NULL,
  received_quantity  INTEGER NOT NULL DEFAULT 0,
  unit_price         NUMERIC(10, 2) NOT NULL,
  line_total         NUMERIC(12, 2) NOT NULL,
  CONSTRAINT poi_quantity_positive CHECK (quantity >= 1),
  -- BR9: a line can never be over-received.
  CONSTRAINT poi_received_within_ordered CHECK (received_quantity >= 0 AND received_quantity <= quantity),
  CONSTRAINT poi_unit_price_non_negative CHECK (unit_price >= 0)
);

CREATE INDEX idx_poi_po ON purchase_order_items (purchase_order_id);
CREATE INDEX idx_poi_product ON purchase_order_items (product_id);

-- ---------------------------------------------------------------------------
-- settings
-- ---------------------------------------------------------------------------

CREATE TABLE settings (
  setting_key    VARCHAR(60) PRIMARY KEY,
  setting_value  VARCHAR(255) NOT NULL,
  updated_by     INTEGER REFERENCES users (id),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER settings_set_updated_at
  BEFORE UPDATE ON settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- session — server-side session store for connect-pg-simple.
-- Sessions live in the database, so a restarted API does not log everyone out
-- and the cookie carries nothing but an opaque id.
-- ---------------------------------------------------------------------------

CREATE TABLE session (
  sid    VARCHAR NOT NULL COLLATE "default" PRIMARY KEY,
  sess   JSON NOT NULL,
  expire TIMESTAMP(6) NOT NULL
);

CREATE INDEX idx_session_expire ON session (expire);
