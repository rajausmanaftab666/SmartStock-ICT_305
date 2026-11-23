import type { PurchaseOrder } from '@shared';
import { formatDateTime } from '../lib/format';

export interface TimelineStep {
  label: string;
  meta: string;
  reached: boolean;
  /** Rejection is drawn in danger colours rather than as a reached step. */
  rejected?: boolean;
}

/**
 * Builds the S17/S22 timeline from an order's stamps. Reached steps are drawn
 * in primary, future steps in border grey, and a rejection replaces the
 * approval step in danger red.
 */
export function buildTimeline(order: PurchaseOrder): TimelineStep[] {
  const progress = ['draft', 'pending_approval', 'approved', 'shipped', 'partially_received', 'received'];
  const reached = (status: string) => progress.indexOf(order.status) >= progress.indexOf(status);

  const steps: TimelineStep[] = [
    {
      label: 'Created',
      meta: `${order.created_by_name} · ${formatDateTime(order.created_at)}`,
      reached: true,
    },
    {
      label: 'Submitted for approval',
      meta: order.submitted_at
        ? `${order.created_by_name} · ${formatDateTime(order.submitted_at)}`
        : 'Not yet submitted',
      reached: Boolean(order.submitted_at),
    },
  ];

  if (order.status === 'rejected') {
    steps.push({
      label: 'Rejected',
      meta: `${order.approved_by_name ?? 'A manager'} · ${formatDateTime(order.approved_at)}`,
      reached: true,
      rejected: true,
    });
  } else {
    steps.push({
      label: 'Approved',
      meta: order.approved_at
        ? `${order.approved_by_name} · ${formatDateTime(order.approved_at)}`
        : 'Awaiting a manager — never the person who raised it (BR8)',
      reached: reached('approved'),
    });
  }

  if (order.status === 'cancelled') {
    steps.push({ label: 'Cancelled', meta: 'This order was cancelled and is final.', reached: true, rejected: true });
    return steps;
  }

  steps.push(
    {
      label: 'Shipped by supplier',
      meta: order.shipped_at
        ? `${order.supplier_contact ?? order.supplier_name} · ${formatDateTime(order.shipped_at)}`
        : 'The supplier marks this',
      reached: Boolean(order.shipped_at),
    },
    {
      label: 'Received into stock',
      meta:
        order.status === 'received'
          ? `Full receipt · ${formatDateTime(order.received_at)}`
          : order.status === 'partially_received'
            ? `Partial receipt · ${order.units_received} of ${order.units_ordered} units in`
            : 'Not received',
      reached: order.status === 'received' || order.status === 'partially_received',
    }
  );

  return steps;
}

export function StatusTimeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <div className="card card--pad stack" style={{ gap: 'var(--s-4)' }}>
      <span className="card-title">Status timeline</span>
      <div className="timeline">
        {steps.map((step, index) => (
          <div className="timeline__step" key={step.label}>
            <div className="timeline__rail">
              <span
                className={`timeline__dot${step.rejected ? ' timeline__dot--rejected' : step.reached ? ' timeline__dot--reached' : ''}`}
              />
              {index < steps.length - 1 && (
                <span
                  className={`timeline__line${step.reached && !step.rejected ? ' timeline__line--reached' : ''}`}
                />
              )}
            </div>
            <div className="timeline__body">
              <span
                className={`timeline__label${step.rejected ? ' danger-text' : step.reached ? '' : ' subtle'}`}
              >
                {step.label}
              </span>
              <span className="timeline__meta">{step.meta}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
