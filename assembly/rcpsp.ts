// RCPSP — Resource-Constrained Project Scheduling Problem.
//
// Decodificador: serial schedule generation scheme (serial SGS) sobre uma activity list
// mantida sempre precedence-feasible. Otimização: simulated annealing com operador de
// realocação (shift) + double justification (forward-backward) nas soluções aceitas.
//
// Estado do problema vive em globals do módulo — o worker chama initProblem uma vez e
// depois itera step() em blocos, o que mantém a UI responsiva e a busca cancelável.

import { Rng } from "./random";

// ---- Dados do problema (dummy de início = 0, dummy de fim = J-1) ----
let J: i32 = 0; // total de jobs, incluindo os 2 dummies
let K: i32 = 0; // recursos renováveis
let cap: Int32Array = new Int32Array(0); // [K]
let baseDur: Int32Array = new Int32Array(0); // [J]
let dem: Int32Array = new Int32Array(0); // [J*K] row-major

// Sucessores/predecessores em CSR (compressed sparse row).
let succ: Int32Array = new Int32Array(0);
let succStart: Int32Array = new Int32Array(0); // [J+1]
let pred: Int32Array = new Int32Array(0);
let predStart: Int32Array = new Int32Array(0); // [J+1]

// ---- CPM (ignora recursos) ----
let ES: Int32Array = new Int32Array(0);
let EF: Int32Array = new Int32Array(0);
let LS: Int32Array = new Int32Array(0);
let LF: Int32Array = new Int32Array(0);
let cpLength: i32 = 0; // lower bound de caminho crítico

// ---- Buffers reutilizáveis do decoder ----
let resFree: Int32Array = new Int32Array(0); // [horizon*K]
let horizonCap: i32 = 0;
let startBuf: Int32Array = new Int32Array(0); // [J]
let finishBuf: Int32Array = new Int32Array(0); // [J]

// ---- Estado da busca ----
let order: Int32Array = new Int32Array(0); // permutação precedence-feasible
let posOf: Int32Array = new Int32Array(0); // inverso: posição de cada job
let bestOrder: Int32Array = new Int32Array(0);
let bestStart: Int32Array = new Int32Array(0);
let bestMakespan: i32 = 0;
let curMakespan: i32 = 0;
let rng: Rng = new Rng(1);
let temperature: f64 = 0;
let coolingT0: f64 = 0;
let iterCount: i32 = 0;
let iterBudget: i32 = 1; // usado para o decaimento de temperatura
const TCOLD: f64 = 0.0001; // alvo de temperatura ao fim do orçamento
const TFLOOR: f64 = 1e-6; // piso numérico


// =====================================================================
// Parsing
// =====================================================================
// Layout do Int32Array de entrada:
//   [0]=J [1]=K [2..2+K-1]=cap
//   para cada job j: dur, dem[0..K-1], nSucc, succ...
export function initProblem(data: Int32Array, seed: u32): void {
  let p = 0;
  J = data[p++];
  K = data[p++];
  cap = new Int32Array(K);
  for (let k = 0; k < K; k++) cap[k] = data[p++];

  baseDur = new Int32Array(J);
  dem = new Int32Array(J * K);
  const succCount = new Int32Array(J);
  const predCount = new Int32Array(J);

  // Primeira passada: durações, demandas e contagem de arestas.
  const succListStart = new Int32Array(J);
  const tmpSucc = new Array<i32>(); // arestas achatadas na ordem de leitura
  for (let j = 0; j < J; j++) {
    baseDur[j] = data[p++];
    for (let k = 0; k < K; k++) dem[j * K + k] = data[p++];
    const ns = data[p++];
    succCount[j] = ns;
    succListStart[j] = tmpSucc.length;
    for (let s = 0; s < ns; s++) {
      const t = data[p++];
      tmpSucc.push(t);
      predCount[t]++;
    }
  }

  // CSR de sucessores.
  succStart = new Int32Array(J + 1);
  for (let j = 0; j < J; j++) succStart[j + 1] = succStart[j] + succCount[j];
  succ = new Int32Array(tmpSucc.length);
  for (let j = 0; j < J; j++) {
    const base = succListStart[j];
    for (let s = 0; s < succCount[j]; s++) succ[succStart[j] + s] = tmpSucc[base + s];
  }

  // CSR de predecessores (invertendo).
  predStart = new Int32Array(J + 1);
  for (let j = 0; j < J; j++) predStart[j + 1] = predStart[j] + predCount[j];
  pred = new Int32Array(succ.length);
  const fill = new Int32Array(J);
  for (let j = 0; j < J; j++) {
    for (let s = succStart[j]; s < succStart[j + 1]; s++) {
      const t = succ[s];
      pred[predStart[t] + fill[t]] = j;
      fill[t]++;
    }
  }

  ES = new Int32Array(J);
  EF = new Int32Array(J);
  LS = new Int32Array(J);
  LF = new Int32Array(J);
  startBuf = new Int32Array(J);
  finishBuf = new Int32Array(J);
  order = new Int32Array(J);
  posOf = new Int32Array(J);
  bestOrder = new Int32Array(J);
  bestStart = new Int32Array(J);

  computeCPM();
  ensureHorizon(sumDur(baseDur) + 1);

  rng = new Rng(seed);
  buildInitialOrder();
  curMakespan = decodeSerial(order, baseDur);
  copyOrderToBest();

  // Temperatura inicial calibrada pela escala do makespan da solução gulosa.
  coolingT0 = <f64>curMakespan * 0.06 + 1.0;
  temperature = coolingT0;
  iterCount = 0;
}

