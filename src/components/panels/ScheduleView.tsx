"use client";
import * as React from "react";
import type { RcpspProject } from "@/lib/rcpsp/types";
import type { SolveResult } from "@/lib/engine/types";
import { buildScheduledActivities, buildResourceProfiles } from "@/lib/rcpsp/schedule";
import { GanttChart } from "@/components/charts/GanttChart";
import { ResourceProfiles } from "@/components/charts/ResourceProfiles";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn, criticalBg } from "@/lib/utils";

export function ScheduleView({ project, result }: { project: RcpspProject; result: SolveResult }) {
  const activities = React.useMemo(
    () => buildScheduledActivities(project, result),
    [project, result],
  );
  const profiles = React.useMemo(() => buildResourceProfiles(project, result), [project, result]);
  const rows = React.useMemo(
    () => activities.filter((a) => a.label !== "start" && a.label !== "end"),
    [activities],
  );

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <Card className="min-w-0 xl:col-span-2">
        <CardHeader>
          <CardTitle>Cronograma com nivelamento de recursos</CardTitle>
          <CardDescription>
            Serial SGS sobre a activity list otimizada. Barras vermelhas formam o caminho crítico.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GanttChart activities={activities} makespan={result.makespan} resources={profiles} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Carga por recurso</CardTitle>
          <CardDescription>Histograma de uso vs. capacidade; gargalos em vermelho.</CardDescription>
        </CardHeader>
        <CardContent>
          <ResourceProfiles profiles={profiles} makespan={result.makespan} />
        </CardContent>
      </Card>

      <Card className="min-w-0 xl:col-span-3">
        <CardHeader>
          <CardTitle>Ordens da parada</CardTitle>
          <CardDescription>
            {rows.length} atividades · {rows.filter((a) => a.isCritical).length} no caminho crítico
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className="scrollbar-thin max-h-80 overflow-auto"
            role="region"
            aria-label="Tabela de ordens da parada"
            tabIndex={0}
          >
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-card text-muted-foreground">
                <tr className="border-b border-border text-left">
                  <th className="py-1.5 pr-2 font-medium">Atividade</th>
                  <th className="px-2 py-1.5 text-right font-medium">Início</th>
                  <th className="px-2 py-1.5 text-right font-medium">Fim</th>
                  <th className="px-2 py-1.5 text-right font-medium">Dur.</th>
                  <th className="px-2 py-1.5 text-right font-medium">Folga T.</th>
                  <th className="px-2 py-1.5 text-right font-medium">Folga L.</th>
                  <th className="px-2 py-1.5 text-left font-medium">Recursos</th>
                </tr>
              </thead>
              <tbody className="tabular">
                {rows.map((a) => (
                  <tr key={a.id} className="border-b border-border/50 hover:bg-secondary/40">
                    <td className="py-1.5 pr-2">
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className={cn(
                            "size-1.5 rounded-full",
                            criticalBg(a.isCritical),
                          )}
                        />
                        {a.label}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-right">{a.start}</td>
                    <td className="px-2 py-1.5 text-right">{a.finish}</td>
                    <td className="px-2 py-1.5 text-right">{a.duration}</td>
                    <td
                      className={cn(
                        "px-2 py-1.5 text-right",
                        a.isCritical && "font-medium text-[var(--critical)]",
                      )}
                    >
                      {a.totalSlack}
                    </td>
                    <td className="px-2 py-1.5 text-right text-muted-foreground">{a.freeSlack}</td>
                    <td className="px-2 py-1.5 text-left text-muted-foreground">
                      {project.activities[a.id].demands
                        .map((d, k) => (d > 0 ? `${project.resources[k].id}·${d}` : null))
                        .filter(Boolean)
                        .join("  ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
