"use client";
import * as React from "react";
import { fitWeibull } from "@/lib/engine/client";
import type { WeibullFit } from "@/lib/engine/types";
import { sealLifeSample } from "@/lib/data/reliability";
import { optimizeInterval } from "@/lib/weibull/interval";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StatBox } from "@/components/ui/stat";
import { WeibullChart } from "@/components/charts/WeibullChart";

export function ReliabilityView() {
  const [fit, setFit] = React.useState<WeibullFit | null>(null);
  const [cfRatio, setCfRatio] = React.useState(8);
  const cp = 1; // custo de preventiva normalizado; o que importa é a razão falha/preventiva

  React.useEffect(() => {
    let alive = true;
    fitWeibull({ times: sealLifeSample.times, censored: sealLifeSample.censored }).then((f) => {
      if (alive) setFit(f);
    });
    return () => {
      alive = false;
    };
  }, []);

  const interval = React.useMemo(() => {
    if (!fit || !Number.isFinite(fit.shape)) return null;
    return optimizeInterval(fit.shape, fit.scale, cp, cp * cfRatio);
  }, [fit, cp, cfRatio]);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-1">
        <Card>
          <CardHeader>
            <CardTitle>Ajuste de Weibull (MLE censurado)</CardTitle>
            <CardDescription>{sealLifeSample.name}</CardDescription>
          </CardHeader>
          <CardContent>
            {fit ? (
              <dl className="grid grid-cols-2 gap-2 text-sm tabular">
                <StatBox label="Forma (k)" value={fit.shape.toFixed(2)} tone="primary" />
                <StatBox label="Escala (η)" value={`${Math.round(fit.scale)} h`} />
                <StatBox label="MTTF" value={interval ? `${Math.round(interval.mttf)} h` : "—"} />
                <StatBox label="Falhas" value={`${fit.failures}/${fit.total}`} />
              </dl>
            ) : (
              <div className="h-16 animate-pulse rounded bg-secondary/50" />
            )}
            {fit && (
              <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                {fit.shape > 1
                  ? `k > 1: falha por desgaste — a taxa de risco cresce com o tempo, então a preventiva por idade faz sentido.`
                  : `k ≤ 1: sem desgaste — preventiva por idade não ajuda.`}{" "}
                {fit.total - fit.failures} das {fit.total} unidades estão censuradas (ainda em
                operação).
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Custos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="block">
              <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
                <span>Falha ÷ preventiva</span>
                <span className="tabular text-foreground">{cfRatio}×</span>
              </div>
              <input
                type="range"
                min={2}
                max={30}
                step={1}
                value={cfRatio}
                onChange={(e) => setCfRatio(Number(e.target.value))}
                className="w-full accent-[var(--primary)]"
              />
            </label>
            {interval && (
              <div className="rounded-md border border-primary/30 bg-primary/10 p-2.5">
                <div className="text-[11px] text-muted-foreground">Intervalo ótimo</div>
                <div className="text-2xl font-semibold text-primary tabular">
                  {Math.round(interval.optimalT)} h
                </div>
                <div className="text-[11px] text-muted-foreground">
                  R = {(interval.reliabilityAtOptimal * 100).toFixed(0)}% ·{" "}
                  {(
                    ((interval.runToFailureCost - interval.optimalCost) / interval.runToFailureCost) *
                    100
                  ).toFixed(0)}
                  % mais barato que rodar até a falha
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Intervalo ótimo de manutenção</CardTitle>
          <CardDescription>
            Substituição por idade: custo de preventiva vs. risco de falha ao longo da vida.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {interval ? (
            <WeibullChart result={interval} unit={sealLifeSample.unit} />
          ) : (
            <div className="grid h-64 place-items-center text-sm text-muted-foreground">
              Ajustando…
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
