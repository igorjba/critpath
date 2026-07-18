// Superfície pública do módulo WASM. O worker instancia via @assemblyscript/loader
// e usa estes IDs de classe para materializar TypedArrays na fronteira JS<->WASM.

export const Int32Array_ID = idof<Int32Array>();
export const Float64Array_ID = idof<Float64Array>();

export {
  initProblem,
  setBudget,
  step,
  getBestMakespan,
  getCurMakespan,
  getCriticalPathLB,
  getBestStarts,
  getBestOrder,
  getES,
  getLS,
  getEF,
  getLF,
} from "./rcpsp";

export { runMonteCarlo } from "./montecarlo";
export { fitWeibull } from "./weibull";
