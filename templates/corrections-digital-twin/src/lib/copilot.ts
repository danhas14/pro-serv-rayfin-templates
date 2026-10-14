/**
 * Operations Assistant — natural-language question routing over the twin.
 *
 * The assistant is deliberately grounded: every answer is assembled from the
 * derived {@link Twin}, which in turn comes from the semantic model. Nothing is
 * pre-written, so an answer cannot drift from what the dashboard renders.
 */

import { FACILITY, PREDICTIVE_ALERTS } from '@/data/twin';
import { formatDelta, formatInt, formatPercent } from '@/lib/format';
import type { BuildingMetrics, Twin } from '@/lib/metrics';

export type Tone = 'neutral' | 'good' | 'warn' | 'bad';

export type AssistantBlock =
  | { kind: 'text'; text: string }
  | { kind: 'metrics'; items: { label: string; value: string; tone?: Tone }[] }
  | {
      kind: 'table';
      columns: string[];
      rows: { cells: string[]; tone?: Tone }[];
    }
  | { kind: 'bullets'; items: string[] };

export interface AssistantAnswer {
  headline: string;
  blocks: AssistantBlock[];
  /** Building ids the answer refers to; the map highlights these. */
  focus: string[];
  source: string;
}

export const SUGGESTED_QUESTIONS = [
  'Which housing unit has the highest incident rate?',
  'Which buildings are currently overcrowded?',
  'Show the officer-to-inmate ratio for all units.',
  'Predict inmate population six months from now.',
  'Which facilities have rising incident trends?',
  'Which units are understaffed?',
  "Summarize today's operational status.",
];

function toneForOccupancy(occupancy: number): Tone {
  if (occupancy > 1.05) return 'bad';
  if (occupancy > 0.95) return 'warn';
  return 'good';
}

/* ------------------------------------------------------------------ */
/* Answer builders                                                     */
/* ------------------------------------------------------------------ */

function highestIncidents(twin: Twin): AssistantAnswer {
  const lastLabel = twin.monthAbbr[twin.monthCount - 2] ?? 'last period';
  const ranked = [...twin.buildingMetrics].sort(
    (a, b) => b.building.incidents - a.building.incidents
  );
  const top = ranked[0];
  const previous = top.incidentSeries[top.incidentSeries.length - 2] ?? 0;
  const change = top.building.incidents - previous;
  const perCapita = [...twin.buildingMetrics]
    .filter((m) => m.building.inmates > 0)
    .sort((a, b) => b.incidentsPer100 - a.incidentsPer100)[0];

  return {
    headline: `${top.building.name} recorded the highest incident volume this period.`,
    blocks: [
      {
        kind: 'text',
        text: `${top.building.name} recorded the highest number of incidents this month with ${top.building.incidents} incidents — ${
          change >= 0
            ? `up ${change} from ${previous}`
            : `down ${Math.abs(change)} from ${previous}`
        } in ${lastLabel}. It is a ${top.building.type.toLowerCase()} unit at ${formatPercent(top.occupancy)} of rated capacity.`,
      },
      {
        kind: 'text',
        text: `Adjusted for population, ${perCapita.building.name} carries the highest incident rate at ${perCapita.incidentsPer100.toFixed(1)} incidents per 100 inmates.`,
      },
      {
        kind: 'table',
        columns: ['Building', 'Incidents', 'Per 100 inmates', 'Status'],
        rows: ranked.slice(0, 5).map((m) => ({
          cells: [
            m.building.name,
            String(m.building.incidents),
            m.building.inmates > 0 ? m.incidentsPer100.toFixed(1) : '—',
            m.building.status,
          ],
          tone: m.building.status === 'Normal' ? 'neutral' : 'warn',
        })),
      },
    ],
    focus: [top.building.id, perCapita.building.id],
    source: `Incident log · ${twin.reportingPeriod} reporting period`,
  };
}

