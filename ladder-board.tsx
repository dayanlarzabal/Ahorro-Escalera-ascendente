import { useEffect, useRef } from "react";
import { Flag, Star } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  LEVELS,
  currentWeek,
  formatNumber,
  isStarWeek,
  levelOfWeek,
  type Cell,
} from "@/lib/ladder";

export function LadderBoard({
  cells,
  total,
  onWeek,
}: {
  cells: Cell[];
  total: number;
  onWeek: (week: number) => void;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const currentRef = useRef<HTMLElement>(null);
  const weekNow = currentWeek(cells);
  const focusLevel = weekNow >= 0 ? levelOfWeek(weekNow).id : 10;

  useEffect(() => {
    const scroller = scrollerRef.current;
    const column = currentRef.current;
    if (!scroller || !column) return;
    const left = column.offsetLeft - scroller.clientWidth / 2 + column.clientWidth / 2;
    scroller.scrollTo({ left: Math.max(0, left) });
  }, [focusLevel]);

  return (
    <section className="pt-2">
      <div className="flex items-end justify-between px-5">
        <div>
          <h2 className="font-display text-2xl leading-tight">La escalera</h2>
          <p className="text-sm text-muted">De abajo hacia arriba. Cada 5 semanas, un nivel nuevo.</p>
        </div>
        <Flag className="size-5 text-gold-deep" aria-hidden />
      </div>
      <div ref={scrollerRef} className="mt-4 overflow-x-auto overscroll-x-contain px-5 pb-2">
        <div className="flex w-max items-end gap-2">
          {LEVELS.map((level) => {
            const start = (level.id - 1) * 5;
            const reached =
              (level.id === 4 && total >= 62_500) ||
              (level.id === 6 && total >= 125_000) ||
              (level.id === 9 && total >= 187_500);
            return (
              <article
                key={level.id}
                ref={level.id === focusLevel ? currentRef : undefined}
                className={cn(
                  "flex w-28 shrink-0 snap-start flex-col rounded-t-2xl px-2 pt-3 pb-2",
                  `lvl-${level.id}`,
                )}
              >
                <div aria-hidden style={{ height: `${(level.id - 1) * 12}px` }} />
                <p className="text-center text-xs tracking-widest uppercase opacity-80">Nivel {level.id}</p>
                <h3 className="text-center font-display text-lg leading-tight">{level.name}</h3>
                <p className="text-center text-xs opacity-80">{level.share} de la meta</p>
                <div className="mt-1 flex justify-center">
                  {level.star ? (
                    <Star
                      className={cn("size-4", reached ? "fill-current" : "opacity-50")}
                      aria-hidden
                    />
                  ) : level.id === 10 ? (
                    <Flag className="size-4" aria-hidden />
                  ) : (
                    <span className="size-4" />
                  )}
                </div>
                <p className="mt-2 text-center text-base font-semibold leading-none">
                  {formatNumber(level.weekly)}
                </p>
                <p className="text-center text-xs opacity-80">por semana</p>
                <div className="mt-3 flex flex-col gap-1">
                  {[4, 3, 2, 1, 0].map((offset) => {
                    const week = start + offset;
                    const cell = cells[week] ?? "open";
                    const isCurrent = week === weekNow;
                    const interactive = isCurrent || cell === "joker" || cell === "saved" || cell === "recovered";
                    const label = [
                      `Semana ${week + 1}`,
                      cell === "open" ? "sin pintar" : cell === "saved" ? "pintada" : cell === "joker" ? "comodín" : "recuperada",
                      formatNumber(level.weekly) + " CUP",
                    ].join(", ");
                    return (
                      <button
                        key={week}
                        type="button"
                        className={cn(
                          "cell",
                          cell === "open" && "cell-open",
                          cell === "saved" && "cell-saved",
                          cell === "joker" && "cell-joker",
                          cell === "recovered" && "cell-recovered",
                          isCurrent && "cell-current",
                        )}
                        disabled={!interactive}
                        aria-label={label}
                        onClick={() => onWeek(week)}
                      >
                        {week + 1}
                        {isStarWeek(week) ? (
                          <Star className="absolute -top-1 -right-1 size-3 fill-surface text-ink" aria-hidden />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-3 text-center text-xs tracking-wide uppercase opacity-75">Acumulado</p>
                <p className="text-center text-sm font-semibold">{formatNumber(level.acumulado)}</p>
              </article>
            );
          })}
        </div>
      </div>
      <div className="mx-5 mt-1 h-px bg-line" />
      <p className="px-5 pt-3 text-sm text-muted">
        Acumulado = total del plan al cerrar el nivel. Toca la casilla de esta semana para pintarla.
      </p>
    </section>
  );
}
