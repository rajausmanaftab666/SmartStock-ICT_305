/**
 * Static demo catalogue for the seed script.
 *
 * The six suppliers, five categories, seven users, first sixteen products,
 * thirteen purchase orders and twelve most-recent stock movements are taken
 * verbatim from the approved clickable prototype, so every screenshot matches
 * the design that was signed off. The remaining twenty-four products extend
 * the catalogue to the forty the specification asks for, spread evenly across
 * all five categories and the five active suppliers.
 *
 * Dates are expressed as day offsets from the day the seed runs (negative is
 * the past). That keeps "last 30 days" charts populated no matter when the
 * database is rebuilt.
 */

export interface SeedSupplier {
  seedId: number;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  leadTimeDays: number;
  status: 'active' | 'inactive';
}

export interface SeedCategory {
  seedId: number;
  name: string;
  description: string;
}

export interface SeedUser {
  seedId: number;
  name: string;
  email: string;
  role: 'admin' | 'staff' | 'manager' | 'supplier';
  supplierSeedId: number | null;
  status: 'active' | 'inactive';
  createdDayOffset: number;
}

export interface SeedProduct {
  seedId: number;
  sku: string;
  name: string;
  description: string;
  categorySeedId: number;
  supplierSeedId: number;
  unit: string;
  unitPrice: number;
  /** Final balance once the whole generated ledger has been applied. */
  quantityInStock: number;
  minStockLevel: number;
  status: 'active' | 'inactive';
}

export interface SeedPoLine {
  productSeedId: number;
  quantity: number;
  receivedQuantity: number;
  unitPrice: number;
}

export interface SeedPurchaseOrder {
  seedId: number;
  poNumber: string;
  supplierSeedId: number;
  status:
    | 'draft'
    | 'pending_approval'
    | 'approved'
    | 'rejected'
    | 'shipped'
    | 'partially_received'
    | 'received'
    | 'cancelled';
  orderDayOffset: number;
  expectedDayOffset: number;
  shippedDayOffset?: number;
  receivedDayOffset?: number;
  notes: string;
  rejectionReason?: string;
  /** Seed id of the staff user who raised it. */
  createdBySeedId: number;
  lines: SeedPoLine[];
}

/** A movement lifted from the prototype — the newest row for its product. */
export interface SeedTailMovement {
  productSeedId: number;
  type: 'IN' | 'OUT';
  reason:
    | 'po_receipt'
    | 'opening_balance'
    | 'count_correction'
    | 'customer_return'
    | 'sale_dispatch'
    | 'damaged'
    | 'expired'
    | 'internal_use';
  quantityChange: number;
  reference: string | null;
  note: string | null;
  userSeedId: number;
  dayOffset: number;
  minutesIntoDay: number;
}

// ---------------------------------------------------------------------------
// Suppliers — 5 active, 1 inactive, lead times 4–14 days
// ---------------------------------------------------------------------------

