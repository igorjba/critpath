"use client";
import * as React from "react";
import { Save, Trash2, GitCompare } from "lucide-react";
import { useApp } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { saveScenario, listScenarios, deleteScenario, type Scenario } from "@/lib/db/scenarios";
import { cn } from "@/lib/utils";

export function ScenariosBar() {
  const { result, monteCarlo, sourceLabel, iterations } = useApp();
  const [scenarios, setScenarios] = React.useState<Scenario[]>([]);

  const refresh = React.useCallback(() => {
    listScenarios().then(setScenarios).catch(() => {});
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const save = async () => {
    if (!result) return;
    await saveScenario({
      name: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      source: sourceLabel,
      makespan: result.makespan,
      lb: result.criticalPathLB,
      iterations,
      elapsedMs: result.elapsedMs,
      p80: monteCarlo ? Math.round(monteCarlo.p80) : null,
    });
    refresh();
  };

  const remove = async (id?: number) => {
    if (id == null) return;
    await deleteScenario(id);
    refresh();
  };

  const best = scenarios.length ? Math.min(...scenarios.map((s) => s.makespan)) : null;

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <GitCompare className="size-3.5" /> Cenários salvos ({scenarios.length})
        </div>
        <Button variant="outline" size="sm" onClick={save} disabled={!result}>
          <Save /> Salvar atual
        </Button>
      </div>
      {scenarios.length === 0 ? (
        <p className="py-2 text-center text-xs text-muted-foreground">
          Salve execuções para comparar makespan, esforço e P80 lado a lado.
        </p>
      ) : (
        <div
          className="scrollbar-thin max-h-40 overflow-auto"
          role="region"
          aria-label="Cenários salvos"
          tabIndex={0}
        >
          <table className="w-full text-xs">
            <thead className="text-muted-foreground">
              <tr className="border-b border-border text-left">
                <th className="py-1 pr-2 font-medium">Cenário</th>
                <th className="px-2 py-1 text-left font-medium">Origem</th>
                <th className="px-2 py-1 text-right font-medium">Makespan</th>
                <th className="px-2 py-1 text-right font-medium">LB</th>
                <th className="px-2 py-1 text-right font-medium">Esforço</th>
                <th className="px-2 py-1 text-right font-medium">P80</th>
                <th className="px-2 py-1" />
              </tr>
            </thead>
            <tbody className="tabular">
              {scenarios.map((s) => (
                <tr key={s.id} className="border-b border-border/50">
                  <td className="py-1 pr-2">{s.name}</td>
                  <td className="max-w-[180px] truncate px-2 py-1 text-muted-foreground">
                    {s.source}
                  </td>
                  <td
                    className={cn(
                      "px-2 py-1 text-right font-medium",
                      s.makespan === best && "text-primary",
                    )}
                  >
                    {s.makespan}h
                  </td>
                  <td className="px-2 py-1 text-right text-muted-foreground">{s.lb}h</td>
                  <td className="px-2 py-1 text-right text-muted-foreground">
                    {s.iterations.toLocaleString()}
                  </td>
                  <td className="px-2 py-1 text-right text-muted-foreground">
                    {s.p80 != null ? `${s.p80}h` : "—"}
                  </td>
                  <td className="px-2 py-1 text-right">
                    <button
                      onClick={() => remove(s.id)}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label="Remover"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
