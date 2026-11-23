import type { ReactNode } from 'react';

export interface PanelRow {
  label: string;
  value: ReactNode;
  tone?: 'default' | 'muted' | 'danger' | 'success';
}

interface PanelProps {
  title: string;
  badge?: { label: string; bg: string; fg: string };
  rows: PanelRow[];
  action?: { label: string; onClick: () => void };
  emptyText?: string;
}

const TONE_COLOUR = {
  default: 'var(--text)',
  muted: 'var(--muted)',
  danger: 'var(--danger-fg)',
  success: 'var(--success-fg)',
} as const;

/**
 * The key/value card used across product detail, purchase order detail and the
 * supplier form's read-only lists.
 */
export function Panel({ title, badge, rows, action, emptyText }: PanelProps) {
  return (
    <div className="panel">
      <div className="panel__head">
        <span className="card-title" style={{ flex: 1 }}>
          {title}
        </span>
        {badge && (
          <span className="badge" style={{ background: badge.bg, color: badge.fg }}>
            {badge.label}
          </span>
        )}
      </div>

      {rows.length === 0 ? (
        <span className="field__hint">{emptyText ?? 'Nothing to show.'}</span>
      ) : (
        <div className="panel__rows">
          {rows.map((row, index) => (
            <div className="panel__row" key={`${row.label}-${index}`}>
              <span className="panel__label">{row.label}</span>
              <span className="panel__value" style={{ color: TONE_COLOUR[row.tone ?? 'default'] }}>
                {row.value}
              </span>
            </div>
          ))}
        </div>
      )}

      {action && (
        <button type="button" className="btn btn--secondary btn--sm panel__action" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}

export function PanelGrid({ children }: { children: ReactNode }) {
  return <div className="panel-grid">{children}</div>;
}
