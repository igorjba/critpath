import type { Activity, RcpspProject, ResourceDef } from "../rcpsp/types";

// Parser do formato PSPLIB single-mode (.sm). Cobre j30/j60/j120.
// Jobs no arquivo são 1-based; internamente usamos 0-based (0 = source, J-1 = sink).
export function parseSm(text: string, name = "instance"): RcpspProject {
  const lines = text.split(/\r?\n/);

  const numJobs = intAfter(lines, /jobs\s*\(incl\.\s*supersource\/sink\s*\)\s*:/i);
  const numRes = intAfter(lines, /-\s*renewable\s*:/i);
  if (numJobs == null || numRes == null) {
    throw new Error("Arquivo .sm inválido: cabeçalho de jobs/recursos ausente.");
  }

  const successors: number[][] = Array.from({ length: numJobs }, () => []);
  const durations = new Array<number>(numJobs).fill(0);
  const demands: number[][] = Array.from({ length: numJobs }, () =>
    new Array<number>(numRes).fill(0),
  );

  // --- PRECEDENCE RELATIONS ---
  let i = findLine(lines, /PRECEDENCE\s+RELATIONS/i);
  if (i < 0) throw new Error("Seção PRECEDENCE RELATIONS ausente.");
  i = skipToDataAfterHeader(lines, i, /jobnr/i);
  for (let read = 0; read < numJobs && i < lines.length; i++) {
    const nums = numbersOf(lines[i]);
    if (nums.length < 3) continue;
    const job = nums[0] - 1;
    const nSucc = nums[2];
    const succ = nums.slice(3, 3 + nSucc).map((s) => s - 1);
    successors[job] = succ;
    read++;
  }

  // --- REQUESTS/DURATIONS ---
  i = findLine(lines, /REQUESTS\/DURATIONS/i);
  if (i < 0) throw new Error("Seção REQUESTS/DURATIONS ausente.");
  i = skipToDataAfterHeader(lines, i, /jobnr/i);
  for (let read = 0; read < numJobs && i < lines.length; i++) {
    const nums = numbersOf(lines[i]);
    if (nums.length < 3 + numRes) continue;
    const job = nums[0] - 1;
    durations[job] = nums[2];
    for (let k = 0; k < numRes; k++) demands[job][k] = nums[3 + k];
    read++;
  }

  // --- RESOURCEAVAILABILITIES ---
  i = findLine(lines, /RESOURCEAVAILABILITIES/i);
  if (i < 0) throw new Error("Seção RESOURCEAVAILABILITIES ausente.");
  let caps: number[] = [];
  for (let j = i + 1; j < lines.length; j++) {
    // pula o cabeçalho "R 1  R 2 ..." (contém letras); a capacidade é linha só numérica
    if (/[A-Za-z]/.test(lines[j])) continue;
    const nums = numbersOf(lines[j]);
    if (nums.length >= numRes) { caps = nums.slice(0, numRes); break; }
  }
  if (caps.length < numRes) throw new Error("Capacidades de recurso ausentes.");

  const resources: ResourceDef[] = caps.map((c, k) => ({
    id: `R${k + 1}`,
    label: `R${k + 1}`,
    capacity: c,
  }));

  const activities: Activity[] = [];
  for (let j = 0; j < numJobs; j++) {
    activities.push({
      id: j,
      label: j === 0 ? "start" : j === numJobs - 1 ? "end" : String(j),
      duration: durations[j],
      demands: demands[j],
      successors: successors[j],
    });
  }

  return { name, numJobs, resources, activities };
}

function numbersOf(line: string): number[] {
  const m = line.match(/-?\d+/g);
  return m ? m.map(Number) : [];
}

function findLine(lines: string[], re: RegExp): number {
  for (let i = 0; i < lines.length; i++) if (re.test(lines[i])) return i;
  return -1;
}

function intAfter(lines: string[], re: RegExp): number | null {
  for (const l of lines) {
    if (re.test(l)) {
      const after = l.slice(l.search(re));
      const m = after.match(/:\s*(\d+)/);
      if (m) return Number(m[1]);
      const nums = numbersOf(after);
      if (nums.length) return nums[nums.length - 1];
    }
  }
  return null;
}

// A partir do cabeçalho da seção, pula a linha "jobnr..." e eventuais separadores.
function skipToDataAfterHeader(lines: string[], sectionIdx: number, headerRe: RegExp): number {
  let i = sectionIdx + 1;
  while (i < lines.length && !headerRe.test(lines[i])) i++;
  i++; // pula a própria linha de cabeçalho
  while (i < lines.length && /^[-\s*]+$/.test(lines[i])) i++; // pula linhas de traços
  return i;
}

// Parser da tabela de ótimos j30opt.sm: "Parameter Instance Makespan CPU".
// Chave "param_instance" (ex.: "1_1") -> makespan ótimo.
export function parseOptimalTable(text: string): Map<string, number> {
  const out = new Map<string, number>();
  for (const line of text.split(/\r?\n/)) {
    const nums = line.trim().match(/^(\d+)\s+(\d+)\s+(\d+)/);
    if (nums) out.set(`${nums[1]}_${nums[2]}`, Number(nums[3]));
  }
  return out;
}
