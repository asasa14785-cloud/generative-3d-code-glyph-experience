import { useCallback, useEffect, useRef, useState } from "react";
import { Player, Phase } from "./engine/Player";
import { ACTS, DURATION, evaluate } from "./animation/timeline";

declare global { interface Window { __garden?: Player; __gardenReady?: boolean } }

const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s) % 60).padStart(2, "0")}`;

const Icon = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
);

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const player = useRef<Player | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [t, setT] = useState(0);
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState("");
  const [sound, setSound] = useState(true);
  const [idle, setIdle] = useState(false);
  const idleTimer = useRef<number>(0);

  useEffect(() => {
    if (!canvasRef.current) return;
    const p = new Player(canvasRef.current);
    player.current = p;
    window.__garden = p;
    let last = 0;
    p.onChange = (ph, tt) => {
      setPhase(ph);
      const n = performance.now();
      if (n - last > 90 || ph !== "playing") { last = n; setT(tt); }
    };
    const q = new URLSearchParams(location.search).get("q");
    p.init(q !== null ? Number(q) : undefined).then(() => { setReady(true); window.__gardenReady = true; }).catch((e) => { console.error(e); setErr(String(e?.message ?? e)); setPhase("error"); });
    return () => { p.dispose(); };
  }, []);

  const poke = useCallback(() => {
    setIdle(false);
    window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => setIdle(true), 2600);
  }, []);
  useEffect(() => { poke(); }, [poke, phase]);

  const start = () => player.current?.begin(sound);
  const toggle = () => { const p = player.current; if (!p) return; if (p.phase === "playing") p.pause(); else if (p.phase === "paused") p.resume(); };
  const replay = () => player.current?.replay(sound);
  const toggleSound = () => { const n = !sound; setSound(n); player.current?.audio.setEnabled(n); };
  const fullscreen = () => {
    const el = stageRef.current?.parentElement; if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen(); else void el.requestFullscreen?.();
  };
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.code === "Space") { e.preventDefault(); toggle(); }
      if (e.key === "f") fullscreen();
      if (e.key === "m") toggleSound();
    };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  });

  const act = phase === "idle" ? 0 : evaluate(t).act - 1;
  const showStart = phase === "idle" || phase === "loading" || phase === "error";

  return (
    <div className="fixed inset-0 bg-black overflow-hidden select-none text-[#f3e6d8]" onMouseMove={poke} onTouchStart={poke}
      style={{ cursor: idle && phase === "playing" ? "none" : "default", fontFamily: "'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace" }}>
      <div ref={stageRef} className="absolute left-1/2 top-1/2" style={{ width: "min(100vw, 177.7778vh)", height: "min(56.25vw, 100vh)", transform: "translate(-50%,-50%)" }}>
        <canvas ref={canvasRef} className="w-full h-full block bg-black" id="film" />

        {showStart && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center"
            style={{ background: "radial-gradient(ellipse at 50% 55%, rgba(120,10,25,0.55) 0%, rgba(10,0,4,0.93) 55%, #000 100%)" }}>
            <div className="absolute inset-0 overflow-hidden opacity-[0.16] text-[11px] leading-[13px] tracking-[0.35em] whitespace-pre-wrap break-all text-[#ff5a64] pointer-events-none" aria-hidden>
              {"const float vec2 vec3 vec4 return uniform texture sin cos fract mix smoothstep void main gl_FragCoord ".repeat(60)}
            </div>
            <div className="relative z-10 flex flex-col items-center gap-6 px-6">
              <div className="text-[#ff6a73] text-xs tracking-[0.6em] opacity-80">A 60-SECOND CODE-GLYPH FILM</div>
              <h1 className="text-[clamp(30px,6.2vw,84px)] font-bold tracking-[0.18em] leading-none" style={{ textShadow: "0 0 40px rgba(255,60,80,.55)" }}>THE GARDEN<br />WITHIN</h1>
              <p className="max-w-xl text-[13px] leading-6 opacity-70">
                A beating heart holds an entire garden. A deer finds a rose reflected in its own eye. The rose rises, escapes, and burns into light.
                Everything you see is drawn with characters — rendered live in your browser.
              </p>
              {phase === "error" ? (
                <div className="text-[#ff8a8a] text-sm max-w-md">This experience needs WebGL2. {err}</div>
              ) : (
                <button onClick={start} disabled={!ready || phase === "loading"}
                  className="mt-2 px-10 py-3 border border-[#ff6a73] text-[#ffd9d0] tracking-[0.5em] text-sm transition hover:bg-[#ff3a4a]/20 hover:shadow-[0_0_40px_rgba(255,60,80,.5)] disabled:opacity-40 cursor-pointer">
                  {phase === "loading" ? "PREPARING SOUND…" : ready ? "BEGIN" : "COMPILING GLYPHS…"}
                </button>
              )}
              <label className="flex items-center gap-2 text-xs opacity-70 cursor-pointer">
                <input type="checkbox" checked={sound} onChange={() => setSound(!sound)} className="accent-[#ff5a64]" /> sound on · headphones recommended
              </label>
              <div className="text-[10px] opacity-40 tracking-[0.25em]">SPACE pause · F fullscreen · M mute</div>
            </div>
          </div>
        )}

        {!showStart && (
          <div className={`absolute left-0 right-0 bottom-0 px-5 pb-4 pt-10 transition-opacity duration-700 ${idle && phase === "playing" ? "opacity-0" : "opacity-100"}`}
            style={{ background: "linear-gradient(to top, rgba(0,0,0,.72), rgba(0,0,0,0))" }}>
            <div className="flex items-center gap-3 text-[11px] tracking-[0.2em]">
              <button className="hover:text-[#ff7a82] cursor-pointer" aria-label={phase === "playing" ? "Pause" : "Resume"} onClick={phase === "ended" ? replay : toggle}>
                {phase === "playing" ? <Icon d="M8 5v14M16 5v14" /> : phase === "ended" ? <Icon d="M4 12a8 8 0 1 0 3-6.2M4 4v4h4" /> : <Icon d="M7 4l12 8-12 8z" />}
              </button>
              <button className="hover:text-[#ff7a82] cursor-pointer" aria-label="Replay" title="Replay" onClick={replay}><Icon d="M4 12a8 8 0 1 0 3-6.2M4 4v4h4" /></button>
              <span className="opacity-70 w-24">{fmt(t)} / {fmt(DURATION)}</span>
              <div className="flex-1 h-[2px] bg-white/15 relative">
                <div className="absolute left-0 top-0 h-full bg-[#ff5a64]" style={{ width: `${(t / DURATION) * 100}%`, boxShadow: "0 0 10px #ff5a64" }} />
              </div>
              <span className="opacity-60 hidden sm:inline w-56 text-right">{phase === "ended" ? "— FIN —" : ACTS[act]}</span>
              <button className="hover:text-[#ff7a82] cursor-pointer" aria-label="Sound" title="Sound on/off (M)" onClick={toggleSound}>
                <Icon d={sound ? "M4 9v6h4l5 4V5L8 9zM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" : "M4 9v6h4l5 4V5L8 9zM17 9l5 6M22 9l-5 6"} />
              </button>
              <button className="hover:text-[#ff7a82] cursor-pointer" aria-label="Fullscreen" title="Fullscreen (F)" onClick={fullscreen}><Icon d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
