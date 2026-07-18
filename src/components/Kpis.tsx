"use client";
import * as React from "react";
import { cn, toneText, type Tone } from "@/lib/utils";
import { InfoTip } from "@/components/ui/info-tip";

export interface Kpi {
  label: string;
  value: React.ReactNode;
  sub?: string;
  tone?: Tone;
  help?: React.ReactNode;
}

export function Kpis({ items }: Readonly<{ items: readonly Kpi[] }>) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      {items.map((k) => (
        <div key={k.label} className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground">
            {k.label}
            {k.help && <InfoTip label={`O que é ${k.label}`}>{k.help}</InfoTip>}
          </div>
          <div className={cn("mt-1 text-2xl font-semibold tabular leading-none", toneText(k.tone))}>
            {k.value}
          </div>
          {k.sub && <div className="mt-1 text-[11px] text-muted-foreground">{k.sub}</div>}
        </div>
      ))}
    </div>
  );
}
