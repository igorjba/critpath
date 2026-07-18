"use client";
import * as React from "react";
import { Dices, Loader2 } from "lucide-react";
import { useApp } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StatBox } from "@/components/ui/stat";
import { MonteCarloChart } from "@/components/charts/MonteCarloChart";

export function RiskView() {
  const { monteCarlo, mcStatus, runMonteCarlo, result } = useApp();
  const [trials, setTrials] = React.useState(5000);
  const [spread, setSpread] = React.useState(30);
  const running = mcStatus === "running";

  const run = () =>
    runMonteCarlo(trials, { low: 0.1, high: spread / 100 });

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Simulação de Monte Carlo</CardTitle>
          <CardDescription>
            Duração PERT-beta por atividade, propagada pela mesma sequência ótima. A pergunta da
            diretoria não é uma data — é P50/P80.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {monteCarlo ? (
            <MonteCarloChart mc={monteCarlo} />
          ) : (
            <div className="grid h-64 place-items-center text-sm text-muted-foreground">
              {running ? "Simulando…" : "Configure e rode a simulação."}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Parâmetros</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="block">
              <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
                <span>Réplicas</span>
                <span className="tabular text-foreground">{trials.toLocaleString()}</span>
              </div>
              <input
                type="range"
                min={1000}
                max={20000}
                step={1000}
                value={trials}
                onChange={(e) => setTrials(Number(e.target.value))}
                className="w-full accent-[var(--primary)]"
              />
            </label>
            <label className="block">
              <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
                <span>Cauda pessimista</span>
                <span className="tabular text-foreground">+{spread}%</span>
              </div>
              <input
                type="range"
                min={10}
                max={80}
                step={5}
                value={spread}
                onChange={(e) => setSpread(Number(e.target.value))}
                className="w-full accent-[var(--primary)]"
              />
            </label>
            <Button onClick={run} disabled={running || !result} className="w-full">
              {running ? <Loader2 className="animate-spin" /> : <Dices />}
              {running ? "Simulando…" : "Rodar simulação"}
            </Button>
          </CardContent>
        </Card>

        {monteCarlo && (
          <Card>
            <CardHeader>
              <CardTitle>Percentis da partida</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-2 text-sm tabular">
                <StatBox label="Determinístico" value={`${monteCarlo.deterministic}h`} />
                <StatBox label="Média" value={`${monteCarlo.mean.toFixed(1)}h`} />
                <StatBox label="P50" value={`${Math.round(monteCarlo.p50)}h`} tone="primary" />
                <StatBox label="P80" value={`${Math.round(monteCarlo.p80)}h`} tone="critical" />
                <StatBox label="P90" value={`${Math.round(monteCarlo.p90)}h`} />
                <StatBox label="Desvio" value={`±${monteCarlo.std.toFixed(1)}h`} />
              </dl>
              <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                Planejar pelo determinístico ({monteCarlo.deterministic}h) dá ~
                {pctBelow(monteCarlo, monteCarlo.deterministic)}% de chance de cumprir. Para 80% de
                confiança, reserve {Math.round(monteCarlo.p80)}h.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function pctBelow(mc: { samples: number[] }, x: number): number {
  const n = mc.samples.length;
  const below = mc.samples.reduce((c, v) => c + (v <= x ? 1 : 0), 0);
  return Math.round((below / n) * 100);
}
