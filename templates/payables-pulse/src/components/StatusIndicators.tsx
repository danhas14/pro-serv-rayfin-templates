import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  CircleDot,
  Clock,
  Hourglass,
  Minus,
  PauseCircle,
  RotateCcw,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import type { ComponentType } from 'react';

import {
  EXCEPTION_STATUS_LABELS,
  PRIORITY_LABELS,
  RISK_LEVEL_LABELS,
  SLA_RISK_LABELS,
  type ExceptionPriority,
  type ExceptionStatus,
  type RiskLevel,
  type SlaRisk,
} from '@/domain/enums';
import { cn } from '@/lib/utils';

/**
 * Status is always communicated with a shape and a word, never colour alone,
 * so the queue stays readable for colour-vision-deficient operators.
 */
function Pill({
  icon: Icon,
  label,
  className,
  title,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        className
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {label}
    </span>
  );
}

const PRIORITY_STYLE: Record<
  ExceptionPriority,
  { icon: ComponentType<{ className?: string }>; className: string }
> = {
  critical: {
    icon: AlertOctagon,
    className: 'border-red-300 bg-red-50 text-red-800',
  },
  high: {
    icon: AlertTriangle,
    className: 'border-amber-300 bg-amber-50 text-amber-900',
  },
  medium: {
    icon: CircleDot,
    className: 'border-sky-300 bg-sky-50 text-sky-900',
  },
  low: { icon: Minus, className: 'border-slate-300 bg-slate-50 text-slate-700' },
};

export function PriorityBadge({ priority }: { priority: ExceptionPriority }) {
  const style = PRIORITY_STYLE[priority];
  return (
    <Pill
      icon={style.icon}
      label={PRIORITY_LABELS[priority]}
      className={style.className}
      title={`Priority: ${PRIORITY_LABELS[priority]}`}
    />
  );
}

const STATUS_STYLE: Record<
  ExceptionStatus,
  { icon: ComponentType<{ className?: string }>; className: string }
> = {
  new: { icon: CircleDot, className: 'border-slate-300 bg-slate-50 text-slate-800' },
  investigating: {
    icon: Hourglass,
    className: 'border-blue-300 bg-blue-50 text-blue-900',
  },
  'waiting-customer': {
    icon: PauseCircle,
    className: 'border-violet-300 bg-violet-50 text-violet-900',
  },
  'waiting-vendor': {
    icon: PauseCircle,
    className: 'border-fuchsia-300 bg-fuchsia-50 text-fuchsia-900',
  },
  'ready-to-retry': {
    icon: RotateCcw,
    className: 'border-teal-300 bg-teal-50 text-teal-900',
  },
  resolved: {
    icon: CheckCircle2,
    className: 'border-emerald-300 bg-emerald-50 text-emerald-900',
  },
  closed: {
    icon: ShieldCheck,
    className: 'border-slate-300 bg-slate-100 text-slate-700',
  },
};

export function StatusBadge({ status }: { status: ExceptionStatus }) {
  const style = STATUS_STYLE[status];
  return (
    <Pill
      icon={style.icon}
      label={EXCEPTION_STATUS_LABELS[status]}
      className={style.className}
      title={`Status: ${EXCEPTION_STATUS_LABELS[status]}`}
    />
  );
}

const SLA_STYLE: Record<
  SlaRisk,
  { icon: ComponentType<{ className?: string }>; className: string }
> = {
  'on-track': {
    icon: CheckCircle2,
    className: 'border-emerald-300 bg-emerald-50 text-emerald-900',
  },
  'at-risk': {
    icon: Clock,
    className: 'border-amber-300 bg-amber-50 text-amber-900',
  },
  breached: { icon: XCircle, className: 'border-red-300 bg-red-50 text-red-800' },
};

export function SlaBadge({ risk }: { risk: SlaRisk }) {
  const style = SLA_STYLE[risk];
  return (
    <Pill
      icon={style.icon}
      label={SLA_RISK_LABELS[risk]}
      className={style.className}
      title={`Service level: ${SLA_RISK_LABELS[risk]}`}
    />
  );
}

const RISK_STYLE: Record<
  RiskLevel,
  { icon: ComponentType<{ className?: string }>; className: string }
> = {
  low: {
    icon: CheckCircle2,
    className: 'border-emerald-300 bg-emerald-50 text-emerald-900',
  },
  medium: {
    icon: AlertTriangle,
    className: 'border-amber-300 bg-amber-50 text-amber-900',
  },
  high: {
    icon: AlertOctagon,
    className: 'border-red-300 bg-red-50 text-red-800',
  },
};

export function RiskBadge({ level }: { level: RiskLevel }) {
  const style = RISK_STYLE[level];
  return (
    <Pill
      icon={style.icon}
      label={RISK_LEVEL_LABELS[level]}
      className={style.className}
      title={`Payment health: ${RISK_LEVEL_LABELS[level]}`}
    />
  );
}
