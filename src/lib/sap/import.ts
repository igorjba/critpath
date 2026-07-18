import Papa from "papaparse";
import type { RcpspProject, Activity, ResourceDef } from "@/lib/rcpsp/types";

// Importa um export tabular do SAP PM (IW39 = ordens, IW49 = operações).
// O export padrão do IW39/IW49 não carrega a rede de precedências (ela vive no PS/rede),
// então aceitamos uma coluna Predecessoras opcional; sem ela, assume-se sequência dentro
// da ordem. Centro de trabalho vira recurso renovável; capacidade vem da coluna Cap.
//
// Colunas reconhecidas (tolerante a acento, caixa e sinônimos PT/EN):
//   Ordem/Order · Operacao/Operation · Descricao/Description/Texto
//   Centro/WorkCenter · Duracao/Work/Duration · Cap/Capacity · Predecessoras/Predecessors

const SYN: Record<string, string[]> = {
  order: ["ordem", "order", "aufnr"],
  operation: ["operacao", "operação", "operation", "vornr", "op"],
  description: ["descricao", "descrição", "description", "texto", "textobreve", "shorttext"],
  workCenter: ["centro", "centrotrab", "centrodetrabalho", "workcenter", "arbpl"],
  duration: ["duracao", "duração", "duration", "work", "trabalho", "arbeit", "dauer"],
  capacity: ["cap", "capacity", "capacidade"],
  preds: ["predecessoras", "predecessors", "pred", "precedencias", "precedências"],
};

function normalizeKey(k: string): string {
  const n = k
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z]/g, "");
  for (const [canon, alts] of Object.entries(SYN)) {
    if (alts.some((a) => a.replace(/[^a-z]/g, "") === n)) return canon;
  }
  return n;
}

// Kahn: se nem todos os nós são ordenados, há ciclo nas precedências.
function assertAcyclic(activities: Activity[], numJobs: number): void {
  const indeg = new Array(numJobs).fill(0);
  for (const a of activities) for (const s of a.successors) indeg[s]++;
  const queue: number[] = [];
  for (let j = 0; j < numJobs; j++) if (indeg[j] === 0) queue.push(j);
  let visited = 0;
  while (queue.length) {
    const j = queue.pop()!;
    visited++;
    for (const s of activities[j].successors) if (--indeg[s] === 0) queue.push(s);
  }
  if (visited < numJobs) {
    throw new Error("As precedências formam um ciclo — verifique a coluna Predecessoras.");
  }
}

interface Row {
  order?: string;
  operation?: string;
  description?: string;
  workCenter?: string;
  duration?: string;
  capacity?: string;
  preds?: string;
}

export function parseSapExport(text: string, name = "Import IW39/IW49"): RcpspProject {
  const parsed = Papa.parse<Record<string, string>>(text.trim(), {
    header: true,
    skipEmptyLines: true,
    transformHeader: normalizeKey,
    delimiter: "", // autodetecta , ; \t
  });
  const raw = parsed.data.filter((r) => Object.keys(r).length > 0) as unknown as Row[];
  if (raw.length === 0) throw new Error("Nenhuma operação encontrada no export.");

  // Chave (ordem, operação) -> índice interno 1..n
  const key = (r: Row) => `${r.order ?? "1"}/${(r.operation ?? "").trim()}`;
  const rows = raw.filter((r) => (r.operation ?? "").trim() !== "");
  // limite defensivo: mantem o problema no cliente sem estourar memoria do WASM
  if (rows.length > 2000) {
    throw new Error(`Import muito grande: ${rows.length} operações (limite 2000).`);
  }
  const idOf = new Map<string, number>();
  rows.forEach((r, i) => idOf.set(key(r), i + 1));

  // Recursos = centros de trabalho distintos; capacidade = maior Cap declarada.
  const wcCap = new Map<string, number>();
  for (const r of rows) {
    const wc = (r.workCenter ?? "GERAL").trim() || "GERAL";
    const cap = Math.max(1, Math.round(Number(r.capacity ?? "1")) || 1);
    wcCap.set(wc, Math.max(wcCap.get(wc) ?? 1, cap));
  }
  const resources: ResourceDef[] = [...wcCap.entries()].map(([id, capacity]) => ({
    id,
    label: id,
    capacity,
  }));
  const resIndex = new Map(resources.map((r, k) => [r.id, k]));
  const K = resources.length;
  const numJobs = rows.length + 2;

  const activities: Activity[] = new Array(numJobs);
  activities[0] = { id: 0, label: "start", duration: 0, demands: new Array(K).fill(0), successors: [] };
  activities[numJobs - 1] = {
    id: numJobs - 1,
    label: "end",
    duration: 0,
    demands: new Array(K).fill(0),
    successors: [],
  };

  const predsByJob: number[][] = Array.from({ length: numJobs }, () => []);

  rows.forEach((r, i) => {
    const id = i + 1;
    const wc = (r.workCenter ?? "GERAL").trim() || "GERAL";
    const demands = new Array(K).fill(0);
    demands[resIndex.get(wc)!] = 1;
    // clamp: duração inválida vira 0; teto evita horizonte gigante no decoder
    const duration = Math.min(100000, Math.max(0, Math.round(Number(r.duration ?? "0")) || 0));

    // precedências explícitas dentro da mesma ordem; senão, sequência por número de operação
    const predRefs = (r.preds ?? "")
      .split(/[\s,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const preds: number[] = [];
    for (const ref of predRefs) {
      const pid = idOf.get(`${r.order ?? "1"}/${ref}`);
      if (pid) preds.push(pid);
    }
    if (preds.length === 0 && predRefs.length === 0) {
      // fallback: operação anterior da mesma ordem
      const prev = rows[i - 1];
      if (prev && (prev.order ?? "1") === (r.order ?? "1")) preds.push(i);
    }

    predsByJob[id] = preds;
    activities[id] = {
      id,
      label: `${(r.operation ?? "").trim()} ${r.description ?? ""}`.trim() || `op ${id}`,
      duration,
      demands,
      successors: [],
    };
  });

  // Deriva sucessores; liga órfãos ao source e folhas ao sink.
  for (let j = 1; j <= rows.length; j++) {
    const preds = predsByJob[j];
    if (preds.length === 0) activities[0].successors.push(j);
    for (const p of preds) activities[p].successors.push(j);
  }
  for (let j = 1; j <= rows.length; j++) {
    if (activities[j].successors.length === 0) activities[j].successors.push(numJobs - 1);
  }

  // Precedências com ciclo travariam o solver (Kahn não fecha a ordem topológica).
  // Detecta e rejeita com mensagem clara em vez de deixar o WASM abortar.
  assertAcyclic(activities, numJobs);

  return { name, numJobs, resources, activities };
}
