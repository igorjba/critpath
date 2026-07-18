// Modelo de domínio do RCPSP, independente de origem (PSPLIB, importador SAP ou editor).

export interface Activity {
  /** id interno 0-based; 0 = supersource, numJobs-1 = supersink */
  id: number;
  /** rótulo exibível (ex.: número da ordem IW39 ou índice PSPLIB) */
  label: string;
  duration: number;
  /** demanda por recurso renovável, alinhada a RcpspProject.resources */
  demands: number[];
  /** ids internos dos sucessores diretos */
  successors: number[];
  /** metadados opcionais para a camada de domínio de manutenção */
  meta?: ActivityMeta;
}

export interface ActivityMeta {
  workCenter?: string;
  confinedSpace?: boolean;
  requiresCrane?: boolean;
  /** três pontos PERT para o Monte Carlo; default derivado da duração determinística */
  optimistic?: number;
  mostLikely?: number;
  pessimistic?: number;
}

export interface ResourceDef {
  id: string;
  label: string;
  capacity: number;
}

export interface RcpspProject {
  name: string;
  /** número total de jobs, incluindo as duas atividades dummy */
  numJobs: number;
  resources: ResourceDef[];
  activities: Activity[];
}

export interface Schedule {
  starts: number[];
  finishes: number[];
  makespan: number;
  criticalPathLB: number;
}
