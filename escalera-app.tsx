import { useEffect, useRef, useState, type ReactNode } from "react";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import * as Dialog from "@radix-ui/react-dialog";
import { BookOpen, Flag, House, Mountain, Star, Ticket, Undo2, Volume2, VolumeX, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LadderBoard } from "@/components/ladder-board";
import { LevelIcon } from "@/components/level-icon";
import { cn } from "@/lib/cn";
import {
  GOAL,
  JOKER_MAX,
  LEVELS,
  MILESTONES,
  addWeeksISO,
  currentWeek,
  dueLabel,
  formatCup,
  formatDay,
  formatNumber,
  jokersUsed,
  levelOfWeek,
  pendingJokers,
  slotsFilled,
  todayISO,
  totalSaved,
  weeklyAmount,
  type Cell,
} from "@/lib/ladder";
import { playTone } from "@/lib/sound";
import { selectPending, useSave } from "@/lib/store";

type Tab = "inicio" | "escalera" | "hitos" | "reglas";

type Intent =
  | { kind: "save" }
  | { kind: "joker" }
  | { kind: "recover"; week: number }
  | { kind: "detail"; week: number };

const PRIZE_NOTES = ["Un café en casa", "Un helado", "Una tarde libre", "Un antojo", "Una llamada larga"];

const RULES = [
  "Cada semana pinta una casilla: ahorras el monto de tu nivel. Cada 5 semanas subes de nivel.",
  "Págate primero: aparta el dinero el mismo día que cobras o vendes, antes de gastar.",
  "Tienes 2 comodines: 2 semanas libres al año. La casilla se recupera después.",
  "Cada estrella marca un hito (25%, 50%, 75%): celebra con un premio pequeño.",
];

export function EscaleraApp() {
  useEffect(() => {
    void Promise.resolve(useSave.persist.rehydrate());
  }, []);
  return <ReadyApp />;
}

