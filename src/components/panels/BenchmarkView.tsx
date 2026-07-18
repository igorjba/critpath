"use client";
import * as React from "react";
import { Play, Loader2, CheckCircle2 } from "lucide-react";
import { psplibInstances } from "@/lib/data/psplib";
import { solveProject } from "@/lib/engine/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn, toneText, type Tone } from "@/lib/utils";

interface Row {
  key: string;
  label: string;
  optimum: number;
  best?: number;
  lb?: number;
  gap?: number;
  ms?: number;
}

export function BenchmarkView() {
  const [rows, setRows] = React.useState<Row[]>(() =>
    psplibInstances.map((i) => ({ key: i.key, label: i.label, optimum: i.optimum })),
  );
  const [running, setRunning] = React.useState(false);
  const [iters, setIters] = React.useState(15000);

  const run = async () => {
    setRunning(true);
    setRows(psplibInstances.map((i) => ({ key: i.key, label: i.label, optimum: i.optimum })));
    for (const inst of psplibInstances) {
      const res = await solveProject(inst.project, { iterations: iters, seed: 12345 });
      const gap = ((res.makespan - inst.optimum) / inst.optimum) * 100;
      setRows((prev) =>
        prev.map((r) =>
          r.key === inst.key
            ? { ...r, best: res.makespan, lb: res.criticalPathLB, gap, ms: res.elapsedMs }
            : r,
        ),
      );
    }
    setRunning(false);
  };

  const done = rows.filter((r) => r.gap != null);
  const meanGap = done.length ? done.reduce((a, r) => a + (r.gap ?? 0), 0) / done.length : null;
  const optimalCount = done.filter((r) => r.gap === 0).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle>Validação no PSPLIB J30</CardTitle>
            <CardDescription>
              Ótimos provados por Demeulemeester &amp; Herroelen. O solver roda no seu navegador; o
              gap é medido, não declarado.
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex flex-col text-[11px] text-muted-foreground">
              <span>
                {iters.toLocaleString()} iter/instância
              </span>
              <input
                type="range"
                min={5000}
                max={40000}
                step={5000}
                value={iters}
                disabled={running}
                onChange={(e) => setIters(Number(e.target.value))}
                className="w-40 accent-[var(--primary)]"
              />
            </label>
            <Button onClick={run} disabled={running}>
              {running ? <Loader2 className="animate-spin" /> : <Play />}
              {running ? "Rodando…" : "Rodar benchmark"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {meanGap != null && (
          <div className="mb-3 flex flex-wrap gap-4 rounded-lg border border-border bg-card/60 p-3 text-sm">
            <Summary label="Instâncias" value={`${done.length}/${rows.length}`} />
            <Summary
              label="Ótimo atingido"
              value={`${optimalCount}/${done.length}`}
              tone="primary"
            />
            <Summary label="Gap médio" value={`${meanGap.toFixed(3)}%`} tone="accent" />
            <Summary
              label="Pior gap"
              value={`${Math.max(...done.map((r) => r.gap ?? 0)).toFixed(2)}%`}
            />
          </div>
        )}
        <div
          className="scrollbar-thin max-h-96 overflow-auto"
          role="region"
          aria-label="Resultados do benchmark PSPLIB J30"
          tabIndex={0}
        >
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-card text-muted-foreground">
              <tr className="border-b border-border text-left">
                <th className="py-1.5 pr-2 font-medium">Instância</th>
                <th className="px-2 py-1.5 text-right font-medium">Ótimo</th>
                <th className="px-2 py-1.5 text-right font-medium">Encontrado</th>
                <th className="px-2 py-1.5 text-right font-medium">CP LB</th>
                <th className="px-2 py-1.5 text-right font-medium">Gap</th>
                <th className="px-2 py-1.5 text-right font-medium">Tempo</th>
              </tr>
            </thead>
            <tbody className="tabular">
              {rows.map((r) => (
                <tr key={r.key} className="border-b border-border/50">
                  <td className="py-1.5 pr-2">{r.label}</td>
                  <td className="px-2 py-1.5 text-right text-muted-foreground">{r.optimum}</td>
                  <td className="px-2 py-1.5 text-right font-medium">{r.best ?? "—"}</td>
                  <td className="px-2 py-1.5 text-right text-muted-foreground">{r.lb ?? "—"}</td>
                  <td
                    className={cn(
                      "px-2 py-1.5 text-right",
                      r.gap === 0 && "text-primary",
                      r.gap != null && r.gap > 0 && "text-[var(--critical)]",
                    )}
                  >
                    {r.gap != null ? (
                      r.gap === 0 ? (
                        <span className="inline-flex items-center gap-1 justify-end">
                          <CheckCircle2 className="size-3" /> 0%
                        </span>
                      ) : (
                        `${r.gap.toFixed(2)}%`
                      )
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-right text-muted-foreground">
                    {r.ms != null ? `${(r.ms / 1000).toFixed(1)}s` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function Summary({
  label,
  value,
  tone,
}: Readonly<{ label: string; value: string; tone?: Tone }>) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("text-lg font-semibold tabular", toneText(tone))}>{value}</div>
    </div>
  );
}
