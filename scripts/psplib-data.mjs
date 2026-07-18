// Helpers compartilhados de acesso ao dataset PSPLIB local (.psplib/).
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parseOptimalTable } from "../src/lib/psplib/sm.ts";

// Diretório com o MAIOR número de instâncias j30 (ignora amostras soltas na raiz).
export function findSmDir(root) {
  const base = join(root, ".psplib");
  if (!existsSync(base)) return null;
  const stack = [base];
  let bestDir = null;
  let bestCount = 0;
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    const count = entries.filter((e) => e.isFile() && /^j30\d+_\d+\.sm$/.test(e.name)).length;
    if (count > bestCount) {
      bestCount = count;
      bestDir = dir;
    }
    for (const e of entries) if (e.isDirectory()) stack.push(join(dir, e.name));
  }
  return bestDir;
}

// Tabela de ótimos provados (j30opt.sm) como Map "param_inst" -> makespan, ou null.
export function loadOptimal(root) {
  const p = join(root, ".psplib", "j30opt.sm");
  return existsSync(p) ? parseOptimalTable(readFileSync(p, "utf8")) : null;
}
