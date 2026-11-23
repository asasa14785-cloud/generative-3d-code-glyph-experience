// Sound design. Real recordings (see research/SOUND_ASSET_LOG.md) + small amounts of original synthesis.
// Everything is scheduled from the master timeline; AudioContext.suspend() gives sample-accurate pause/resume.
import heartUrl from "../assets/audio/heartbeat_cycle.mp3?inline";
import birdsUrl from "../assets/audio/garden_birds.mp3?inline";
import leavesUrl from "../assets/audio/leaves.mp3?inline";
import fireUrl from "../assets/audio/fire.mp3?inline";
import { BEATS, S1_OFFSET } from "../animation/timeline";

type Key = [number, number];
const raw: Record<string, string> = { heart: heartUrl, birds: birdsUrl, leaves: leavesUrl, fire: fireUrl };

export class AudioDirector {
  private ctx: AudioContext | null = null;
  private buffers: Record<string, AudioBuffer> = {};
  private master!: GainNode;
  private heartBus!: GainNode;
  private reverb!: ConvolverNode;
  private revSend!: GainNode;
  private bi = 0;
  private ci = 0;
  private soundOn = true;
  private noise!: AudioBuffer;

  get state() { return this.ctx?.state ?? "none"; }

  async start(): Promise<void> {
    this.stop();
    const ctx = new AudioContext({ latencyHint: "interactive" });
    this.ctx = ctx;
    await ctx.resume();
    if (!Object.keys(this.buffers).length) {
      for (const k of Object.keys(raw)) {
        const ab = await (await fetch(raw[k])).arrayBuffer();
        this.buffers[k] = await ctx.decodeAudioData(ab);
      }
    }
    this.noise = this.makeNoise(ctx, 4);
    // master chain: highpass (no infrasound) -> compressor (no clipping) -> gain
    const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 32;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 5; comp.attack.value = 0.01; comp.release.value = 0.25;
    this.master = ctx.createGain(); this.master.gain.value = this.soundOn ? 0.85 : 0;
    hp.connect(comp).connect(this.master).connect(ctx.destination);
    // spacious reverb (generated impulse response)
    this.reverb = ctx.createConvolver(); this.reverb.buffer = this.makeIR(ctx, 2.6);
    const wet = ctx.createGain(); wet.gain.value = 0.55;
    this.reverb.connect(wet).connect(hp);
    this.revSend = ctx.createGain(); this.revSend.gain.value = 1; this.revSend.connect(this.reverb);
    const dry = ctx.createGain(); dry.connect(hp);
    this.heartBus = ctx.createGain(); this.heartBus.gain.value = 1; this.heartBus.connect(dry);
    const heartRev = ctx.createGain(); heartRev.gain.value = 0.12; this.heartBus.connect(heartRev).connect(this.revSend);

    const now = ctx.currentTime + 0.05;
    this.bi = 0; this.ci = 0;
    const at = (T: number) => now + T;
    // --- garden bed: birds + breeze
    const birds = this.layer(); const birdPan = ctx.createStereoPanner();
    birds.out.connect(birdPan); birdPan.connect(dry); birdPan.connect(this.sendTo(0.35));
    this.curve(birds.out.gain, at, [[0, 0], [13.2, 0], [15.8, 0.78], [46, 0.78], [50.5, 0.55], [53.2, 0.0]]);
    this.loop(this.buffers.birds, birds.input, 13.2, 53.5, 2.4, at);
    const pan = new Float32Array(64); for (let i = 0; i < 64; i++) pan[i] = 0.55 * Math.sin((i / 63) * Math.PI * 2 * 2.2);
    birdPan.pan.setValueCurveAtTime(pan, at(14), 38);
    const wind = this.layer(); const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 1400;
    wind.out.connect(lp); lp.connect(dry);
    this.curve(wind.out.gain, at, [[0, 0], [13.6, 0], [16, 0.42], [44, 0.42], [51, 0.3], [54, 0]]);
    this.loop(this.buffers.leaves, wind.input, 13.6, 54, 2.0, at);
    lp.frequency.setValueAtTime(900, at(14)); lp.frequency.linearRampToValueAtTime(2400, at(50));
    // --- original soft pad (garden)
    const pad = ctx.createGain(); pad.gain.value = 0; pad.connect(dry); pad.connect(this.sendTo(0.5));
    this.curve(pad.gain, at, [[0, 0], [14, 0], [19, 0.05], [44, 0.05], [52, 0.03], [54, 0]]);
    [196, 293.66, 392, 587.33].forEach((f, i) => {
      const o = ctx.createOscillator(); o.type = i % 2 ? "triangle" : "sine"; o.frequency.value = f * (1 + (i - 1.5) * 0.0007);
      const g = ctx.createGain(); g.gain.value = 0.25;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07 + 0.03 * i; const lg = ctx.createGain(); lg.gain.value = 0.12; lfo.connect(lg).connect(g.gain);
      o.connect(g).connect(pad); o.start(now + 12); o.stop(at(55)); lfo.start(now + 12); lfo.stop(at(55));
    });
    // --- tunnel: whoosh + low drone
    this.whoosh(dry, at(8.0), 6.6, 180, 3200, 0.22, 11.5 - 8.0);
    this.drone(dry, at, [[0, 0], [6.8, 0], [10.5, 0.07], [14.2, 0.0]], [55, 82.41]);
    // --- rose ascent: elegant bell figure + air
    [523.25, 659.25, 783.99, 987.77, 1174.66, 1318.51, 1567.98, 1975.53].forEach((f, i) => this.bell(at(45.0 + i * 0.72), f, 0.045 + i * 0.002));
    this.whoosh(dry, at(48.6), 3.2, 1500, 7000, 0.07, 2.2);
    // --- ignition & fire
    this.whoosh(dry, at(54.9), 1.8, 350, 2600, 0.30, 0.5);
    const fire = this.layer(); fire.out.connect(dry); fire.out.connect(this.sendTo(0.18));
    this.curve(fire.out.gain, at, [[0, 0], [54.9, 0], [55.8, 0.95], [58.4, 0.95], [59.6, 0]]);
    this.loop(this.buffers.fire, fire.input, 54.9, 59.8, 0.4, at);
    // keep context alive until the end
  }

