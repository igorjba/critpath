import type { Activity, RcpspProject, ResourceDef } from "@/lib/rcpsp/types";
import type { ActivityMeta } from "@/lib/rcpsp/types";

// Definição legível de uma atividade, com precedências e demandas por chave de recurso.
export interface ActivityDef {
  id: number; // 1-based, referenciado por preds
  name: string;
  duration: number;
  demands: Record<string, number>;
  preds: number[];
  meta?: ActivityMeta;
}

export interface ResourceDefInput {
  id: string;
  label: string;
  capacity: number;
}

// Monta um RcpspProject com as duas atividades dummy (source=0, sink=N-1).
// Atividades sem predecessor penduram no source; sem sucessor, no sink.
export function buildProject(
  name: string,
  resources: ResourceDefInput[],
  defs: ActivityDef[],
): RcpspProject {
  const n = defs.length;
  const numJobs = n + 2;
  const resDefs: ResourceDef[] = resources.map((r) => ({
    id: r.id,
    label: r.label,
    capacity: r.capacity,
  }));
  const resIndex = new Map(resources.map((r, k) => [r.id, k]));
  const K = resources.length;

  // id externo (1..n) -> id interno (1..n); source=0, sink=n+1
  const internalOf = (extId: number) => extId;

  const hasSucc = new Set<number>();
  for (const d of defs) for (const p of d.preds) hasSucc.add(p);

  const activities: Activity[] = new Array(numJobs);

  // source
  activities[0] = {
    id: 0,
    label: "start",
    duration: 0,
    demands: new Array(K).fill(0),
    successors: defs.filter((d) => d.preds.length === 0).map((d) => internalOf(d.id)),
  };

  for (const d of defs) {
    const demands = new Array(K).fill(0);
    for (const [key, v] of Object.entries(d.demands)) {
      const k = resIndex.get(key);
      if (k == null) throw new Error(`Recurso desconhecido: ${key}`);
      demands[k] = v;
    }
    const successors = defs.filter((s) => s.preds.includes(d.id)).map((s) => internalOf(s.id));
    if (successors.length === 0) successors.push(numJobs - 1); // -> sink
    activities[internalOf(d.id)] = {
      id: internalOf(d.id),
      label: d.name,
      duration: d.duration,
      demands,
      successors,
      meta: d.meta,
    };
  }

  // sink
  activities[numJobs - 1] = {
    id: numJobs - 1,
    label: "end",
    duration: 0,
    demands: new Array(K).fill(0),
    successors: [],
  };

  // Fecha source -> atividades órfãs (nenhum pred): já feito acima.
  // Garante que toda atividade não referenciada como pred vá ao sink: feito acima.
  void hasSucc;

  return { name, numJobs, resources: resDefs, activities };
}
