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
import { InfoTip } from "@/components/ui/info-tip";
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
      {
        label: "Makespan",
        value: `${result.makespan}h`,
        tone: "primary",
        sub: "duração da parada",
        help: "Duração total da parada, do começo ao fim — a janela em que a unidade fica fora de operação. O otimizador busca deixá-la a menor possível.",
      },
      {
        label: "Caminho crítico",
        value: `${result.criticalPathLB}h`,
        sub: "mínimo teórico",
        help: "A menor duração possível se houvesse equipe e guindaste ilimitados. É o piso teórico: nenhum cronograma consegue ser mais curto que isto.",
      },
      {
        label: "Folga de recurso",
        value: `${gapLb.toFixed(1)}%`,
        sub: "acima do mínimo",
        help: "Quanto a parada real passa do mínimo teórico por causa de equipes e guindaste limitados. Quanto menor, mais enxuto está o plano.",
      },
      {
        label: "Atividades críticas",
        value: critical - 2,
        tone: "critical",
        sub: "sem folga",
        help: "Tarefas que não têm folga nenhuma. Atrasar qualquer uma delas empurra a data de partida da unidade inteira.",
      },
      {
        label: "Cálculo",
        value: `${(result.elapsedMs / 1000).toFixed(1)}s`,
        sub: `${result.iterations.toLocaleString()} tentativas`,
        help: "Tempo que o otimizador levou e quantos cronogramas ele testou para chegar a este resultado, tudo no seu navegador.",
      },
      {
        label: "P80",
        value: monteCarlo ? `${Math.round(monteCarlo.p80)}h` : "—",
        tone: "accent",
        sub: monteCarlo ? "80% de chance" : "rode a simulação",
        help: "Prazo com 80% de chance de ser cumprido, considerando que as tarefas variam de duração. Planejar pela duração 'seca' costuma dar bem menos de 50% de chance. Disponível após rodar a simulação de risco.",
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
            <h1 className="flex items-center gap-1.5 text-lg font-semibold tracking-tight">
              Critpath
              <span className="ml-1 font-normal text-muted-foreground">
                otimizador de parada de manutenção
              </span>
              <InfoTip side="bottom" label="O que este app faz">
                Uma parada de manutenção é quando uma unidade industrial é desligada para
                reparos. Este app monta o cronograma que deixa a unidade parada o menor tempo
                possível — respeitando equipes, o guindaste único e as tarefas que só podem
                acontecer em ordem — e ainda estima o risco da data e quando trocar cada peça.
              </InfoTip>
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

function EmptyState({ solving }: Readonly<{ solving: boolean }>) {
  return (
    <div className="grid place-items-center rounded-xl border border-dashed border-border bg-card/40 py-16 text-center">
      <div className="max-w-lg space-y-2">
        <h2 className="text-base font-medium">
          {solving ? "Montando o melhor cronograma…" : "Pronto para começar"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {solving
            ? "O otimizador está testando milhares de cronogramas para achar o que deixa a unidade parada o menor tempo possível. Roda todo no seu navegador, sem travar a página."
            : "Escolha um projeto acima e clique em Otimizar. O app encontra a ordem das tarefas que minimiza o tempo de parada, respeitando o tamanho das equipes e o guindaste único — e destaca o caminho crítico, o que decide a data de partida."}
        </p>
      </div>
    </div>
  );
}
