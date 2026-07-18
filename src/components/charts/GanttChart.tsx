"use client";
import * as React from "react";
import type { ScheduledActivity, ResourceProfile } from "@/lib/rcpsp/schedule";
import { cn, criticalBg } from "@/lib/utils";
import { Lock, ArrowUpFromLine } from "lucide-react";

interface Props {
  activities: ScheduledActivity[];
  makespan: number;
  resources: ResourceProfile[];
}

const ROW_H = 26;

export function GanttChart({ activities, makespan }: Props) {
  const rows = React.useMemo(
    () =>
      activities
        .filter((a) => a.label !== "start" && a.label !== "end")
        .sort((a, b) => a.start - b.start || a.ls - b.ls),
    [activities],
  );
  const [hover, setHover] = React.useState<{ a: ScheduledActivity; x: number; y: number } | null>(
    null,
  );

  const T = Math.max(1, makespan);
  const ticks = React.useMemo(() => niceTicks(T, 8), [T]);
  const pct = (v: number) => `${(v / T) * 100}%`;

  return (
    <div className="relative">
      {/* eixo de tempo */}
      <div className="grid" style={{ gridTemplateColumns: "minmax(160px, 220px) 1fr" }}>
        <div className="text-[11px] font-medium text-muted-foreground pb-1 pl-1">Atividade</div>
        <div className="relative h-5 border-b border-border">
          {ticks.map((t) => (
            <div
              key={t}
              className="absolute top-0 h-full text-[10px] text-muted-foreground tabular"
              style={{ left: pct(t), transform: "translateX(-50%)" }}
            >
              {t}h
            </div>
          ))}
        </div>
      </div>

      <div
        className="scrollbar-thin max-h-[460px] overflow-y-auto overflow-x-hidden"
        role="region"
        aria-label="Linha do tempo das atividades"
        tabIndex={0}
      >
        {rows.map((a) => (
          <div
            key={a.id}
            className="grid items-center hover:bg-secondary/40"
            style={{ gridTemplateColumns: "minmax(160px, 220px) 1fr", height: ROW_H }}
          >
            <div className="flex items-center gap-1.5 pr-2 pl-1 min-w-0">
              <span
                className={cn(
                  "size-1.5 shrink-0 rounded-full",
                  criticalBg(a.isCritical),
                )}
              />
              <span className="truncate text-xs text-foreground/90" title={a.label}>
                {a.label}
              </span>
              {a.confinedSpace && <Lock className="size-3 shrink-0 text-[var(--chart-5)]" />}
              {a.requiresCrane && (
                <ArrowUpFromLine className="size-3 shrink-0 text-primary" />
              )}
            </div>

            <div className="relative h-full">
              {/* grade */}
              {ticks.map((t) => (
                <div
                  key={t}
                  className="absolute top-0 h-full w-px bg-border/40"
                  style={{ left: pct(t) }}
                />
              ))}
              {/* folga total (extensão discreta), limitada ao horizonte */}
              {a.totalSlack > 0 && a.finish < T && (
                <div
                  className="absolute top-1/2 -translate-y-1/2 h-1 rounded-full bg-[var(--slack)]/30"
                  style={{ left: pct(a.finish), width: pct(Math.min(a.totalSlack, T - a.finish)) }}
                />
              )}
              {/* barra da atividade */}
              <button
                className={cn(
                  "absolute top-1/2 -translate-y-1/2 h-[14px] rounded-[4px] ring-1 ring-inset ring-background/20 transition-[filter] hover:brightness-110",
                  criticalBg(a.isCritical),
                )}
                style={{ left: pct(a.start), width: `max(3px, ${(a.duration / T) * 100}%)` }}
                onMouseEnter={(e) =>
                  setHover({ a, x: e.clientX, y: e.clientY })
                }
                onMouseMove={(e) => setHover({ a, x: e.clientX, y: e.clientY })}
                onMouseLeave={() => setHover(null)}
                aria-label={a.label}
              />
            </div>
          </div>
        ))}
      </div>

      {/* legenda */}
      <div className="flex flex-wrap items-center gap-4 pt-3 text-[11px] text-muted-foreground">
        <LegendDot className="bg-[var(--critical)]" label="Caminho crítico" />
        <LegendDot className="bg-[var(--chart-2)]" label="Com folga" />
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1 w-5 rounded-full bg-[var(--slack)]/40" /> Folga total
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Lock className="size-3 text-[var(--chart-5)]" /> Espaço confinado
        </span>
        <span className="inline-flex items-center gap-1.5">
          <ArrowUpFromLine className="size-3 text-primary" /> Guindaste
        </span>
      </div>

      {hover && <GanttTooltip {...hover} />}
    </div>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("size-2.5 rounded-[3px]", className)} />
      {label}
    </span>
  );
}

function GanttTooltip({ a, x, y }: { a: ScheduledActivity; x: number; y: number }) {
  return (
    <div
      className="pointer-events-none fixed z-50 w-56 rounded-lg border border-border bg-popover p-2.5 text-xs shadow-xl"
      style={{ left: Math.min(x + 14, window.innerWidth - 240), top: y + 14 }}
    >
      <div className="mb-1.5 flex items-center gap-1.5 font-medium">
        <span
          className={cn(
            "size-2 rounded-full",
            criticalBg(a.isCritical),
          )}
        />
        {a.label}
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-0.5 tabular text-muted-foreground">
        <dt>Início</dt>
        <dd className="text-right text-foreground">{a.start}h</dd>
        <dt>Término</dt>
        <dd className="text-right text-foreground">{a.finish}h</dd>
        <dt>Duração</dt>
        <dd className="text-right text-foreground">{a.duration}h</dd>
        <dt>Folga total</dt>
        <dd className="text-right text-foreground">{a.totalSlack}h</dd>
        <dt>Folga livre</dt>
        <dd className="text-right text-foreground">{a.freeSlack}h</dd>
      </dl>
      {a.isCritical && (
        <div className="mt-1.5 text-[10px] font-medium text-[var(--critical)]">
          No caminho crítico — atraso empurra a partida.
        </div>
      )}
    </div>
  );
}

// Ticks "redondos" para o eixo de tempo.
function niceTicks(max: number, count: number): number[] {
  const raw = max / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm >= 5 ? 5 : norm >= 2 ? 2 : 1) * mag;
  const out: number[] = [];
  for (let t = 0; t <= max; t += step) out.push(Math.round(t));
  return out;
}
