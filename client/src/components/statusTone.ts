import {
  ENTITY_STATUS_LABEL,
  PO_STATUS_LABEL,
  ROLE_LABEL,
  type EntityStatus,
  type PoStatus,
  type Role,
} from '@shared';

/**
 * Single source of truth for status colour. Every badge in the application
 * reads its background and foreground from here, so a status can never be
 * shown in two different colours on two different screens.
 */
export interface Tone {
  bg: string;
  fg: string;
  label: string;
}

type ToneKey = PoStatus | EntityStatus | Role | 'low';

const DIVIDER = 'var(--divider)';

export const TONES: Record<ToneKey, Tone> = {
  // purchase order statuses
  draft: { bg: DIVIDER, fg: 'var(--text-2)', label: PO_STATUS_LABEL.draft },
  cancelled: { bg: DIVIDER, fg: 'var(--muted)', label: PO_STATUS_LABEL.cancelled },
  pending_approval: {
    bg: 'var(--warning-bg)',
    fg: 'var(--warning-fg)',
    label: PO_STATUS_LABEL.pending_approval,
  },
  partially_received: {
    bg: 'var(--warning-bg)',
    fg: 'var(--warning-fg)',
    label: PO_STATUS_LABEL.partially_received,
  },
  approved: { bg: 'var(--info-bg)', fg: 'var(--info-fg)', label: PO_STATUS_LABEL.approved },
  shipped: { bg: 'var(--violet-bg)', fg: 'var(--violet-fg)', label: PO_STATUS_LABEL.shipped },
  received: { bg: 'var(--success-bg)', fg: 'var(--success-fg)', label: PO_STATUS_LABEL.received },
  rejected: { bg: 'var(--danger-bg)', fg: 'var(--danger-fg)', label: PO_STATUS_LABEL.rejected },

  // entity statuses
  active: { bg: 'var(--success-bg)', fg: 'var(--success-fg)', label: ENTITY_STATUS_LABEL.active },
  inactive: { bg: DIVIDER, fg: 'var(--muted)', label: ENTITY_STATUS_LABEL.inactive },

  // roles
  admin: { bg: 'var(--violet-bg)', fg: 'var(--violet-fg)', label: ROLE_LABEL.admin },
  staff: { bg: 'var(--info-bg)', fg: 'var(--info-fg)', label: ROLE_LABEL.staff },
  manager: { bg: 'var(--success-bg)', fg: 'var(--success-fg)', label: ROLE_LABEL.manager },
  supplier: { bg: 'var(--warning-bg)', fg: 'var(--warning-fg)', label: ROLE_LABEL.supplier },

  // derived
  low: { bg: 'var(--danger-bg)', fg: 'var(--danger-fg)', label: 'Low' },
};

export function toneFor(key: string): Tone {
  return TONES[key as ToneKey] ?? TONES.draft;
}

/** Chart palette (§2). Ordered so adjacent series stay distinguishable. */
export const CHART_COLOURS = {
  primary: '#0C5CAB',
  warning: '#f59e0b',
  success: '#10b981',
  danger: '#ef4444',
  violet: '#7f56d9',
  orange: '#f97316',
  grey: '#98a2b3',
} as const;

/** Colour per purchase order status, for the dashboard donut. */
export const PO_STATUS_COLOUR: Record<PoStatus, string> = {
  draft: CHART_COLOURS.grey,
  pending_approval: CHART_COLOURS.warning,
  approved: CHART_COLOURS.primary,
  shipped: CHART_COLOURS.violet,
  partially_received: CHART_COLOURS.orange,
  received: CHART_COLOURS.success,
  rejected: CHART_COLOURS.danger,
  cancelled: '#d0d5dd',
};
