import { useMemo } from 'react';

const SAFETY_AXES = [
  { key: 'overall', label: 'Overall' },
  { key: 'women', label: 'Women' },
  { key: 'lgbtq', label: 'LGBTQ+' },
  { key: 'night', label: 'Night' },
  { key: 'solo', label: 'Solo' },
  { key: 'transport', label: 'Transport' },
];

const SafetyScoreRadar = ({ scores = {}, size = 260 }) => {
  const axes = SAFETY_AXES.filter(a => {
    const v = scores[a.key] ?? scores[`${a.key}_score`];
    return v != null;
  });

  if (axes.length < 3) {
    return (
      <div className="flex items-center justify-center h-32 text-sm text-base-content/40">
        Not enough safety data available
      </div>
    );
  }

  const data = axes.map(a => {
    const raw = scores[a.key] ?? scores[`${a.key}_score`] ?? 0;
    // Scores can be 0–10 or 0–100; normalise to 0–100
    const norm = raw > 10 ? raw : raw * 10;
    return { label: a.label, value: Math.min(100, Math.max(0, Math.round(norm))) };
  });

  const center = size / 2;
  const radius = (size - 64) / 2;
  const levels = 5;
  const angleStep = (2 * Math.PI) / data.length;

  const dataPoints = data.map((d, i) => {
    const angle = i * angleStep - Math.PI / 2;
    const r = (d.value / 100) * radius;
    return { x: center + r * Math.cos(angle), y: center + r * Math.sin(angle) };
  });

  const axisEndPoints = data.map((_, i) => {
    const angle = i * angleStep - Math.PI / 2;
    return { x: center + radius * Math.cos(angle), y: center + radius * Math.sin(angle) };
  });

  const gridPolygons = useMemo(() => {
    const grids = [];
    for (let l = 1; l <= levels; l++) {
      const r = (l / levels) * radius;
      const pts = data.map((_, i) => {
        const angle = i * angleStep - Math.PI / 2;
        return `${center + r * Math.cos(angle)},${center + r * Math.sin(angle)}`;
      });
      grids.push(pts.join(' '));
    }
    return grids;
  }, [center, radius, data, angleStep]);

  const pathD = dataPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} className="overflow-visible">
        {/* Grid rings */}
        {gridPolygons.map((pts, i) => (
          <polygon key={`g-${i}`} points={pts} fill="none" stroke="#e2e8f0" strokeWidth="1" />
        ))}
        {/* Axes */}
        {axisEndPoints.map((p, i) => (
          <line key={`a-${i}`} x1={center} y1={center} x2={p.x} y2={p.y} stroke="#e2e8f0" strokeWidth="1" />
        ))}
        {/* Data area */}
        <path d={pathD} fill="rgba(239,68,68,0.15)" stroke="#ef4444" strokeWidth="2.5" strokeLinejoin="round" />
        {/* Data points */}
        {dataPoints.map((p, i) => (
          <circle key={`pt-${i}`} cx={p.x} cy={p.y} r="5" fill="#ef4444" stroke="#fff" strokeWidth="2" />
        ))}
        {/* Labels */}
        {data.map((d, i) => {
          const angle = i * angleStep - Math.PI / 2;
          const lr = radius + 28;
          const lx = center + lr * Math.cos(angle);
          const ly = center + lr * Math.sin(angle);
          const anchor = Math.cos(angle) > 0.1 ? 'start' : Math.cos(angle) < -0.1 ? 'end' : 'middle';
          return (
            <text key={`l-${i}`} x={lx} y={ly} textAnchor={anchor} dominantBaseline="middle"
              className="text-xs font-bold fill-slate-500" fontSize="11">
              {d.label} ({d.value})
            </text>
          );
        })}
      </svg>
    </div>
  );
};

export default SafetyScoreRadar;
