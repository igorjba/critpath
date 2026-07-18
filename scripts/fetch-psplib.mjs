// Baixa o dataset PSPLIB J30 para .psplib/ de forma reprodutível:
//  - 480 instâncias .sm (mirror no GitHub; o site oficial do TUM saiu do ar)
//  - j30opt.sm com os ótimos provados (Internet Archive do arquivo original do TUM)
//
// Uso: node scripts/fetch-psplib.mjs
import { mkdirSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, ".psplib");
mkdirSync(dir, { recursive: true });

const UA = "critpath-fetch";
async function get(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res;
}

// 1) ótimos (Wayback do arquivo original de Demeulemeester & Herroelen)
const optPath = join(dir, "j30opt.sm");
if (!existsSync(optPath)) {
  console.log("Baixando j30opt.sm (ótimos provados)…");
  const r = await get(
    "https://web.archive.org/web/2id_/http://www.om-db.wi.tum.de/psplib/files/j30opt.sm",
  );
  writeFileSync(optPath, Buffer.from(await r.arrayBuffer()));
}

// 2) instâncias (tarball do mirror, extraído com tar do sistema)
const smDir = join(dir, "j30");
const has480 =
  existsSync(smDir) && readdirSync(smDir).filter((f) => /^j30\d+_\d+\.sm$/.test(f)).length >= 480;
if (!has480) {
  console.log("Baixando as 480 instâncias J30…");
  const r = await get("https://codeload.github.com/AlkisPlas/MPRJ_RCPSP/tar.gz/refs/heads/main");
  const tgz = join(dir, "mprj.tgz");
  writeFileSync(tgz, Buffer.from(await r.arrayBuffer()));
  mkdirSync(smDir, { recursive: true });
  // extrai só os .sm de j30, achatando os diretórios
  execFileSync("tar", [
    "-xzf",
    tgz,
    "-C",
    smDir,
    "--strip-components=5",
    "--wildcards",
    "*/data/instances/sm/j30/*.sm",
  ]);
}

const n = readdirSync(smDir).filter((f) => /^j30\d+_\d+\.sm$/.test(f)).length;
console.log(`Pronto: ${n} instâncias em ${smDir} + ótimos em ${optPath}`);
console.log("Agora rode: npm run validate  (ou node scripts/gen-psplib-sample.mjs)");
