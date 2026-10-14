import type { ReactNode } from 'react';

import { cx } from '@/lib/format';

export function Panel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={cx('ops-panel', className)}>{children}</section>;
}

export function PanelHeader({
  title,
  subtitle,
  icon,
  actions,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex items-start justify-between gap-4 border-b border-ink-700/70 px-5 py-4">
      <div className="flex min-w-0 items-start gap-3">
        {icon && (
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border border-fabric-500/30 bg-fabric-500/10 text-fabric-300">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold tracking-wide text-haze-100">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-0.5 text-xs text-haze-400">{subtitle}</p>
          )}
        </div>
      </div>
      {actions}
    </header>
  );
}

export function Badge({
  children,
  className,
  dotColor,
}: {
  children: ReactNode;
  className?: string;
  dotColor?: string;
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium whitespace-nowrap',
        className ?? 'border-ink-600 bg-ink-800 text-haze-300'
      )}
    >
      {dotColor && (
        <span
          className="size-1.5 rounded-full"
          style={{ backgroundColor: dotColor }}
        />
      )}
      {children}
    </span>
  );
}