export const suppliers: SeedSupplier[] = [
  {
    seedId: 1,
    name: 'Harbourline Beverages',
    contactPerson: 'Dana Whitfield',
    email: 'orders@harbourline.com.au',
    phone: '+61 8 9221 4410',
    address: '12 Quay St, Fremantle WA',
    leadTimeDays: 5,
    status: 'active',
  },
  {
    seedId: 2,
    name: 'Kettle & Grain Wholesale',
    contactPerson: 'Marcus Ng',
    email: 'marcus@kettlegrain.com',
    phone: '+61 8 9330 8827',
    address: '88 Mill Rd, Canning Vale WA',
    leadTimeDays: 7,
    status: 'active',
  },
  {
    seedId: 3,
    name: 'Purelyne Cleaning Supply',
    contactPerson: 'Amelia Sorensen',
    email: 'sales@purelyne.com.au',
    phone: '+61 8 9455 1120',
    address: '3/40 Kewdale Rd, Kewdale WA',
    leadTimeDays: 10,
    status: 'active',
  },
  {
    seedId: 4,
    name: 'CartonWorks Packaging',
    contactPerson: 'Tobias Reid',
    email: 'tobias@cartonworks.com',
    phone: '+61 8 9412 7765',
    address: '220 Bannister Rd, Malaga WA',
    leadTimeDays: 4,
    status: 'active',
  },
  {
    seedId: 5,
    name: 'Meridian Office Stationery',
    contactPerson: 'Priya Raman',
    email: 'accounts@meridianoffice.com',
    phone: '+61 8 9200 6633',
    address: '19 Sundercombe St, Osborne Park WA',
    leadTimeDays: 12,
    status: 'active',
  },
  {
    seedId: 6,
    name: 'Northbay Dry Goods',
    contactPerson: 'Glen Harper',
    email: 'glen@northbaydry.com',
    phone: '+61 8 9481 2299',
    address: '6 Hasler Rd, Osborne Park WA',
    leadTimeDays: 14,
    status: 'inactive',
  },
];

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export const categories: SeedCategory[] = [
  { seedId: 1, name: 'Beverages', description: 'Drinks, tea, coffee' },
  { seedId: 2, name: 'Dry Goods', description: 'Shelf-stable staples' },
  { seedId: 3, name: 'Cleaning', description: 'Chemicals and consumables' },
  { seedId: 4, name: 'Packaging', description: 'Cartons, wrap, void fill' },
  { seedId: 5, name: 'Stationery', description: 'Office supplies' },
];

// ---------------------------------------------------------------------------
// Users — every account uses SEED_PASSWORD (default "demo1234").
// User 7 is deactivated on purpose, to demonstrate BR19 during the demo.
// ---------------------------------------------------------------------------

export const users: SeedUser[] = [
  {
    seedId: 1,
    name: 'Renee Adeyemi',
    email: 'admin@smartstock.io',
    role: 'admin',
    supplierSeedId: null,
    status: 'active',
    createdDayOffset: -174,
  },
  {
    seedId: 2,
    name: 'Jordan Vella',
    email: 'staff@smartstock.io',
    role: 'staff',
    supplierSeedId: null,
    status: 'active',
    createdDayOffset: -174,
  },
  {
    seedId: 3,
    name: 'Hana Ishikawa',
    email: 'hana@smartstock.io',
    role: 'staff',
    supplierSeedId: null,
    status: 'active',
    createdDayOffset: -154,
  },
  {
    seedId: 4,
    name: 'Peter Oyelaran',
    email: 'manager@smartstock.io',
    role: 'manager',
    supplierSeedId: null,
    status: 'active',
    createdDayOffset: -171,
  },
  {
    seedId: 5,
    name: 'Dana Whitfield',
    email: 'dana@harbourline.com.au',
    role: 'supplier',
    supplierSeedId: 1,
    status: 'active',
    createdDayOffset: -137,
  },
  {
    seedId: 6,
    name: 'Marcus Ng',
    email: 'marcus@kettlegrain.com',
    role: 'supplier',
    supplierSeedId: 2,
    status: 'active',
    createdDayOffset: -137,
  },
  {
    seedId: 7,
    name: 'Tobias Reid',
    email: 'tobias@cartonworks.com',
    role: 'supplier',
    supplierSeedId: 4,
    status: 'inactive',
    createdDayOffset: -117,
  },
];

// ---------------------------------------------------------------------------
// Products — 40 across 5 categories and the 5 active suppliers.
// Eight active products sit at or below their minimum (the alerts page),
// four sit just above it, the rest are healthy.
// ---------------------------------------------------------------------------