function overcrowded(twin: Twin): AssistantAnswer {
  const over = [...twin.summary.overcrowded].sort(
    (a, b) => b.occupancy - a.occupancy
  );

  if (over.length === 0) {
    return {
      headline: 'No buildings are currently over rated capacity.',
      blocks: [
        {
          kind: 'text',
          text: `Every modelled building is operating at or below its rated capacity. Facility-wide utilisation is ${formatPercent(twin.summary.occupancyRate)}.`,
        },
      ],
      focus: [],
      source: 'Bed management roll-up',
    };
  }

  const nearCapacity = twin.buildingMetrics
    .filter((m) => !m.overCapacity && m.occupancy >= 0.95)
    .sort((a, b) => b.occupancy - a.occupancy);

  return {
    headline: `${over.length} building${over.length === 1 ? ' is' : 's are'} operating over rated capacity.`,
    blocks: [
      {
        kind: 'text',
        text: over
          .map(
            (m) =>
              `${m.building.name} is operating at ${formatPercent(m.occupancy)} capacity (${formatInt(m.building.inmates)} of ${formatInt(m.building.capacity)} beds, ${formatInt(-m.bedsAvailable)} over).`
          )
          .join(' '),
      },
      {
        kind: 'table',
        columns: ['Building', 'Inmates', 'Capacity', 'Occupancy'],
        rows: over.map((m) => ({
          cells: [
            m.building.name,
            formatInt(m.building.inmates),
            formatInt(m.building.capacity),
            formatPercent(m.occupancy),
          ],
          tone: toneForOccupancy(m.occupancy),
        })),
      },
      ...(nearCapacity.length
        ? ([
            {
              kind: 'text',
              text: `Watch list: ${nearCapacity
                .map((m) => `${m.building.name} at ${formatPercent(m.occupancy)}`)
                .join(', ')}.`,
            },
          ] as AssistantBlock[])
        : []),
    ],
    focus: over.map((m) => m.building.id),
    source: 'Bed management roll-up',
  };
}

function supervisionRatios(twin: Twin): AssistantAnswer {
  const rows = twin.buildingMetrics
    .filter((m) => m.supervisionRatio !== null)
    .sort((a, b) => (b.supervisionRatio ?? 0) - (a.supervisionRatio ?? 0));

  return {
    headline: 'Officer-to-inmate ratio by unit, highest supervision load first.',
    blocks: [
      {
        kind: 'text',
        text: `Facility-wide the ratio is ${twin.summary.facilityRatio.toFixed(2)} inmates per officer (${formatInt(twin.summary.totalInmates)} inmates, ${formatInt(twin.summary.totalOfficers)} officers). Units above their type target are flagged.`,
      },
      {
        kind: 'table',
        columns: ['Building', 'Inmates', 'Officers', 'Ratio', 'Target', 'Status'],
        rows: rows.map((m) => ({
          cells: [
            m.building.name,
            formatInt(m.building.inmates),
            formatInt(m.building.officers),
            (m.supervisionRatio ?? 0).toFixed(2),
            m.ratioTarget ? m.ratioTarget.toFixed(1) : '—',
            m.understaffed ? 'Over target' : 'Within target',
          ],
          tone: m.understaffed ? 'bad' : 'good',
        })),
      },
    ],
    focus: rows.filter((m) => m.understaffed).map((m) => m.building.id),
    source: 'Post assignment roster',
  };
}

function populationForecast(twin: Twin): AssistantAnswer {
  const { forecast6, values, fit } = twin.trends.population;
  const current = values[values.length - 1];
  const projectedOccupancy = twin.summary.designCapacity
    ? forecast6 / twin.summary.designCapacity
    : 0;
  const staffForecast = twin.trends.staffing.forecast6;

  return {
    headline: `Population is forecast to reach ${formatInt(forecast6)} within six months.`,
    blocks: [
      {
        kind: 'text',
        text: `Based on current growth trends the inmate population is forecast to reach ${formatInt(forecast6)} within six months, up from ${formatInt(current)} today at roughly ${formatInt(fit.slope)} inmates per month.`,
      },
      {
        kind: 'metrics',
        items: [
          { label: 'Today', value: formatInt(current) },
          { label: 'In 6 months', value: formatInt(forecast6), tone: 'bad' },
          {
            label: 'Projected utilisation',
            value: formatPercent(projectedOccupancy),
            tone: projectedOccupancy > 1 ? 'bad' : 'warn',
          },
          {
            label: 'Officers at that point',
            value: formatInt(staffForecast),
            tone: 'warn',
          },
        ],
      },
      {
        kind: 'text',
        text:
          projectedOccupancy > 1
            ? `That projection puts the complex ${formatInt(forecast6 - twin.summary.designCapacity)} inmates above its rated design capacity of ${formatInt(twin.summary.designCapacity)}, while officer strength is trending to ${formatInt(staffForecast)}. Supervision load would rise to ${(forecast6 / Math.max(1, staffForecast)).toFixed(2)} inmates per officer.`
            : `That keeps the complex inside its rated design capacity of ${formatInt(twin.summary.designCapacity)}, but officer strength is trending to ${formatInt(staffForecast)} over the same window.`,
      },
    ],
    focus: [],
    source: `${twin.monthCount}-month least-squares projection`,
  };
}

