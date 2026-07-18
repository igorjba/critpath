"use client";
import * as React from "react";
import type { IntervalResult } from "@/lib/weibull/interval";

export function WeibullChart({ result, unit }: { result: IntervalResult; unit: string }) {
  const maxT = result.curve[result.curve.length - 1]?.t ?? 1;
  const yCostMax = Math.min(
    result.optimalCost * 2.5,
    result.curve.reduce((m, p) => (p.cost < Infinity && p.cost > m ? p.cost : m), 0),
  );

  const relPath = linePath(result.curve, (p) => p.t / maxT, (p) => 1 - p.reliability);
  const costPath = linePath(
    result.curve,
    (p) => p.t / maxT,
    (p) => 1 - Math.min(p.cost, yCostMax) / yCostMax,
  );
  const optX = (result.optimalT / maxT) * 100;
  const rtfY = 1 - result.runToFailureCost / yCostMax;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Panel title="Confiabilidade R(t)" sub={`vida característica η, forma k`}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-36 w-full">
          <Grid />
          <path d={relPath} fill="none" stroke="var(--chart-2)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
          <VLine x={optX} color="var(--primary)" />
          <circle
            cx={optX}
            cy={(1 - result.reliabilityAtOptimal) * 100}
            r={2.5}
            fill="var(--primary)"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <AxisRow lo={0} hi={maxT} unit={unit} />
        <div className="mt-1 text-[11px] text-muted-foreground">
          No intervalo ótimo, R = {(result.reliabilityAtOptimal * 100).toFixed(0)}%.
        </div>
      </Panel>

      <Panel title="Custo por hora C(T)" sub="mínimo = intervalo ótimo">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-36 w-full">
          <Grid />
          <line
            x1={0}
            x2={100}
            y1={rtfY * 100}
            y2={rtfY * 100}
            stroke="var(--muted-foreground)"
            strokeWidth={1}
            strokeDasharray="3 3"
            vectorEffect="non-scaling-stroke"
          />
          <path d={costPath} fill="none" stroke="var(--critical)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
          <VLine x={optX} color="var(--primary)" />
        </svg>
        <AxisRow lo={0} hi={maxT} unit={unit} />
        <div className="mt-1 text-[11px] text-muted-foreground">
          Linha tracejada: custo de rodar até a falha. O ótimo economiza{" "}
          <span className="text-foreground">
            {(((result.runToFailureCost - result.optimalCost) / result.runToFailureCost) * 100).toFixed(
              0,
            )}
            %
          </span>
          .
        </div>
      </Panel>
    </div>
  );
}

function Panel({
  title,
  sub,
  children,
}: {
  title: string;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-card/60 p-3">
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-xs font-medium">{title}</span>
        <span className="text-[10px] text-muted-foreground">{sub}</span>
      </div>
      {children}
    </div>
  );
}

function Grid() {
  return (
    <>
      {[25, 50, 75].map((g) => (
        <line
          key={g}
          x1={0}
          x2={100}
          y1={g}
          y2={g}
          stroke="var(--border)"
          strokeWidth={0.5}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </>
  );
}

function VLine({ x, color }: { x: number; color: string }) {
  return (
    <line x1={x} x2={x} y1={0} y2={100} stroke={color} strokeWidth={1} strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
  );
}

function AxisRow({ lo, hi, unit }: { lo: number; hi: number; unit: string }) {
  return (
    <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular">
      <span>{Math.round(lo)}</span>
      <span>
        {Math.round((lo + hi) / 2)} {unit}
      </span>
      <span>{Math.round(hi)}</span>
    </div>
  );
}

function linePath<T>(data: T[], fx: (d: T) => number, fy: (d: T) => number): string {
  return data
    .map((d, i) => `${i === 0 ? "M" : "L"} ${(fx(d) * 100).toFixed(2)} ${(fy(d) * 100).toFixed(2)}`)
    .join(" ");
}
