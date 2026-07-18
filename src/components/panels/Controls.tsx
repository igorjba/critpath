"use client";
import * as React from "react";
import { Play, Square } from "lucide-react";
import { useApp } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { turnaroundSample } from "@/lib/data/turnaround";
import { psplibInstances } from "@/lib/data/psplib";
import { ImportDialog } from "./ImportDialog";

export function Controls() {
  const {
    status,
    iterations,
    setIterations,
    solve,
    cancel,
    progress,
    loadProject,
    sourceKey,
    sourceLabel,
  } = useApp();
  const solving = status === "solving";

  const onSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value;
    if (v === "import") return; // origem importada: mantida, não recarrega
    if (v === "turnaround") {
      loadProject(turnaroundSample(), "Parada CDU (exemplo)", "turnaround");
      return;
    }
    const inst = psplibInstances.find((i) => i.key === v);
    if (inst) loadProject(inst.project, `PSPLIB ${inst.label} · ótimo ${inst.optimum}`, inst.key);
  };

  const gapToLb =
    progress && progress.criticalPathLB > 0
      ? ((progress.best - progress.criticalPathLB) / progress.criticalPathLB) * 100
      : null;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 lg:flex-row lg:items-end lg:justify-between">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-muted-foreground">Projeto</span>
          <select
            onChange={onSelect}
            value={sourceKey}
            className="h-9 min-w-[240px] rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {sourceKey === "import" && (
              <optgroup label="Importado">
                <option value="import">{sourceLabel}</option>
              </optgroup>
            )}
            <optgroup label="Manutenção">
              <option value="turnaround">Parada CDU (exemplo)</option>
            </optgroup>
            <optgroup label="PSPLIB J30 (benchmark)">
              {psplibInstances.map((i) => (
                <option key={i.key} value={i.key}>
                  {i.label} · ótimo {i.optimum}
                </option>
              ))}
            </optgroup>
          </select>
        </label>

        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-muted-foreground">Fonte de dados</span>
          <ImportDialog />
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-muted-foreground">
            Esforço de busca: <span className="tabular text-foreground">{iterations.toLocaleString()}</span> iterações
          </span>
          <input
            type="range"
            min={5000}
            max={120000}
            step={5000}
            value={iterations}
            disabled={solving}
            onChange={(e) => setIterations(Number(e.target.value))}
            className="h-9 w-56 accent-[var(--primary)]"
          />
        </label>
      </div>

      <div className="flex items-center gap-3">
        {solving && progress && (
          <div className="flex flex-col items-end text-[11px] text-muted-foreground">
            <span className="tabular">
              melhor <span className="text-primary font-medium">{progress.best}h</span>
              {gapToLb != null && <> · {gapToLb.toFixed(1)}% do LB</>}
            </span>
            <div className="mt-1 h-1.5 w-40 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full bg-primary transition-[width]"
                style={{ width: `${(progress.iteration / progress.totalIterations) * 100}%` }}
              />
            </div>
          </div>
        )}
        {solving ? (
          <Button variant="destructive" onClick={cancel}>
            <Square /> Parar
          </Button>
        ) : (
          <Button onClick={solve}>
            <Play /> Otimizar
          </Button>
        )}
      </div>

      <span className="sr-only">{sourceLabel}</span>
    </div>
  );
}
