// Contrato entre a UI (main thread) e o motor WASM (worker). Só dados serializáveis
// cruzam a fronteira Comlink.

export interface SolveOptions {
  iterations: number;
  seed: number;
}

export interface SolveProgress {
  iteration: number;
  totalIterations: number;
  best: number;
  criticalPathLB: number;
  elapsedMs: number;
}

export interface SolveResult {
  makespan: number;
  criticalPathLB: number;
  /** por job, alinhado a project.activities */
  starts: number[];
  finishes: number[];
  earliestStart: number[];
  earliestFinish: number[];
  latestStart: number[];
  latestFinish: number[];
  /** folga total = LS - ES; folga livre derivada na UI */
  order: number[];
  elapsedMs: number;
  iterations: number;
}

export interface MonteCarloOptions {
  trials: number;
  seed: number;
  spreadLow?: number;
  spreadHigh?: number;
}

export interface MonteCarloResult {
  /** makespan de cada réplica (não ordenado) */
  samples: number[];
  deterministic: number;
  mean: number;
  std: number;
  p10: number;
  p50: number;
  p80: number;
  p90: number;
  min: number;
  max: number;
}

export interface WeibullInput {
  /** tempos observados (em operação ou até falha) */
  times: number[];
  /** true = censurado (ainda não falhou) */
  censored: boolean[];
}

export interface WeibullFit {
  shape: number;
  scale: number;
  logLikelihood: number;
  failures: number;
  total: number;
}
