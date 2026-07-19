import { describe, it, expect } from "vitest";
import { turnaroundSample } from "@/lib/data/turnaround";
import { psplibInstances } from "@/lib/data/psplib";
import type { RcpspProject } from "@/lib/rcpsp/types";
import { solveInNode } from "./helpers";

// Verifica as duas invariantes de viabilidade sobre o cronograma produzido pelo solver:
// nenhum sucessor começa antes do fim do predecessor, e em nenhum instante o uso de um
// recurso passa da capacidade. Retorna a lista de violações (vazia = viável).
function violations(project: RcpspProject, starts: number[]): string[] {
  const acts = project.activities;
  const out: string[] = [];
  for (const a of acts) {
    for (const s of a.successors) {
      if (starts[s] < starts[a.id] + a.duration) {
        out.push(`precedência ${a.id}->${s}: início ${starts[s]} < fim ${starts[a.id] + a.duration}`);
      }
    }
  }
  const K = project.resources.length;
  const T = Math.max(...acts.map((a) => starts[a.id] + a.duration));
  for (let t = 0; t < T; t++) {
    for (let k = 0; k < K; k++) {
      let use = 0;
      for (const a of acts) {
        if (starts[a.id] <= t && t < starts[a.id] + a.duration) use += a.demands[k];
      }
      if (use > project.resources[k].capacity) {
        out.push(`recurso ${project.resources[k].id} em t=${t}: uso ${use} > capacidade ${project.resources[k].capacity}`);
      }
    }
  }
  return out;
}

describe("solver RCPSP", () => {
  it("produz cronograma viável para a parada de exemplo", () => {
    const project = turnaroundSample();
    const { starts, makespan } = solveInNode(project, 20000);
    expect(violations(project, starts)).toEqual([]);
    expect(makespan).toBeGreaterThan(0);
  });

  it("atinge o ótimo provado na instância J30 1-1 (makespan 43)", () => {
    const inst = psplibInstances.find((i) => i.key === "1_1");
    if (!inst) throw new Error("instância J30 1-1 ausente do dataset empacotado");
    const { makespan, starts } = solveInNode(inst.project, 20000);
    expect(violations(inst.project, starts)).toEqual([]);
    expect(makespan).toBe(inst.optimum);
  });

  it("nunca fica abaixo do limite inferior de caminho crítico", () => {
    const inst = psplibInstances[0];
    const { makespan, criticalPathLB } = solveInNode(inst.project, 20000);
    expect(makespan).toBeGreaterThanOrEqual(criticalPathLB);
  });
});