function sumDur(d: Int32Array): i32 {
  let s = 0;
  for (let j = 0; j < J; j++) s += d[j];
  return s;
}

function ensureHorizon(h: i32): void {
  if (h <= horizonCap) return;
  horizonCap = h;
  resFree = new Int32Array(horizonCap * K);
}

// =====================================================================
// CPM — forward e backward pass ignorando recursos (lower bound crítico)
// =====================================================================
function computeCPM(): void {
  // Ordem topológica por Kahn.
  const topo = new Int32Array(J);
  const indeg = new Int32Array(J);
  for (let j = 0; j < J; j++) indeg[j] = predStart[j + 1] - predStart[j];
  const queue = new Int32Array(J);
  let qh = 0, qt = 0, ti = 0;
  for (let j = 0; j < J; j++) if (indeg[j] == 0) queue[qt++] = j;
  while (qh < qt) {
    const j = queue[qh++];
    topo[ti++] = j;
    for (let s = succStart[j]; s < succStart[j + 1]; s++) {
      const t = succ[s];
      if (--indeg[t] == 0) queue[qt++] = t;
    }
  }

  // Forward: earliest start/finish.
  for (let i = 0; i < J; i++) {
    const j = topo[i];
    let es = 0;
    for (let s = predStart[j]; s < predStart[j + 1]; s++) {
      const pj = pred[s];
      if (EF[pj] > es) es = EF[pj];
    }
    ES[j] = es;
    EF[j] = es + baseDur[j];
  }
  cpLength = EF[J - 1];

  // Backward: latest start/finish com deadline = comprimento do caminho crítico.
  for (let j = 0; j < J; j++) LF[j] = cpLength;
  for (let i = J - 1; i >= 0; i--) {
    const j = topo[i];
    let lf = cpLength;
    if (succStart[j] < succStart[j + 1]) {
      lf = i32.MAX_VALUE;
      for (let s = succStart[j]; s < succStart[j + 1]; s++) {
        const sj = succ[s];
        if (LS[sj] < lf) lf = LS[sj];
      }
    }
    LF[j] = lf;
    LS[j] = lf - baseDur[j];
  }
}

// =====================================================================
// Solução inicial: ordem topológica gulosa por menor LF (min latest finish)
// =====================================================================
function buildInitialOrder(): void {
  const indeg = new Int32Array(J);
  for (let j = 0; j < J; j++) indeg[j] = predStart[j + 1] - predStart[j];
  const ready = new Int32Array(J);
  let rc = 0;
  for (let j = 0; j < J; j++) if (indeg[j] == 0) ready[rc++] = j;

  for (let filled = 0; filled < J; filled++) {
    // seleciona, entre os elegíveis, o de menor LF (desempate por menor ES).
    let bi = 0;
    for (let i = 1; i < rc; i++) {
      const a = ready[i], b = ready[bi];
      if (LF[a] < LF[b] || (LF[a] == LF[b] && ES[a] < ES[b])) bi = i;
    }
    const j = ready[bi];
    ready[bi] = ready[--rc];
    order[filled] = j;
    posOf[j] = filled;
    for (let s = succStart[j]; s < succStart[j + 1]; s++) {
      const t = succ[s];
      if (--indeg[t] == 0) ready[rc++] = t;
    }
  }
}

