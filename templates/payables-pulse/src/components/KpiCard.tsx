import { Info } from 'lucide-react';
import type { ReactNode } from 'react';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export function MetricInfo({ text }: { text: string }) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={`What this measures: ${text}`}
            className="inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground transition hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <Info className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs leading-relaxed">
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export interface KpiCardProps {
  label: string;
  value: string;
  hint?: string;
  tooltip: string;
  tone?: 'default' | 'warning' | 'critical' | 'positive';
  icon?: ReactNode;
  onClick?: () => void;
  active?: boolean;
}

const TONE_CLASS: Record<NonNullable<KpiCardProps['tone']>, string> = {
  default: 'border-border',
  positive: 'border-emerald-200',
  warning: 'border-amber-300',
  critical: 'border-red-300',
};

const TONE_VALUE_CLASS: Record<NonNullable<KpiCardProps['tone']>, string> = {
  default: 'text-foreground',
  positive: 'text-emerald-700',
  warning: 'text-amber-700',
  critical: 'text-red-700',
};

export function KpiCard({
  label,
  value,
  hint,
  tooltip,
  tone = 'default',
  icon,
  onClick,
  active,
}: KpiCardProps) {
  const interactive = !!onClick;
  const Element = interactive ? 'button' : 'div';

  return (
    <Element
      {...(interactive
        ? { type: 'button' as const, onClick, 'aria-pressed': !!active }
        : {})}
      className={cn(
        'flex w-full flex-col gap-1 rounded-lg border bg-card p-4 text-left shadow-xs transition',
        TONE_CLASS[tone],
        interactive &&
          'hover:border-primary/50 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none cursor-pointer',
        active && 'border-primary ring-2 ring-primary/20'
      )}
    >
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {icon ? (
          <span className="text-muted-foreground" aria-hidden="true">
            {icon}
          </span>
        ) : null}
        <span>{label}</span>
        <MetricInfo text={tooltip} />
      </div>
      <div
        className={cn(
          'text-2xl font-semibold tabular-nums tracking-tight',
          TONE_VALUE_CLASS[tone]
        )}
      >
        {value}
      </div>
      {hint ? (
        <div className="text-xs text-muted-foreground">{hint}</div>
      ) : null}
    </Element>
  );
}
