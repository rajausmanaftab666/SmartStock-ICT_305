import type { PoStatus } from '@shared';
import { PO_STATUS_LABEL } from '@shared';
import { conflict } from '../../types/errors';

/**
 * BR4 — the purchase order state machine from §5.2, in one place.
 *
 * Every status change in the service goes through assertTransition, so an
 * illegal move (draft straight to shipped, reviving a cancelled order, and so
 * on) is a 409 rather than a silently corrupted record. Terminal states have
 * an empty list and nothing can leave them.
 */
export const PO_TRANSITIONS: Record<PoStatus, PoStatus[]> = {
  draft: ['pending_approval', 'cancelled'],
  pending_approval: ['approved', 'rejected', 'cancelled'],
  // Receiving can complete an order in one go, or leave it partial.
  approved: ['shipped', 'partially_received', 'received'],
  shipped: ['partially_received', 'received'],
  // A further partial receipt keeps it in the same state.
  partially_received: ['partially_received', 'received'],
  rejected: [],
  received: [],
  cancelled: [],
};

/** Statuses that can still be received against (BR17). */
export const RECEIVABLE_STATUSES: PoStatus[] = ['approved', 'shipped', 'partially_received'];

/** Statuses whose header and lines are still editable (BR5). */
export const EDITABLE_STATUSES: PoStatus[] = ['draft'];

export function canTransition(from: PoStatus, to: PoStatus): boolean {
  return PO_TRANSITIONS[from].includes(to);
}

export function assertTransition(from: PoStatus, to: PoStatus, poNumber: string): void {
  if (canTransition(from, to)) return;

  const allowed = PO_TRANSITIONS[from];
  const detail =
    allowed.length === 0
      ? `${PO_STATUS_LABEL[from]} is final — nothing can change after it.`
      : `From ${PO_STATUS_LABEL[from].toLowerCase()} it can only become ${allowed
          .map((status) => PO_STATUS_LABEL[status].toLowerCase())
          .join(' or ')}.`;

  throw conflict(
    `${poNumber} cannot go from ${PO_STATUS_LABEL[from].toLowerCase()} to ${PO_STATUS_LABEL[
      to
    ].toLowerCase()}. ${detail}`
  );
}
