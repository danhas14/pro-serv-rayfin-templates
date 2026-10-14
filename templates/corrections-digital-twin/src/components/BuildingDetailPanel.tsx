import { useEffect } from 'react';

import { useTwin } from '@/hooks/TwinContext';
import { cx, formatInt, formatPercent } from '@/lib/format';
import { briefingFor } from '@/lib/copilot';
import { STATUS_THEME } from '@/lib/status';
import { LineChart } from '@/components/ui/LineChart';

interface BuildingDetailPanelProps {
  buildingId: string | null;
  onClose: () => void;
}

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: string;
}) {
  return (
    <div className="rounded-lg border border-ink-700/70 bg-ink-900/60 px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wide text-haze-500">{label}</p>
      <p
        className="tabular mt-1 text-lg leading-none font-semibold text-haze-100"
        style={tone ? { color: tone } : undefined}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-[10px] text-haze-500">{hint}</p>}
    </div>
  );
}

export function BuildingDetailPanel({
  buildingId,
  onClose,
}: BuildingDetailPanelProps) {
  const twin = useTwin();

  useEffect(() => {
    if (!buildingId) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [buildingId, onClose]);

  const metrics = buildingId ? twin.metricsFor(buildingId) : undefined;
  if (!buildingId || !metrics) return null;

  const { building } = metrics;
  const theme = STATUS_THEME[building.status];
  const briefing = briefingFor(twin, building.id);
  const summaryText = briefing?.blocks
    .filter((b): b is { kind: 'text'; text: string } => b.kind === 'text')
    .map((b) => b.text)
    .join(' ');

  // Six projected periods appended to the observed population history.
  const forecastLabels = ['+1', '+2', '+3', '+4', '+5', '+6'];
  const step =
    (metrics.forecastInmates - building.inmates) / forecastLabels.length;
  const projectedSeries = [
    ...metrics.inmateSeries,
    ...forecastLabels.map((_, i) => Math.round(building.inmates + step * (i + 1))),
  ];

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-ink-950/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`${building.name} twin record`}
      onClick={onClose}
    >
      <aside
        className="h-full w-full max-w-[520px] overflow-y-auto border-l border-ink-700 bg-ink-900 shadow-2xl"
        style={{ animation: 'ops-rise 180ms ease-out' }}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-ink-700 bg-ink-900/95 px-5 py-4 backdrop-blur">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-haze-500">
              Building twin record
            </p>
            <h2 className="mt-0.5 text-lg font-semibold text-haze-100">
              {building.name}
            </h2>
            <p className="text-xs text-haze-400">{building.type}</p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={cx(
                'rounded-full border px-2.5 py-1 text-[11px] font-medium',
                theme.badge
              )}
            >
              {building.status}
            </span>
            <button
              onClick={onClose}
              aria-label="Close building detail"
              className="flex size-7 items-center justify-center rounded-lg border border-ink-700 text-haze-400 transition-colors hover:bg-ink-800 hover:text-haze-100"
            >
              <svg viewBox="0 0 16 16" className="size-3.5" fill="currentColor">
                <path d="M3.3 2.3 8 7l4.7-4.7 1 1L9 8l4.7 4.7-1 1L8 9l-4.7 4.7-1-1L7 8 2.3 3.3l1-1Z" />
              </svg>
            </button>
          </div>
        </header>

        <div className="space-y-5 px-5 py-5">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            <Stat
              label="Current inmates"
              value={formatInt(building.inmates)}
              hint={`of ${formatInt(building.capacity)} rated beds`}
            />
            <Stat
              label="Occupancy"
              value={formatPercent(metrics.occupancy)}
              hint={
                metrics.overCapacity
                  ? `${formatInt(-metrics.bedsAvailable)} over rating`
                  : `${formatInt(metrics.bedsAvailable)} beds free`
              }
              tone={metrics.overCapacity ? theme.color : undefined}
            />
            <Stat
              label="Officers assigned"
              value={formatInt(building.officers)}
              hint={
                metrics.coveragePer100 === null
                  ? 'No inmate population'
                  : `${metrics.coveragePer100.toFixed(1)} per 100 inmates`
              }
            />
            <Stat
              label="Supervision ratio"
              value={
                metrics.supervisionRatio === null
                  ? '—'
                  : metrics.supervisionRatio.toFixed(2)
              }
              hint={
                metrics.ratioTarget
                  ? `target ≤ ${metrics.ratioTarget.toFixed(1)}`
                  : 'no target'
              }
              tone={metrics.understaffed ? STATUS_THEME.Critical.color : undefined}
            />
            <Stat
              label="Incidents this month"
              value={formatInt(building.incidents)}
              hint={
                building.inmates > 0
                  ? `${metrics.incidentsPer100.toFixed(1)} per 100 inmates`
                  : 'no resident population'
              }
            />
            <Stat
              label="6-month forecast"
              value={formatInt(metrics.forecastInmates)}
              hint={`${formatPercent(metrics.forecastOccupancy)} of capacity`}
              tone={
                metrics.forecastOccupancy > 1
                  ? STATUS_THEME.Critical.color
                  : undefined
              }
            />
          </div>

          <section className="rounded-xl border border-fabric-500/25 bg-fabric-500/[0.06] p-4">
            <div className="flex items-center gap-2">
              <svg
                viewBox="0 0 16 16"
                className="size-3.5 text-fabric-300"
                fill="currentColor"
              >
                <path d="M8 1 9.6 5.1 14 6.2l-3.2 3 .8 4.4L8 11.5 4.4 13.6l.8-4.4L2 6.2l4.4-1.1L8 1Z" />
              </svg>
              <h3 className="text-xs font-semibold tracking-wide text-fabric-300">
                AI-generated summary
              </h3>
            </div>
            <p className="mt-2 text-[13px] leading-relaxed text-haze-300">
              {summaryText}
            </p>
          </section>

          <section>
            <h3 className="mb-1 text-xs font-semibold tracking-wide text-haze-300">
              Occupancy trend
            </h3>
            <p className="mb-2 text-[11px] text-haze-500">
              Share of rated capacity across the {twin.monthCount} reporting
              periods.
            </p>
            <LineChart
              labels={twin.monthAbbr}
              series={[
                {
                  name: 'Occupancy',
                  values: metrics.occupancySeries,
                  color: '#3aa0ff',
                },
              ]}
              height={150}
              formatValue={(v) => `${(v * 100).toFixed(0)}%`}
            />
          </section>

          <section>
            <h3 className="mb-1 text-xs font-semibold tracking-wide text-haze-300">
              Historical incidents
            </h3>
            <p className="mb-2 text-[11px] text-haze-500">
              Trailing trend {metrics.incidentSlope >= 0 ? '+' : ''}
              {metrics.incidentSlope.toFixed(1)} incidents per month.
            </p>
            <LineChart
              labels={twin.monthAbbr}
              series={[
                {
                  name: 'Incidents',
                  values: metrics.incidentSeries,
                  color: '#ff4d5e',
                },
              ]}
              height={150}
              zeroBased
            />
          </section>

          <section>
            <h3 className="mb-1 text-xs font-semibold tracking-wide text-haze-300">
              Officer coverage ratio
            </h3>
            <p className="mb-2 text-[11px] text-haze-500">
              Inmates supervised per assigned officer
              {metrics.ratioTarget
                ? ` against a target of ${metrics.ratioTarget.toFixed(1)}.`
                : '.'}
            </p>
            <LineChart
              labels={twin.monthAbbr}
              series={[
                {
                  name: 'Inmates per officer',
                  values: metrics.inmateSeries.map((inmates, i) =>
                    metrics.officerSeries[i]
                      ? inmates / metrics.officerSeries[i]
                      : 0
                  ),
                  color: '#ff8c3a',
                },
              ]}
              height={150}
              formatValue={(v) => v.toFixed(1)}
            />
          </section>

          <section>
            <h3 className="mb-1 text-xs font-semibold tracking-wide text-haze-300">
              Capacity forecast
            </h3>
            <p className="mb-2 text-[11px] text-haze-500">
              Observed population with a six-period projection (dashed).
            </p>
            <LineChart
              labels={[...twin.monthAbbr, ...forecastLabels]}
              series={[
                {
                  name: 'Population',
                  values: projectedSeries,
                  color: '#7cc3ff',
                  projectedFrom: metrics.inmateSeries.length - 1,
                },
              ]}
              height={150}
            />
          </section>

          <p className="rounded-lg border border-ink-700/70 bg-ink-900/60 px-3 py-2.5 text-[11px] leading-relaxed text-haze-400">
            {building.note}
          </p>
        </div>
      </aside>
    </div>
  );
}
