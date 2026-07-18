// Gera src/lib/data/psplib-sample.json a partir do dataset local .psplib:
// um subconjunto representativo de instâncias J30 + seus ótimos provados, para a
// aba de benchmark rodar o solver ao vivo no navegador e medir o gap.
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseSm } from "../src/lib/psplib/sm.ts";
import { findSmDir, loadOptimal } from "./psplib-data.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// Instâncias escolhidas: mistura de folgadas (cpLB = ótimo) e de alta contenção.
const PICKS = [
  [1, 1], [3, 1], [5, 1], [9, 1], [13, 1],
  [21, 1], [25, 1], [29, 1], [37, 1], [41, 1], [45, 1], [48, 1],
];

const smDir = findSmDir(root);
const optimal = loadOptimal(root);
if (!smDir || !optimal) {
  console.error("Dataset .psplib ausente. Rode: node scripts/fetch-psplib.mjs");
  process.exit(1);
}

const out = [];
for (const [param, inst] of PICKS) {
  const file = join(smDir, `j30${param}_${inst}.sm`);
  const project = parseSm(readFileSync(file, "utf8"), `J30 ${param}-${inst}`);
  out.push({
    key: `${param}_${inst}`,
    label: `J30 ${param}-${inst}`,
    optimum: optimal.get(`${param}_${inst}`),
    project,
  });
}

const dest = join(root, "src", "lib", "data", "psplib-sample.json");
writeFileSync(dest, JSON.stringify(out));
console.log(`Escrito ${out.length} instâncias em ${dest} (${(JSON.stringify(out).length / 1024).toFixed(1)} KB)`);
