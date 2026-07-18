// Cliente main-thread do motor. Cria o Web Worker (uma vez), fala Comlink com ele e
// expõe uma API async limpa para os componentes React.
import * as Comlink from "comlink";
import type { WorkerEngine } from "@/workers/engine.worker";
import type { RcpspProject } from "@/lib/rcpsp/types";
import { encodeProblem, encodePert } from "@/lib/rcpsp/encode";
import type {
  SolveOptions,
  SolveProgress,
  SolveResult,
  MonteCarloOptions,
  MonteCarloResult,
  WeibullInput,
  WeibullFit,
} from "./types";

let worker: Worker | null = null;
let proxy: Comlink.Remote<WorkerEngine> | null = null;

function getProxy(): Comlink.Remote<WorkerEngine> {
  if (!proxy) {
    worker = new Worker(new URL("../../workers/engine.worker.ts", import.meta.url), {
      type: "module",
    });
    proxy = Comlink.wrap<WorkerEngine>(worker);
  }
  return proxy;
}

export async function solveProject(
  project: RcpspProject,
  options: SolveOptions,
  onProgress?: (p: SolveProgress) => void,
): Promise<SolveResult> {
  const p = getProxy();
  const encoded = encodeProblem(project);
  const durations = Int32Array.from(project.activities.map((a) => a.duration));
  const cb = onProgress ? Comlink.proxy(onProgress) : undefined;
  return p.solve(encoded, durations, options, cb);
}

export async function monteCarloProject(
  project: RcpspProject,
  options: MonteCarloOptions,
  result: SolveResult,
): Promise<MonteCarloResult> {
  const p = getProxy();
  const encoded = encodeProblem(project);
  const order = Int32Array.from(result.order);
  const pert = encodePert(project, {
    spreadLow: options.spreadLow,
    spreadHigh: options.spreadHigh,
  });
  const res = await p.monteCarlo(encoded, order, pert, options);
  return { ...res, deterministic: result.makespan };
}

export function fitWeibull(input: WeibullInput): Promise<WeibullFit> {
  return getProxy().fitWeibull(input);
}

export function cancelSolve(): void {
  proxy?.requestCancel();
}

export function disposeEngine(): void {
  worker?.terminate();
  worker = null;
  proxy = null;
}
