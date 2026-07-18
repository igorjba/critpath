"use client";
import * as React from "react";
import { Activity, Cpu, GitBranch, Gauge, FlaskConical, Boxes } from "lucide-react";
import { useApp } from "@/lib/store";
import { Controls } from "@/components/panels/Controls";
import { Kpis, type Kpi } from "@/components/Kpis";
import { ScheduleView } from "@/components/panels/ScheduleView";
import { RiskView } from "@/components/panels/RiskView";
import { ReliabilityView } from "@/components/panels/ReliabilityView";
import { BenchmarkView } from "@/components/panels/BenchmarkView";
import { ScenariosBar } from "@/components/panels/ScenariosBar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ThemeToggle";

export function Dashboard() {
  const { project, result, status, monteCarlo, sourceLabel } = useApp();

  const kpis: Kpi[] = React.useMemo(() => {
    if (!result) return [];
    const gapLb =
      result.criticalPathLB > 0
        ? ((result.makespan - result.criticalPathLB) / result.criticalPathLB) * 100
        : 0;
    const critical = result.earliestStart.reduce(
      (n, es, j) => n + (result.latestStart[j] - es === 0 ? 1 : 0),
      0,
    );
    return [
      { label: "Makespan", value: `${result.makespan}h`, tone: "primary", sub: "janela de parada" },
      { label: "Caminho crítico", value: `${result.criticalPathLB}h`, sub: "limite inferior" },
      { label: "Folga de recurso", value: `${gapLb.toFixed(1)}%`, sub: "makespan vs. LB" },
      { label: "Atividades críticas", value: critical - 2, tone: "critical", sub: "folga total zero" },
      {
        label: "Cálculo",
        value: `${(result.elapsedMs / 1000).toFixed(1)}s`,
        sub: `${result.iterations.toLocaleString()} iter.`,
      },
      {
        label: "P80 (Monte Carlo)",
        value: monteCarlo ? `${Math.round(monteCarlo.p80)}h` : "—",
        tone: "accent",
        sub: monteCarlo ? "80% de confiança" : "rode a simulação",
      },
    ];
  }, [result, monteCarlo]);

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-5 lg:px-6">
      <header className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-lg bg-primary/15 text-primary">
            <GitBranch className="size-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">
              critpath
              <span className="ml-2 font-normal text-muted-foreground">
                otimizador de parada de manutenção
              </span>
            </h1>
            <p className="text-xs text-muted-foreground">{sourceLabel}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1.5">
            <Cpu className="size-3" /> motor WASM · Web Worker
          </Badge>
          <Badge variant="outline" className="gap-1.5">
            RCPSP · {project.numJobs - 2} ordens
          </Badge>
          <ThemeToggle />
        </div>
      </header>

      <Controls />

      <div className="mt-4">
        {result ? (
          <Kpis items={kpis} />
        ) : (
          <EmptyState solving={status === "solving"} />
        )}
      </div>

      {result && (
        <div className="mt-4">
          <Tabs defaultValue="schedule">
            <TabsList>
              <TabsTrigger value="schedule">
                <Activity className="size-3.5" /> Cronograma
              </TabsTrigger>
              <TabsTrigger value="risk">
                <Gauge className="size-3.5" /> Risco (Monte Carlo)
              </TabsTrigger>
              <TabsTrigger value="reliability">
                <FlaskConical className="size-3.5" /> Confiabilidade
              </TabsTrigger>
              <TabsTrigger value="benchmark">
                <Boxes className="size-3.5" /> Benchmark
              </TabsTrigger>
            </TabsList>

            <TabsContent value="schedule" className="mt-4">
              <ScheduleView project={project} result={result} />
            </TabsContent>
            <TabsContent value="risk" className="mt-4">
              <RiskView />
            </TabsContent>
            <TabsContent value="reliability" className="mt-4">
              <ReliabilityView />
            </TabsContent>
            <TabsContent value="benchmark" className="mt-4">
              <BenchmarkView />
            </TabsContent>
          </Tabs>

          <div className="mt-4">
            <ScenariosBar />
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({ solving }: { solving: boolean }) {
  return (
    <div className="grid place-items-center rounded-xl border border-dashed border-border bg-card/40 py-16 text-center">
      <div className="max-w-md space-y-2">
        <h2 className="text-base font-medium">
          {solving ? "Otimizando o cronograma…" : "Pronto para otimizar"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {solving
            ? "O motor roda em WebAssembly numa worker thread — sem congelar a página e sem timeout de serverless."
            : "Escolha um projeto e clique em Otimizar. O solver resolve o RCPSP com serial SGS + simulated annealing."}
        </p>
      </div>
    </div>
  );
}
