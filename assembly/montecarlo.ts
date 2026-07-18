// Monte Carlo sobre a duração das atividades.
//
// Cada atividade recebe uma distribuição PERT-beta a partir de três pontos
// (otimista, mais provável, pessimista). Fixada a activity list ótima, cada réplica
// amostra durações e re-decodifica via serial SGS — propagando a incerteza pelas
// precedências e recursos. A saída é a distribuição do makespan, de onde vêm P50/P80.

import { Rng } from "./random";
import { jobs, decodeWith } from "./rcpsp";

let durBuf: Int32Array = new Int32Array(0);

// Amostra Gamma(shape>=1, 1) — Marsaglia-Tsang. PERT garante shape >= 1.
function sampleGamma(rng: Rng, shape: f64): f64 {
  const d = shape - 1.0 / 3.0;
  const c = 1.0 / Math.sqrt(9.0 * d);
  while (true) {
    let x: f64 = 0;
    let v: f64 = 0;
    do {
      x = rng.nextGaussian();
      v = 1.0 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = rng.nextFloat();
    const x2 = x * x;
    if (u < 1.0 - 0.0331 * x2 * x2) return d * v;
    if (Math.log(u) < 0.5 * x2 + d * (1.0 - v + Math.log(v))) return d * v;
  }
}

// Beta(a,b) via razão de Gammas.
function sampleBeta(rng: Rng, a: f64, b: f64): f64 {
  const x = sampleGamma(rng, a);
  const y = sampleGamma(rng, b);
  return x / (x + y);
}

// order: activity list ótima; pert: [o,m,p] por job. O problema já deve estar carregado
// (initProblem). Recebe a ordem explicitamente para não depender do estado residual do
// engine — que pode conter outra instância após um benchmark ou troca de projeto.
// Retorna Int32Array com o makespan de cada réplica.
export function runMonteCarlo(
  order: Int32Array,
  pert: Float64Array,
  trials: i32,
  seed: u32,
): Int32Array {
  const J = jobs();
  const ord = order;
  if (durBuf.length != J) durBuf = new Int32Array(J);
  const rng = new Rng(seed);
  const out = new Int32Array(trials);

  const lambda = 4.0; // peso PERT clássico da moda
  for (let t = 0; t < trials; t++) {
    for (let j = 0; j < J; j++) {
      const o = pert[j * 3];
      const m = pert[j * 3 + 1];
      const p = pert[j * 3 + 2];
      const range = p - o;
      if (range <= 1e-9) {
        durBuf[j] = <i32>Math.round(o);
        continue;
      }
      const alpha = 1.0 + lambda * (m - o) / range;
      const beta = 1.0 + lambda * (p - m) / range;
      const b = sampleBeta(rng, alpha, beta);
      let d = o + b * range;
      let di = <i32>Math.round(d);
      if (di < 0) di = 0;
      durBuf[j] = di;
    }
    out[t] = decodeWith(ord, durBuf);
  }
  return out;
}
