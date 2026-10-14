import { useId, useMemo, useState } from 'react';

import { useElementSize } from '@/hooks/useElementSize';

export interface LineSeries {
  name: string;
  values: number[];
  color: string;
  /** Render the trailing projected points as a dashed continuation. */
  projectedFrom?: number;
}

interface LineChartProps {
  labels: string[];
  series: LineSeries[];
  height?: number;
  formatValue?: (value: number) => string;
  /** Force the y-axis to start at zero instead of hugging the data. */
  zeroBased?: boolean;
  areaFill?: boolean;
}

const PAD = { top: 14, right: 14, bottom: 26, left: 46 };

function niceTicks(min: number, max: number, count = 4): number[] {
  if (min === max) return [min];
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? mag * 10;
  const start = Math.floor(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + step * 0.5; v += step) ticks.push(v);
  return ticks;
}

export function LineChart({
  labels,
  series,
  height = 190,
  formatValue = (v) => v.toLocaleString('en-US'),
  zeroBased = false,
  areaFill = true,
}: LineChartProps) {
  const { ref, width } = useElementSize<HTMLDivElement>();
  const gradientId = useId();
  const [hover, setHover] = useState<number | null>(null);

  const allValues = series.flatMap((s) => s.values);
  const dataMin = Math.min(...allValues);
  const dataMax = Math.max(...allValues);
  const span = dataMax - dataMin || Math.max(1, dataMax * 0.1);
  const min = zeroBased ? 0 : Math.max(0, dataMin - span * 0.35);
  const max = dataMax + span * 0.25;

  const ticks = useMemo(
    () => niceTicks(min, max).filter((t) => t >= min && t <= max),
    [min, max]
  );
  const innerW = Math.max(0, width - PAD.left - PAD.right);
  const innerH = height - PAD.top - PAD.bottom;

  const x = (i: number) =>
    PAD.left + (labels.length <= 1 ? 0 : (i / (labels.length - 1)) * innerW);
  const y = (value: number) =>
    PAD.top + innerH - ((value - min) / (max - min || 1)) * innerH;

  const path = (values: number[], from = 0, to = values.length - 1) =>
    values
      .slice(from, to + 1)
      .map((v, idx) => `${idx === 0 ? 'M' : 'L'}${x(from + idx)} ${y(v)}`)
      .join(' ');

  // Keep x-axis labels readable on narrow panels.
  const labelStep = innerW < 260 ? 2 : 1;

  return (
    <div ref={ref} className="w-full">
      {width > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={series.map((s) => s.name).join(', ')}
          onMouseLeave={() => setHover(null)}
          onMouseMove={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            const px = event.clientX - rect.left - PAD.left;
            const idx = Math.round((px / (innerW || 1)) * (labels.length - 1));
            setHover(Math.min(labels.length - 1, Math.max(0, idx)));
          }}
        >
          <defs>
            {series.map((s, i) => (
              <linearGradient
                key={s.name}
                id={`${gradientId}-${i}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor={s.color} stopOpacity={0.32} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>

          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={PAD.left}
                x2={PAD.left + innerW}
                y1={y(tick)}
                y2={y(tick)}
                stroke="#1b2942"
                strokeDasharray="2 4"
              />
              <text
                x={PAD.left - 8}
                y={y(tick) + 3.5}
                textAnchor="end"
                className="fill-haze-500 text-[10px]"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {formatValue(tick)}
              </text>
            </g>
          ))}

          {labels.map((label, i) =>
            i % labelStep === 0 ? (
              <text
                key={label}
                x={x(i)}
                y={height - 8}
                textAnchor="middle"
                className="fill-haze-500 text-[10px]"
              >
                {label}
              </text>
            ) : null
          )}

          {series.map((s, i) => {
            const split = s.projectedFrom ?? s.values.length - 1;
            return (
              <g key={s.name}>
                {areaFill && (
                  <path
                    d={`${path(s.values)} L${x(s.values.length - 1)} ${PAD.top + innerH} L${x(0)} ${PAD.top + innerH} Z`}
                    fill={`url(#${gradientId}-${i})`}
                  />
                )}
                <path
                  d={path(s.values, 0, split)}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {split < s.values.length - 1 && (
                  <path
                    d={path(s.values, split, s.values.length - 1)}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    strokeLinecap="round"
                    opacity={0.75}
                  />
                )}
                {s.values.map((v, idx) => (
                  <circle
                    key={idx}
                    cx={x(idx)}
                    cy={y(v)}
                    r={hover === idx ? 4 : 2.5}
                    fill="#080d1a"
                    stroke={s.color}
                    strokeWidth={2}
                  />
                ))}
              </g>
            );
          })}

          {hover !== null && (
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={PAD.top}
              y2={PAD.top + innerH}
              stroke="#3aa0ff"
              strokeOpacity={0.5}
              strokeDasharray="3 3"
            />
          )}
        </svg>
      )}

      {hover !== null && (
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-[11px]">
          <span className="font-medium text-haze-300">{labels[hover]}</span>
          {series.map((s) => (
            <span key={s.name} className="flex items-center gap-1.5 text-haze-400">
              <span
                className="size-1.5 rounded-full"
                style={{ backgroundColor: s.color }}
              />
              {s.name}
              <span className="tabular font-semibold text-haze-100">
                {formatValue(s.values[hover])}
              </span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
