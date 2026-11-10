/**
 * Domain vocabulary shared by the API and the web app.
 *
 * These unions mirror the PostgreSQL enum types in schema.sql exactly. Keeping
 * one definition means a new purchase order status cannot be added on the
 * server and silently forgotten on the client — the compiler catches it.
 */

export const ROLES = ["admin", "staff", "manager", "supplier"] as const;
export type Role = (typeof ROLES)[number];

export const ENTITY_STATUSES = ["active", "inactive"] as const;
export type EntityStatus = (typeof ENTITY_STATUSES)[number];

export const MOVEMENT_TYPES = ["IN", "OUT"] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

export const MOVEMENT_REASONS = [
  "po_receipt",
  "opening_balance",
  "count_correction",
  "customer_return",
  "sale_dispatch",
  "damaged",
  "expired",
  "internal_use",
] as const;
export type MovementReason = (typeof MOVEMENT_REASONS)[number];

export const PO_STATUSES = [
  "draft",
  "pending_approval",
  "approved",
  "rejected",
  "shipped",
  "partially_received",
  "received",
  "cancelled",
] as const;
export type PoStatus = (typeof PO_STATUSES)[number];

// ---------------------------------------------------------------------------
// Labels — the only place a machine value is turned into display text.
// ---------------------------------------------------------------------------

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Admin",
  staff: "Staff",
  manager: "Manager",
  supplier: "Supplier",
};

export const ENTITY_STATUS_LABEL: Record<EntityStatus, string> = {
  active: "Active",
  inactive: "Inactive",
};

export const PO_STATUS_LABEL: Record<PoStatus, string> = {
  draft: "Draft",
  pending_approval: "Pending approval",
  approved: "Approved",
  rejected: "Rejected",
  shipped: "Shipped",
  partially_received: "Partially received",
  received: "Received",
  cancelled: "Cancelled",
};

export const MOVEMENT_REASON_LABEL: Record<MovementReason, string> = {
  po_receipt: "PO receipt",
  opening_balance: "Opening balance",
  count_correction: "Count correction",
  customer_return: "Customer return",
  sale_dispatch: "Sale / dispatch",
  damaged: "Damaged",
  expired: "Expired",
  internal_use: "Internal use",
};

/**
 * 3.3 — which directions each reason is valid for. `BOTH` means the reason
 * can be recorded as either an increase or a decrease. Drives the reason
 * dropdown on S11 and is re-checked server-side.
 */
export const MOVEMENT_REASON_DIRECTION: Record<
  MovementReason,
  MovementType | "BOTH"
> = {
  opening_balance: "IN",
  po_receipt: "IN",
  customer_return: "IN",
  count_correction: "BOTH",
  sale_dispatch: "OUT",
  damaged: "OUT",
  expired: "OUT",
  internal_use: "OUT",
};

/** Reasons the system writes itself; staff can never pick them on S11. */
export const SYSTEM_REASONS: MovementReason[] = [
  "opening_balance",
  "po_receipt",
];

/** Reasons that require an explanatory note (9). */
export const NOTE_REQUIRED_REASONS: MovementReason[] = [
  "count_correction",
  "damaged",
  "expired",
];

export function reasonsForDirection(direction: MovementType): MovementReason[] {
  return MOVEMENT_REASONS.filter(
    (reason) =>
      !SYSTEM_REASONS.includes(reason) &&
      (MOVEMENT_REASON_DIRECTION[reason] === direction ||
        MOVEMENT_REASON_DIRECTION[reason] === "BOTH"),
  );
}

// ---------------------------------------------------------------------------
// Shapes returned by the API
// ---------------------------------------------------------------------------

/** The signed-in user, as returned by GET /api/auth/me. */
export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: Role;
  supplier_id: number | null;
  supplier_name: string | null;
  status: EntityStatus;
}

/** 3.2 settings, already coerced from their stored string form. */
export interface AppSettings {
  company_name: string;
  currency_symbol: string;
  default_min_stock_level: number;
  po_number_prefix: string;
  low_stock_banner_enabled: boolean;
}

/** Error body shape for every non-2xx response (6). */
export interface ApiErrorBody {
  error: string;
  fields?: Record<string, string>;
}

/** Envelope for every paginated list endpoint. */
export interface Paginated<T> {
  rows: T[];
  total: number;
  page: number;
  limit: number;
}

// ---------------------------------------------------------------------------
// Entities
// ---------------------------------------------------------------------------

export interface Category {
  id: number;
  name: string;
  description: string | null;
  /** How many products reference it — a category in use cannot be deleted (BR12). */
  product_count: number;
}

export interface Supplier {
  id: number;
  name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  lead_time_days: number;
  status: EntityStatus;
  product_count: number;
  /** Orders that are neither received, cancelled nor rejected. */
  open_order_count: number;
}

/** A product as shown in the supplier detail panel — enough to spot low stock. */
export interface SupplierProductSummary {
  id: number;
  sku: string;
  name: string;
  unit: string;
  quantity_in_stock: number;
  min_stock_level: number;
  status: EntityStatus;
}

