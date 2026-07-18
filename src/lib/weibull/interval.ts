// Otimização de intervalo de manutenção — política de substituição por idade.
//
// Dada uma vida útil Weibull(k, eta) e a razão entre custo de falha (cf) e custo de
// preventiva (cp), o custo por unidade de tempo de substituir na idade T é
//   C(T) = [cp·R(T) + cf·(1-R(T))] / ∫₀ᵀ R(t) dt,   R(t) = exp(-(t/eta)^k)
// Preventiva cedo demais desperdiça vida; tarde demais paga falhas. O mínimo é o ótimo.

export interface IntervalPoint {
  t: number;
  cost: number;
  reliability: number;
}

export interface IntervalResult {
  curve: IntervalPoint[];
  optimalT: number;
  optimalCost: number;
  reliabilityAtOptimal: number;
  mttf: number;
  // custo de rodar até a falha (sem preventiva), como base de comparação
  runToFailureCost: number;
}

function reliability(t: number, k: number, eta: number): number {
  return Math.exp(-Math.pow(t / eta, k));
}

// Γ(x) via Lanczos, para a MTTF = eta·Γ(1 + 1/k).
function gamma(x: number): number {
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
    1.5056327351493116e-7,
  ];
  if (x < 0.5) return Math.PI / (Math.sin(Math.PI * x) * gamma(1 - x));
  x -= 1;
  let a = c[0];
  const tt = x + g + 0.5;
  for (let i = 1; i < g + 2; i++) a += c[i] / (x + i);
  return Math.sqrt(2 * Math.PI) * Math.pow(tt, x + 0.5) * Math.exp(-tt) * a;
}

export function optimizeInterval(
  k: number,
  eta: number,
  costPreventive: number,
  costFailure: number,
  opts: { maxT?: number; steps?: number } = {},
): IntervalResult {
  const mttf = eta * gamma(1 + 1 / k);
  const maxT = opts.maxT ?? Math.max(mttf * 2.5, eta * 2.5);
  const steps = opts.steps ?? 400;
  const dt = maxT / steps;

  const curve: IntervalPoint[] = [];
  let integral = 0;
  let prevR = 1;
  let best = { t: dt, cost: Infinity, reliability: 1 };

  for (let i = 1; i <= steps; i++) {
    const t = i * dt;
    const R = reliability(t, k, eta);
    // trapézio para ∫₀ᵀ R
    integral += ((prevR + R) / 2) * dt;
    prevR = R;
    const cost = (costPreventive * R + costFailure * (1 - R)) / integral;
    curve.push({ t, cost, reliability: R });
    if (cost < best.cost) best = { t, cost, reliability: R };
  }

  // custo de rodar até a falha: cf / MTTF (limite de C(T) quando T -> inf)
  const runToFailureCost = costFailure / mttf;

  return {
    curve,
    optimalT: best.t,
    optimalCost: best.cost,
    reliabilityAtOptimal: best.reliability,
    mttf,
    runToFailureCost,
  };
}