function risingIncidents(twin: Twin): AssistantAnswer {
  const lastLabel = twin.monthAbbr[twin.monthCount - 2] ?? 'prior';
  const thisLabel = twin.monthAbbr[twin.monthCount - 1] ?? 'current';
  const rising = twin.buildingMetrics
    .filter((m) => m.incidentSlope > 0.15)
    .sort((a, b) => b.incidentSlope - a.incidentSlope);

  return {
    headline: `${rising.length} building${rising.length === 1 ? ' shows' : 's show'} a rising incident trend.`,
    blocks: [
      {
        kind: 'text',
        text: `Measured over the trailing six reporting periods, facility incidents are climbing about ${twin.trends.incidents.fit.slope.toFixed(1)} per month (${formatDelta(twin.trends.incidents.ytdChange)} year to date). The units below are driving that movement.`,
      },
      {
        kind: 'table',
        columns: [
          'Building',
          `${lastLabel} → ${thisLabel}`,
          'Trend / month',
          'Status',
        ],
        rows: rising.map((m) => ({
          cells: [
            m.building.name,
            `${m.incidentSeries[m.incidentSeries.length - 2] ?? 0} → ${m.building.incidents}`,
            `+${m.incidentSlope.toFixed(1)}`,
            m.building.status,
          ],
          tone: m.building.status === 'Normal' ? 'warn' : 'bad',
        })),
      },
    ],
    focus: rising.map((m) => m.building.id),
    source: 'Six-period incident regression',
  };
}

function understaffed(twin: Twin): AssistantAnswer {
  const units = [...twin.summary.understaffed].sort(
    (a, b) =>
      (b.supervisionRatio ?? 0) / (b.ratioTarget ?? 1) -
      (a.supervisionRatio ?? 0) / (a.ratioTarget ?? 1)
  );

  if (units.length === 0) {
    return {
      headline: 'All units are within their supervision ratio targets.',
      blocks: [
        {
          kind: 'text',
          text: `No modelled building exceeds its inmates-per-officer target. Facility-wide load is ${twin.summary.facilityRatio.toFixed(2)}.`,
        },
      ],
      focus: [],
      source: 'Post assignment roster',
    };
  }

  const shortfall = (m: BuildingMetrics) =>
    Math.ceil(m.building.inmates / (m.ratioTarget ?? 1)) - m.building.officers;

  return {
    headline: `${units.length} units are operating above their supervision ratio target.`,
    blocks: [
      {
        kind: 'text',
        text: units
          .map(
            (m) =>
              `${m.building.name} is supervising ${(m.supervisionRatio ?? 0).toFixed(2)} inmates per officer against a target of ${(m.ratioTarget ?? 0).toFixed(1)}; closing the gap needs ${shortfall(m)} additional post${shortfall(m) === 1 ? '' : 's'}.`
          )
          .join(' '),
      },
      {
        kind: 'table',
        columns: ['Building', 'Ratio', 'Target', 'Officers short'],
        rows: units.map((m) => ({
          cells: [
            m.building.name,
            (m.supervisionRatio ?? 0).toFixed(2),
            (m.ratioTarget ?? 0).toFixed(1),
            String(shortfall(m)),
          ],
          tone: 'bad',
        })),
      },
      {
        kind: 'text',
        text: `Officer strength has moved ${formatDelta(twin.trends.staffing.ytdChange)} year to date while population moved ${formatDelta(twin.trends.population.ytdChange)}, so these gaps widen without recruitment.`,
      },
    ],
    focus: units.map((m) => m.building.id),
    source: 'Post assignment roster · staffing trend',
  };
}

