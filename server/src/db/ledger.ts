import {
  products,
  purchaseOrders,
  tailMovements,
  type SeedProduct,
  type SeedTailMovement,
} from './seed-data';

/**
 * Builds the demo stock ledger.
 *
 * Rather than inventing movements and hoping the arithmetic works out, the
 * builder works backwards from each product's final balance: purchase order
 * receipts and manual movements are placed on a timeline, then an opening
 * balance is derived so the running total lands exactly on the product's
 * quantity_in_stock. Where the derived opening would be negative — a product
 * that received more than it currently holds — the opening is lifted and a
 * matching dispatch is appended, which shifts every intermediate balance up
 * without moving the closing balance.
 *
 * The result satisfies BR2 (balance_after is the running total) and BR3 (no
 * balance is ever negative) by construction, and seed.ts re-checks both
 * against the database before committing.
 *
 * Everything here is pure and works in day offsets, so it can be unit tested
 * without a database connection.
 */

const MIN_OPENING_BALANCE = 2;

/** A movement before its balance_after and database ids are known. */
export interface MovementDraft {
  productSeedId: number;
  type: 'IN' | 'OUT';
  reason: SeedTailMovement['reason'];
  quantityChange: number;
  reference: string | null;
  note: string | null;
  userSeedId: number;
  dayOffset: number;
  minutesIntoDay: number;
}

export interface LedgerRow extends MovementDraft {
  balanceAfter: number;
}

export interface Ledger {
  rows: LedgerRow[];
  /** Product seed id -> the day its opening balance was recorded. */
  openingDates: Map<number, number>;
}

/**
 * Manual movements that give products outside the purchase order flow some
 * history. Written by hand rather than generated randomly so that rebuilding
 * the database always produces the same screenshots.
 */
export const EXTRA_MOVEMENTS: MovementDraft[] = [
  { productSeedId: 17, type: 'OUT', reason: 'sale_dispatch',    quantityChange: -9, reference: 'SO-2201', note: null, userSeedId: 2, dayOffset: -34, minutesIntoDay: 555 },
  { productSeedId: 18, type: 'OUT', reason: 'sale_dispatch',    quantityChange: -6, reference: 'SO-2214', note: null, userSeedId: 3, dayOffset: -31, minutesIntoDay: 640 },
  { productSeedId: 19, type: 'OUT', reason: 'internal_use',     quantityChange: -4, reference: 'REQ-104', note: null, userSeedId: 2, dayOffset: -28, minutesIntoDay: 720 },
  { productSeedId: 21, type: 'OUT', reason: 'sale_dispatch',    quantityChange: -8, reference: 'SO-2229', note: null, userSeedId: 3, dayOffset: -26, minutesIntoDay: 495 },
  { productSeedId: 23, type: 'OUT', reason: 'sale_dispatch',    quantityChange: -7, reference: 'SO-2236', note: null, userSeedId: 2, dayOffset: -23, minutesIntoDay: 880 },
  { productSeedId: 24, type: 'OUT', reason: 'damaged',          quantityChange: -3, reference: null,      note: 'Two drums leaked on the pallet.',   userSeedId: 3, dayOffset: -21, minutesIntoDay: 610 },
  { productSeedId: 26, type: 'OUT', reason: 'sale_dispatch',    quantityChange: -5, reference: 'SO-2248', note: null, userSeedId: 2, dayOffset: -19, minutesIntoDay: 705 },
  { productSeedId: 28, type: 'OUT', reason: 'internal_use',     quantityChange: -6, reference: 'REQ-109', note: null, userSeedId: 3, dayOffset: -17, minutesIntoDay: 930 },
  { productSeedId: 29, type: 'IN',  reason: 'customer_return',  quantityChange: 4,  reference: 'RET-0038', note: null, userSeedId: 2, dayOffset: -15, minutesIntoDay: 520 },
  { productSeedId: 31, type: 'OUT', reason: 'sale_dispatch',    quantityChange: -7, reference: 'SO-2259', note: null, userSeedId: 3, dayOffset: -13, minutesIntoDay: 845 },
  { productSeedId: 32, type: 'OUT', reason: 'sale_dispatch',    quantityChange: -9, reference: 'SO-2263', note: null, userSeedId: 2, dayOffset: -11, minutesIntoDay: 575 },
  { productSeedId: 34, type: 'OUT', reason: 'internal_use',     quantityChange: -8, reference: 'REQ-112', note: null, userSeedId: 3, dayOffset: -9,  minutesIntoDay: 660 },
  { productSeedId: 37, type: 'OUT', reason: 'sale_dispatch',    quantityChange: -5, reference: 'SO-2276', note: null, userSeedId: 2, dayOffset: -7,  minutesIntoDay: 915 },
  { productSeedId: 39, type: 'OUT', reason: 'count_correction', quantityChange: -3, reference: 'CNT-06',  note: 'Cycle count adjustment, aisle 4.', userSeedId: 3, dayOffset: -5,  minutesIntoDay: 480 },
];

