"use client";
import * as React from "react";
import type { MonteCarloResult } from "@/lib/engine/types";

// Histograma da distribuição do makespan + CDF "chance de partir até X".
// Dois eixos-y distintos => dois gráficos separados (nunca dual-axis).
export function MonteCarloChart({ mc }: { mc: MonteCarloResult }) {
  const { bins, maxCount } = React.useMemo(
    () => buildHistogram(mc.samples, mc.min, mc.max),
    [mc.samples, mc.min, mc.max],
  );
  const lo = bins[0]?.x0 ?? mc.min;
  const hi = bins[bins.length - 1]?.x1 ?? mc.max;
  const span = Math.max(1, hi - lo);
  const xPct = (v: number) => `${((v - lo) / span) * 100}%`;

  const markers = [
    { v: mc.deterministic, label: "determinístico", color: "var(--chart-2)" },
    { v: mc.p50, label: "P50", color: "var(--primary)" },
    { v: mc.p80, label: "P80", color: "var(--critical)" },
  ];

  return (
    <div className="space-y-4">
      {/* histograma */}
      <div>
        <div className="mb-1 text-[11px] font-medium text-muted-foreground">
          Distribuição do makespan · {mc.samples.length.toLocaleString()} réplicas
        </div>
        <div className="relative h-40">
          <div className="absolute inset-0 flex items-end gap-px">
            {bins.map((b, i) => (
              <div
                key={i}
                className="flex-1 rounded-t-[3px] bg-[var(--chart-2)]/60"
                style={{ height: `${(b.count / maxCount) * 100}%` }}
                title={`${b.x0}–${b.x1}h: ${b.count}`}
              />
            ))}
          </div>
          {markers.map((m) => (
            <Marker key={m.label} left={xPct(m.v)} color={m.color} label={m.label} value={m.v} />
          ))}
        </div>
        <Axis lo={lo} hi={hi} />
      </div>

      {/* CDF */}
      <CdfChart mc={mc} lo={lo} hi={hi} />
    </div>
  );
}

function CdfChart({ mc, lo, hi }: { mc: MonteCarloResult; lo: number; hi: number }) {
  const sorted = React.useMemo(() => [...mc.samples].sort((a, b) => a - b), [mc.samples]);
  const span = Math.max(1, hi - lo);
  const W = 100;
  const H = 100;
  const path = React.useMemo(() => {
    const n = sorted.length;
    const pts: string[] = [];
    const step = Math.max(1, Math.floor(n / 120));
    for (let i = 0; i < n; i += step) {
      const x = ((sorted[i] - lo) / span) * W;
      const y = H - (i / (n - 1)) * H;
      pts.push(`${pts.length === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`);
    }
    pts.push(`L ${W} 0`);
    return pts.join(" ");
  }, [sorted, lo, span]);

  const p80x = ((mc.p80 - lo) / span) * W;
  const p80y = H - 80;

  return (
    <div>
      <div className="mb-1 text-[11px] font-medium text-muted-foreground">
        Chance de partir até a data
      </div>
      <div className="relative h-32">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-full w-full">
          {[20, 40, 60, 80].map((g) => (
            <line
              key={g}
              x1={0}
              x2={W}
              y1={H - g}
              y2={H - g}
              stroke="var(--border)"
              strokeWidth={0.5}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          <path d={path} fill="none" stroke="var(--primary)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
          <line
            x1={p80x}
            x2={p80x}
            y1={0}
            y2={H}
            stroke="var(--critical)"
            strokeWidth={1}
            strokeDasharray="3 2"
            vectorEffect="non-scaling-stroke"
          />
          <circle cx={p80x} cy={p80y} r={2.5} fill="var(--critical)" vectorEffect="non-scaling-stroke" />
        </svg>
        <div
          className="absolute -translate-x-1/2 text-[10px] font-medium text-[var(--critical)]"
          style={{ left: `${(p80x / W) * 100}%`, top: 2 }}
        >
          P80 = {Math.round(mc.p80)}h
        </div>
      </div>
      <Axis lo={lo} hi={hi} />
    </div>
  );
}

function Marker({
  left,
  color,
  label,
  value,
}: {
  left: string;
  color: string;
  label: string;
  value: number;
}) {
  return (
    <div className="absolute bottom-0 top-0 -translate-x-1/2" style={{ left }}>
      <div className="h-full w-px" style={{ backgroundColor: color }} />
      <div
        className="absolute -top-0.5 left-1 whitespace-nowrap text-[9px] font-medium"
        style={{ color }}
      >
        {label} {Math.round(value)}
      </div>
    </div>
  );
}

function Axis({ lo, hi }: { lo: number; hi: number }) {
  return (
    <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular">
      <span>{Math.round(lo)}h</span>
      <span>{Math.round((lo + hi) / 2)}h</span>
      <span>{Math.round(hi)}h</span>
    </div>
  );
}

// min/max vêm pré-computados (evita Math.min(...samples) com dezenas de milhares de
// argumentos, que estoura a call stack).
function buildHistogram(samples: number[], min: number, max: number) {
  const range = Math.max(1, max - min);
  const nBins = Math.min(36, Math.max(8, range));
  const width = range / nBins;
  const bins = Array.from({ length: nBins }, (_, i) => ({
    x0: Math.round(min + i * width),
    x1: Math.round(min + (i + 1) * width),
    count: 0,
  }));
  for (const s of samples) {
    let idx = Math.floor((s - min) / width);
    if (idx >= nBins) idx = nBins - 1;
    if (idx < 0) idx = 0;
    bins[idx].count++;
  }
  const maxCount = bins.reduce((m, b) => (b.count > m ? b.count : m), 1);
  return { bins, maxCount };
}