function operationalSummary(twin: Twin): AssistantAnswer {
  const lastLabel = twin.monthAbbr[twin.monthCount - 2] ?? 'the prior period';
  const offNormal = twin.data.buildings.filter((b) => b.status !== 'Normal');

  return {
    headline: `${FACILITY.name} is ${FACILITY.status.toLowerCase()} with an ${twin.risk.band.toLowerCase()} operational risk score of ${twin.risk.score}.`,
    blocks: [
      {
        kind: 'metrics',
        items: [
          {
            label: 'Population',
            value: formatInt(twin.summary.totalInmates),
            tone: 'warn',
          },
          {
            label: 'Occupancy',
            value: formatPercent(twin.summary.occupancyRate),
            tone: 'warn',
          },
          {
            label: 'Officers',
            value: formatInt(twin.summary.totalOfficers),
            tone: 'bad',
          },
          {
            label: 'Incidents',
            value: formatInt(twin.summary.totalIncidents),
            tone: 'bad',
          },
          {
            label: 'Risk score',
            value: `${twin.risk.score} / 100`,
            tone: 'bad',
          },
        ],
      },
      {
        kind: 'text',
        text: `Population closed ${twin.reportingPeriod} at ${formatInt(twin.summary.totalInmates)} against ${formatInt(twin.summary.designCapacity)} rated beds (${formatPercent(twin.summary.occupancyRate)}), ${formatDelta(twin.trends.population.momChange)} month over month. ${formatInt(twin.summary.totalIncidents)} incidents were recorded, ${formatDelta(twin.trends.incidents.momChange)} versus ${lastLabel}. Officer strength stands at ${formatInt(twin.summary.totalOfficers)}, ${formatDelta(twin.trends.staffing.ytdChange)} year to date.`,
      },
      {
        kind: 'bullets',
        items: [
          `${offNormal.length} of ${twin.data.buildings.length} buildings are off-normal: ${offNormal.map((b) => `${b.name} (${b.status})`).join(', ')}.`,
          `${twin.summary.overcrowded.length} buildings are over rated capacity; ${twin.summary.understaffed.length} are above their supervision ratio target.`,
          ...PREDICTIVE_ALERTS.map((a) => `${a.title} — ${a.horizon}.`),
        ],
      },
    ],
    focus: offNormal.map((b) => b.id),
    source: 'Facility command roll-up',
  };
}

function capacityOutlook(twin: Twin): AssistantAnswer {
  const ranked = [...twin.buildingMetrics]
    .filter((m) => m.building.capacity > 0)
    .sort((a, b) => b.occupancy - a.occupancy);
  const headroom = twin.summary.designCapacity - twin.summary.totalInmates;
  const perMonth = Math.max(1, twin.trends.population.fit.slope);

  return {
    headline: `${formatInt(headroom)} rated beds remain across the complex.`,
    blocks: [
      {
        kind: 'text',
        text: `Facility utilisation is ${formatPercent(twin.summary.occupancyRate)} of ${formatInt(twin.summary.designCapacity)} rated beds. At the current intake trend of ${formatInt(twin.trends.population.fit.slope)} inmates per month that headroom is consumed in roughly ${Math.max(0, Math.round(headroom / perMonth))} months.`,
      },
      {
        kind: 'table',
        columns: ['Building', 'Occupancy', 'Beds free', '6-month outlook'],
        rows: ranked.map((m) => ({
          cells: [
            m.building.name,
            formatPercent(m.occupancy),
            formatInt(m.bedsAvailable),
            formatPercent(m.forecastOccupancy),
          ],
          tone: toneForOccupancy(m.forecastOccupancy),
        })),
      },
    ],
    focus: ranked.slice(0, 3).map((m) => m.building.id),
    source: 'Bed management · capacity projection',
  };
}

