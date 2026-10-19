import { useEffect, useRef, useState } from "react";
import { Minus, Plus, Play, Square } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const NOTES = ["Do", "Do♯", "Re", "Mi♭", "Mi", "Fa", "Fa♯", "Sol", "La♭", "La", "Si♭", "Si"];
const METERS = ["2/4", "3/4", "4/4", "3/8", "6/8", "9/8", "12/8"] as const;

function detectPitch(buf: Float32Array, rate: number) {
  let rms = 0;
  for (const v of buf) rms += v * v;
  if (Math.sqrt(rms / buf.length) < 0.01) return null;
  const n = buf.length;
  let best = -1;
  let bestCorr = 0;
  for (let lag = Math.floor(rate / 1500); lag < Math.floor(rate / 50); lag++) {
    let c = 0;
    for (let i = 0; i < n - lag; i++) c += buf[i]! * buf[i + lag]!;
    if (c > bestCorr) {
      bestCorr = c;
      best = lag;
    }
  }
  return best > 0 ? rate / best : null;
}

function Tuner() {
  const [a4, setA4] = useState(442);
  const [freq, setFreq] = useState<number | null>(null);
  const [error, setError] = useState("");
  const stop = useRef<() => void>(() => {});

  useEffect(() => {
    const saved = Number(localStorage.getItem("tuner_a4"));
    if (saved >= 400 && saved <= 480) setA4(saved);
    void start();
    return () => stop.current();
  }, []);

  function changeA4(v: number) {
    const n = Math.min(480, Math.max(400, v));
    setA4(n);
    localStorage.setItem("tuner_a4", String(n));
  }

  async function start() {
    try {
      setError("");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = new AudioContext();
      void ctx.resume();
      const an = ctx.createAnalyser();
      an.fftSize = 2048;
      ctx.createMediaStreamSource(stream).connect(an);
      const buf = new Float32Array(an.fftSize);
      let raf = 0;
      const loop = () => {
        an.getFloatTimeDomainData(buf);
        const f = detectPitch(buf, ctx.sampleRate);
        if (f) setFreq(f);
        raf = requestAnimationFrame(loop);
      };
      loop();
      stop.current = () => {
        cancelAnimationFrame(raf);
        stream.getTracks().forEach((t) => t.stop());
        void ctx.close();
      };
    } catch {
      setError("No se ha podido usar el micrófono. Revisa los permisos.");
    }
  }

  let note = "—";
  let cents = 0;
  if (freq) {
    const midi = 69 + 12 * Math.log2(freq / a4);
    const r = Math.round(midi);
    cents = Math.round((midi - r) * 100);
    note = NOTES[((r % 12) + 12) % 12]!;
  }
  const ok = freq !== null && Math.abs(cents) <= 5;

  return (
    <div className="space-y-4 text-center">
      <div className="comic rounded-xl bg-card p-5">
        <p className={`text-6xl font-extrabold ${ok ? "text-primary" : ""}`}>{note}</p>
        <p className="mt-1 text-sm font-bold text-muted-foreground">
          {freq ? `${freq.toFixed(1)} Hz · ${cents > 0 ? "+" : ""}${cents} cents` : "Toca una nota"}
        </p>
        <div className="relative mx-auto mt-4 h-3 w-full max-w-xs rounded-full bg-muted">
          <div className="absolute left-1/2 top-[-4px] h-5 w-0.5 bg-foreground/40" />
          {freq && (
            <div
              className={`absolute top-[-6px] h-6 w-1.5 -translate-x-1/2 rounded-full transition-all ${ok ? "bg-primary" : "bg-destructive"}`}
              style={{ left: `${50 + Math.max(-50, Math.min(50, cents))}%` }}
            />
          )}
        </div>
      </div>
      <div className="flex items-center justify-center gap-2">
        <span className="text-xs font-extrabold uppercase text-muted-foreground">La =</span>
        <button
          onClick={() => changeA4(a4 - 1)}
          className="comic-sm comic-press rounded-lg bg-card p-2"
          aria-label="Bajar referencia"
        >
          <Minus className="h-4 w-4" />
        </button>
        <input
          type="number"
          value={a4}
          onChange={(e) => changeA4(Number(e.target.value) || 440)}
          className="comic-sm w-20 rounded-lg bg-card px-2 py-2 text-center font-extrabold"
          aria-label="Frecuencia de referencia"
        />
        <button
          onClick={() => changeA4(a4 + 1)}
          className="comic-sm comic-press rounded-lg bg-card p-2"
          aria-label="Subir referencia"
        >
          <Plus className="h-4 w-4" />
        </button>
        <span className="text-xs font-extrabold text-muted-foreground">Hz</span>
      </div>
      {error && (
        <div className="space-y-2">
          <p className="text-sm font-bold text-destructive">{error}</p>
          <button
            onClick={() => void start()}
            className="comic-sm comic-press rounded-lg bg-card px-3 py-1.5 text-sm font-extrabold"
          >
            Reintentar
          </button>
        </div>
      )}
    </div>
  );
}