export const products: SeedProduct[] = [
  // Beverages — Harbourline Beverages
  { seedId: 1,  sku: 'BEV-1001', name: 'Sparkling Mineral Water 750ml',  description: 'Case of 12 glass bottles, naturally carbonated.',      categorySeedId: 1, supplierSeedId: 1, unit: 'case',   unitPrice: 18.50,  quantityInStock: 6,   minStockLevel: 12, status: 'active' },
  { seedId: 2,  sku: 'BEV-1002', name: 'Cold Brew Concentrate 2L',       description: 'Single-origin cold brew, dilute 1:3.',                 categorySeedId: 1, supplierSeedId: 1, unit: 'bottle', unitPrice: 24.00,  quantityInStock: 48,  minStockLevel: 20, status: 'active' },
  { seedId: 3,  sku: 'BEV-1003', name: 'Ceylon Black Tea 500g',          description: 'Loose leaf, foil-sealed.',                             categorySeedId: 1, supplierSeedId: 1, unit: 'pack',   unitPrice: 12.75,  quantityInStock: 9,   minStockLevel: 15, status: 'active' },
  // The largest shortfall in the catalogue, and deliberately so: it belongs to
  // Harbourline, the supplier whose contact Dana Whitfield has an active
  // login. The §12 demo starts by ordering the worst low-stock row, and that
  // order has to be one a supplier can actually sign in and ship.
  { seedId: 4,  sku: 'BEV-1004', name: 'Espresso Beans 1kg',             description: 'Medium roast, whole bean.',                            categorySeedId: 1, supplierSeedId: 1, unit: 'bag',    unitPrice: 28.00,  quantityInStock: 3,   minStockLevel: 13, status: 'active' },
  { seedId: 17, sku: 'BEV-1005', name: 'Still Spring Water 1.5L',        description: 'Case of 12 PET bottles.',                              categorySeedId: 1, supplierSeedId: 1, unit: 'case',   unitPrice: 14.90,  quantityInStock: 62,  minStockLevel: 24, status: 'active' },
  { seedId: 18, sku: 'BEV-1006', name: 'Orange Juice Concentrate 5L',    description: 'Frozen concentrate, dilute 1:4.',                      categorySeedId: 1, supplierSeedId: 1, unit: 'drum',   unitPrice: 39.50,  quantityInStock: 18,  minStockLevel: 10, status: 'active' },
  { seedId: 19, sku: 'BEV-1007', name: 'Green Tea Sachets 200pk',        description: 'Individually wrapped sachets.',                        categorySeedId: 1, supplierSeedId: 1, unit: 'box',    unitPrice: 22.40,  quantityInStock: 27,  minStockLevel: 14, status: 'active' },
  { seedId: 20, sku: 'BEV-1008', name: 'Barista Oat Milk 1L',            description: 'Case of 6, barista formulation.',                      categorySeedId: 1, supplierSeedId: 1, unit: 'case',   unitPrice: 31.20,  quantityInStock: 15,  minStockLevel: 14, status: 'active' },

  // Dry Goods — Kettle & Grain Wholesale
  { seedId: 5,  sku: 'DRY-2001', name: 'Jasmine Rice 10kg',              description: 'Thai fragrant long grain.',                            categorySeedId: 2, supplierSeedId: 2, unit: 'sack',   unitPrice: 32.00,  quantityInStock: 84,  minStockLevel: 25, status: 'active' },
  { seedId: 6,  sku: 'DRY-2002', name: 'Rolled Oats 5kg',                description: 'Traditional cut, kiln dried.',                         categorySeedId: 2, supplierSeedId: 2, unit: 'sack',   unitPrice: 14.20,  quantityInStock: 11,  minStockLevel: 18, status: 'active' },
  { seedId: 7,  sku: 'DRY-2003', name: 'Chickpeas 3kg',                  description: 'Dried, sorted, food service grade.',                   categorySeedId: 2, supplierSeedId: 2, unit: 'pack',   unitPrice: 9.60,   quantityInStock: 62,  minStockLevel: 20, status: 'active' },
  { seedId: 21, sku: 'DRY-2004', name: 'Plain Flour 12.5kg',             description: 'Unbleached bakers flour.',                             categorySeedId: 2, supplierSeedId: 2, unit: 'sack',   unitPrice: 21.80,  quantityInStock: 44,  minStockLevel: 20, status: 'active' },
  { seedId: 22, sku: 'DRY-2005', name: 'Caster Sugar 15kg',              description: 'Fine grain, free flowing.',                            categorySeedId: 2, supplierSeedId: 2, unit: 'sack',   unitPrice: 26.40,  quantityInStock: 9,   minStockLevel: 12, status: 'active' },
  { seedId: 23, sku: 'DRY-2006', name: 'Penne Pasta 5kg',                description: 'Durum wheat semolina.',                                categorySeedId: 2, supplierSeedId: 2, unit: 'pack',   unitPrice: 11.90,  quantityInStock: 58,  minStockLevel: 22, status: 'active' },
  { seedId: 24, sku: 'DRY-2007', name: 'Olive Oil 4L',                   description: 'Extra virgin, cold pressed.',                          categorySeedId: 2, supplierSeedId: 2, unit: 'drum',   unitPrice: 54.00,  quantityInStock: 23,  minStockLevel: 12, status: 'active' },
  { seedId: 25, sku: 'DRY-2008', name: 'Sea Salt Fine 25kg',             description: 'Solar evaporated, food grade.',                        categorySeedId: 2, supplierSeedId: 2, unit: 'sack',   unitPrice: 18.60,  quantityInStock: 31,  minStockLevel: 15, status: 'active' },

  // Cleaning — Purelyne Cleaning Supply
  { seedId: 8,  sku: 'CLN-3001', name: 'Industrial Degreaser 5L',        description: 'Alkaline degreaser for kitchen plant.',                categorySeedId: 3, supplierSeedId: 3, unit: 'drum',   unitPrice: 46.00,  quantityInStock: 4,   minStockLevel: 8,  status: 'active' },
  { seedId: 9,  sku: 'CLN-3002', name: 'Microfibre Cloth Bulk 50pk',     description: 'Colour coded, laundry safe.',                          categorySeedId: 3, supplierSeedId: 3, unit: 'pack',   unitPrice: 21.40,  quantityInStock: 33,  minStockLevel: 15, status: 'active' },
  { seedId: 10, sku: 'CLN-3003', name: 'Floor Sanitiser 20L',            description: 'Neutral pH, dilute 1:100.',                            categorySeedId: 3, supplierSeedId: 3, unit: 'drum',   unitPrice: 88.00,  quantityInStock: 7,   minStockLevel: 6,  status: 'active' },
  { seedId: 26, sku: 'CLN-3004', name: 'Bleach Concentrate 10L',         description: 'Sodium hypochlorite 12.5%.',                           categorySeedId: 3, supplierSeedId: 3, unit: 'drum',   unitPrice: 32.75,  quantityInStock: 26,  minStockLevel: 12, status: 'active' },
  { seedId: 27, sku: 'CLN-3005', name: 'Hand Soap Refill 5L',            description: 'Fragrance free, pump compatible.',                     categorySeedId: 3, supplierSeedId: 3, unit: 'drum',   unitPrice: 27.30,  quantityInStock: 19,  minStockLevel: 10, status: 'active' },
  { seedId: 28, sku: 'CLN-3006', name: 'Disposable Gloves 100pk',        description: 'Nitrile, powder free, medium.',                        categorySeedId: 3, supplierSeedId: 3, unit: 'box',    unitPrice: 12.50,  quantityInStock: 74,  minStockLevel: 30, status: 'active' },
  { seedId: 29, sku: 'CLN-3007', name: 'Commercial Mop Head',            description: 'Looped end, 400g cotton blend.',                       categorySeedId: 3, supplierSeedId: 3, unit: 'pcs',    unitPrice: 8.40,   quantityInStock: 41,  minStockLevel: 18, status: 'active' },
  { seedId: 30, sku: 'CLN-3008', name: 'Pressure Washer Detergent 25L',  description: 'High foam, for hard surfaces.',                        categorySeedId: 3, supplierSeedId: 3, unit: 'drum',   unitPrice: 118.00, quantityInStock: 11,  minStockLevel: 6,  status: 'active' },

  // Packaging — CartonWorks Packaging
  { seedId: 11, sku: 'PKG-4001', name: 'Corrugated Carton 400x300',      description: 'Single wall, bundle of 25.',                           categorySeedId: 4, supplierSeedId: 4, unit: 'bundle', unitPrice: 27.90,  quantityInStock: 120, minStockLevel: 40, status: 'active' },
  { seedId: 12, sku: 'PKG-4002', name: 'Pallet Wrap 500mm',              description: '20 micron cast, hand roll.',                           categorySeedId: 4, supplierSeedId: 4, unit: 'roll',   unitPrice: 15.75,  quantityInStock: 13,  minStockLevel: 20, status: 'active' },
  { seedId: 13, sku: 'PKG-4003', name: 'Void Fill Paper 450m',           description: 'Recycled kraft, 70gsm.',                               categorySeedId: 4, supplierSeedId: 4, unit: 'roll',   unitPrice: 34.50,  quantityInStock: 51,  minStockLevel: 24, status: 'active' },
  { seedId: 31, sku: 'PKG-4004', name: 'Shipping Satchel 400x500 500pk', description: 'Opaque poly, self seal.',                              categorySeedId: 4, supplierSeedId: 4, unit: 'box',    unitPrice: 96.00,  quantityInStock: 22,  minStockLevel: 12, status: 'active' },
  { seedId: 32, sku: 'PKG-4005', name: 'Packing Tape 48mm 36pk',         description: 'Acrylic adhesive, clear.',                             categorySeedId: 4, supplierSeedId: 4, unit: 'box',    unitPrice: 44.60,  quantityInStock: 38,  minStockLevel: 20, status: 'active' },
  { seedId: 33, sku: 'PKG-4006', name: 'Bubble Wrap 750mm 100m',         description: '10mm bubble, perforated.',                             categorySeedId: 4, supplierSeedId: 4, unit: 'roll',   unitPrice: 29.80,  quantityInStock: 25,  minStockLevel: 24, status: 'active' },
  { seedId: 34, sku: 'PKG-4007', name: 'Timber Pallet 1165x1165',        description: 'Standard AU export pallet.',                           categorySeedId: 4, supplierSeedId: 4, unit: 'pcs',    unitPrice: 24.50,  quantityInStock: 96,  minStockLevel: 40, status: 'active' },
  { seedId: 35, sku: 'PKG-4008', name: 'Strapping Coil 12mm 1000m',      description: 'Polypropylene, machine grade.',                        categorySeedId: 4, supplierSeedId: 4, unit: 'roll',   unitPrice: 67.20,  quantityInStock: 14,  minStockLevel: 8,  status: 'active' },

  // Stationery — Meridian Office Stationery
  { seedId: 14, sku: 'STA-5001', name: 'A4 Copy Paper 80gsm',            description: 'Box of 5 reams, FSC certified.',                       categorySeedId: 5, supplierSeedId: 5, unit: 'box',    unitPrice: 42.00,  quantityInStock: 8,   minStockLevel: 16, status: 'active' },
  { seedId: 15, sku: 'STA-5002', name: 'Gel Pen Refill Black',           description: 'Box of 50, 0.7mm.',                                    categorySeedId: 5, supplierSeedId: 5, unit: 'box',    unitPrice: 6.80,   quantityInStock: 96,  minStockLevel: 30, status: 'active' },
  { seedId: 16, sku: 'STA-5003', name: 'Lever Arch Binder 70mm',         description: 'Discontinued line — kept for order history.',          categorySeedId: 5, supplierSeedId: 5, unit: 'pcs',    unitPrice: 4.95,   quantityInStock: 5,   minStockLevel: 12, status: 'inactive' },
  { seedId: 36, sku: 'STA-5004', name: 'Toner Cartridge Mono HL-5500',   description: 'Genuine OEM, 12k page yield.',                         categorySeedId: 5, supplierSeedId: 5, unit: 'pcs',    unitPrice: 248.00, quantityInStock: 6,   minStockLevel: 4,  status: 'active' },
  { seedId: 37, sku: 'STA-5005', name: 'Sticky Notes 76mm 12pk',         description: 'Assorted colours, repositionable.',                    categorySeedId: 5, supplierSeedId: 5, unit: 'pack',   unitPrice: 9.20,   quantityInStock: 63,  minStockLevel: 25, status: 'active' },
  { seedId: 38, sku: 'STA-5006', name: 'Whiteboard Marker 10pk',         description: 'Bullet tip, low odour.',                               categorySeedId: 5, supplierSeedId: 5, unit: 'box',    unitPrice: 17.60,  quantityInStock: 34,  minStockLevel: 16, status: 'active' },
  { seedId: 39, sku: 'STA-5007', name: 'Manila Folder A4 100pk',         description: 'Buff, pre-punched.',                                   categorySeedId: 5, supplierSeedId: 5, unit: 'box',    unitPrice: 26.90,  quantityInStock: 48,  minStockLevel: 20, status: 'active' },
  { seedId: 40, sku: 'STA-5008', name: 'Paper Clips 33mm 1000pk',        description: 'Nickel plated, boxed.',                                categorySeedId: 5, supplierSeedId: 5, unit: 'box',    unitPrice: 2.40,   quantityInStock: 88,  minStockLevel: 30, status: 'active' },
];