/** Purchase order receipts that are not already represented by a tail movement. */
export function buildReceiptDrafts(): MovementDraft[] {
  const coveredByTail = new Set(
    tailMovements
      .filter((m) => m.reason === 'po_receipt' && m.reference)
      .map((m) => `${m.reference}:${m.productSeedId}`)
  );

  const drafts: MovementDraft[] = [];

  for (const po of purchaseOrders) {
    const poHasTailReceipt = po.lines.some((l) =>
      coveredByTail.has(`${po.poNumber}:${l.productSeedId}`)
    );
    // When one line of an order was received late (its receipt is a tail
    // movement), the remaining lines landed on the expected date — a split
    // delivery. Otherwise the whole order landed together.
    const dayOffset = poHasTailReceipt
      ? po.expectedDayOffset
      : po.receivedDayOffset ?? po.expectedDayOffset;

    po.lines.forEach((line, index) => {
      if (line.receivedQuantity <= 0) return;
      if (coveredByTail.has(`${po.poNumber}:${line.productSeedId}`)) return;
      drafts.push({
        productSeedId: line.productSeedId,
        type: 'IN',
        reason: 'po_receipt',
        quantityChange: line.receivedQuantity,
        reference: po.poNumber,
        note: null,
        userSeedId: po.createdBySeedId,
        dayOffset,
        minutesIntoDay: 600 + index * 7,
      });
    });
  }

  return drafts;
}

/**
 * Produces the full ledger for one product, closing exactly on its stored
 * quantity_in_stock and never dipping below zero.
 */
export function buildProductLedger(
  product: SeedProduct,
  earlier: MovementDraft[],
  tail: MovementDraft | null,
  openingDayOffset: number
): LedgerRow[] {
  const sorted = [...earlier].sort(
    (a, b) => a.dayOffset - b.dayOffset || a.minutesIntoDay - b.minutesIntoDay
  );

  // If the prototype already gives this product an opening balance, its whole
  // history is that single row.
  if (tail?.reason === 'opening_balance') {
    if (sorted.length > 0) {
      throw new Error(
        `${product.sku} has an opening_balance tail movement but also earlier movements.`
      );
    }
    return [{ ...tail, balanceAfter: product.quantityInStock }];
  }

  const tailDelta = tail?.quantityChange ?? 0;
  const preTarget = product.quantityInStock - tailDelta;

  let opening = preTarget - sorted.reduce((sum, m) => sum + m.quantityChange, 0);

  // Walk the chain to find the lowest point it reaches.
  let running = opening;
  let lowest = opening;
  for (const m of sorted) {
    running += m.quantityChange;
    lowest = Math.min(lowest, running);
  }

  const need = MIN_OPENING_BALANCE - Math.min(opening, lowest);
  if (need > 0) {
    opening += need;
    const lastEarlier = sorted[sorted.length - 1];
    const from = lastEarlier ? lastEarlier.dayOffset : openingDayOffset;
    const to = tail ? tail.dayOffset : -1;
    sorted.push({
      productSeedId: product.seedId,
      type: 'OUT',
      reason: 'sale_dispatch',
      quantityChange: -need,
      reference: `SO-${2300 + product.seedId}`,
      note: null,
      userSeedId: product.seedId % 2 === 0 ? 3 : 2,
      dayOffset: Math.round((from + to) / 2),
      minutesIntoDay: 780,
    });
  }

  const chain: MovementDraft[] = [
    {
      productSeedId: product.seedId,
      type: 'IN',
      reason: 'opening_balance',
      quantityChange: opening,
      reference: null,
      note: null,
      userSeedId: 2,
      dayOffset: openingDayOffset,
      minutesIntoDay: 540,
    },
    ...sorted,
    ...(tail ? [tail] : []),
  ];

  let balance = 0;
  return chain.map((m) => {
    balance += m.quantityChange;
    return { ...m, balanceAfter: balance };
  });
}

export function buildLedger(): Ledger {
  const drafts = [...buildReceiptDrafts(), ...EXTRA_MOVEMENTS];
  const byProduct = new Map<number, MovementDraft[]>();
  for (const draft of drafts) {
    const list = byProduct.get(draft.productSeedId) ?? [];
    list.push(draft);
    byProduct.set(draft.productSeedId, list);
  }

  const tailByProduct = new Map<number, MovementDraft>(
    tailMovements.map((m) => [m.productSeedId, { ...m }])
  );

  const rows: LedgerRow[] = [];
  const openingDates = new Map<number, number>();

  for (const product of products) {
    // Stagger creation across the first week of the 60-day window.
    const openingDayOffset = -60 + (product.seedId % 8);
    openingDates.set(product.seedId, openingDayOffset);
    rows.push(
      ...buildProductLedger(
        product,
        byProduct.get(product.seedId) ?? [],
        tailByProduct.get(product.seedId) ?? null,
        openingDayOffset
      )
    );
  }

  rows.sort((a, b) => a.dayOffset - b.dayOffset || a.minutesIntoDay - b.minutesIntoDay);
  return { rows, openingDates };
}
