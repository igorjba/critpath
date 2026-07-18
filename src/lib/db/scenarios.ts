import Dexie, { type Table } from "dexie";

// Persistência local de cenários (IndexedDB via Dexie) para comparar execuções —
// esforço de busca, importações e ajustes de recurso — sem backend.
export interface Scenario {
  id?: number;
  name: string;
  source: string;
  makespan: number;
  lb: number;
  iterations: number;
  elapsedMs: number;
  p80: number | null;
  createdAt: number;
}

class CritpathDB extends Dexie {
  scenarios!: Table<Scenario, number>;
  constructor() {
    super("critpath");
    this.version(1).stores({ scenarios: "++id, createdAt, makespan" });
  }
}

export const db = new CritpathDB();

export async function saveScenario(s: Omit<Scenario, "id" | "createdAt">): Promise<void> {
  await db.scenarios.add({ ...s, createdAt: Date.now() });
}

export async function listScenarios(): Promise<Scenario[]> {
  return db.scenarios.orderBy("createdAt").reverse().toArray();
}

export async function deleteScenario(id: number): Promise<void> {
  await db.scenarios.delete(id);
}
