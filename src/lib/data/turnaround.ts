import { buildProject, type ActivityDef, type ResourceDefInput } from "./build";
import type { RcpspProject } from "@/lib/rcpsp/types";

// Parada programada de uma unidade de destilação de cru (coluna T-101, permutadores
// E-101/E-102, bombas P-101/P-102 e forno H-101). Tempos em horas.
//
// O guindaste (CRANE, capacidade 1) é recurso único e vira gargalo — puxa feixe de
// permutador, remove cabeçotes e troca tubo de forno competem por ele. Espaço confinado
// na coluna e no forno bloqueia paralelismo de fato: inspeção interna, troca de pratos
// e reparo de casco não coexistem com serviço a quente adjacente.

const resources: ResourceDefInput[] = [
  { id: "MEC", label: "Mecânicos", capacity: 8 },
  { id: "WELD", label: "Soldadores", capacity: 4 },
  { id: "RIG", label: "Rigging", capacity: 6 },
  { id: "CRANE", label: "Guindaste", capacity: 1 },
  { id: "SCAF", label: "Andaimes", capacity: 5 },
  { id: "INSP", label: "Inspeção", capacity: 3 },
];

const activities: ActivityDef[] = [
  { id: 1, name: "Mobilização e canteiro", duration: 8, demands: { MEC: 2, RIG: 2 }, preds: [] },
  { id: 2, name: "Permissões e bloqueio (LOTO)", duration: 6, demands: { MEC: 2, INSP: 1 }, preds: [1] },
  { id: 3, name: "Despressurizar, drenar e purgar", duration: 10, demands: { MEC: 3 }, preds: [2] },
  { id: 4, name: "Gás-free e liberação de entrada", duration: 6, demands: { INSP: 2 }, preds: [3] },
  { id: 5, name: "Montar andaime da coluna", duration: 16, demands: { SCAF: 5 }, preds: [2] },
  { id: 6, name: "Montar andaime dos permutadores", duration: 10, demands: { SCAF: 3 }, preds: [2] },
  { id: 7, name: "Remover isolamento da coluna", duration: 8, demands: { MEC: 3 }, preds: [5] },
  { id: 8, name: "Abrir bocas de visita da coluna", duration: 6, demands: { MEC: 3, RIG: 2 }, preds: [4, 7] },
  { id: 9, name: "Setup do guindaste e plano de içamento", duration: 6, demands: { RIG: 3, CRANE: 1 }, preds: [1] },
  { id: 10, name: "Remover cabeçotes dos permutadores", duration: 12, demands: { MEC: 3, RIG: 2, CRANE: 1 }, preds: [4, 6, 9] },
  { id: 11, name: "Puxar feixe E-101", duration: 8, demands: { RIG: 4, CRANE: 1 }, preds: [10] },
  { id: 12, name: "Puxar feixe E-102", duration: 8, demands: { RIG: 4, CRANE: 1 }, preds: [10] },
  {
    id: 13, name: "Inspeção interna da coluna", duration: 8, demands: { INSP: 2, MEC: 2 }, preds: [8],
    meta: { confinedSpace: true },
  },
  {
    id: 14, name: "Trocar pratos 10-20 da coluna", duration: 24, demands: { MEC: 4, WELD: 2 }, preds: [13],
    meta: { confinedSpace: true, optimistic: 20, mostLikely: 24, pessimistic: 40 },
  },
  {
    id: 15, name: "Reparo de solda no casco", duration: 16, demands: { WELD: 3, INSP: 1 }, preds: [13],
    meta: { confinedSpace: true, optimistic: 12, mostLikely: 16, pessimistic: 30 },
  },
  { id: 16, name: "Hidrojato dos feixes", duration: 12, demands: { MEC: 3 }, preds: [11, 12] },
  { id: 17, name: "Correntes parasitas (tubos)", duration: 8, demands: { INSP: 2 }, preds: [16] },
  {
    id: 18, name: "Retubagem/tamponamento E-101", duration: 20, demands: { MEC: 3, WELD: 2 }, preds: [17],
    meta: { optimistic: 16, mostLikely: 20, pessimistic: 34 },
  },
  { id: 19, name: "Revisão da bomba P-101", duration: 14, demands: { MEC: 3 }, preds: [4] },
  { id: 20, name: "Revisão da bomba P-102", duration: 14, demands: { MEC: 3 }, preds: [4] },
  {
    id: 21, name: "Inspeção de tubos do forno", duration: 10, demands: { INSP: 2, MEC: 2 }, preds: [4],
    meta: { confinedSpace: true },
  },
  {
    id: 22, name: "Troca de tubos do forno H-101", duration: 28, demands: { WELD: 3, RIG: 2, CRANE: 1 }, preds: [21],
    meta: { requiresCrane: true, optimistic: 22, mostLikely: 28, pessimistic: 48 },
  },
  { id: 23, name: "Reinstalar feixes dos permutadores", duration: 10, demands: { RIG: 4, CRANE: 1 }, preds: [18] },
  { id: 24, name: "Fechar e torquear permutadores", duration: 8, demands: { MEC: 3, INSP: 1 }, preds: [23] },
  { id: 25, name: "Fechar bocas e torquear coluna", duration: 8, demands: { MEC: 3, INSP: 1 }, preds: [14, 15] },
  { id: 26, name: "Reinstalar isolamento e desmontar andaime", duration: 16, demands: { SCAF: 4, MEC: 2 }, preds: [24, 25] },
  { id: 27, name: "Reinstalar bombas e alinhar", duration: 10, demands: { MEC: 2 }, preds: [19, 20] },
  { id: 28, name: "Teste de estanqueidade", duration: 12, demands: { INSP: 2, MEC: 3 }, preds: [22, 26, 27] },
  { id: 29, name: "Remover raquetes e desbloquear", duration: 6, demands: { MEC: 3, INSP: 1 }, preds: [28] },
  { id: 30, name: "Purga N2 e preparo de partida", duration: 8, demands: { MEC: 2, INSP: 2 }, preds: [29] },
];

export function turnaroundSample(): RcpspProject {
  return buildProject("Parada CDU — Unidade de destilação de cru", resources, activities);
}
