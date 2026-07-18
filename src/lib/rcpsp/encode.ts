import type { RcpspProject } from "./types";

// Serializa o projeto no layout plano que o módulo WASM espera em initProblem:
//   [J, K, cap[0..K-1], (por job) dur, dem[0..K-1], nSucc, succ[0..nSucc-1]]
export function encodeProblem(project: RcpspProject): Int32Array {
  const J = project.numJobs;
  const K = project.resources.length;
  const parts: number[] = [J, K];
  for (const r of project.resources) parts.push(r.capacity);

  for (let j = 0; j < J; j++) {
    const a = project.activities[j];
    parts.push(a.duration);
    for (let k = 0; k < K; k++) parts.push(a.demands[k] ?? 0);
    parts.push(a.successors.length);
    for (const s of a.successors) parts.push(s);
  }
  return Int32Array.from(parts);
}

// Buffer PERT [o, m, p] por job para o Monte Carlo. Sem tríade explícita, deriva-se
// uma assimetria realista da duração determinística (caudas mais longas à direita).
export function encodePert(
  project: RcpspProject,
  opts: { spreadLow?: number; spreadHigh?: number } = {},
): Float64Array {
  const spreadLow = opts.spreadLow ?? 0.1;
  const spreadHigh = opts.spreadHigh ?? 0.35;
  const J = project.numJobs;
  const out = new Float64Array(J * 3);
  for (let j = 0; j < J; j++) {
    const a = project.activities[j];
    const d = a.duration;
    const m = a.meta;
    let o: number, ml: number, p: number;
    if (m && m.optimistic != null && m.mostLikely != null && m.pessimistic != null) {
      o = m.optimistic; ml = m.mostLikely; p = m.pessimistic;
    } else if (d === 0) {
      o = 0; ml = 0; p = 0;
    } else {
      o = Math.max(0, Math.round(d * (1 - spreadLow)));
      ml = d;
      p = Math.round(d * (1 + spreadHigh));
    }
    out[j * 3] = o;
    out[j * 3 + 1] = ml;
    out[j * 3 + 2] = p;
  }
  return out;
}
