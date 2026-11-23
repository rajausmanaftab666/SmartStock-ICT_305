import { toneFor } from './statusTone';

interface BadgeProps {
  /** A purchase order status, entity status, role, or "low". */
  tone: string;
  /** Overrides the tone's own label. */
  children?: React.ReactNode;
}

export function Badge({ tone, children }: BadgeProps) {
  const { bg, fg, label } = toneFor(tone);
  return (
    <span className="badge" style={{ background: bg, color: fg }}>
      {children ?? label}
    </span>
  );
}
