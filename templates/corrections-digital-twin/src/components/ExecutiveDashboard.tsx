import { useTwin } from '@/hooks/TwinContext';
import { cx, formatDelta, formatPercent } from '@/lib/format';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { heatColor } from '@/lib/status';

const SENTIMENT: Record<string, string> = {
  good: 'text-status-normal',
  warn: 'text-status-elevated',
  bad: 'text-status-critical',
};

function TrendArrow({ direction }: { direction: 'up' | 'down' }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={cx('size-3.5', direction === 'up' ? '' : 'rotate-180')}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M8 2.5 13 9h-3v4.5H6V9H3l5-6.5Z" />
    </svg>
  );
}

function formatValue(
  value: number,
  format: 'percent' | 'percent-abs' | 'score'
): string {
  if (format === 'score') return `${Math.round(value)}`;
  if (format === 'percent-abs') return formatPercent(value);
  return formatDelta(value);
}

export function ExecutiveDashboard() {
  const { executiveMetrics, risk } = useTwin();

  return (
    <Panel>
      <PanelHeader
        title="Executive Summary"
        subtitle="Period-over-period movement across the indicators reported to district command"
        icon={
          <svg viewBox="0 0 16 16" className="size-4" fill="currentColor">
            <path d="M2 13h12v1.4H2V13Zm1.4-3.4h2v2.6h-2V9.6Zm3.3-4h2v6.6h-2V5.6Zm3.3 2h2v4.6h-2V7.6ZM2 1.6h1.4v9.8H2V1.6Z" />
          </svg>
        }
        actions={
          <span className="rounded-full border border-ink-600 bg-ink-800 px-2.5 py-1 text-[11px] text-haze-300">
            Risk {risk.score}/100 · {risk.band}
          </span>
        }
      />

      <div className="grid gap-3 p-5 lg:grid-cols-5">
        {executiveMetrics.map((metric) => (
          <article
            key={metric.key}
            className="rounded-xl border border-ink-700/70 bg-ink-900/55 p-4"
          >
            <p className="text-[11px] font-medium uppercase tracking-wide text-haze-500">
              {metric.label}
            </p>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span
                className={cx(
                  'tabular text-2xl leading-none font-semibold',
                  SENTIMENT[metric.sentiment] ?? 'text-haze-100'
                )}
              >
                {formatValue(metric.value, metric.format)}
              </span>
              <span
                className={cx(
                  'flex items-center',
                  SENTIMENT[metric.sentiment] ?? 'text-haze-400'
                )}
              >
                <TrendArrow direction={metric.direction} />
              </span>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-haze-500">
              {metric.caption}
            </p>
          </article>
        ))}
      </div>

      <div className="border-t border-ink-700/70 px-5 py-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold tracking-wide text-haze-300">
            Operational risk composition
          </h3>
          <span className="text-[11px] text-haze-500">
            Weighted contribution to the {risk.score}-point score
          </span>
        </div>

        <ul className="mt-3 space-y-2.5">
          {risk.components.map((component) => (
            <li key={component.key} className="flex items-center gap-3">
              <span className="w-36 shrink-0 text-[11px] text-haze-400">
                {component.label}
              </span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-800">
                <div
                  className="h-full rounded-full transition-[width]"
                  style={{
                    width: `${Math.max(2, component.pressure * 100)}%`,
                    backgroundColor: heatColor(component.pressure),
                  }}
                />
              </div>
              <span className="tabular w-44 shrink-0 text-right text-[11px] text-haze-500">
                {component.readout}
              </span>
              <span className="tabular w-10 shrink-0 text-right text-[11px] font-medium text-haze-300">
                {Math.round(component.weight * 100)}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  );
}
