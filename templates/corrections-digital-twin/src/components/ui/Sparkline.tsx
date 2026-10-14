interface SparklineProps {
  values: number[];
  color: string;
  width?: number;
  height?: number;
  /** Draw a faint baseline at the series' first value. */
  baseline?: boolean;
}

export function Sparkline({
  values,
  color,
  width = 104,
  height = 30,
  baseline = false,
}: SparklineProps) {
  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const x = (i: number) => (i / (values.length - 1)) * (width - 2) + 1;
  const y = (v: number) => height - 2 - ((v - min) / span) * (height - 4);

  const line = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i)} ${y(v)}`).join(' ');

  return (
    <svg width={width} height={height} aria-hidden="true" className="shrink-0">
      {baseline && (
        <line
          x1={0}
          x2={width}
          y1={y(values[0])}
          y2={y(values[0])}
          stroke="#27384f"
          strokeDasharray="2 3"
        />
      )}
      <path
        d={`${line} L${x(values.length - 1)} ${height} L${x(0)} ${height} Z`}
        fill={color}
        opacity={0.12}
      />
      <path d={line} fill="none" stroke={color} strokeWidth={1.75} strokeLinecap="round" />
      <circle cx={x(values.length - 1)} cy={y(values[values.length - 1])} r={2.5} fill={color} />
    </svg>
  );
}
