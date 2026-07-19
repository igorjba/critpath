"use client";
import { create } from "zustand";
import type { RcpspProject } from "@/lib/rcpsp/types";
import type { SolveProgress, SolveResult, MonteCarloResult } from "@/lib/engine/types";
import { solveProject, monteCarloProject, cancelSolve } from "@/lib/engine/client";
import { turnaroundSample } from "@/lib/data/turnaround";

type SolveStatus = "idle" | "solving" | "done" | "cancelled";
type McStatus = "idle" | "running" | "done";

interface AppState {
  project: RcpspProject;
  sourceLabel: string;
  /** identifica a origem no seletor: 'turnaround', a key da instancia PSPLIB, ou 'import' */
  sourceKey: string;
  iterations: number;
  seed: number;

  status: SolveStatus;
  progress: SolveProgress | null;
  result: SolveResult | null;
  cancelRequested: boolean;

  mcStatus: McStatus;
  monteCarlo: MonteCarloResult | null;

  setIterations: (n: number) => void;
  loadProject: (project: RcpspProject, label: string, sourceKey: string) => void;
  solve: () => Promise<void>;
  cancel: () => void;
  runMonteCarlo: (trials: number, spread: { low: number; high: number }) => Promise<void>;
}

export const useApp = create<AppState>((set, get) => ({
  project: turnaroundSample(),
  sourceLabel: "Parada CDU (exemplo)",
  sourceKey: "turnaround",
  iterations: 20000,
  seed: 20260718,

  status: "idle",
  progress: null,
  result: null,
  cancelRequested: false,

  mcStatus: "idle",
  monteCarlo: null,

  setIterations: (n) => set({ iterations: n }),

  loadProject: (project, label, sourceKey) =>
    set({
      project,
      sourceLabel: label,
      sourceKey,
      status: "idle",
      progress: null,
      result: null,
      monteCarlo: null,
      mcStatus: "idle",
    }),

  solve: async () => {
    const { project, iterations, seed } = get();
    set({
      status: "solving",
      progress: null,
      result: null,
      monteCarlo: null,
      mcStatus: "idle",
      cancelRequested: false,
    });
    try {
      const res = await solveProject(project, { iterations, seed }, (p) => set({ progress: p }));
      set((s) => ({ result: res, status: s.cancelRequested ? "cancelled" : "done" }));
    } catch (err) {
      console.error("solve failed", err);
      set({ status: "idle" });
    }
  },

  cancel: () => {
    set({ cancelRequested: true });
    cancelSolve();
  },

  runMonteCarlo: async (trials, spread) => {
    const { project, result } = get();
    if (!result) return;
    set({ mcStatus: "running" });
    try {
      const mc = await monteCarloProject(
        project,
        { trials, seed: 7919, spreadLow: spread.low, spreadHigh: spread.high },
        result,
      );
      set({ monteCarlo: mc, mcStatus: "done" });
    } catch (err) {
      console.error("monte carlo failed", err);
      set({ mcStatus: "idle" });
    }
  },
}));
