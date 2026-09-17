const CURRENCY_FRACTION: Record<string, number> = { JPY: 0, KRW: 0 };

export function formatCurrency(
  value: number | null | undefined,
  currency = 'USD',
  options: { compact?: boolean; decimals?: boolean } = {}
): string {
  const amount = Number(value ?? 0);
  const fraction = CURRENCY_FRACTION[currency] ?? 2;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    notation: options.compact ? 'compact' : 'standard',
    maximumFractionDigits: options.decimals === false ? 0 : fraction,
    minimumFractionDigits: options.decimals === false ? 0 : fraction,
  }).format(amount);
}

export function formatCompactCurrency(
  value: number | null | undefined,
  currency = 'USD'
): string {
  const amount = Number(value ?? 0);
  if (Math.abs(amount) < 10_000) {
    return formatCurrency(amount, currency, { decimals: false });
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(amount);
}

export function formatNumber(value: number | null | undefined): string {
  return new Intl.NumberFormat('en-US').format(Number(value ?? 0));
}

export function formatPercent(
  value: number | null | undefined,
  digits = 1
): string {
  return `${Number(value ?? 0).toFixed(digits)}%`;
}

export function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDate(value: Date | string | null | undefined): string {
  const d = toDate(value);
  if (!d) return '—';
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(value: Date | string | null | undefined): string {
  const d = toDate(value);
  if (!d) return '—';
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function hoursBetween(
  from: Date | string | null | undefined,
  to: Date | string | null | undefined = new Date()
): number {
  const a = toDate(from);
  const b = toDate(to);
  if (!a || !b) return 0;
  return (b.getTime() - a.getTime()) / 36e5;
}

/** "3d 4h" / "5h 12m" / "18m" — compact elapsed-time rendering. */
export function formatDuration(hours: number): string {
  const total = Math.max(0, hours);
  if (total < 1) return `${Math.round(total * 60)}m`;
  if (total < 24) {
    const h = Math.floor(total);
    const m = Math.round((total - h) * 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  const d = Math.floor(total / 24);
  const h = Math.round(total - d * 24);
  return h > 0 ? `${d}d ${h}h` : `${d}d`;
}

export function relativeTime(value: Date | string | null | undefined): string {
  const d = toDate(value);
  if (!d) return '—';
  const diffMs = Date.now() - d.getTime();
  const past = diffMs >= 0;
  const suffix = past ? 'ago' : 'from now';
  return `${formatDuration(Math.abs(diffMs) / 36e5)} ${suffix}`;
}

export function dateKey(value: Date | string): string {
  const d = toDate(value) ?? new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

export function startOfDay(value: Date): Date {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(value: Date, days: number): Date {
  const d = new Date(value);
  d.setDate(d.getDate() + days);
  return d;
}

export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}