function Metronome() {
  const [bpm, setBpm] = useState(100);
  const [meter, setMeter] = useState<(typeof METERS)[number]>("4/4");
  const [running, setRunning] = useState(false);
  const [beat, setBeat] = useState(-1);
  const taps = useRef<number[]>([]);
  const state = useRef({ bpm, meter });
  state.current = { bpm, meter };
  const stopRef = useRef<() => void>(() => {});

  useEffect(() => () => stopRef.current(), []);

  function start() {
    const ctx = new AudioContext();
    let next = ctx.currentTime + 0.1;
    let i = 0;
    const timer = window.setInterval(() => {
      while (next < ctx.currentTime + 0.12) {
        const [num, den] = state.current.meter.split("/").map(Number) as [number, number];
        const pos = i % num;
        const strong = pos === 0;
        const mid = den === 8 && pos % 3 === 0;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.frequency.value = strong ? 1600 : mid ? 1200 : 900;
        g.gain.setValueAtTime(strong ? 0.6 : 0.35, next);
        g.gain.exponentialRampToValueAtTime(0.001, next + 0.05);
        osc.connect(g).connect(ctx.destination);
        osc.start(next);
        osc.stop(next + 0.06);
        const delay = Math.max(0, (next - ctx.currentTime) * 1000);
        window.setTimeout(() => setBeat(pos), delay);
        next += 60 / state.current.bpm;
        i++;
      }
    }, 25);
    stopRef.current = () => {
      clearInterval(timer);
      void ctx.close();
    };
    setRunning(true);
  }

  function stop() {
    stopRef.current();
    setRunning(false);
    setBeat(-1);
  }

  function tap() {
    const now = performance.now();
    const t = taps.current.filter((x) => now - x < 2500);
    t.push(now);
    taps.current = t.slice(-6);
    if (taps.current.length >= 2) {
      const d = taps.current.slice(1).map((x, k) => x - taps.current[k]!);
      const avg = d.reduce((a, b) => a + b, 0) / d.length;
      setBpm(Math.round(Math.min(300, Math.max(30, 60000 / avg))));
    }
  }

  const num = Number(meter.split("/")[0]);
  const den = Number(meter.split("/")[1]);

  return (
    <div className="space-y-4 text-center">
      <div className="comic rounded-xl bg-card p-5">
        <p className="text-6xl font-extrabold">{bpm}</p>
        <p className="text-xs font-extrabold uppercase text-muted-foreground">BPM</p>
        <div className="mt-4 flex flex-wrap justify-center gap-1.5">
          {Array.from({ length: num }, (_, k) => (
            <span
              key={k}
              className={`h-4 w-4 rounded-full transition-colors ${
                beat === k
                  ? k === 0
                    ? "bg-primary"
                    : "bg-foreground"
                  : den === 8 && k % 3 === 0
                    ? "bg-muted-foreground/40"
                    : "bg-muted"
              }`}
            />
          ))}
        </div>
        <input
          type="range"
          min={30}
          max={300}
          value={bpm}
          onChange={(e) => setBpm(Number(e.target.value))}
          className="mt-4 w-full accent-[var(--primary)]"
          aria-label="Tempo"
        />
        <div className="mt-2 flex justify-center gap-2">
          {[-5, -1, 1, 5].map((d) => (
            <button
              key={d}
              onClick={() => setBpm((b) => Math.min(300, Math.max(30, b + d)))}
              className="comic-sm comic-press rounded-lg bg-background px-3 py-1.5 text-sm font-extrabold"
            >
              {d > 0 ? `+${d}` : d}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap justify-center gap-1.5">
        {METERS.map((m) => (
          <button
            key={m}
            onClick={() => setMeter(m)}
            className={`comic-sm comic-press rounded-lg px-3 py-2 text-sm font-extrabold ${meter === m ? "bg-primary text-primary-foreground" : "bg-card"}`}
          >
            {m}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={tap}
          className="comic comic-press rounded-lg bg-secondary py-3 font-extrabold uppercase text-secondary-foreground"
        >
          Tap
        </button>
        <button
          onClick={running ? stop : start}
          className="comic comic-press flex items-center justify-center gap-2 rounded-lg bg-primary py-3 font-extrabold uppercase text-primary-foreground"
        >
          {running ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          {running ? "Parar" : "Iniciar"}
        </button>
      </div>
    </div>
  );
}

type Tab = "afinador" | "metronomo";
const TAB_KEY = "tuner_last_tab";
const TAB_EVENT = "tuner-tab-change";

function readTab(): Tab {
  return localStorage.getItem(TAB_KEY) === "metronomo" ? "metronomo" : "afinador";
}

export function TuningForkIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M8 2v8a4 4 0 0 0 8 0V2" />
      <path d="M12 14v8" />
    </svg>
  );
}

export function MetronomeIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M9.5 3h5l4.5 18H5L9.5 3Z" />
      <path d="M5.8 17h12.4" />
      <path d="M12 17 16.5 6" />
    </svg>
  );
}

export function TunerMetronome({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [tab, setTabState] = useState<Tab>("afinador");

  useEffect(() => {
    setTabState(readTab());
    const sync = () => setTabState(readTab());
    window.addEventListener(TAB_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(TAB_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  function setTab(t: Tab) {
    localStorage.setItem(TAB_KEY, t);
    setTabState(t);
    window.dispatchEvent(new Event(TAB_EVENT));
  }

  const Icon = tab === "metronomo" ? MetronomeIcon : TuningForkIcon;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Afinador y metrónomo"
          title="Afinador y metrónomo"
          className={
            className ??
            "comic-sm comic-press flex items-center justify-center rounded-xl p-2.5 text-foreground"
          }
        >
          <Icon className="h-5 w-5 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        collisionPadding={8}
        className="w-[min(22rem,calc(100vw-1rem))] max-h-[80svh] overflow-y-auto p-3"
      >
        <div className="comic-sm mb-3 flex overflow-hidden rounded-lg">
          {(
            [
              ["afinador", "Afinador"],
              ["metronomo", "Metrónomo"],
            ] as const
          ).map(([v, l]) => (
            <button
              key={v}
              onClick={() => setTab(v)}
              className={`flex-1 py-2 text-sm font-extrabold uppercase ${tab === v ? "bg-primary text-primary-foreground" : "bg-card"}`}
            >
              {l}
            </button>
          ))}
        </div>
        {tab === "afinador" ? <Tuner /> : <Metronome />}
      </PopoverContent>
    </Popover>
  );
}
