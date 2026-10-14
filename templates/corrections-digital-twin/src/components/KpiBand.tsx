import { FACILITY } from '@/data/twin';
import { useTwin } from '@/hooks/TwinContext';
import { cx, formatDelta, formatInt, formatPercent } from '@/lib/format';
import { STATUS_THEME } from '@/lib/status';
import { Sparkline } from '@/components/ui/Sparkline';

type Tone = 'neutral' | 'good' | 'warn' | 'bad';

const TONE_TEXT: Record<Tone, string> = {
  neutral: 'text-haze-300',
  good: 'text-status-normal',
  warn: 'text-status-elevated',
  bad: 'text-status-critical',
};

interface Kpi {
  key: string;
  label: string;
  value: string;
  caption: string;
  delta?: { text: string; tone: Tone };
  spark?: { values: number[]; color: string };
  accent?: string;
}

export function KpiBand() {
  const { summary, trends, risk, data, reportingPeriod } = useTwin();

  const kpis: Kpi[] = [
    {
      key: 'inmates',
      label: 'Total Inmates',
      value: formatInt(summary.totalInmates),
      caption: `${formatInt(summary.instrumentedInmates)} in instrumented units`,
      delta: {
        text: `${formatDelta(trends.population.momChange)} MoM`,
        tone: 'bad',
      },
      spark: { values: data.populationTrend, color: '#3aa0ff' },
    },
    {
      key: 'officers',
      label: 'Total Correctional Officers',
      value: formatInt(summary.totalOfficers),
      caption: `${formatInt(summary.postedOfficers)} posted · ${formatInt(summary.reliefOfficers)} relief`,
      delta: {
        text: `${formatDelta(trends.staffing.ytdChange)} YTD`,
        tone: 'bad',
      },
      spark: { values: data.staffingTrend, color: '#ff8c3a' },
    },
    {
      key: 'incidents',
      label: 'Monthly Incidents',
      value: formatInt(summary.totalIncidents),
      caption: `${summary.incidentsPer1000.toFixed(1)} per 1,000 inmates`,
      delta: {
        text: `${formatDelta(trends.incidents.momChange)} MoM`,
        tone: 'bad',
      },
      spark: { values: data.incidentTrend, color: '#ff4d5e' },
    },
    {
      key: 'occupancy',
      label: 'Occupancy Rate',
      value: formatPercent(summary.occupancyRate),
      caption: `${formatInt(summary.totalInmates)} of ${formatInt(summary.designCapacity)} rated beds`,
      delta: {
        text: `${formatInt(summary.designCapacity - summary.totalInmates)} beds free`,
        tone: 'warn',
      },
      spark: {
        values: data.populationTrend.map((v) =>
          summary.designCapacity ? v / summary.designCapacity : 0
        ),
        color: '#f3c623',
      },
    },
    {
      key: 'overcrowded',
      label: 'Overcrowded Buildings',
      value: formatInt(summary.overcrowded.length),
      caption:
        summary.overcrowded
          .map((m) => `${m.building.shortName} ${formatPercent(m.occupancy)}`)
          .join(' · ') || 'All units within rating',
      delta: {
        text: `${summary.understaffed.length} units understaffed`,
        tone: 'bad',
      },
      accent: STATUS_THEME['Over Capacity'].color,
    },
    {
      key: 'status',
      label: 'Facility Status',
      value: FACILITY.status,
      caption: `Operational risk ${risk.score}/100 · ${risk.band}`,
      delta: { text: `${reportingPeriod} close`, tone: 'neutral' },
      accent: STATUS_THEME.Normal.color,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {kpis.map((kpi) => (
        <article key={kpi.key} className="ops-panel relative overflow-hidden p-4">
          {kpi.accent && (
            <span
              className="absolute inset-x-0 top-0 h-px"
              style={{
                backgroundImage: `linear-gradient(90deg, transparent, ${kpi.accent}, transparent)`,
              }}
            />
          )}
          <p className="text-[11px] font-medium uppercase tracking-wide text-haze-500">
            {kpi.label}
          </p>
          <p
            className="tabular mt-2 text-[26px] leading-none font-semibold text-haze-100"
            style={kpi.accent ? { color: kpi.accent } : undefined}
          >
            {kpi.value}
          </p>

          <div className="mt-3 flex items-end justify-between gap-2">
            <div className="min-w-0">
              {kpi.delta && (
                <p
                  className={cx(
                    'text-[11px] font-medium',
                    TONE_TEXT[kpi.delta.tone]
                  )}
                >
                  {kpi.delta.text}
                </p>
              )}
              <p
                className="mt-0.5 text-[11px] leading-snug text-haze-500"
                title={kpi.caption}
              >
                {kpi.caption}
              </p>
            </div>
            {kpi.spark && (
              <Sparkline
                values={kpi.spark.values}
                color={kpi.spark.color}
                width={74}
                height={26}
              />
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
