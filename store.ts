import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  WEEK_COUNT,
  currentWeek,
  jokersUsed,
  JOKER_MAX,
  pendingMilestone,
  totalSaved,
  type Cell,
  type MilestonePct,
  type Prize,
} from "@/lib/ladder";

export interface HistoryItem {
  kind: "save" | "joker" | "recover";
  week: number;
}

interface Persisted {
  onboarded: boolean;
  startDate: string;
  cells: Cell[];
  history: HistoryItem[];
  prizes: Prize[];
  muted: boolean;
  summitSeen: boolean;
}

interface Store extends Persisted {
  begin: (startDate: string) => void;
  saveCurrent: () => void;
  jokerCurrent: () => void;
  recover: (week: number) => void;
  setPrize: (pct: MilestonePct, week: number, note: string) => void;
  ackSummit: () => void;
  undo: () => void;
  reset: () => void;
  toggleMuted: () => void;
}

function emptyCells(): Cell[] {
  return Array.from({ length: WEEK_COUNT }, () => "open" as const);
}

function isCell(value: unknown): value is Cell {
  return value === "open" || value === "saved" || value === "joker" || value === "recovered";
}

function sanitize(raw: Partial<Persisted> | undefined): Persisted {
  const cells = Array.isArray(raw?.cells) && raw.cells.length === WEEK_COUNT && raw.cells.every(isCell)
    ? raw.cells
    : emptyCells();
  const history = Array.isArray(raw?.history)
    ? raw.history.filter(
        (item): item is HistoryItem =>
          !!item &&
          (item.kind === "save" || item.kind === "joker" || item.kind === "recover") &&
          Number.isInteger(item.week),
      )
    : [];
  const prizes = Array.isArray(raw?.prizes)
    ? raw.prizes.filter(
        (prize): prize is Prize =>
          !!prize &&
          (prize.pct === 25 || prize.pct === 50 || prize.pct === 75) &&
          typeof prize.note === "string" &&
          Number.isInteger(prize.week),
      )
    : [];
  return {
    onboarded: raw?.onboarded === true,
    startDate: typeof raw?.startDate === "string" ? raw.startDate : "",
    cells,
    history,
    prizes,
    muted: raw?.muted === true,
    summitSeen: raw?.summitSeen === true,
  };
}

const initial = sanitize(undefined);

export const useSave = create<Store>()(
  persist(
    (set, get) => ({
      ...initial,
      begin: (startDate) => set({ onboarded: true, startDate }),
      saveCurrent: () => {
        const { cells, history } = get();
        const week = currentWeek(cells);
        if (week < 0) return;
        const next = cells.slice();
        next[week] = "saved";
        set({ cells: next, history: [...history, { kind: "save", week }] });
      },
      jokerCurrent: () => {
        const { cells, history } = get();
        const week = currentWeek(cells);
        if (week < 0 || jokersUsed(cells) >= JOKER_MAX) return;
        const next = cells.slice();
        next[week] = "joker";
        set({ cells: next, history: [...history, { kind: "joker", week }] });
      },
      recover: (week) => {
        const { cells, history } = get();
        if (cells[week] !== "joker") return;
        const next = cells.slice();
        next[week] = "recovered";
        set({ cells: next, history: [...history, { kind: "recover", week }] });
      },
      setPrize: (pct, week, note) => {
        const prizes = get().prizes.filter((prize) => prize.pct !== pct);
        set({ prizes: [...prizes, { pct, week, note }] });
      },
      ackSummit: () => set({ summitSeen: true }),
      undo: () => {
        const { history, cells, prizes } = get();
        const last = history.at(-1);
        if (!last) return;
        const next = cells.slice();
        if ((last.kind === "save" || last.kind === "joker") && next[last.week] !== "open") {
          next[last.week] = "open";
        } else if (last.kind === "recover" && next[last.week] === "recovered") {
          next[last.week] = "joker";
        } else {
          return;
        }
        const total = totalSaved(next);
        set({
          cells: next,
          history: history.slice(0, -1),
          prizes: prizes.filter((prize) => total >= prize.pct * 2_500),
          summitSeen: total >= 250_000 ? get().summitSeen : false,
        });
      },
      reset: () =>
        set({
          onboarded: false,
          startDate: "",
          cells: emptyCells(),
          history: [],
          prizes: [],
          summitSeen: false,
        }),
      toggleMuted: () => set({ muted: !get().muted }),
    }),
    {
      name: "escalera-ascendente",
      skipHydration: true,
      partialize: (state) => ({
        onboarded: state.onboarded,
        startDate: state.startDate,
        cells: state.cells,
        history: state.history,
        prizes: state.prizes,
        muted: state.muted,
        summitSeen: state.summitSeen,
      }),
      merge: (persisted, current) => ({
        ...current,
        ...sanitize(persisted as Partial<Persisted> | undefined),
      }),
    },
  ),
);

export function selectTotal(state: Store): number {
  return totalSaved(state.cells);
}

export function selectPending(state: Store) {
  return pendingMilestone(selectTotal(state), state.prizes);
}
