// Carregamento e wrapper tipado do módulo WASM (AssemblyScript + runtime exportado).
// Roda dentro do Web Worker; o .wasm é servido estático de /public/wasm.
import { instantiate } from "@assemblyscript/loader";

interface RawExports {
  Int32Array_ID: number | { value: number };
  Float64Array_ID: number | { value: number };
  __newArray(id: number, values: ArrayLike<number>): number;
  __getInt32Array(ptr: number): Int32Array;
  __getFloat64Array(ptr: number): Float64Array;
  __pin(ptr: number): number;
  __unpin(ptr: number): void;
  initProblem(dataPtr: number, seed: number): void;
  setBudget(iters: number): void;
  step(iters: number): number;
  getBestMakespan(): number;
  getCurMakespan(): number;
  getCriticalPathLB(): number;
  getBestStarts(): number;
  getBestOrder(): number;
  getES(): number;
  getLS(): number;
  getEF(): number;
  getLF(): number;
  runMonteCarlo(orderPtr: number, pertPtr: number, trials: number, seed: number): number;
  fitWeibull(timesPtr: number, censoredPtr: number, n: number): number;
}

export interface Engine {
  loadProblem(encoded: Int32Array, seed: number): void;
  setBudget(iters: number): void;
  step(iters: number): number;
  bestMakespan(): number;
  criticalPathLB(): number;
  bestStarts(): Int32Array;
  bestOrder(): Int32Array;
  cpm(): { es: Int32Array; ef: Int32Array; ls: Int32Array; lf: Int32Array };
  monteCarlo(order: Int32Array, pert: Float64Array, trials: number, seed: number): Int32Array;
  fitWeibull(times: Float64Array, censored: Int32Array): Float64Array;
}

function idOf(v: number | { value: number }): number {
  return typeof v === "number" ? v : v.value;
}

let enginePromise: Promise<Engine> | null = null;

export function loadEngine(wasmUrl = "/wasm/critpath.wasm"): Promise<Engine> {
  if (!enginePromise) {
    enginePromise = fetch(wasmUrl)
      .then((r) => {
        if (!r.ok) throw new Error(`Falha ao carregar o motor WASM (${r.status})`);
        return r.arrayBuffer();
      })
      .then((bytes) => instantiate(bytes, {}))
      .then((mod) => wrap(mod.exports as unknown as RawExports));
  }
  return enginePromise;
}

function wrap(e: RawExports): Engine {
  const I32 = idOf(e.Int32Array_ID);
  const F64 = idOf(e.Float64Array_ID);

  const pushI32 = (arr: Int32Array): number => {
    const ptr = e.__newArray(I32, arr);
    return ptr;
  };
  const pushF64 = (arr: Float64Array): number => e.__newArray(F64, arr);

  return {
    loadProblem(encoded, seed) {
      const ptr = pushI32(encoded);
      e.__pin(ptr);
      e.initProblem(ptr, seed >>> 0);
      e.__unpin(ptr);
    },
    setBudget: (iters) => e.setBudget(iters),
    step: (iters) => e.step(iters),
    bestMakespan: () => e.getBestMakespan(),
    criticalPathLB: () => e.getCriticalPathLB(),
    bestStarts: () => e.__getInt32Array(e.getBestStarts()).slice(),
    bestOrder: () => e.__getInt32Array(e.getBestOrder()).slice(),
    cpm: () => ({
      es: e.__getInt32Array(e.getES()).slice(),
      ef: e.__getInt32Array(e.getEF()).slice(),
      ls: e.__getInt32Array(e.getLS()).slice(),
      lf: e.__getInt32Array(e.getLF()).slice(),
    }),
    monteCarlo(order, pert, trials, seed) {
      const op = pushI32(order);
      e.__pin(op);
      const pp = pushF64(pert);
      e.__pin(pp);
      const res = e.runMonteCarlo(op, pp, trials, seed >>> 0);
      const out = e.__getInt32Array(res).slice();
      e.__unpin(op);
      e.__unpin(pp);
      return out;
    },
    fitWeibull(times, censored) {
      const tp = pushF64(times);
      e.__pin(tp);
      const cp = pushI32(censored);
      e.__pin(cp);
      const res = e.fitWeibull(tp, cp, times.length);
      const out = e.__getFloat64Array(res).slice();
      e.__unpin(tp);
      e.__unpin(cp);
      return out;
    },
  };
}
