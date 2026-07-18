"use client";
import * as React from "react";
import type { RcpspProject } from "@/lib/rcpsp/types";
import type { SolveResult } from "@/lib/engine/types";
import { buildScheduledActivities, buildResourceProfiles } from "@/lib/rcpsp/schedule";
import { GanttChart } from "@/components/charts/GanttChart";
import { ResourceProfiles } from "@/components/charts/ResourceProfiles";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { InfoTip } from "@/components/ui/info-tip";
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
          <CardTitle className="flex items-center gap-1.5">
            Cronograma da parada
            <InfoTip label="Como ler o Gantt">
              Cada barra é uma tarefa posicionada no tempo (eixo horizontal, em horas). As barras
              <strong className="text-[var(--critical)]"> vermelhas</strong> são o caminho crítico:
              a corrente de tarefas que define a data de partida. A linha fina após uma barra é a
              folga — quanto ela pode atrasar sem afetar o fim.
            </InfoTip>
          </CardTitle>
          <CardDescription>
            Ordem de execução que minimiza o tempo de parada, respeitando equipes e o guindaste.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GanttChart activities={activities} makespan={result.makespan} resources={profiles} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            Carga por recurso
            <InfoTip label="O que é carga por recurso">
              Mostra quantas pessoas ou equipamentos de cada tipo estão em uso ao longo do tempo,
              contra o total disponível (linha tracejada). Quando o uso fica colado no teto boa
              parte do tempo, aquele recurso é o <strong>gargalo</strong> — mostrado em vermelho.
            </InfoTip>
          </CardTitle>
          <CardDescription>Uso de cada equipe/equipamento vs. o que existe disponível.</CardDescription>
        </CardHeader>
        <CardContent>
          <ResourceProfiles profiles={profiles} makespan={result.makespan} />
        </CardContent>
      </Card>

      <Card className="min-w-0 xl:col-span-3">
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            Ordens da parada
            <InfoTip label="O que são as colunas de folga">
              <strong>Folga total</strong>: quanto a tarefa pode atrasar sem empurrar a data de
              partida da unidade (folga zero = está no caminho crítico).{" "}
              <strong>Folga livre</strong>: quanto pode atrasar sem sequer mexer no início das
              tarefas seguintes.
            </InfoTip>
          </CardTitle>
          <CardDescription>
            {rows.length} atividades · {rows.filter((a) => a.isCritical).length} no caminho crítico
            (sem folga)
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