export interface SupplierOrderSummary {
  id: number;
  po_number: string;
  status: PoStatus;
  order_date: string;
  total_amount: number;
}

export interface SupplierDetail extends Supplier {
  products: SupplierProductSummary[];
  recent_orders: SupplierOrderSummary[];
}

export interface Product {
  id: number;
  sku: string;
  name: string;
  description: string | null;
  category_id: number;
  category_name: string;
  supplier_id: number;
  supplier_name: string;
  unit: string;
  unit_price: number;
  quantity_in_stock: number;
  min_stock_level: number;
  status: EntityStatus;
  created_by: number;
  created_by_name: string;
  updated_by: number | null;
  updated_by_name: string | null;
  created_at: string;
  updated_at: string;
  /** BR15, computed by the query — there is no stored low-stock flag. */
  is_low: boolean;
}

export interface PurchaseOrderLine {
  id: number;
  product_id: number;
  sku: string;
  product_name: string;
  unit: string;
  quantity: number;
  received_quantity: number;
  outstanding: number;
  unit_price: number;
  line_total: number;
}

export interface PurchaseOrder {
  id: number;
  po_number: string;
  supplier_id: number;
  supplier_name: string;
  supplier_contact: string | null;
  supplier_email: string | null;
  supplier_lead_time_days: number;
  status: PoStatus;
  order_date: string;
  expected_date: string | null;
  total_amount: number;
  notes: string | null;
  created_by: number;
  created_by_name: string;
  approved_by: number | null;
  approved_by_name: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  submitted_at: string | null;
  shipped_at: string | null;
  received_at: string | null;
  created_at: string;
  line_count: number;
  units_ordered: number;
  units_received: number;
}

export interface PurchaseOrderDetail extends PurchaseOrder {
  items: PurchaseOrderLine[];
}

/**
 * A row on S12. `shortfall` and `suggested_order_quantity` are computed, not
 * stored — there is no notifications table (BR15).
 */
export interface LowStockItem {
  id: number;
  sku: string;
  name: string;
  unit: string;
  unit_price: number;
  supplier_id: number;
  supplier_name: string;
  quantity_in_stock: number;
  min_stock_level: number;
  shortfall: number;
  /** min × 2 − quantity: enough to clear the minimum with headroom. */
  suggested_order_quantity: number;
  last_received_at: string | null;
}

// ---------------------------------------------------------------------------
// Dashboards (6.8)
// ---------------------------------------------------------------------------

export interface StatusCount {
  status: PoStatus;
  count: number;
}

export interface AdminDashboard {
  users_total: number;
  users_by_role: Array<{ role: Role; count: number }>;
  active_suppliers: number;
  total_suppliers: number;
  total_products: number;
  active_products: number;
  low_stock_count: number;
  pending_approval: number;
  awaiting_receipt: number;
  orders_by_status: StatusCount[];
  recent_movements: StockMovement[];
}

export interface StaffDashboard {
  active_products: number;
  low_stock_count: number;
  my_drafts: number;
  pending_approval: number;
  awaiting_receipt: number;
  recent_movements: StockMovement[];
  top_shortfalls: Array<{ sku: string; name: string; shortfall: number }>;
}

export interface ManagerDashboard {
  pending_approval: number;
  pending_orders: PurchaseOrder[];
  inventory_value: number;
  low_stock_count: number;
  approved_this_month: number;
  spend_this_month: number;
  spend_by_supplier: Array<{ supplier_name: string; total: number }>;
  movement_trend: Array<{ day: string; in_qty: number; out_qty: number }>;
}

export interface SupplierDashboard {
  new_orders: number;
  shipped: number;
  completed_this_month: number;
  recent_orders: PurchaseOrder[];
}

// ---------------------------------------------------------------------------
// Reports (6.9)
// ---------------------------------------------------------------------------

export const REPORT_TYPES = [
  "stock-levels",
  "low-stock",
  "stock-movements",
  "purchase-orders",
] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export interface ReportChartPoint {
  label: string;
  value: number;
  /** Only the movement report uses the second series. */
  secondary?: number;
}

export interface ReportResult {
  type: ReportType;
  title: string;
  columns: Array<{ key: string; label: string; align?: "left" | "right" }>;
  rows: Array<Record<string, string | number | null>>;
  chart: {
    title: string;
    note: string;
    kind: "bar" | "line";
    points: ReportChartPoint[];
  };
  summary: string;
}

// ---------------------------------------------------------------------------
// Users (6.2)
// ---------------------------------------------------------------------------

export interface UserRecord {
  id: number;
  name: string;
  email: string;
  role: Role;
  supplier_id: number | null;
  supplier_name: string | null;
  status: EntityStatus;
  created_at: string;
}

export interface StockMovement {
  id: number;
  product_id: number;
  product_sku: string;
  product_name: string;
  type: MovementType;
  reason: MovementReason;
  quantity_change: number;
  balance_after: number;
  reference: string | null;
  note: string | null;
  user_id: number;
  user_name: string;
  created_at: string;
}
