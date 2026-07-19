import { readFileSync } from "node:fs";
import { instantiateSync } from "@assemblyscript/loader";
import type { RcpspProject } from "@/lib/rcpsp/types";
import { encodeProblem } from "@/lib/rcpsp/encode";

// Carrega o mesmo .wasm que o app usa e roda o solver em Node, para exercitar o motor
// de verdade nos testes (não um mock).
interface WasmExports {
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
  getCriticalPathLB(): number;
  getBestStarts(): number;
  fitWeibull(timesPtr: number, censoredPtr: number, n: number): number;
}

let cached: WasmExports | null = null;

function exports(): WasmExports {
  if (!cached) {
    const wasm = readFileSync("public/wasm/critpath.wasm");
    cached = instantiateSync(wasm, {}).exports as unknown as WasmExports;
  }
  return cached;
}

function idOf(v: number | { value: number }): number {
  return typeof v === "number" ? v : v.value;
}

export interface SolveOutcome {
  makespan: number;
  criticalPathLB: number;
  starts: number[];
}

export function solveInNode(project: RcpspProject, iters = 20000, seed = 12345): SolveOutcome {
  const e = exports();
  const data = encodeProblem(project);
  const ptr = e.__newArray(idOf(e.Int32Array_ID), data);
  e.__pin(ptr);
  e.initProblem(ptr, seed >>> 0);
  e.__unpin(ptr);
  e.setBudget(iters);
  let done = 0;
  while (done < iters) {
    const n = Math.min(2000, iters - done);
    e.step(n);
    done += n;
  }
  return {
    makespan: e.getBestMakespan(),
    criticalPathLB: e.getCriticalPathLB(),
    starts: Array.from(e.__getInt32Array(e.getBestStarts())),
  };
}

export function fitWeibullInNode(times: number[], censored: boolean[]): number[] {
  const e = exports();
  const tp = e.__newArray(idOf(e.Float64Array_ID), Float64Array.from(times));
  e.__pin(tp);
  const cp = e.__newArray(idOf(e.Int32Array_ID), Int32Array.from(censored.map((c) => (c ? 1 : 0))));
  e.__pin(cp);
  const res = e.fitWeibull(tp, cp, times.length);
  const out = Array.from(e.__getFloat64Array(res));
  e.__unpin(tp);
  e.__unpin(cp);
  return out;
}
