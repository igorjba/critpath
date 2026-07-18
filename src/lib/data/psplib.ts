import raw from "./psplib-sample.json";
import type { RcpspProject } from "@/lib/rcpsp/types";

export interface PsplibInstance {
  key: string;
  label: string;
  optimum: number;
  project: RcpspProject;
}

export const psplibInstances = raw as unknown as PsplibInstance[];
