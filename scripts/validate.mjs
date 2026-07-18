// Harness de validação: roda o solver WASM sobre as instâncias PSPLIB J30 e mede o
// gap para o ótimo provado (Demeulemeester & Herroelen). Número frio, sem enfeite.
//
// Uso:
//   node scripts/validate.mjs                 # amostra 48 instâncias, 25k iterações
//   node scripts/validate.mjs --full          # todas as 480
//   node scripts/validate.mjs --iters 60000   # mais esforço por instância
//
// Requer o dataset local em .psplib/ (ver scripts/fetch-psplib.mjs).

import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import loader from "@assemblyscript/loader";
import { parseSm } from "../src/lib/psplib/sm.ts";
import { encodeProblem } from "../src/lib/rcpsp/encode.ts";
import { findSmDir, loadOptimal } from "./psplib-data.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const args = process.argv.slice(2);
const getFlag = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};
const full = args.includes("--full");
const iters = Number(getFlag("iters", "25000"));
const seed = Number(getFlag("seed", "12345"));

const smDir = findSmDir(root);
const optimal = loadOptimal(root);
if (!smDir || !optimal) {
  console.error("Dataset J30 não encontrado em .psplib/. Rode: node scripts/fetch-psplib.mjs");
  process.exit(1);
}

// Lista instâncias e ordena por (param, inst).
const files = readdirSync(smDir)
  .filter((f) => /^j30\d+_\d+\.sm$/.test(f))
  .map((f) => {
    const [, param, inst] = f.match(/^j30(\d+)_(\d+)\.sm$/);
    return { f, param: Number(param), inst: Number(inst) };
  })
  .sort((a, b) => a.param - b.param || a.inst - b.inst);

// Sem --full, amostra a primeira instância de cada um dos 48 parâmetros.
const selected = full ? files : files.filter((x) => x.inst === 1);

const wasm = readFileSync(join(root, "public", "wasm", "critpath.wasm"));
const { exports } = loader.instantiateSync(wasm, {});
const CHUNK = 2000;

let sumGap = 0;
let optimalCount = 0;
let worstGap = 0;
let worstName = "";
const t0 = performance.now();

for (const { f, param, inst } of selected) {
  const project = parseSm(readFileSync(join(smDir, f), "utf8"), f);
  const data = encodeProblem(project);

  const ptr = exports.__newArray(exports.Int32Array_ID, data);
  exports.__pin(ptr);
  exports.initProblem(ptr, seed >>> 0);
  exports.__unpin(ptr);
  exports.setBudget(iters);

  let done = 0;
  while (done < iters) {
    const n = Math.min(CHUNK, iters - done);
    exports.step(n);
    done += n;
  }

  const best = exports.getBestMakespan();
  const lb = exports.getCriticalPathLB();
  const opt = optimal.get(`${param}_${inst}`);
  if (opt == null) continue;

  const gap = ((best - opt) / opt) * 100;
  sumGap += gap;
  if (best === opt) optimalCount++;
  if (gap > worstGap) { worstGap = gap; worstName = f; }

  if (full === false || gap > 0) {
    const tag = best === opt ? "OK " : "gap";
    console.log(
      `${tag} ${f.padEnd(12)} best=${String(best).padStart(3)} opt=${String(opt).padStart(3)} ` +
        `cpLB=${String(lb).padStart(3)} gap=${gap.toFixed(2)}%`,
    );
  }
}

const n = selected.length;
const secs = (performance.now() - t0) / 1000;
console.log("\n" + "=".repeat(60));
console.log(`Instâncias        : ${n} ${full ? "(J30 completo)" : "(amostra, inst=1)"}`);
console.log(`Iterações/inst.   : ${iters}`);
console.log(`Ótimo atingido    : ${optimalCount}/${n} (${((optimalCount / n) * 100).toFixed(1)}%)`);
console.log(`Gap médio         : ${(sumGap / n).toFixed(3)}%`);
console.log(`Pior gap          : ${worstGap.toFixed(2)}% (${worstName})`);
console.log(`Tempo total       : ${secs.toFixed(1)}s (${(secs / n * 1000).toFixed(0)} ms/inst.)`);
console.log("=".repeat(60));
