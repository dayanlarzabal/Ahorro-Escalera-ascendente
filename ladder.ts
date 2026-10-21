export const GOAL = 250_000;
export const WEEK_COUNT = 50;
export const JOKER_MAX = 2;

export type Cell = "open" | "saved" | "joker" | "recovered";

export interface Level {
  id: number;
  name: string;
  weekly: number;
  share: string;
  acumulado: number;
  star: boolean;
}

const WEEKLY = [3200, 3600, 4000, 4400, 4800, 5200, 5600, 6000, 6400, 6800];
const NAMES = [
  "Semilla",
  "Brote",
  "Tallo",
  "Rama",
  "Hoja",
  "Flor",
  "Fruto",
  "Cosecha",
  "Árbol",
  "Bosque",
];
const SHARES = ["6%", "14%", "22%", "30%", "40%", "50%", "62%", "74%", "86%", "100%"];
const STAR_LEVELS = new Set([4, 6, 9]);

function buildLevels(): Level[] {
  let acc = 0;
  return WEEKLY.map((weekly, index) => {
    acc += weekly * 5;
    const id = index + 1;
    return {
      id,
      name: NAMES[index] ?? "Nivel",
      weekly,
      share: SHARES[index] ?? "",
      acumulado: acc,
      star: STAR_LEVELS.has(id),
    };
  });
}

export const LEVELS: Level[] = buildLevels();

if (LEVELS.length !== 10 || LEVELS[9]?.acumulado !== GOAL) {
  throw new Error("La escalera no suma 250,000 CUP");
}

export const MILESTONES = [
  { pct: 25 as const, amount: 62_500, title: "Primer cuarto", line: "Celebra con un premio pequeño." },
  { pct: 50 as const, amount: 125_000, title: "Mitad de la cima", line: "Vas por la mitad. Un premio pequeño." },
  { pct: 75 as const, amount: 187_500, title: "El bosque se ve", line: "Tres cuartos. Toca celebrar." },
];

export type MilestonePct = (typeof MILESTONES)[number]["pct"];

export interface Prize {
  pct: MilestonePct;
  week: number;
  note: string;
}

export function levelOfWeek(week: number): Level {
  const level = LEVELS[Math.floor(week / 5)];
  if (!level) return LEVELS[0]!;
  return level;
}

export function weeklyAmount(week: number): number {
  return levelOfWeek(week).weekly;
}

export function plannedCumulative(weekIndex: number): number {
  let total = 0;
  for (let i = 0; i <= weekIndex; i += 1) total += weeklyAmount(i);
  return total;
}

/** Week index (0-based) where the plan first crosses each star. */
export const STAR_WEEK_INDEX: number[] = MILESTONES.map((milestone) => {
  for (let i = 0; i < WEEK_COUNT; i += 1) {
    if (plannedCumulative(i) >= milestone.amount) return i;
  }
  return WEEK_COUNT - 1;
});

export function isStarWeek(week: number): boolean {
  return STAR_WEEK_INDEX.includes(week);
}

export function totalSaved(cells: Cell[]): number {
  return cells.reduce((sum, cell, index) => {
    if (cell === "saved" || cell === "recovered") return sum + weeklyAmount(index);
    return sum;
  }, 0);
}

export function currentWeek(cells: Cell[]): number {
  return cells.findIndex((cell) => cell === "open");
}

export function jokersUsed(cells: Cell[]): number {
  return cells.filter((cell) => cell === "joker" || cell === "recovered").length;
}

export function pendingJokers(cells: Cell[]): number[] {
  const weeks: number[] = [];
  cells.forEach((cell, index) => {
    if (cell === "joker") weeks.push(index);
  });
  return weeks;
}

export function slotsFilled(cells: Cell[]): number {
  return cells.filter((cell) => cell !== "open").length;
}

export function pendingMilestone(total: number, prizes: Prize[]) {
  return MILESTONES.find(
    (milestone) => total >= milestone.amount && !prizes.some((prize) => prize.pct === milestone.pct),
  );
}

export function formatCup(amount: number): string {
  return `${amount.toLocaleString("en-US")} CUP`;
}

export function formatNumber(amount: number): string {
  return amount.toLocaleString("en-US");
}

export function todayISO(): string {
  const now = new Date();
  const z = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${z(now.getMonth() + 1)}-${z(now.getDate())}`;
}

export function addWeeksISO(start: string, weeks: number): string {
  const [year, month, day] = start.split("-").map(Number);
  const date = new Date(year || 2026, (month || 1) - 1, day || 1);
  date.setDate(date.getDate() + weeks * 7);
  const z = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${z(date.getMonth() + 1)}-${z(date.getDate())}`;
}

export function daysUntil(iso: string): number {
  const [year, month, day] = iso.split("-").map(Number);
  const target = new Date(year || 2026, (month || 1) - 1, day || 1);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

const DAY = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MONTH = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export function formatDay(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(year || 2026, (month || 1) - 1, day || 1);
  return `${DAY[date.getDay()]} ${date.getDate()} ${MONTH[date.getMonth()]}`;
}

export function dueLabel(iso: string): string {
  const days = daysUntil(iso);
  if (days === 0) return "Hoy te pagas primero";
  if (days === 1) return "Mañana";
  if (days > 1) return `En ${days} días`;
  if (days === -1) return "Atrasada 1 día";
  return `Atrasada ${Math.abs(days)} días`;
}

export function levelProgress(cells: Cell[], levelId: number): { done: number; owed: number } {
  const start = (levelId - 1) * 5;
  let done = 0;
  let owed = 0;
  for (let i = start; i < start + 5; i += 1) {
    const cell = cells[i];
    if (cell === "saved" || cell === "recovered") done += 1;
    if (cell === "joker") owed += 1;
  }
  return { done, owed };
}
