"use client";
import * as React from "react";
import type { ResourceProfile } from "@/lib/rcpsp/schedule";
import { cn } from "@/lib/utils";

interface Props {
  profiles: ResourceProfile[];
  makespan: number;
}

export function ResourceProfiles({ profiles, makespan }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
      {profiles.map((p) => (
        <ResourceMini key={p.id} profile={p} makespan={makespan} />
      ))}
    </div>
  );
}

function ResourceMini({ profile, makespan }: { profile: ResourceProfile; makespan: number }) {
  const T = Math.max(1, makespan);
  const maxY = Math.max(profile.capacity, profile.peak, 1);
  const bottleneck = profile.saturatedFraction >= 0.3;
  const util = profile.usage.reduce((a, b) => a + b, 0) / (profile.capacity * T);

  // área em degraus (uso constante por unidade de tempo)
  const H = 60;
  const path = React.useMemo(() => {
    const pts: string[] = [`M 0 ${H}`];
    for (let t = 0; t < profile.usage.length; t++) {
      const y = H - (profile.usage[t] / maxY) * H;
      pts.push(`L ${t} ${y}`, `L ${t + 1} ${y}`);
    }
    pts.push(`L ${profile.usage.length} ${H}`, "Z");
    return pts.join(" ");
  }, [profile.usage, maxY]);

  const capY = H - (profile.capacity / maxY) * H;

  return (
    <div className="rounded-lg border border-border bg-card/60 p-2.5">
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-xs font-medium">{profile.label}</span>
        <span
          className={cn(
            "tabular text-[10px]",
            bottleneck ? "text-[var(--critical)]" : "text-muted-foreground",
          )}
        >
          pico {profile.peak}/{profile.capacity}
        </span>
      </div>
      <svg viewBox={`0 0 ${T} ${H}`} preserveAspectRatio="none" className="h-14 w-full">
        <path
          d={path}
          fill={bottleneck ? "var(--critical)" : "var(--chart-2)"}
          fillOpacity={0.35}
        />
        <line
          x1={0}
          x2={T}
          y1={capY}
          y2={capY}
          stroke="var(--muted-foreground)"
          strokeWidth={1}
          strokeDasharray="3 3"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground tabular">
        <span>utilização {(util * 100).toFixed(0)}%</span>
        {bottleneck && <span className="text-[var(--critical)]">gargalo</span>}
      </div>
    </div>
  );
}