// =====================================================================
// Serial SGS — decodifica uma activity list em cronograma; retorna makespan
// =====================================================================
function decodeSerial(ord: Int32Array, durations: Int32Array): i32 {
  let horizon = 0;
  for (let j = 0; j < J; j++) horizon += durations[j];
  horizon += 1;
  ensureHorizon(horizon);

  // reset do perfil de recursos
  const cells = horizon * K;
  for (let c = 0; c < cells; c++) resFree[c] = cap[c % K];

  let makespan = 0;
  for (let idx = 0; idx < J; idx++) {
    const j = ord[idx];
    const d = durations[j];

    // earliest respeitando precedências
    let est = 0;
    for (let s = predStart[j]; s < predStart[j + 1]; s++) {
      const f = finishBuf[pred[s]];
      if (f > est) est = f;
    }

    let t = est;
    if (d > 0) {
      // avança t até caber em todos os períodos [t, t+d) para todo recurso
      while (true) {
        let ok = true;
        let tau = t;
        while (tau < t + d) {
          const rowBase = tau * K;
          for (let k = 0; k < K; k++) {
            if (dem[j * K + k] > resFree[rowBase + k]) { ok = false; break; }
          }
          if (!ok) break;
          tau++;
        }
        if (ok) break;
        // salta para o próximo instante potencialmente viável
        t = tau + 1 > t ? tau + 1 : t + 1;
      }
      // aloca recursos
      for (let tau = t; tau < t + d; tau++) {
        const rowBase = tau * K;
        for (let k = 0; k < K; k++) resFree[rowBase + k] -= dem[j * K + k];
      }
    }

    startBuf[j] = t;
    finishBuf[j] = t + d;
    if (t + d > makespan) makespan = t + d;
  }
  return makespan;
}

// =====================================================================
// Double justification — desloca à direita e depois à esquerda; costuma reduzir makespan
// =====================================================================
function justify(ord: Int32Array, durations: Int32Array): i32 {
  const ms = decodeSerial(ord, durations); // popula start/finish
  // Justificação à direita: ordena por finish decrescente e agenda a partir do fim.
  const byFinish = new Int32Array(J);
  for (let i = 0; i < J; i++) byFinish[i] = ord[i];
  sortByFinishDesc(byFinish);
  const rightMs = decodeReverse(byFinish, durations, ms);

  // Justificação à esquerda: ordena por start (do reverso) crescente e reagenda normal.
  const byStart = new Int32Array(J);
  for (let i = 0; i < J; i++) byStart[i] = byFinish[i];
  sortByStartAsc(byStart);
  const leftMs = decodeSerial(byStart, durations);

  if (leftMs <= rightMs && leftMs <= ms) {
    for (let i = 0; i < J; i++) ord[i] = byStart[i];
    return leftMs;
  }
  return ms;
}

// SGS reverso (agenda a partir do fim, para a justificação à direita).
function decodeReverse(ord: Int32Array, durations: Int32Array, curMs: i32): i32 {
  let horizon = curMs + 1;
  ensureHorizon(horizon);
  const cells = horizon * K;
  for (let c = 0; c < cells; c++) resFree[c] = cap[c % K];

  for (let idx = 0; idx < J; idx++) {
    const j = ord[idx];
    const d = durations[j];
    // latest finish respeitando sucessores já agendados (start deles)
    let lft = horizon - 1;
    for (let s = succStart[j]; s < succStart[j + 1]; s++) {
      const st = startBuf[succ[s]];
      if (st < lft) lft = st;
    }
    let f = lft;
    if (d > 0) {
      while (true) {
        // não há espaço antes do instante 0: força início em 0 e evita índice negativo
        if (f - d < 0) { f = d; break; }
        let ok = true;
        let tau = f - d;
        while (tau < f) {
          const rowBase = tau * K;
          for (let k = 0; k < K; k++) {
            if (dem[j * K + k] > resFree[rowBase + k]) { ok = false; break; }
          }
          if (!ok) break;
          tau++;
        }
        if (ok) break;
        f = tau; // recua
      }
      for (let tau = f - d; tau < f; tau++) {
        const rowBase = tau * K;
        for (let k = 0; k < K; k++) resFree[rowBase + k] -= dem[j * K + k];
      }
    }
    finishBuf[j] = f;
    startBuf[j] = f - d;
  }
  // normaliza deslocando para começar em 0
  let minStart = i32.MAX_VALUE;
  for (let j = 0; j < J; j++) if (startBuf[j] < minStart) minStart = startBuf[j];
  let ms = 0;
  for (let j = 0; j < J; j++) {
    startBuf[j] -= minStart;
    finishBuf[j] -= minStart;
    if (finishBuf[j] > ms) ms = finishBuf[j];
  }
  return ms;
}

function sortByFinishDesc(a: Int32Array): void {
  insertionSort(a, true, false);
}
function sortByStartAsc(a: Int32Array): void {
  insertionSort(a, false, true);
}
// Insertion sort estável e simples (J pequeno); byFinishDesc / byStartAsc.
function insertionSort(a: Int32Array, byFinish: bool, asc: bool): void {
  for (let i = 1; i < J; i++) {
    const v = a[i];
    const key = byFinish ? finishBuf[v] : startBuf[v];
    let jj = i - 1;
    while (jj >= 0) {
      const w = a[jj];
      const kw = byFinish ? finishBuf[w] : startBuf[w];
      const worse = asc ? kw > key : kw < key;
      if (!worse) break;
      a[jj + 1] = w;
      jj--;
    }
    a[jj + 1] = v;
  }
}

