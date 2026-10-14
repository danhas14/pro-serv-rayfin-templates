import { useMemo, useRef, useState } from 'react';

import aerial from '@/assets/facility-aerial.png';
import type { Building } from '@/data/twin';
import { useTwin } from '@/hooks/TwinContext';
import { cx, formatInt, formatPercent } from '@/lib/format';
import { MAP_VIEWS, type MapView } from '@/lib/metrics';
import { STATUS_ORDER, STATUS_THEME, heatColor } from '@/lib/status';

interface FacilityMapProps {
  view: MapView;
  onViewChange: (view: MapView) => void;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Buildings the Operations Assistant is currently referring to. */
  highlighted: string[];
}

const centroid = (points: readonly (readonly [number, number])[]) => {
  if (points.length === 0) return { x: 50, y: 50 };
  const x = points.reduce((sum, p) => sum + p[0], 0) / points.length;
  const y = points.reduce((sum, p) => sum + p[1], 0) / points.length;
  return { x, y };
};

export function FacilityMap({
  view,
  onViewChange,
  selectedId,
  onSelect,
  highlighted,
}: FacilityMapProps) {
  const twin = useTwin();
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [cursor, setCursor] = useState({ x: 0, y: 0 });

  const buildings = twin.data.buildings;
  const activeView = MAP_VIEWS.find((v) => v.id === view) ?? MAP_VIEWS[0];
  const hovered = hoverId ? twin.metricsFor(hoverId) : undefined;
  const highlightSet = useMemo(() => new Set(highlighted), [highlighted]);

  const statusCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const b of buildings)
      counts.set(b.status, (counts.get(b.status) ?? 0) + 1);
    return counts;
  }, [buildings]);

  const overlayColors = (building: Building) => {
    const metrics = twin.metricsFor(building.id);
    if (view === 'status') {
      const theme = STATUS_THEME[building.status];
      return { fill: theme.fill, stroke: theme.color };
    }
    const t = metrics ? twin.heatValue(metrics, view) : 0;
    return { fill: heatColor(t, 0.34), stroke: heatColor(t, 0.95) };
  };

  const handleMove = (event: React.MouseEvent) => {
    const rect = frameRef.current?.getBoundingClientRect();
    if (!rect) return;
    setCursor({ x: event.clientX - rect.left, y: event.clientY - rect.top });
  };

  const tooltipStyle = (() => {
    const rect = frameRef.current?.getBoundingClientRect();
    const width = rect?.width ?? 0;
    const flipX = cursor.x > width - 290;
    return {
      left: flipX ? undefined : cursor.x + 18,
      right: flipX ? Math.max(12, width - cursor.x + 18) : undefined,
      top: Math.max(12, cursor.y - 20),
    };
  })();

  return (
    <div className="ops-panel overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-700/70 px-5 py-3.5">
        <div className="flex items-center gap-3">
          <span className="flex size-8 items-center justify-center rounded-lg border border-fabric-500/30 bg-fabric-500/10 text-fabric-300">
            <svg viewBox="0 0 16 16" className="size-4" fill="currentColor">
              <path d="M6 1.5 1.5 3.2v11.3L6 12.8l4 1.7 4.5-1.7V1.5L10 3.2 6 1.5Zm-.6 1.4v8.4l-2.8 1V3.9l2.8-1Zm1.2 0 2.8 1v8.4l-2.8-1V2.9Zm4 1 2.8-1v8.5l-2.8 1V3.9Z" />
            </svg>
          </span>
          <div>
            <h2 className="text-sm font-semibold text-haze-100">
              Digital Twin — Facility Map
            </h2>
            <p className="text-xs text-haze-400">{activeView.description}</p>
          </div>
        </div>

        <div
          role="tablist"
          aria-label="Facility map view"
          className="flex flex-wrap gap-1 rounded-xl border border-ink-700 bg-ink-900/70 p-1"
        >
          {MAP_VIEWS.map((option) => (
            <button
              key={option.id}
              role="tab"
              aria-selected={option.id === view}
              onClick={() => onViewChange(option.id)}
              className={cx(
                'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                option.id === view
                  ? 'bg-fabric-500/20 text-fabric-300 shadow-[inset_0_0_0_1px_rgba(17,141,255,0.35)]'
                  : 'text-haze-400 hover:bg-ink-800 hover:text-haze-100'
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </header>

      <div
        ref={frameRef}
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverId(null)}
        className="relative w-full overflow-hidden aspect-[16/10] lg:aspect-[21/9] [--map-shift:12.8%] lg:[--map-shift:22.6%]"
      >
        <div
          className="absolute inset-x-0 top-0 aspect-square"
          style={{ transform: 'translateY(calc(-1 * var(--map-shift)))' }}
        >
          <img
            src={aerial}
            alt="Aerial photograph of the North Valley Correctional Complex"
            className="size-full object-cover"
            draggable={false}
          />

          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-0 size-full"
          >
            {buildings.map((building) => {
              if (building.hotspot.length === 0) return null;
              const colors = overlayColors(building);
              const points = building.hotspot
                .map(([x, y]) => `${x},${y}`)
                .join(' ');
              const isActive =
                hoverId === building.id || selectedId === building.id;
              const isFlagged = highlightSet.has(building.id);

              return (
                <g key={building.id}>
                  {(isFlagged || building.status === 'Critical') && (
                    <polygon
                      points={points}
                      fill="none"
                      stroke={isFlagged ? '#7cc3ff' : STATUS_THEME.Critical.color}
                      strokeWidth={1.1}
                      vectorEffect="non-scaling-stroke"
                      opacity={0.9}
                      style={{ animation: 'ops-pulse 2.4s ease-in-out infinite' }}
                    />
                  )}
                  <polygon
                    points={points}
                    fill={colors.fill}
                    stroke={colors.stroke}
                    strokeWidth={isActive ? 2 : 1}
                    vectorEffect="non-scaling-stroke"
                    opacity={
                      hoverId && hoverId !== building.id && !isActive ? 0.55 : 1
                    }
                    className="cursor-pointer transition-opacity"
                    tabIndex={0}
                    role="button"
                    aria-label={`${building.name}, ${building.status}`}
                    onMouseEnter={() => setHoverId(building.id)}
                    onFocus={() => setHoverId(building.id)}
                    onBlur={() => setHoverId(null)}
                    onClick={() =>
                      onSelect(selectedId === building.id ? null : building.id)
                    }
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onSelect(selectedId === building.id ? null : building.id);
                      }
                    }}
                  />
                </g>
              );
            })}
          </svg>

          {/* Centroid markers sit above the SVG so they can use crisp text. */}
          {buildings.map((building) => {
            if (building.hotspot.length === 0) return null;
            const { x, y } = centroid(building.hotspot);
            const isActive =
              hoverId === building.id || selectedId === building.id;
            const colors = overlayColors(building);
            return (
              <div
                key={building.id}
                className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${x}%`, top: `${y}%` }}
              >
                <span
                  className="block size-1.5 rounded-full ring-2 ring-ink-950/70"
                  style={{ backgroundColor: colors.stroke }}
                />
                {isActive && (
                  <span className="absolute left-1/2 top-3 -translate-x-1/2 rounded bg-ink-950/90 px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap text-haze-100 ring-1 ring-ink-600">
                    {building.shortName}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="pointer-events-none absolute bottom-3 left-3 rounded-xl border border-ink-700/80 bg-ink-950/80 px-3 py-2.5 backdrop-blur-sm">
          {view === 'status' ? (
            <div className="flex flex-col gap-1.5">
              {STATUS_ORDER.map((status) => (
                <div key={status} className="flex items-center gap-2 text-[11px]">
                  <span
                    className="size-2 rounded-sm"
                    style={{ backgroundColor: STATUS_THEME[status].color }}
                  />
                  <span className="text-haze-300">{status}</span>
                  <span className="tabular ml-auto pl-3 text-haze-500">
                    {statusCounts.get(status) ?? 0}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="w-44">
              <p className="mb-1.5 text-[11px] font-medium text-haze-300">
                {activeView.label}
              </p>
              <div
                className="h-1.5 w-full rounded-full"
                style={{
                  backgroundImage: `linear-gradient(90deg, ${heatColor(0)}, ${heatColor(0.4)}, ${heatColor(0.7)}, ${heatColor(1)})`,
                }}
              />
              <div className="mt-1 flex justify-between text-[10px] text-haze-500">
                <span>{activeView.legend[0]}</span>
                <span>{activeView.legend[1]}</span>
              </div>
            </div>
          )}
        </div>

        <div className="pointer-events-none absolute right-3 top-3 flex items-center gap-2 rounded-full border border-ink-700/80 bg-ink-950/80 px-3 py-1.5 text-[11px] text-haze-300 backdrop-blur-sm">
          <span
            className="size-1.5 rounded-full bg-status-normal"
            style={{ animation: 'ops-pulse 2s ease-in-out infinite' }}
          />
          Live telemetry · {buildings.length} structures modelled
        </div>

        {hovered && (
          <div
            className="pointer-events-none absolute z-20 w-[268px] rounded-xl border border-ink-600 bg-ink-950/95 p-3.5 shadow-2xl backdrop-blur-sm"
            style={tooltipStyle}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-haze-100">
                  {hovered.building.name}
                </p>
                <p className="text-[11px] text-haze-400">
                  {hovered.building.type}
                </p>
              </div>
              <span
                className={cx(
                  'rounded-full border px-2 py-0.5 text-[10px] font-medium whitespace-nowrap',
                  STATUS_THEME[hovered.building.status].badge
                )}
              >
                {hovered.building.status}
              </span>
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2">
              {[
                ['Inmates', formatInt(hovered.building.inmates)],
                ['Officers', formatInt(hovered.building.officers)],
                ['Incidents (mo)', formatInt(hovered.building.incidents)],
                ['Occupancy', formatPercent(hovered.occupancy)],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-[10px] uppercase tracking-wide text-haze-500">
                    {label}
                  </dt>
                  <dd className="tabular text-sm font-semibold text-haze-100">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>

            <div className="mt-3 flex items-center justify-between border-t border-ink-700 pt-2 text-[11px]">
              <span className="text-haze-500">{activeView.label}</span>
              <span className="font-medium text-fabric-300">
                {twin.heatReadout(hovered, view)}
              </span>
            </div>
            <p className="mt-2 text-[10px] text-haze-500">
              Click the building for the full twin record.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
