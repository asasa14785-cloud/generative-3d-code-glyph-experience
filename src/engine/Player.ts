import { GlyphEngine } from "./GlyphEngine";
import { AudioDirector } from "../audio/AudioDirector";
import { DURATION, evaluate } from "../animation/timeline";

export type Phase = "idle" | "loading" | "playing" | "paused" | "ended" | "error";

// Elapsed-time clock: the timeline advances by real elapsed milliseconds (never by frame counting).
export class Player {
  engine: GlyphEngine;
  audio = new AudioDirector();
  t = 0;
  phase: Phase = "idle";
  ready = false;
  private last = 0;
  private raf = 0;
  private dirty = true;
  onChange: (p: Phase, t: number) => void = () => {};

  constructor(canvas: HTMLCanvasElement) {
    this.engine = new GlyphEngine(canvas);
    document.addEventListener("visibilitychange", () => { if (document.hidden && this.phase === "playing") void this.pause(); });
  }

  async init(q?: number) {
    await this.engine.init(q);
    this.ready = true;
    this.renderAt(0.0001);
    this.loop(performance.now());
  }

  renderAt(t: number) { this.engine.render(evaluate(t)); }

  private set(p: Phase) { this.phase = p; this.onChange(p, this.t); }

  private loop = (now: number) => {
    this.raf = requestAnimationFrame(this.loop);
    if (this.phase === "playing") {
      const dt = Math.max(0, (now - this.last) / 1000); // true elapsed time, independent of frame rate
      this.last = now;
      this.t = Math.min(DURATION, this.t + dt);
      this.audio.update(this.t);
      this.engine.render(evaluate(this.t));
      if (this.t >= DURATION) { this.set("ended"); }
      else this.onChange(this.phase, this.t);
    } else if (this.dirty) {
      this.engine.render(evaluate(this.t)); this.dirty = false;
    }
  };

  async begin(withSound: boolean) {
    this.set("loading");
    this.t = 0; this.engine.resetHistory();
    try { await this.audio.start(); } catch (e) { console.warn("audio unavailable", e); }
    this.audio.setEnabled(withSound);
    this.last = performance.now();
    this.set("playing");
  }
  async pause() { if (this.phase !== "playing") return; this.set("paused"); await this.audio.pause(); }
  async resume() { if (this.phase !== "paused") return; await this.audio.resume(); this.last = performance.now(); this.set("playing"); }
  async replay(withSound: boolean) { await this.begin(withSound); }
  dispose() { cancelAnimationFrame(this.raf); this.audio.stop(); this.engine.dispose(); }
}
