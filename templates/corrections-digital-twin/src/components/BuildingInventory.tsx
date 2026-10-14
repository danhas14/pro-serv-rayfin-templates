import { useMemo, useState } from 'react';

import { useTwin } from '@/hooks/TwinContext';
import { cx, formatInt, formatPercent } from '@/lib/format';
import type { BuildingMetrics } from '@/lib/metrics';
import { STATUS_THEME } from '@/lib/status';
import { Sparkline } from '@/components/ui/Sparkline';
import { Panel, PanelHeader } from '@/components/ui/Panel';

type SortKey = 'name' | 'inmates' | 'officers' | 'incidents' | 'occupancy';

const COLUMNS: { key: SortKey; label: string; numeric: boolean }[] = [
  { key: 'name', label: 'Building', numeric: false },
  { key: 'inmates', label: 'Inmates', numeric: true },
  { key: 'officers', label: 'Officers', numeric: true },
  { key: 'incidents', label: 'Incidents', numeric: true },
  { key: 'occupancy', label: 'Occupancy', numeric: true },
];

function sortValue(metrics: BuildingMetrics, key: SortKey): number | string {
  switch (key) {
    case 'inmates':
      return metrics.building.inmates;
    case 'officers':
      return metrics.building.officers;
    case 'incidents':
      return metrics.building.incidents;
    case 'occupancy':
      return metrics.occupancy;
    default:
      return metrics.building.name;
  }
}

export function BuildingInventory({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const { buildingMetrics, monthCount } = useTwin();
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({
    key: 'inmates',
    desc: true,
  });

  const rows = useMemo(() => {
    const copy = [...buildingMetrics];
    copy.sort((a, b) => {
      const av = sortValue(a, sort.key);
      const bv = sortValue(b, sort.key);
      const cmp =
        typeof av === 'string' && typeof bv === 'string'
          ? av.localeCompare(bv)
          : Number(av) - Number(bv);
      return sort.desc ? -cmp : cmp;
    });
    return copy;
  }, [buildingMetrics, sort]);

  const toggle = (key: SortKey) =>
    setSort((prev) =>
      prev.key === key ? { key, desc: !prev.desc } : { key, desc: true }
    );

  return (
    <Panel className="overflow-hidden">
      <PanelHeader
        title="Building Inventory"
        subtitle="Every modelled structure — select a row to open its twin record"
        icon={
          <svg viewBox="0 0 16 16" className="size-4" fill="currentColor">
            <path d="M2 2h5v12H2V2Zm1.4 1.4v9.2h2.2V3.4H3.4ZM9 5h5v9H9V5Zm1.4 1.4v6.2h2.2V6.4h-2.2Z" />
          </svg>
        }
      />

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[12.5px]">
          <thead>
            <tr className="border-b border-ink-700/70 bg-ink-900/50">
              {COLUMNS.map((column) => (
                <th
                  key={column.key}
                  className={cx(
                    'px-4 py-2.5 font-medium whitespace-nowrap',
                    column.numeric ? 'text-right' : 'text-left'
                  )}
                >
                  <button
                    onClick={() => toggle(column.key)}
                    className={cx(
                      'inline-flex items-center gap-1 transition-colors hover:text-haze-100',
                      sort.key === column.key
                        ? 'text-fabric-300'
                        : 'text-haze-500'
                    )}
                  >
                    {column.label}
                    {sort.key === column.key && (
                      <span className="text-[9px]">{sort.desc ? '▼' : '▲'}</span>
                    )}
                  </button>
                </th>
              ))}
              <th className="px-4 py-2.5 text-right font-medium text-haze-500 whitespace-nowrap">
                Ratio
              </th>
              <th className="hidden px-4 py-2.5 text-right font-medium text-haze-500 whitespace-nowrap md:table-cell">
                {monthCount}-month population
              </th>
              <th className="px-4 py-2.5 text-left font-medium text-haze-500 whitespace-nowrap">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((metrics) => {
              const { building } = metrics;
              const theme = STATUS_THEME[building.status];
              return (
                <tr
                  key={building.id}
                  onClick={() => onSelect(building.id)}
                  className={cx(
                    'cursor-pointer border-b border-ink-700/40 transition-colors hover:bg-ink-800/60',
                    selectedId === building.id && 'bg-fabric-500/10'
                  )}
                >
                  <td className="px-4 py-2.5">
                    <span className="font-medium text-haze-100">
                      {building.name}
                    </span>
                    <span className="ml-2 text-[11px] text-haze-500">
                      {building.type}
                    </span>
                  </td>
                  <td className="tabular px-4 py-2.5 text-right text-haze-200">
                    {formatInt(building.inmates)}
                    <span className="ml-1 text-[11px] text-haze-500">
                      / {formatInt(building.capacity)}
                    </span>
                  </td>
                  <td className="tabular px-4 py-2.5 text-right text-haze-200">
                    {formatInt(building.officers)}
                  </td>
                  <td className="tabular px-4 py-2.5 text-right text-haze-200">
                    {formatInt(building.incidents)}
                  </td>
                  <td
                    className="tabular px-4 py-2.5 text-right font-medium"
                    style={{
                      color: metrics.overCapacity ? theme.color : undefined,
                    }}
                  >
                    {formatPercent(metrics.occupancy)}
                  </td>
                  <td
                    className={cx(
                      'tabular px-4 py-2.5 text-right',
                      metrics.understaffed
                        ? 'font-medium text-status-critical'
                        : 'text-haze-300'
                    )}
                  >
                    {metrics.supervisionRatio === null
                      ? '—'
                      : metrics.supervisionRatio.toFixed(2)}
                  </td>
                  <td className="hidden px-4 py-1.5 text-right md:table-cell">
                    <div className="flex justify-end">
                      <Sparkline
                        values={metrics.inmateSeries}
                        color={theme.color}
                        width={88}
                        height={24}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={cx(
                        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium whitespace-nowrap',
                        theme.badge
                      )}
                    >
                      <span
                        className="size-1.5 rounded-full"
                        style={{ backgroundColor: theme.color }}
                      />
                      {building.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
