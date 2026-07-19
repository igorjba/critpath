import { describe, it, expect } from "vitest";
import { parseSapExport } from "@/lib/sap/import";
import { sampleIwExport } from "@/lib/sap/sample";

describe("importador IW39/IW49", () => {
  it("interpreta o export de exemplo (13 operações + 2 dummies)", () => {
    const p = parseSapExport(sampleIwExport);
    expect(p.numJobs).toBe(15);
    expect(p.resources.map((r) => r.id)).toContain("CRANE");
  });

  it("rejeita precedências com ciclo", () => {
    const cyclic = `Ordem;Operacao;Texto;Centro;Duracao;Cap;Predecessoras
1;0010;a;MEC;5;2;0020
1;0020;b;MEC;5;2;0010`;
    expect(() => parseSapExport(cyclic)).toThrow(/ciclo/i);
  });

  it("neutraliza cabeçalho malicioso (__proto__) sem poluir o protótipo", () => {
    const evil = `__proto__;Operacao;Centro;Duracao;Cap;Predecessoras
x;0010;MEC;5;2;`;
    parseSapExport(evil);
    expect((Object.prototype as Record<string, unknown>).polluted).toBeUndefined();
  });
});
