// Histórico de vida de selos mecânicos das bombas P-101/P-102 (horas em operação).
// A maioria das unidades ainda não falhou — são observações censuradas à direita.
// Ignorar a censura puxaria a vida característica para baixo e adiantaria a preventiva.

export interface ReliabilitySample {
  name: string;
  unit: string;
  times: number[];
  censored: boolean[];
}

export const sealLifeSample: ReliabilitySample = {
  name: "Selo mecânico — bombas P-101/P-102",
  unit: "h",
  // t: horas; censored=true => ainda em operação (não falhou)
  times: [
    4200, 5100, 6300, 7000, 7850, 8600, 9500, 10200, 11800,
    3000, 4000, 5000, 6000, 8000, 9000, 10000, 11000, 12000, 13000, 9800,
  ],
  censored: [
    false, false, false, false, false, false, false, false, false,
    true, true, true, true, true, true, true, true, true, true, true,
  ],
};
