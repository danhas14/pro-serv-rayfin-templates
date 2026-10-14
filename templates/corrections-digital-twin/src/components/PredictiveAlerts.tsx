import { PREDICTIVE_ALERTS } from '@/data/twin';
import { useTwin } from '@/hooks/TwinContext';
import { cx, formatInt, formatPercent } from '@/lib/format';
import type { Twin } from '@/lib/metrics';
import { Panel, PanelHeader } from '@/components/ui/Panel';

const SEVERITY = {
  critical: {
    color: '#ff4d5e',
    label: 'Critical',
    badge: 'border-[#ff4d5e]/45 bg-[#ff4d5e]/12 text-[#ff9aa5]',
  },
  risk: {
    color: '#ff8c3a',
    label: 'Staffing risk',
    badge: 'border-[#ff8c3a]/45 bg-[#ff8c3a]/12 text-[#ffbb86]',
  },
  elevated: {
    color: '#f3c623',
    label: 'Elevated',
    badge: 'border-[#f3c623]/40 bg-[#f3c623]/12 text-[#f7dc7d]',
  },
} as const;

/** Supporting figure rendered under each alert, computed from the twin. */
function evidence(
  twin: Twin,
  alertId: string,
  buildingId: string | null
): string {
  const metrics = buildingId ? twin.metricsFor(buildingId) : undefined;

  if (alertId === 'alert-b-capacity' && metrics) {
    return `Now ${formatPercent(metrics.occupancy)} · projected ${formatPercent(metrics.forecastOccupancy)} in six periods`;
  }
  if (alertId === 'alert-d-staffing' && metrics) {
    const short =
      Math.ceil(metrics.building.inmates / (metrics.ratioTarget ?? 1)) -
      metrics.building.officers;
    return `${(metrics.supervisionRatio ?? 0).toFixed(2)} inmates/officer vs target ${(metrics.ratioTarget ?? 0).toFixed(1)} · ${formatInt(short)} posts short`;
  }
  return `Population ${twin.trends.population.fit.slope > 0 ? '+' : ''}${twin.trends.population.fit.slope.toFixed(0)}/mo · staffing ${twin.trends.staffing.fit.slope.toFixed(1)}/mo`;
}

export function PredictiveAlerts({
  onSelectBuilding,
}: {
  onSelectBuilding: (id: string) => void;
}) {
  const twin = useTwin();

  return (
    <Panel className="flex h-full flex-col">
      <PanelHeader
        title="Predictive Alerts"
        subtitle={`Forward-looking risks derived from ${twin.monthCount} periods of history`}
        icon={
          <svg viewBox="0 0 16 16" className="size-4" fill="currentColor">
            <path d="M8 1.5 15 14H1L8 1.5Zm0 3.2L3.4 12.8h9.2L8 4.7ZM7.3 7h1.4v3.1H7.3V7Zm0 3.8h1.4v1.3H7.3v-1.3Z" />
          </svg>
        }
        actions={
          <span className="rounded-full border border-ink-600 bg-ink-800 px-2.5 py-1 text-[11px] text-haze-300">
            {PREDICTIVE_ALERTS.length} active
          </span>
        }
      />
      <ul className="flex-1 divide-y divide-ink-700/70">
        {PREDICTIVE_ALERTS.map((alert) => {
          const severity = SEVERITY[alert.severity];
          return (
            <li key={alert.id} className="px-5 py-4">
              <div className="flex items-start gap-3">
                <span
                  className="mt-1.5 size-2 shrink-0 rounded-full"
                  style={{
                    backgroundColor: severity.color,
                    boxShadow: `0 0 10px ${severity.color}`,
                    animation: 'ops-pulse 2.6s ease-in-out infinite',
                  }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cx(
                        'rounded-full border px-2 py-0.5 text-[10px] font-medium',
                        severity.badge
                      )}
                    >
                      {severity.label}
                    </span>
                    <span className="text-[10px] uppercase tracking-wide text-haze-500">
                      {alert.horizon}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[13px] font-semibold text-haze-100">
                    {alert.title}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-haze-400">
                    {alert.detail}
                  </p>
                  <p className="tabular mt-2 text-[11px] text-fabric-300">
                    {evidence(twin, alert.id, alert.buildingId)}
                  </p>
                  {alert.buildingId && (
                    <button
                      onClick={() => onSelectBuilding(alert.buildingId!)}
                      className="mt-2 text-[11px] font-medium text-fabric-400 underline-offset-2 transition-colors hover:text-fabric-300 hover:underline"
                    >
                      Open building record →
                    </button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
