/// <reference lib="webworker" />
// Motor de otimização isolado na worker thread. Roda por minutos sem congelar a UI e
// sem tocar em serverless (o RCPSP é NP-difícil; um timeout de função seria fatal).
import * as Comlink from "comlink";
import { loadEngine } from "@/lib/engine/wasm";
import type {
  SolveOptions,
  SolveProgress,
  SolveResult,
  MonteCarloOptions,
  MonteCarloResult,
  WeibullInput,
  WeibullFit,
} from "@/lib/engine/types";

let cancelFlag = false;
const yieldTick = () => new Promise<void>((r) => setTimeout(r, 0));

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return NaN;
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

const api = {
  async solve(
    encoded: Int32Array,
    durations: Int32Array,
    options: SolveOptions,
    onProgress?: (p: SolveProgress) => void,
  ): Promise<SolveResult> {
    cancelFlag = false;
    const engine = await loadEngine();
    const t0 = performance.now();

    engine.loadProblem(encoded, options.seed);
    engine.setBudget(options.iterations);
    const lb = engine.criticalPathLB();

    const chunk = 1500;
    let done = 0;
    while (done < options.iterations && !cancelFlag) {
      const n = Math.min(chunk, options.iterations - done);
      engine.step(n);
      done += n;
      onProgress?.({
        iteration: done,
        totalIterations: options.iterations,
        best: engine.bestMakespan(),
        criticalPathLB: lb,
        elapsedMs: performance.now() - t0,
      });
      await yieldTick();
    }

    const starts = Array.from(engine.bestStarts());
    const finishes = starts.map((s, j) => s + durations[j]);
    const { es, ef, ls, lf } = engine.cpm();

    return {
      makespan: engine.bestMakespan(),
      criticalPathLB: lb,
      starts,
      finishes,
      earliestStart: Array.from(es),
      earliestFinish: Array.from(ef),
      latestStart: Array.from(ls),
      latestFinish: Array.from(lf),
      order: Array.from(engine.bestOrder()),
      elapsedMs: performance.now() - t0,
      iterations: done,
    };
  },

  async monteCarlo(
    encoded: Int32Array,
    order: Int32Array,
    pert: Float64Array,
    options: MonteCarloOptions,
  ): Promise<MonteCarloResult> {
    const engine = await loadEngine();
    // recarrega o problema para restaurar o estado do engine (J, precedências, recursos),
    // independentemente do que foi resolvido por último (benchmark, outra instância).
    engine.loadProblem(encoded, options.seed);
    const raw = engine.monteCarlo(order, pert, options.trials, options.seed);
    const samples = Array.from(raw);
    const sorted = [...samples].sort((a, b) => a - b);
    const n = samples.length;
    const mean = samples.reduce((a, b) => a + b, 0) / n;
    const variance = samples.reduce((a, b) => a + (b - mean) ** 2, 0) / n;

    return {
      samples,
      deterministic: sorted[0], // sobrescrito pela UI com o makespan determinístico real
      mean,
      std: Math.sqrt(variance),
      p10: percentile(sorted, 10),
      p50: percentile(sorted, 50),
      p80: percentile(sorted, 80),
      p90: percentile(sorted, 90),
      min: sorted[0],
      max: sorted[n - 1],
    };
  },

  async fitWeibull(input: WeibullInput): Promise<WeibullFit> {
    const engine = await loadEngine();
    const times = Float64Array.from(input.times);
    const censored = Int32Array.from(input.censored.map((c) => (c ? 1 : 0)));
    const [shape, scale, logLikelihood, failures] = engine.fitWeibull(times, censored);
    return {
      shape,
      scale,
      logLikelihood,
      failures,
      total: input.times.length,
    };
  },

  requestCancel() {
    cancelFlag = true;
  },
};

export type WorkerEngine = typeof api;
Comlink.expose(api);
