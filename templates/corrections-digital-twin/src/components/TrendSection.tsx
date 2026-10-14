import { useTwin } from '@/hooks/TwinContext';
import { cx, formatDelta, formatInt } from '@/lib/format';
import type { TrendSeries } from '@/lib/metrics';
import { LineChart } from '@/components/ui/LineChart';
import { Panel, PanelHeader } from '@/components/ui/Panel';

const CAPTIONS: Record<string, string> = {
  population: 'Inmate population at each month end',
  incidents: 'Reportable incidents recorded per month',
  staffing: 'Correctional officers on strength',
};

const COLORS: Record<string, string> = {
  population: '#3aa0ff',
  incidents: '#ff4d5e',
  staffing: '#ff8c3a',
};

export function TrendSection() {
  const { trends, monthAbbr } = useTwin();
  const entries = Object.entries(trends) as [string, TrendSeries][];

  return (
    <div className="grid gap-3 lg:grid-cols-3">
      {entries.map(([key, trend]) => {
        const rising = trend.fit.slope > 0;
        return (
          <Panel key={key}>
            <PanelHeader
              title={trend.label}
              subtitle={CAPTIONS[key]}
              actions={
                <div className="text-right">
                  <p
                    className={cx(
                      'tabular text-sm font-semibold',
                      rising ? 'text-status-critical' : 'text-status-risk'
                    )}
                  >
                    {formatDelta(trend.ytdChange)}
                  </p>
                  <p className="text-[10px] text-haze-500">year to date</p>
                </div>
              }
            />
            <div className="px-3 pb-3 pt-2">
              <LineChart
                labels={monthAbbr}
                series={[
                  { name: trend.label, values: trend.values, color: COLORS[key] },
                ]}
                formatValue={formatInt}
              />
              <dl className="mt-2 grid grid-cols-3 gap-2 border-t border-ink-700/70 px-2 pt-2.5">
                {[
                  ['Current', formatInt(trend.values[trend.values.length - 1])],
                  [
                    'Trend / month',
                    `${trend.fit.slope > 0 ? '+' : '−'}${Math.abs(trend.fit.slope).toFixed(1)}`,
                  ],
                  ['6-month forecast', formatInt(trend.forecast6)],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-[10px] uppercase tracking-wide text-haze-500">
                      {label}
                    </dt>
                    <dd className="tabular mt-0.5 text-sm font-semibold text-haze-100">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </Panel>
        );
      })}
    </div>
  );
}
