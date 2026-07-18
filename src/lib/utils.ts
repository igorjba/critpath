import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPct(v: number, digits = 1): string {
  return `${v.toFixed(digits)}%`;
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

// Sistema de tom compartilhado por KPIs, stat boxes e resumos.
export type Tone = "default" | "primary" | "critical" | "accent";

const TONE_TEXT: Record<Tone, string> = {
  default: "",
  primary: "text-primary",
  critical: "text-[var(--critical)]",
  accent: "text-accent",
};

export function toneText(tone: Tone = "default"): string {
  return TONE_TEXT[tone];
}

// Cor de fundo por criticidade (caminho crítico vs. com folga), usada em barras e marcadores.
export function criticalBg(critical: boolean): string {
  return critical ? "bg-[var(--critical)]" : "bg-[var(--chart-2)]";
}