function staffingOutlook(twin: Twin): AssistantAnswer {
  const { values, forecast6, ytdChange, fit } = twin.trends.staffing;

  return {
    headline: `Officer strength stands at ${formatInt(values[values.length - 1])}, ${formatDelta(ytdChange)} year to date.`,
    blocks: [
      {
        kind: 'text',
        text: `Staffing has moved from ${formatInt(values[0])} to ${formatInt(values[values.length - 1])} (${formatDelta(ytdChange)}), an average of ${Math.abs(fit.slope).toFixed(1)} officers per month. Holding that trend puts strength at ${formatInt(forecast6)} in six months while population reaches ${formatInt(twin.trends.population.forecast6)}.`,
      },
      {
        kind: 'metrics',
        items: [
          {
            label: 'Posted to buildings',
            value: formatInt(twin.summary.postedOfficers),
          },
          {
            label: 'Relief & perimeter',
            value: formatInt(twin.summary.reliefOfficers),
          },
          {
            label: 'Ratio today',
            value: twin.summary.facilityRatio.toFixed(2),
            tone: 'warn',
          },
          {
            label: 'Ratio in 6 months',
            value: (
              twin.trends.population.forecast6 / Math.max(1, forecast6)
            ).toFixed(2),
            tone: 'bad',
          },
        ],
      },
    ],
    focus: twin.summary.understaffed.map((m) => m.building.id),
    source: `Staffing roster · ${twin.monthCount}-month trend`,
  };
}

function buildingBriefing(twin: Twin, metrics: BuildingMetrics): AssistantAnswer {
  const { building } = metrics;
  const lastLabel = twin.monthAbbr[twin.monthCount - 2] ?? 'the prior period';
  const thisLabel = twin.monthAbbr[twin.monthCount - 1] ?? 'this period';
  const prevIncidents =
    metrics.incidentSeries[metrics.incidentSeries.length - 2] ?? 0;

  return {
    headline: `${building.name} — ${building.type}, currently ${building.status}.`,
    blocks: [
      {
        kind: 'metrics',
        items: [
          {
            label: 'Inmates',
            value: `${formatInt(building.inmates)} / ${formatInt(building.capacity)}`,
            tone: toneForOccupancy(metrics.occupancy),
          },
          {
            label: 'Occupancy',
            value: formatPercent(metrics.occupancy),
            tone: toneForOccupancy(metrics.occupancy),
          },
          { label: 'Officers', value: formatInt(building.officers) },
          {
            label: 'Ratio',
            value:
              metrics.supervisionRatio === null
                ? '—'
                : metrics.supervisionRatio.toFixed(2),
            tone: metrics.understaffed ? 'bad' : 'good',
          },
          {
            label: 'Incidents',
            value: formatInt(building.incidents),
            tone: building.incidents > 15 ? 'bad' : 'neutral',
          },
        ],
      },
      {
        kind: 'text',
        text: `${building.note} Incidents moved from ${prevIncidents} in ${lastLabel} to ${building.incidents} in ${thisLabel}, a trailing trend of ${metrics.incidentSlope >= 0 ? '+' : ''}${metrics.incidentSlope.toFixed(1)} per month.`,
      },
      {
        kind: 'text',
        text: `Six-month outlook: ${formatInt(metrics.forecastInmates)} inmates (${formatPercent(metrics.forecastOccupancy)} of rated capacity).${
          metrics.understaffed
            ? ` Supervision is above the ${(metrics.ratioTarget ?? 0).toFixed(1)} target for a ${building.type.toLowerCase()} unit.`
            : ''
        }`,
      },
    ],
    focus: [building.id],
    source: `Building twin · ${building.name}`,
  };
}

function fallback(question: string): AssistantAnswer {
  return {
    headline: "I don't have a grounded answer for that yet.",
    blocks: [
      {
        kind: 'text',
        text: `I can only answer from this facility's operational twin, and "${question.trim()}" didn't match a known metric. Try one of these:`,
      },
      { kind: 'bullets', items: [...SUGGESTED_QUESTIONS] },
      {
        kind: 'text',
        text: 'You can also name any building — for example "tell me about Housing Unit D" — for a unit briefing.',
      },
    ],
    focus: [],
    source: 'Operations Assistant',
  };
}

/* ------------------------------------------------------------------ */
/* Routing                                                             */
/* ------------------------------------------------------------------ */

interface Intent {
  id: string;
  phrases: string[];
  build: (twin: Twin) => AssistantAnswer;
}