// ---------------------------------------------------------------------------
// Purchase orders — every status in §5.2 is represented.
// PO-00046 is approved and belongs to Harbourline Beverages, whose contact
// Dana Whitfield is an active supplier user: that is the order step 4 of the
// demo script ships.
// ---------------------------------------------------------------------------

export const purchaseOrders: SeedPurchaseOrder[] = [
  {
    seedId: 1, poNumber: 'PO-00034', supplierSeedId: 5, status: 'cancelled',
    orderDayOffset: -53, expectedDayOffset: -41, notes: 'Cancelled — replaced by a consolidated order.',
    createdBySeedId: 3,
    lines: [{ productSeedId: 15, quantity: 8, receivedQuantity: 0, unitPrice: 6.80 }],
  },
  {
    seedId: 2, poNumber: 'PO-00035', supplierSeedId: 1, status: 'received',
    orderDayOffset: -46, expectedDayOffset: -41, shippedDayOffset: -43, receivedDayOffset: -41,
    notes: 'Standard monthly replenishment.', createdBySeedId: 2,
    lines: [
      { productSeedId: 1, quantity: 40, receivedQuantity: 40, unitPrice: 18.50 },
      { productSeedId: 2, quantity: 20, receivedQuantity: 20, unitPrice: 24.00 },
      { productSeedId: 3, quantity: 5,  receivedQuantity: 5,  unitPrice: 12.75 },
    ],
  },
  {
    seedId: 3, poNumber: 'PO-00036', supplierSeedId: 3, status: 'received',
    orderDayOffset: -35, expectedDayOffset: -25, receivedDayOffset: -8,
    notes: '', createdBySeedId: 3,
    lines: [
      { productSeedId: 8,  quantity: 12, receivedQuantity: 12, unitPrice: 46.00 },
      { productSeedId: 9,  quantity: 15, receivedQuantity: 15, unitPrice: 21.40 },
      { productSeedId: 10, quantity: 8,  receivedQuantity: 8,  unitPrice: 88.00 },
    ],
  },
  {
    seedId: 4, poNumber: 'PO-00037', supplierSeedId: 5, status: 'rejected',
    orderDayOffset: -28, expectedDayOffset: -16, notes: '', createdBySeedId: 2,
    rejectionReason: 'Quantities exceed the quarterly stationery budget. Resubmit with 10 boxes of A4.',
    lines: [
      { productSeedId: 14, quantity: 24, receivedQuantity: 0, unitPrice: 42.00 },
      { productSeedId: 15, quantity: 12, receivedQuantity: 0, unitPrice: 6.80 },
    ],
  },
  {
    seedId: 5, poNumber: 'PO-00038', supplierSeedId: 2, status: 'received',
    orderDayOffset: -24, expectedDayOffset: -17, receivedDayOffset: -3,
    notes: '', createdBySeedId: 2,
    lines: [
      { productSeedId: 5, quantity: 24, receivedQuantity: 24, unitPrice: 32.00 },
      { productSeedId: 6, quantity: 18, receivedQuantity: 18, unitPrice: 14.20 },
      { productSeedId: 7, quantity: 3,  receivedQuantity: 3,  unitPrice: 9.60 },
    ],
  },
  {
    seedId: 6, poNumber: 'PO-00039', supplierSeedId: 4, status: 'partially_received',
    orderDayOffset: -14, expectedDayOffset: -10, shippedDayOffset: -12,
    notes: 'Split delivery agreed with Tobias.', createdBySeedId: 3,
    lines: [
      { productSeedId: 11, quantity: 50, receivedQuantity: 40, unitPrice: 27.90 },
      { productSeedId: 12, quantity: 24, receivedQuantity: 0,  unitPrice: 15.75 },
      { productSeedId: 13, quantity: 10, receivedQuantity: 10, unitPrice: 34.50 },
    ],
  },
  {
    seedId: 7, poNumber: 'PO-00040', supplierSeedId: 1, status: 'shipped',
    orderDayOffset: -7, expectedDayOffset: -2, shippedDayOffset: -4,
    notes: '', createdBySeedId: 2,
    lines: [
      { productSeedId: 4, quantity: 20, receivedQuantity: 0, unitPrice: 28.00 },
      { productSeedId: 1, quantity: 12, receivedQuantity: 0, unitPrice: 18.50 },
      { productSeedId: 3, quantity: 5,  receivedQuantity: 0, unitPrice: 12.75 },
    ],
  },
  {
    seedId: 8, poNumber: 'PO-00041', supplierSeedId: 3, status: 'approved',
    orderDayOffset: -5, expectedDayOffset: 5,
    notes: 'Urgent — degreaser below minimum.', createdBySeedId: 3,
    lines: [
      { productSeedId: 8,  quantity: 15, receivedQuantity: 0, unitPrice: 46.00 },
      { productSeedId: 10, quantity: 5,  receivedQuantity: 0, unitPrice: 88.00 },
    ],
  },
  {
    seedId: 9, poNumber: 'PO-00042', supplierSeedId: 5, status: 'pending_approval',
    orderDayOffset: -2, expectedDayOffset: 10,
    notes: 'Raised from a low stock alert.', createdBySeedId: 2,
    lines: [
      { productSeedId: 14, quantity: 20, receivedQuantity: 0, unitPrice: 42.00 },
      { productSeedId: 15, quantity: 18, receivedQuantity: 0, unitPrice: 6.80 },
      // A deactivated product on an existing order — BR10: inactive products
      // vanish from pickers but stay visible in history.
      { productSeedId: 16, quantity: 14, receivedQuantity: 0, unitPrice: 4.95 },
    ],
  },
  {
    seedId: 10, poNumber: 'PO-00043', supplierSeedId: 2, status: 'pending_approval',
    orderDayOffset: -1, expectedDayOffset: 6, notes: '', createdBySeedId: 3,
    lines: [
      { productSeedId: 6, quantity: 30, receivedQuantity: 0, unitPrice: 14.20 },
      { productSeedId: 7, quantity: 42, receivedQuantity: 0, unitPrice: 9.60 },
    ],
  },
  {
    seedId: 11, poNumber: 'PO-00044', supplierSeedId: 4, status: 'draft',
    orderDayOffset: 0, expectedDayOffset: 4, notes: '', createdBySeedId: 2,
    lines: [{ productSeedId: 12, quantity: 26, receivedQuantity: 0, unitPrice: 15.75 }],
  },
  {
    seedId: 12, poNumber: 'PO-00045', supplierSeedId: 1, status: 'draft',
    orderDayOffset: 0, expectedDayOffset: 5, notes: '', createdBySeedId: 2,
    lines: [],
  },
  {
    seedId: 13, poNumber: 'PO-00046', supplierSeedId: 1, status: 'approved',
    orderDayOffset: -2, expectedDayOffset: 3,
    notes: 'Approved — awaiting despatch from Harbourline.', createdBySeedId: 2,
    lines: [
      { productSeedId: 2, quantity: 30, receivedQuantity: 0, unitPrice: 24.00 },
      { productSeedId: 3, quantity: 6,  receivedQuantity: 0, unitPrice: 12.75 },
      { productSeedId: 1, quantity: 6,  receivedQuantity: 0, unitPrice: 18.50 },
    ],
  },
];

