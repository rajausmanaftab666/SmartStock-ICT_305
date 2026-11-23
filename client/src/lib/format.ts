/**
 * Display formatting. Money always goes through here so the currency symbol
 * from settings is honoured in one place rather than hard-coded per screen.
 */

export function formatMoney(value: number | null | undefined, symbol = '$'): string {
  const amount = Number(value ?? 0);
  return `${symbol}${amount.toLocaleString('en-AU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatNumber(value: number | null | undefined): string {
  return Number(value ?? 0).toLocaleString('en-AU');
}

/** A stored 'YYYY-MM-DD' date, shown as '3 Aug 2026'. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return value;
  return new Date(year, month - 1, day).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** A timestamp, shown as '3 Aug 2026, 2:20 pm'. */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
