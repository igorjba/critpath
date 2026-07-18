"use client";
import * as React from "react";
import { fitWeibull } from "@/lib/engine/client";
import type { WeibullFit } from "@/lib/engine/types";
import { sealLifeSample } from "@/lib/data/reliability";
import { optimizeInterval } from "@/lib/weibull/interval";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StatBox } from "@/components/ui/stat";
import { InfoTip } from "@/components/ui/info-tip";
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
            <CardTitle className="flex items-center gap-1.5">
              Vida útil do equipamento
              <InfoTip label="O que é o ajuste de Weibull">
                Weibull é a curva estatística que descreve quanto tempo uma peça dura até falhar. O
                ajuste é <strong>censurado</strong> porque a maioria das peças ainda não falhou — só
                sabemos que sobreviveram até agora. Ignorar isso subestimaria a vida real.
              </InfoTip>
            </CardTitle>
            <CardDescription>{sealLifeSample.name}</CardDescription>
          </CardHeader>
          <CardContent>
            {fit ? (
              <dl className="grid grid-cols-2 gap-2 text-sm tabular">
                <StatBox
                  label="Forma (k)"
                  value={fit.shape.toFixed(2)}
                  tone="primary"
                  help="Como a peça falha. Menor que 1 = falhas aleatórias (não envelhece). Maior que 1 = desgaste: quanto mais velha, maior a chance de falhar."
                />
                <StatBox
                  label="Escala (η)"
                  value={`${Math.round(fit.scale)} h`}
                  help="Vida característica: a idade em que cerca de 63% das peças já falharam."
                />
                <StatBox
                  label="MTTF"
                  value={interval ? `${Math.round(interval.mttf)} h` : "—"}
                  help="Tempo médio até falhar (Mean Time To Failure)."
                />
                <StatBox
                  label="Falhas"
                  value={`${fit.failures}/${fit.total}`}
                  help="Quantas peças de fato falharam, de todas as observadas. As demais ainda estão em operação (dados censurados)."
                />
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
                <span className="inline-flex items-center gap-1">
                  Falha ÷ preventiva
                  <InfoTip label="O que é a razão falha ÷ preventiva">
                    Quantas vezes uma falha inesperada custa mais que uma troca preventiva
                    programada (parada de emergência, dano secundário, produção perdida). Quanto
                    maior, mais compensa antecipar a manutenção.
                  </InfoTip>
                </span>
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
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  Intervalo ótimo
                  <InfoTip label="O que é o intervalo ótimo">
                    De quanto em quanto tempo trocar a peça para gastar menos no total. Cedo demais
                    desperdiça vida útil; tarde demais arrisca a falha cara. O ponto ótimo é o vale
                    da curva de custo ao lado.
                  </InfoTip>
                </div>
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
