import type { RcpspProject } from "./types";
import type { SolveResult } from "@/lib/engine/types";

export interface ScheduledActivity {
  id: number;
  label: string;
  duration: number;
  demands: number[];
  start: number;
  finish: number;
  es: number;
  ls: number;
  totalSlack: number;
  freeSlack: number;
  isCritical: boolean;
  confinedSpace: boolean;
  requiresCrane: boolean;
}

export interface ResourceProfile {
  id: string;
  label: string;
  capacity: number;
  /** uso por unidade de tempo, comprimento = makespan */
  usage: number[];
  peak: number;
  /** fração do horizonte em que o recurso opera no teto (proxy de gargalo real) */
  saturatedFraction: number;
}

// Enriquece o resultado do solver com folgas (base CPM) e marca o caminho crítico.
// Folga total = LS - ES (ignora recursos, definição clássica); folga livre = quanto a
// atividade pode atrasar sem empurrar o início mais cedo de qualquer sucessor.
export function buildScheduledActivities(
  project: RcpspProject,
  result: SolveResult,
): ScheduledActivity[] {
  const { activities } = project;
  const { earliestStart: ES, earliestFinish: EF, latestStart: LS } = result;

  const out: ScheduledActivity[] = [];
  for (let j = 0; j < project.numJobs; j++) {
    const a = activities[j];
    const totalSlack = LS[j] - ES[j];
    let freeSlack: number;
    if (a.successors.length > 0) {
      let minSuccES = Infinity;
      for (const s of a.successors) if (ES[s] < minSuccES) minSuccES = ES[s];
      freeSlack = minSuccES - EF[j];
    } else {
      freeSlack = result.makespan - EF[j];
    }
    out.push({
      id: j,
      label: a.label,
      duration: a.duration,
      demands: a.demands,
      start: result.starts[j],
      finish: result.finishes[j],
      es: ES[j],
      ls: LS[j],
      totalSlack,
      freeSlack: Math.max(0, freeSlack),
      isCritical: totalSlack === 0,
      confinedSpace: a.meta?.confinedSpace ?? false,
      requiresCrane: a.meta?.requiresCrane ?? false,
    });
  }
  return out;
}

// Perfil de carga por recurso ao longo do horizonte (nivelamento e gargalos).
export function buildResourceProfiles(
  project: RcpspProject,
  result: SolveResult,
): ResourceProfile[] {
  const T = Math.max(1, result.makespan);
  const K = project.resources.length;
  const usage: number[][] = Array.from({ length: K }, () => new Array<number>(T).fill(0));

  for (let j = 0; j < project.numJobs; j++) {
    const a = project.activities[j];
    const s = result.starts[j];
    const f = result.finishes[j];
    for (let k = 0; k < K; k++) {
      const d = a.demands[k];
      if (d === 0) continue;
      for (let t = s; t < f && t < T; t++) usage[k][t] += d;
    }
  }

  return project.resources.map((r, k) => {
    const peak = usage[k].reduce((m, v) => (v > m ? v : m), 0);
    const atCap = usage[k].reduce((n, v) => n + (v >= r.capacity ? 1 : 0), 0);
    return {
      id: r.id,
      label: r.label,
      capacity: r.capacity,
      usage: usage[k],
      peak,
      saturatedFraction: atCap / T,
    };
  });
}

// Fração da janela consumida pelo caminho crítico (aperto do cronograma).
export function scheduleTightness(result: SolveResult): number {
  if (result.makespan === 0) return 0;
  return result.criticalPathLB / result.makespan;
}