function ReadyApp() {
  const onboarded = useSave((s) => s.onboarded);
  const startDate = useSave((s) => s.startDate);
  const cells = useSave((s) => s.cells);
  const history = useSave((s) => s.history);
  const prizes = useSave((s) => s.prizes);
  const muted = useSave((s) => s.muted);
  const summitSeen = useSave((s) => s.summitSeen);
  const begin = useSave((s) => s.begin);
  const saveCurrent = useSave((s) => s.saveCurrent);
  const jokerCurrent = useSave((s) => s.jokerCurrent);
  const recover = useSave((s) => s.recover);
  const setPrize = useSave((s) => s.setPrize);
  const ackSummit = useSave((s) => s.ackSummit);
  const undo = useSave((s) => s.undo);
  const reset = useSave((s) => s.reset);
  const toggleMuted = useSave((s) => s.toggleMuted);

  const [tab, setTab] = useState<Tab>("inicio");
  const [intent, setIntent] = useState<Intent | null>(null);
  const [burst, setBurst] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [prizeOpen, setPrizeOpen] = useState(false);
  const [summitOpen, setSummitOpen] = useState(false);
  const [snoozePrize, setSnoozePrize] = useState<number | null>(null);
  const [snoozeSummit, setSnoozeSummit] = useState(false);
  const [start, setStart] = useState(todayISO);
  const timer = useRef<number | null>(null);

  const total = totalSaved(cells);
  const week = currentWeek(cells);
  const pending = selectPending(useSave());
  const finished = total >= GOAL;

  useEffect(() => {
    if (!pending) {
      setPrizeOpen(false);
      return;
    }
    if (snoozePrize === pending.pct) return;
    setPrizeOpen(true);
  }, [pending, snoozePrize]);

  useEffect(() => {
    if (prizeOpen || pending) return;
    if (finished && !summitSeen && !snoozeSummit) setSummitOpen(true);
  }, [finished, summitSeen, snoozeSummit, prizeOpen, pending]);

  useEffect(() => {
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  function flash(text: string) {
    if (timer.current) window.clearTimeout(timer.current);
    setBurst(text);
    timer.current = window.setTimeout(() => setBurst(null), 900);
  }

  function afterMoney(kind: "save" | "recover") {
    const state = useSave.getState();
    const milestone = selectPending(state);
    playTone(milestone ? "star" : "save", state.muted);
    if (!milestone) flash(kind === "save" ? "Apartado" : "Recuperada");
    setIntent(null);
  }

  function handleWeek(target: number) {
    const cell = cells[target];
    if (cell === "joker") setIntent({ kind: "recover", week: target });
    else if (target === week) setIntent({ kind: "save" });
    else if (cell === "saved" || cell === "recovered") setIntent({ kind: "detail", week: target });
  }

  if (!onboarded) {
    return (
      <Shell
        burst={burst}
        muted={muted}
        onToggleMuted={toggleMuted}
        showMute
      >
        <Welcome
          start={start}
          onStart={setStart}
          onBegin={() => {
            begin(start || todayISO());
            flash("Semilla");
            playTone("save", muted);
          }}
        />
      </Shell>
    );
  }

  const level = week >= 0 ? levelOfWeek(week) : LEVELS[9]!;
  const owed = pendingJokers(cells);
  const jokersLeft = JOKER_MAX - jokersUsed(cells);

  return (
    <Shell burst={burst} muted={muted} onToggleMuted={toggleMuted} showMute>
      <header className="flex items-start justify-between gap-3 px-5 pt-5">
        <div>
          <p className="text-xs tracking-widest text-muted uppercase">Meta {formatCup(GOAL)}</p>
          <h1 className="font-display text-2xl leading-tight">Escalera ascendente</h1>
        </div>
        <MuteButton muted={muted} onClick={toggleMuted} />
      </header>

      {tab === "inicio" ? (
        <HomeView
          cells={cells}
          total={total}
          week={week}
          levelId={level.id}
          startDate={startDate || todayISO()}
          jokersLeft={jokersLeft}
          owed={owed}
          history={history.length}
          onSave={() => setIntent({ kind: "save" })}
          onJoker={() => setIntent({ kind: "joker" })}
          onRecover={(target) => setIntent({ kind: "recover", week: target })}
          onUndo={() => {
            undo();
            flash("Deshecho");
          }}
        />
      ) : null}

      {tab === "escalera" ? <LadderBoard cells={cells} total={total} onWeek={handleWeek} /> : null}

      {tab === "hitos" ? <HitosView total={total} prizes={prizes} /> : null}

      {tab === "reglas" ? <RulesView onReset={reset} /> : null}

      <nav className="dock sticky bottom-0 mt-auto border-t border-line bg-paper/95 backdrop-blur-sm" aria-label="Secciones">
        <div className="grid grid-cols-4">
          <TabButton id="inicio" tab={tab} icon={House} label="Inicio" onSelect={setTab} />
          <TabButton id="escalera" tab={tab} icon={Mountain} label="Escalera" onSelect={setTab} />
          <TabButton id="hitos" tab={tab} icon={Star} label="Estrellas" onSelect={setTab} />
          <TabButton id="reglas" tab={tab} icon={BookOpen} label="Reglas" onSelect={setTab} />
        </div>
      </nav>

      <IntentSheet
        intent={intent}
        cells={cells}
        week={week}
        startDate={startDate || todayISO()}
        jokersLeft={jokersLeft}
        onClose={() => setIntent(null)}
        onSave={() => {
          saveCurrent();
          afterMoney("save");
        }}
        onJoker={() => {
          jokerCurrent();
          playTone("joker", useSave.getState().muted);
          flash("Semana libre");
          setIntent(null);
        }}
        onRecover={(target) => {
          recover(target);
          afterMoney("recover");
        }}
      />

      <Dialog.Root
        open={prizeOpen && !!pending}
        onOpenChange={(open) => {
          setPrizeOpen(open);
          if (!open && pending) setSnoozePrize(pending.pct);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-moss-deep/55" />
          {prizeOpen ? <Confetti /> : null}
          <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-xl rounded-t-3xl bg-surface p-6 shadow-lg focus:outline-none">
            <Dialog.Title className="font-display text-3xl leading-none">
              Estrella del {pending?.pct}%
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-muted">
              {pending?.title}. {pending?.line}
            </Dialog.Description>
            <div className="mt-4 flex flex-wrap gap-2">
              {PRIZE_NOTES.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={cn(
                    "min-h-11 rounded-full px-4 text-sm font-medium ring-1 ring-line",
                    note === item ? "bg-moss text-surface" : "bg-paper text-ink",
                  )}
                  onClick={() => setNote(item)}
                >
                  {item}
                </button>
              ))}
            </div>
            <label className="mt-4 block text-sm font-medium" htmlFor="premio">
              O escribe el tuyo
            </label>
            <input
              id="premio"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={80}
              placeholder="Un premio pequeño"
              className="date-field mt-2"
            />
            <div className="mt-5 flex flex-col gap-2">
              <Button
                disabled={note.trim().length === 0 || !pending}
                onClick={() => {
                  if (!pending) return;
                  setPrize(pending.pct, Math.max(0, slotsFilled(useSave.getState().cells) - 1), note.trim());
                  setNote("");
                  setPrizeOpen(false);
                  flash("Celebrado");
                }}
              >
                Lo celebro
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  if (pending) setSnoozePrize(pending.pct);
                  setPrizeOpen(false);
                }}
              >
                Después
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root
        open={summitOpen}
        onOpenChange={(open) => {
          setSummitOpen(open);
          if (!open) setSnoozeSummit(true);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-moss-deep/55" />
          {summitOpen ? <Confetti /> : null}
          <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-xl rounded-t-3xl bg-surface p-6 shadow-lg focus:outline-none">
            <Flag className="size-6 text-gold-deep" aria-hidden />
            <Dialog.Title className="mt-3 font-display text-4xl leading-none">Bosque</Dialog.Title>
            <Dialog.Description className="mt-2 text-muted">
              Llegaste a {formatCup(GOAL)}. Cincuenta semanas, diez niveles, la cima es tuya.
            </Dialog.Description>
            <Button
              className="mt-6"
              onClick={() => {
                ackSummit();
                setSummitOpen(false);
                playTone("summit", muted);
                flash("Cima");
              }}
            >
              Guardar la cima
            </Button>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </Shell>
  );
}

function Shell({
  children,
  burst,
  muted,
  onToggleMuted,
  showMute,
}: {
  children: ReactNode;
  burst?: string | null;
  muted?: boolean;
  onToggleMuted?: () => void;
  showMute?: boolean;
}) {
  return (
    <div className="min-h-dvh bg-moss-deep text-ink">
      <div className="mx-auto flex min-h-dvh w-full max-w-xl min-w-0 flex-col bg-paper">
        <div className="h-2 bg-moss" />
        {children}
        {showMute && onToggleMuted ? (
          <span className="sr-only">{muted ? "Sonido apagado" : "Sonido encendido"}</span>
        ) : null}
      </div>
      {burst ? (
        <div className="pointer-events-none fixed inset-x-0 top-24 z-30 flex justify-center" role="status">
          <p className="burst rounded-full bg-moss px-5 py-2 font-display text-xl text-surface">{burst}</p>
        </div>
      ) : null}
    </div>
  );
}

function MuteButton({ muted, onClick }: { muted: boolean; onClick: () => void }) {
  const Icon = muted ? VolumeX : Volume2;
  return (
    <button
      type="button"
      className="flex size-11 items-center justify-center rounded-full bg-surface text-ink ring-1 ring-line"
      onClick={onClick}
      aria-label={muted ? "Activar sonido" : "Silenciar"}
      aria-pressed={muted}
    >
      <Icon className="size-5" />
    </button>
  );
}

function Welcome({
  start,
  onStart,
  onBegin,
}: {
  start: string;
  onStart: (value: string) => void;
  onBegin: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col px-5 pt-8 pb-8">
      <p className="text-xs tracking-widest text-muted uppercase">Plan de ahorro</p>
      <h1 className="mt-2 font-display text-5xl leading-none text-balance">La escalera ascendente</h1>
      <p className="mt-4 text-base leading-relaxed text-muted">
        Empiezas suave y subes 400 CUP por semana en cada nivel hasta llegar a la cima.
      </p>
      <dl className="mt-6 grid grid-cols-3 gap-2">
        <Stat k="Meta" v="250,000" />
        <Stat k="Semanas" v="50" />
        <Stat k="Comodines" v="2" />
      </dl>
      <div className="mt-6 flex h-28 items-end gap-1" aria-hidden>
        {LEVELS.map((level) => (
          <div
            key={level.id}
            className={cn("flex-1 rounded-t-lg", `lvl-${level.id}`)}
            style={{ height: `${28 + level.id * 7}%` }}
          />
        ))}
      </div>
      <p className="mt-2 text-center text-xs text-muted">Semilla, brote, tallo… hasta el bosque.</p>
      <label className="mt-8 text-sm font-semibold" htmlFor="inicio">
        ¿Cuándo cobras la primera semana?
      </label>
      <input
        id="inicio"
        type="date"
        className="date-field mt-2"
        value={start}
        onChange={(event) => onStart(event.target.value)}
      />
      <p className="mt-2 text-sm text-muted">Cada casilla cae siete días después. El dinero se queda en este teléfono.</p>
      <Button className="mt-6" onClick={onBegin} disabled={!start}>
        Empezar a subir
      </Button>
      <details className="mt-6 rounded-card bg-surface p-4 ring-1 ring-line">
        <summary className="font-semibold">Reglas del juego</summary>
        <ol className="mt-3 flex flex-col gap-3">
          {RULES.map((rule, index) => (
            <li key={rule} className="flex gap-3 text-sm leading-relaxed">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-moss text-xs font-semibold text-surface">
                {index + 1}
              </span>
              <span>{rule}</span>
            </li>
          ))}
        </ol>
      </details>
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-2xl bg-surface px-2 py-3 text-center ring-1 ring-line">
      <dt className="text-xs tracking-wide text-muted uppercase">{k}</dt>
      <dd className="mt-1 font-display text-xl leading-none">{v}</dd>
    </div>
  );
}

function HomeView({
  cells,
  total,
  week,
  levelId,
  startDate,
  jokersLeft,
  owed,
  history,
  onSave,
  onJoker,
  onRecover,
  onUndo,
}: {
  cells: Cell[];
  total: number;
  week: number;
  levelId: number;
  startDate: string;
  jokersLeft: number;
  owed: number[];
  history: number;
  onSave: () => void;
  onJoker: () => void;
  onRecover: (week: number) => void;
  onUndo: () => void;
}) {
  const level = LEVELS[levelId - 1] ?? LEVELS[0]!;
  const pct = Math.min(100, Math.round((total / GOAL) * 100));
  const active = week >= 0;
  const amount = active ? weeklyAmount(week) : 0;
  const due = active ? addWeeksISO(startDate, week) : "";
  const next = MILESTONES.find((milestone) => total < milestone.amount);

  return (
    <div className="pb-2">
      <section className="px-5 pt-6">
        <p className="flex items-center gap-2 text-sm font-semibold text-moss">
          <LevelIcon id={level.id} className="size-4" />
          {active ? level.name : "Bosque"}
        </p>
        <p className="mt-2 font-display text-5xl leading-none tracking-tight">{formatNumber(total)}</p>
        <p className="mt-2 text-sm text-muted">
          de {formatCup(GOAL)} · {pct}%
        </p>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-paper-deep" aria-hidden>
          <div className="h-full rounded-full bg-moss" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          {total === 0
            ? "La semilla no hace ruido. Aparta la primera casilla antes de gastar."
            : active
              ? `${slotsFilled(cells)} de 50 casillas. Faltan ${formatCup(GOAL - total)}.`
              : owed.length
                ? "El bosque espera: recupera los comodines para cerrar la meta."
                : "Cima alcanzada. Las cincuenta casillas están pintadas."}
        </p>
      </section>

      {active ? (
        <article className="mx-5 mt-6 overflow-hidden rounded-card bg-surface ring-1 ring-line">
          <div className={cn("flex items-center gap-3 px-4 py-3", `lvl-${level.id}`)}>
            <LevelIcon id={level.id} className="size-5" />
            <div>
              <p className="text-xs tracking-widest uppercase opacity-80">Nivel {level.id}</p>
              <p className="font-display text-lg leading-tight">{level.name}</p>
            </div>
            <p className="ml-auto text-right text-sm">{level.share}</p>
          </div>
          <div className="p-5">
            <p className="text-sm text-muted">Semana {week + 1} de 50</p>
            <p className="mt-1 font-display text-3xl leading-none">{formatCup(amount)}</p>
            <p className={cn("mt-2 text-sm", dueLabel(due).startsWith("Atrasada") ? "text-gold-deep" : "text-muted")}>
              {dueLabel(due)} · {formatDay(due)}
            </p>
            <div className="mt-5 flex flex-col gap-3">
              <Button onClick={onSave}>Pintar esta semana</Button>
              <Button variant="surface" onClick={onJoker} disabled={jokersLeft <= 0}>
                <Ticket className="size-4" />
                Comodín · {jokersLeft} {jokersLeft === 1 ? "libre" : "libres"}
              </Button>
            </div>
          </div>
        </article>
      ) : null}

      {owed.length ? (
        <section className="mx-5 mt-4 rounded-card bg-surface p-5 ring-1 ring-line">
          <h2 className="font-display text-xl">Por recuperar</h2>
          <p className="mt-1 text-sm text-muted">El comodín no borra la casilla. La pintas cuando puedas.</p>
          <ul className="mt-4 flex flex-col gap-2">
            {owed.map((target) => (
              <li key={target}>
                <button
                  type="button"
                  className="flex min-h-11 w-full items-center justify-between rounded-2xl bg-paper px-4 text-left"
                  onClick={() => onRecover(target)}
                >
                  <span>
                    Semana {target + 1} · {levelOfWeek(target).name}
                  </span>
                  <span className="font-semibold">{formatCup(weeklyAmount(target))}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-6 px-5">
        <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">De semilla a bosque</h2>
        <ol className="mt-3 grid grid-cols-10">
          {LEVELS.map((item) => {
            const passed = item.id < levelId || (!active && item.id <= 10);
            const now = active && item.id === levelId;
            return (
              <li key={item.id} className="flex justify-center">
                <span
                  className={cn(
                    "flex size-7 items-center justify-center rounded-full",
                    passed || now ? `lvl-${item.id}` : "bg-paper-deep text-muted",
                    now && "ring-2 ring-star",
                  )}
                  title={item.name}
                >
                  <LevelIcon id={item.id} className="size-3.5" />
                </span>
              </li>
            );
          })}
        </ol>
        {next ? (
          <p className="mt-4 text-sm text-muted">
            Siguiente estrella: {next.pct}% · faltan {formatCup(next.amount - total)}.
          </p>
        ) : (
          <p className="mt-4 text-sm text-muted">Las tres estrellas ya quedaron atrás.</p>
        )}
        {history > 0 ? (
          <button
            type="button"
            className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-moss"
            onClick={onUndo}
          >
            <Undo2 className="size-4" />
            Deshacer última casilla
          </button>
        ) : null}
      </section>
    </div>
  );
}

function HitosView({
  total,
  prizes,
}: {
  total: number;
  prizes: { pct: number; week: number; note: string }[];
}) {
  return (
    <section className="px-5 pt-6">
      <h2 className="font-display text-3xl leading-none">Estrellas</h2>
      <p className="mt-2 text-sm text-muted">25%, 50% y 75%. Cada una se celebra con algo pequeño.</p>
      <ul className="mt-5 flex flex-col gap-3">
        {MILESTONES.map((milestone) => {
          const prize = prizes.find((item) => item.pct === milestone.pct);
          const unlocked = total >= milestone.amount;
          return (
            <li key={milestone.pct} className="rounded-card bg-surface p-5 ring-1 ring-line">
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "flex size-11 items-center justify-center rounded-full",
                    unlocked ? "bg-gold text-ink" : "bg-paper-deep text-muted",
                  )}
                >
                  <Star className={cn("size-5", unlocked && "fill-ink")} />
                </span>
                <div>
                  <p className="font-display text-2xl leading-none">{milestone.pct}%</p>
                  <p className="text-sm text-muted">{milestone.title}</p>
                </div>
              </div>
              <p className="mt-3 text-sm">
                {prize
                  ? `Semana ${prize.week + 1}: ${prize.note}`
                  : unlocked
                    ? "Llegaste. Falta anotar el premio."
                    : `Faltan ${formatCup(milestone.amount - total)}.`}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function RulesView({ onReset }: { onReset: () => void }) {
  return (
    <section className="px-5 pt-6">
      <h2 className="font-display text-3xl leading-none">Reglas del juego</h2>
      <ol className="mt-5 flex flex-col gap-4">
        {RULES.map((rule, index) => (
          <li key={rule} className="flex gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-moss font-semibold text-surface">
              {index + 1}
            </span>
            <p className="pt-1 text-sm leading-relaxed">{rule}</p>
          </li>
        ))}
      </ol>
      <div className="mt-6 rounded-card bg-surface p-5 ring-1 ring-line">
        <h3 className="font-display text-xl">Cómo se pinta</h3>
        <ul className="mt-3 flex flex-col gap-2 text-sm leading-relaxed text-muted">
          <li>La casilla con aro dorado es la de esta semana.</li>
          <li>Un aro dorado discontinuo es un comodín: todavía debes el monto.</li>
          <li>Casilla llena: ya apartaste ese dinero.</li>
          <li>El plan sube 400 CUP al cambiar de nivel, de 3,200 a 6,800.</li>
        </ul>
      </div>
      <AlertDialog.Root>
        <AlertDialog.Trigger asChild>
          <Button variant="surface" className="mt-6">
            Empezar de cero
          </Button>
        </AlertDialog.Trigger>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-40 bg-moss-deep/55" />
          <AlertDialog.Content className="fixed inset-x-4 top-1/2 z-50 mx-auto w-auto max-w-md -translate-y-1/2 rounded-card bg-surface p-6 shadow-lg focus:outline-none">
            <AlertDialog.Title className="font-display text-2xl">¿Borrar toda la escalera?</AlertDialog.Title>
            <AlertDialog.Description className="mt-2 text-sm text-muted">
              Se pierden las casillas pintadas y los premios. No se puede deshacer.
            </AlertDialog.Description>
            <div className="mt-5 flex flex-col gap-2">
              <AlertDialog.Action asChild>
                <Button variant="ink" onClick={onReset}>
                  Sí, empezar de cero
                </Button>
              </AlertDialog.Action>
              <AlertDialog.Cancel asChild>
                <Button variant="ghost">Seguir subiendo</Button>
              </AlertDialog.Cancel>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </section>
  );
}

function TabButton({
  id,
  tab,
  icon: Icon,
  label,
  onSelect,
}: {
  id: Tab;
  tab: Tab;
  icon: typeof House;
  label: string;
  onSelect: (tab: Tab) => void;
}) {
  const active = tab === id;
  return (
    <button
      type="button"
      className={cn(
        "flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-semibold",
        active ? "text-moss" : "text-muted",
      )}
      aria-current={active ? "page" : undefined}
      onClick={() => onSelect(id)}
    >
      <Icon className="size-5" />
      {label}
    </button>
  );
}

function IntentSheet({
  intent,
  cells,
  week,
  startDate,
  jokersLeft,
  onClose,
  onSave,
  onJoker,
  onRecover,
}: {
  intent: Intent | null;
  cells: Cell[];
  week: number;
  startDate: string;
  jokersLeft: number;
  onClose: () => void;
  onSave: () => void;
  onJoker: () => void;
  onRecover: (week: number) => void;
}) {
  const target = intent && "week" in intent ? intent.week : week;
  const safeWeek = target >= 0 ? target : 0;
  const level = levelOfWeek(safeWeek);
  const amount = weeklyAmount(safeWeek);
  const when = formatDay(addWeeksISO(startDate, safeWeek));
  const cell: Cell = cells[safeWeek] ?? "open";

  return (
    <Dialog.Root open={intent !== null} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-moss-deep/55" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-xl rounded-t-3xl bg-surface p-6 shadow-lg focus:outline-none">
          <Dialog.Close
            className="absolute top-4 right-4 flex size-11 items-center justify-center rounded-full text-ink"
            aria-label="Cerrar"
          >
            <X className="size-5" />
          </Dialog.Close>
          {!intent ? <Dialog.Title className="sr-only">Casilla</Dialog.Title> : null}
          {intent?.kind === "save" ? (
            <>
              <Dialog.Title className="font-display text-3xl leading-none">Págate primero</Dialog.Title>
              <Dialog.Description className="mt-2 text-muted">
                Aparta {formatCup(amount)} el mismo día que cobras o vendes, antes de gastar. Semana {safeWeek + 1} ·{" "}
                {level.name} · {when}.
              </Dialog.Description>
              <div className="mt-5 flex flex-col gap-2">
                <Button onClick={onSave}>Ya lo aparté</Button>
                <Button variant="ghost" onClick={onClose}>
                  Ahora no
                </Button>
              </div>
            </>
          ) : null}
          {intent?.kind === "joker" ? (
            <>
              <Dialog.Title className="font-display text-3xl leading-none">Semana libre</Dialog.Title>
              <Dialog.Description className="mt-2 text-muted">
                No apartas {formatCup(amount)} esta semana. La casilla queda pendiente y la recuperas después. Te
                quedarán {Math.max(0, jokersLeft - 1)} comodines.
              </Dialog.Description>
              <div className="mt-5 flex flex-col gap-2">
                <Button onClick={onJoker} disabled={jokersLeft <= 0}>
                  Tomo el comodín
                </Button>
                <Button variant="ghost" onClick={onClose}>
                  Mejor pinto
                </Button>
              </div>
            </>
          ) : null}
          {intent?.kind === "recover" ? (
            <>
              <Dialog.Title className="font-display text-3xl leading-none">Recupera la casilla</Dialog.Title>
              <Dialog.Description className="mt-2 text-muted">
                La semana {safeWeek + 1} ({level.name}) quedó libre. Aparta {formatCup(amount)} ahora para pintarla de
                verdad.
              </Dialog.Description>
              <div className="mt-5 flex flex-col gap-2">
                <Button onClick={() => onRecover(safeWeek)}>Ya recuperé este monto</Button>
                <Button variant="ghost" onClick={onClose}>
                  Todavía no
                </Button>
              </div>
            </>
          ) : null}
          {intent?.kind === "detail" ? (
            <>
              <Dialog.Title className="font-display text-3xl leading-none">Semana {safeWeek + 1}</Dialog.Title>
              <Dialog.Description className="mt-2 text-muted">
                {level.name} · {formatCup(amount)} · {when}.{" "}
                {cell === "recovered" ? "Comodín recuperado." : "Casilla pintada."}
              </Dialog.Description>
              <Button className="mt-5" variant="surface" onClick={onClose}>
                Cerrar
              </Button>
            </>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Confetti() {
  return (
    <div className="confetti pointer-events-none fixed inset-0 z-40 overflow-hidden" aria-hidden>
      {Array.from({ length: 18 }, (_, index) => (
        <span key={index} />
      ))}
    </div>
  );
}
