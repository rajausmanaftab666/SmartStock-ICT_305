import { useNavigate } from 'react-router-dom';

interface StatCardProps {
  label: string;
  value: string | number;
  note: string;
  /** Where clicking goes — a stat card always navigates to the list it counts. */
  to: string;
  tone?: 'default' | 'danger' | 'warning' | 'primary';
}

const TONE_COLOUR = {
  default: 'var(--text)',
  danger: 'var(--danger-fg)',
  warning: 'var(--warning-fg)',
  primary: 'var(--primary)',
} as const;

export function StatCard({ label, value, note, to, tone = 'default' }: StatCardProps) {
  const navigate = useNavigate();
  return (
    <button type="button" className="stat-card" onClick={() => navigate(to)}>
      <span className="stat-card__label">{label}</span>
      <span className="stat-card__value" style={{ color: TONE_COLOUR[tone] }}>
        {value}
      </span>
      <span className="stat-card__note">{note}</span>
    </button>
  );
}