  private sendTo(amount: number) { const g = this.ctx!.createGain(); g.gain.value = amount; g.connect(this.revSend); return g; }
  private layer() {
    const ctx = this.ctx!; const input = ctx.createGain(); const out = ctx.createGain(); out.gain.value = 0; input.connect(out);
    return { input, out };
  }
  private curve(p: AudioParam, at: (T: number) => number, keys: Key[]) {
    p.setValueAtTime(keys[0][1], at(keys[0][0]));
    for (let i = 1; i < keys.length; i++) p.linearRampToValueAtTime(keys[i][1], at(keys[i][0]));
  }
  // crossfaded looping of a recorded buffer between times a..b
  private loop(buf: AudioBuffer, dest: AudioNode, a: number, b: number, fade: number, at: (T: number) => number) {
    const ctx = this.ctx!; let T = a; const step = buf.duration - fade;
    while (T < b) {
      const src = ctx.createBufferSource(); src.buffer = buf;
      const g = ctx.createGain(); const end = Math.min(T + buf.duration, b + fade);
      g.gain.setValueAtTime(0, at(T)); g.gain.linearRampToValueAtTime(1, at(T + fade));
      g.gain.setValueAtTime(1, at(end - fade)); g.gain.linearRampToValueAtTime(0, at(end));
      src.connect(g).connect(dest); src.start(at(T)); src.stop(at(end) + 0.1);
      T += step;
    }
  }
  private makeNoise(ctx: AudioContext, sec: number) {
    const b = ctx.createBuffer(1, ctx.sampleRate * sec, ctx.sampleRate); const d = b.getChannelData(0);
    let s = 1234567; for (let i = 0; i < d.length; i++) { s = (s * 1664525 + 1013904223) >>> 0; d[i] = (s / 4294967296) * 2 - 1; }
    return b;
  }
  private makeIR(ctx: AudioContext, sec: number) {
    const n = Math.floor(ctx.sampleRate * sec); const b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); let s = 99 + c * 17; for (let i = 0; i < n; i++) { s = (s * 1664525 + 1013904223) >>> 0; d[i] = ((s / 4294967296) * 2 - 1) * Math.pow(1 - i / n, 2.6); } }
    return b;
  }
  private whoosh(dest: AudioNode, T: number, dur: number, f0: number, f1: number, gain: number, peak: number) {
    const ctx = this.ctx!; const src = ctx.createBufferSource(); src.buffer = this.noise; src.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.Q.value = 0.9;
    bp.frequency.setValueAtTime(f0, T); bp.frequency.exponentialRampToValueAtTime(f1, T + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, T); g.gain.linearRampToValueAtTime(gain, T + peak); g.gain.linearRampToValueAtTime(0, T + dur);
    src.connect(bp).connect(g).connect(dest); src.start(T); src.stop(T + dur + 0.1); g.connect(this.sendTo(0.3));
  }
  private drone(dest: AudioNode, at: (T: number) => number, keys: Key[], freqs: number[]) {
    const ctx = this.ctx!; const g = ctx.createGain(); g.gain.value = 0; g.connect(dest); this.curve(g.gain, at, keys);
    freqs.forEach((f) => { const o = ctx.createOscillator(); o.type = "triangle"; o.frequency.value = f; const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 240; o.connect(lp).connect(g); o.start(at(6)); o.stop(at(15)); });
  }
  private bell(T: number, f: number, gain: number) {
    const ctx = this.ctx!; const g = ctx.createGain();
    g.gain.setValueAtTime(0, T); g.gain.linearRampToValueAtTime(gain, T + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, T + 3.0);
    [1, 2.01, 3.98].forEach((m, i) => { const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = f * m; const og = ctx.createGain(); og.gain.value = [1, 0.28, 0.1][i]; o.connect(og).connect(g); o.start(T); o.stop(T + 3.1); });
    g.connect(this.master); g.connect(this.sendTo(0.9));
  }
  // heartbeat: authentic recorded lub-dub cycle + gentle low-frequency body resonance
  private playBeat(b: { t: number; g: number; rate: number }, when: number) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource(); src.buffer = this.buffers.heart; src.playbackRate.value = b.rate;
    const g = ctx.createGain(); g.gain.value = Math.min(1.1, 0.95 * b.g);
    let out: AudioNode = g;
    if (b.g < 0.4) { const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 260; g.connect(lp); out = lp; g.gain.value = b.g * 2.4; }
    src.connect(g); out.connect(this.heartBus); src.start(when);
    if (b.g >= 0.4) {
      for (const [dt, f, a] of [[S1_OFFSET, 54, 0.30], [0.39 / b.rate, 62, 0.16]] as [number, number, number][]) {
        const o = ctx.createOscillator(); o.type = "sine"; o.frequency.setValueAtTime(f * 1.3, when + dt / b.rate); o.frequency.exponentialRampToValueAtTime(f, when + dt / b.rate + 0.08);
        const og = ctx.createGain(); const T = when + dt / b.rate;
        og.gain.setValueAtTime(0, T); og.gain.linearRampToValueAtTime(a * Math.min(1.2, b.g), T + 0.012); og.gain.exponentialRampToValueAtTime(0.0001, T + 0.34);
        o.connect(og).connect(this.heartBus); o.start(T); o.stop(T + 0.4);
      }
    }
  }
  private chew(when: number, k: number, gain: number) {
    const ctx = this.ctx!; const src = ctx.createBufferSource(); src.buffer = this.buffers.leaves;
    const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 2200 + 500 * Math.sin(k); bp.Q.value = 0.8;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(gain, when + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, when + 0.22);
    src.connect(bp).connect(g).connect(this.master); src.start(when, (k * 1.37) % 15, 0.25);
  }

  update(tl: number) {
    const ctx = this.ctx; if (!ctx || ctx.state !== "running") return;
    const now = ctx.currentTime;
    while (this.bi < BEATS.length && BEATS[this.bi].t < tl + 0.3) {
      const b = BEATS[this.bi++];
      if (b.t < tl - 0.05) continue;
      this.playBeat(b, now + Math.max(0, b.t - tl));
    }
    // grass rustle in step with the chewing animation (jaw = 0.5+0.5 sin(2π·2.3 t); closed at (0.75+n)/2.3)
    for (;;) {
      const T = (0.75 + this.ci) / 2.3;
      if (T > tl + 0.3) break;
      this.ci++;
      if (T < 21.5 || T > 36.5 || T < tl - 0.05) continue;
      const env = Math.min(1, (T - 21.5) / 1.5) * Math.min(1, (36.5 - T) / 1.5);
      this.chew(now + Math.max(0, T - tl), this.ci, 0.16 * env);
    }
  }

  async pause() { if (this.ctx?.state === "running") await this.ctx.suspend(); }
  async resume() { if (this.ctx?.state === "suspended") await this.ctx.resume(); }
  setEnabled(on: boolean) {
    this.soundOn = on;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(on ? 0.85 : 0, this.ctx.currentTime, 0.03);
  }
  stop() { if (this.ctx) { void this.ctx.close(); this.ctx = null; } }
}