/** The manager who signs off every approved-or-later order (never the raiser). */
export const APPROVER_SEED_ID = 4;

/** Highest PO number in the seed — the sequence resumes from here. */
export const HIGHEST_PO_SEQUENCE = 46;

// ---------------------------------------------------------------------------
// Tail movements — the twelve most recent ledger rows, taken from the
// prototype. Each one is the newest movement for its product, and its
// balance_after equals that product's final quantity_in_stock. The seed
// generates the earlier history backwards from these.
// ---------------------------------------------------------------------------

export const tailMovements: SeedTailMovement[] = [
  { productSeedId: 4,  type: 'OUT', reason: 'sale_dispatch',    quantityChange: -6,  reference: 'SO-2291', note: null,                                        userSeedId: 2, dayOffset: -1,  minutesIntoDay: 860 },
  { productSeedId: 11, type: 'IN',  reason: 'po_receipt',       quantityChange: 40,  reference: 'PO-00039', note: 'First of two split deliveries.',           userSeedId: 3, dayOffset: -1,  minutesIntoDay: 545 },
  { productSeedId: 8,  type: 'OUT', reason: 'damaged',          quantityChange: -2,  reference: null,       note: 'Two drums split in transit from the dock.', userSeedId: 2, dayOffset: -2,  minutesIntoDay: 1002 },
  { productSeedId: 14, type: 'OUT', reason: 'internal_use',     quantityChange: -4,  reference: 'REQ-118',  note: null,                                        userSeedId: 3, dayOffset: -2,  minutesIntoDay: 675 },
  { productSeedId: 5,  type: 'IN',  reason: 'po_receipt',       quantityChange: 24,  reference: 'PO-00038', note: null,                                        userSeedId: 2, dayOffset: -3,  minutesIntoDay: 830 },
  { productSeedId: 3,  type: 'OUT', reason: 'sale_dispatch',    quantityChange: -12, reference: 'SO-2284',  note: null,                                        userSeedId: 2, dayOffset: -4,  minutesIntoDay: 602 },
  { productSeedId: 12, type: 'OUT', reason: 'expired',          quantityChange: -3,  reference: null,       note: 'Wrap perished past its shelf life.',        userSeedId: 3, dayOffset: -5,  minutesIntoDay: 931 },
  { productSeedId: 2,  type: 'IN',  reason: 'customer_return',  quantityChange: 6,   reference: 'RET-0042', note: null,                                        userSeedId: 2, dayOffset: -6,  minutesIntoDay: 584 },
  { productSeedId: 6,  type: 'OUT', reason: 'count_correction', quantityChange: -2,  reference: 'CNT-07',   note: 'Cycle count found two sacks short.',        userSeedId: 3, dayOffset: -7,  minutesIntoDay: 1028 },
  { productSeedId: 9,  type: 'IN',  reason: 'po_receipt',       quantityChange: 15,  reference: 'PO-00036', note: null,                                        userSeedId: 2, dayOffset: -8,  minutesIntoDay: 746 },
  { productSeedId: 1,  type: 'OUT', reason: 'sale_dispatch',    quantityChange: -18, reference: 'SO-2270',  note: null,                                        userSeedId: 2, dayOffset: -10, minutesIntoDay: 539 },
  { productSeedId: 15, type: 'IN',  reason: 'opening_balance',  quantityChange: 96,  reference: null,       note: 'Stocktake baseline for the new line.',      userSeedId: 3, dayOffset: -13, minutesIntoDay: 600 },
];

// ---------------------------------------------------------------------------
// Settings — §3.2 defaults
// ---------------------------------------------------------------------------

export const settings: Array<[string, string]> = [
  ['company_name', 'SmartStock Distribution'],
  ['currency_symbol', '$'],
  ['default_min_stock_level', '10'],
  ['po_number_prefix', 'PO-'],
  ['low_stock_banner_enabled', 'true'],
];
