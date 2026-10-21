let ctx: AudioContext | null = null;

export function playTone(kind: "save" | "star" | "summit" | "joker", muted: boolean) {
  if (muted || typeof window === "undefined") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return;
  if (!ctx) ctx = new AudioCtx();
  if (ctx.state === "suspended") void ctx.resume();
  const notes =
    kind === "summit" ? [523, 659, 784] : kind === "star" ? [494, 659] : kind === "joker" ? [349, 440] : [523, 659];
  const now = ctx.currentTime;
  notes.forEach((freq, index) => {
    const osc = ctx!.createOscillator();
    const gain = ctx!.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(ctx!.destination);
    const start = now + index * 0.09;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.05, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.28);
    osc.start(start);
    osc.stop(start + 0.3);
  });
}
