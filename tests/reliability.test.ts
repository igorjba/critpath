import { describe, it, expect } from "vitest";
import { optimizeInterval } from "@/lib/weibull/interval";
import { sealLifeSample } from "@/lib/data/reliability";
import { fitWeibullInNode } from "./helpers";

describe("confiabilidade", () => {
  it("ajusta Weibull com censura e detecta desgaste (k > 1) na amostra de selos", () => {
    const [k, eta, , failures] = fitWeibullInNode(sealLifeSample.times, sealLifeSample.censored);
    expect(k).toBeGreaterThan(1);
    expect(eta).toBeGreaterThan(0);
    expect(failures).toBe(9); // 9 falhas observadas; as demais estão censuradas
  });

  it("intervalo ótimo é finito e mais barato que rodar até a falha quando há desgaste", () => {
    const r = optimizeInterval(3.2, 11583, 1, 8);
    expect(Number.isFinite(r.optimalT)).toBe(true);
    expect(r.optimalT).toBeGreaterThan(0);
    expect(r.optimalCost).toBeLessThan(r.runToFailureCost);
  });
});