const INTENTS: Intent[] = [
  {
    id: 'highest-incidents',
    phrases: [
      'highest incident',
      'most incidents',
      'highest incident rate',
      'worst unit',
      'most violent',
      'incident rate',
      'which unit has the most',
      'top incident',
    ],
    build: highestIncidents,
  },
  {
    id: 'overcrowded',
    phrases: [
      'overcrowd',
      'over capacity',
      'over-capacity',
      'exceed capacity',
      'above capacity',
      'crowded',
      'too full',
      'beyond capacity',
    ],
    build: overcrowded,
  },
  {
    id: 'ratios',
    phrases: [
      'officer-to-inmate',
      'officer to inmate',
      'inmate to officer',
      'inmates per officer',
      'supervision ratio',
      'ratio for all',
      'ratio',
      'coverage',
    ],
    build: supervisionRatios,
  },
  {
    id: 'forecast',
    phrases: [
      'predict inmate population',
      'population six months',
      'six months from now',
      '6 months from now',
      'forecast population',
      'predict population',
      'future population',
      'population projection',
      'predict',
      'forecast',
    ],
    build: populationForecast,
  },
  {
    id: 'rising-incidents',
    phrases: [
      'rising incident',
      'increasing incident',
      'incident trend',
      'trending up',
      'growing incident',
      'incidents rising',
      'getting worse',
    ],
    build: risingIncidents,
  },
  {
    id: 'understaffed',
    phrases: [
      'understaffed',
      'under staffed',
      'short staffed',
      'short-staffed',
      'staffing shortage',
      'staffing gap',
      'below recommended',
      'need more officers',
    ],
    build: understaffed,
  },
  {
    id: 'summary',
    phrases: [
      "summarize today's operational status",
      'operational status',
      'summarize',
      'summary',
      'overview',
      'sitrep',
      'brief me',
      'how are we doing',
      'status today',
    ],
    build: operationalSummary,
  },
  {
    id: 'capacity',
    phrases: [
      'capacity trend',
      'beds available',
      'bed availability',
      'headroom',
      'capacity outlook',
      'how much capacity',
      'capacity',
    ],
    build: capacityOutlook,
  },
  {
    id: 'staffing-trend',
    phrases: [
      'staffing trend',
      'officer staffing',
      'staffing level',
      'losing officers',
      'staff attrition',
      'staffing',
    ],
    build: staffingOutlook,
  },
];

const AGGREGATE_HINTS = [
  'all units',
  'all buildings',
  'every',
  'which',
  'rank',
  'compare',
  'across',
];

function findBuilding(twin: Twin, text: string): BuildingMetrics | undefined {
  const direct = twin.buildingMetrics.find((m) =>
    text.includes(m.building.name.toLowerCase())
  );
  if (direct) return direct;

  // Accept "unit d" / "building d" shorthand for the housing pods.
  const shorthand = text.match(
    /\b(?:housing\s+)?(?:unit|building|pod)\s+([a-f])\b/
  );
  if (shorthand) {
    const suffix = shorthand[1];
    const match = twin.buildingMetrics.find(
      (m) =>
        m.building.id === `housing-${suffix}` ||
        m.building.shortName.toLowerCase() === `unit ${suffix}`
    );
    if (match) return match;
  }

  return twin.buildingMetrics.find((m) =>
    text.includes(m.building.shortName.toLowerCase())
  );
}

function scoreIntent(intent: Intent, text: string): number {
  let best = 0;
  for (const phrase of intent.phrases) {
    if (text.includes(phrase)) best = Math.max(best, phrase.length);
  }
  return best;
}

export function answerQuestion(twin: Twin, question: string): AssistantAnswer {
  const text = question.toLowerCase().trim();
  if (!text) return fallback(question);

  let bestIntent: Intent | null = null;
  let bestScore = 0;
  for (const intent of INTENTS) {
    const score = scoreIntent(intent, text);
    if (score > bestScore) {
      bestScore = score;
      bestIntent = intent;
    }
  }

  const building = findBuilding(twin, text);
  const isAggregate = AGGREGATE_HINTS.some((hint) => text.includes(hint));

  // A named building wins unless the phrasing is clearly a cross-facility
  // question, or the matched intent is a stronger, more specific signal.
  if (building && !isAggregate && bestScore < 12) {
    return buildingBriefing(twin, building);
  }

  if (bestIntent) return bestIntent.build(twin);
  if (building) return buildingBriefing(twin, building);

  return fallback(question);
}

export function briefingFor(
  twin: Twin,
  buildingId: string
): AssistantAnswer | null {
  const metrics = twin.metricsFor(buildingId);
  return metrics ? buildingBriefing(twin, metrics) : null;
}