// =====================================================================
// Simulated annealing — operador de shift precedence-feasible
// =====================================================================
export function step(iters: i32): i32 {
  for (let it = 0; it < iters; it++) {
    // escolhe um job real (evita os dois dummies nas pontas)
    const fromPos = 1 + rng.nextRange(J - 2);
    const g = order[fromPos];

    // limites de reinserção válidos: após o último pred e antes do primeiro succ
    let lo = 0;
    for (let s = predStart[g]; s < predStart[g + 1]; s++) {
      const pp = posOf[pred[s]];
      if (pp > lo) lo = pp;
    }
    let hi = J - 1;
    for (let s = succStart[g]; s < succStart[g + 1]; s++) {
      const sp = posOf[succ[s]];
      if (sp < hi) hi = sp;
    }
    // nova posição no intervalo aberto (lo, hi), diferente da atual
    if (hi - lo <= 1) continue;
    let toPos = lo + 1 + rng.nextRange(hi - lo - 1);
    if (toPos == fromPos) continue;

    applyShift(order, posOf, fromPos, toPos);
    const cand = decodeSerial(order, baseDur);

    const delta = cand - curMakespan;
    let accept = false;
    if (delta <= 0) {
      accept = true;
    } else if (temperature > 1e-9) {
      if (rng.nextFloat() < Math.exp(-<f64>delta / temperature)) accept = true;
    }

    if (accept) {
      // double justification em toda aceitação: a busca passa a operar sobre cronogramas
      // já justificados (forward-backward). Isso costuma fechar as instâncias que a busca
      // pura deixa presas a ~1-2% do ótimo, ao custo de mais trabalho por aceitação.
      const jms = justify(order, baseDur);
      for (let i = 0; i < J; i++) posOf[order[i]] = i;
      curMakespan = jms;
      if (jms < bestMakespan) copyOrderToBest();
    } else {
      applyShift(order, posOf, toPos, fromPos); // desfaz o shift
    }

    // resfriamento geométrico ao longo do orçamento total de iterações:
    // T0 -> ~0, com a cauda fria virando descida gulosa que intensifica a melhor região.
    iterCount++;
    temperature = coolingT0 * Math.pow(TCOLD / (coolingT0 + 1e-9), <f64>iterCount / <f64>iterBudget);
    if (temperature < TFLOOR) temperature = TFLOOR;
  }
  return bestMakespan;
}

function applyShift(ord: Int32Array, pos: Int32Array, from: i32, to: i32): void {
  const g = ord[from];
  if (to > from) {
    for (let i = from; i < to; i++) { ord[i] = ord[i + 1]; pos[ord[i]] = i; }
  } else {
    for (let i = from; i > to; i--) { ord[i] = ord[i - 1]; pos[ord[i]] = i; }
  }
  ord[to] = g;
  pos[g] = to;
}

function copyOrderToBest(): void {
  bestMakespan = curMakespan;
  for (let i = 0; i < J; i++) bestOrder[i] = order[i];
  decodeSerial(bestOrder, baseDur);
  for (let j = 0; j < J; j++) bestStart[j] = startBuf[j];
}

// =====================================================================
// Configuração da busca / getters expostos ao worker
// =====================================================================
export function setBudget(totalIters: i32): void {
  iterBudget = totalIters > 1 ? totalIters : 1;
  iterCount = 0;
}
export function getBestMakespan(): i32 { return bestMakespan; }
export function getCurMakespan(): i32 { return curMakespan; }
export function getCriticalPathLB(): i32 { return cpLength; }
export function getBestStarts(): Int32Array {
  const out = new Int32Array(J);
  for (let j = 0; j < J; j++) out[j] = bestStart[j];
  return out;
}
export function getBestOrder(): Int32Array {
  const out = new Int32Array(J);
  for (let i = 0; i < J; i++) out[i] = bestOrder[i];
  return out;
}
export function getES(): Int32Array { return sliceCopy(ES); }
export function getLS(): Int32Array { return sliceCopy(LS); }
export function getEF(): Int32Array { return sliceCopy(EF); }
export function getLF(): Int32Array { return sliceCopy(LF); }
function sliceCopy(a: Int32Array): Int32Array {
  const out = new Int32Array(J);
  for (let j = 0; j < J; j++) out[j] = a[j];
  return out;
}

// Acesso ao problema para os módulos Monte Carlo (mesmo módulo de estado).
export function jobs(): i32 { return J; }
export function resources(): i32 { return K; }
export function baseDurations(): Int32Array { return baseDur; }

// Decodifica uma ordem com um vetor de durações arbitrário (usado pelo Monte Carlo).
export function decodeWith(ord: Int32Array, durations: Int32Array): i32 {
  return decodeSerial(ord, durations);
}
