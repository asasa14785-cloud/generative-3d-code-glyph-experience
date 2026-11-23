// Deterministic master timeline. Every motion in the film is a pure function of t (seconds, 0..60).
export type V3 = [number, number, number];
export const DURATION = 60;
export const GY = -9; // garden ground level (heart space)

const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
export const norm = (a: V3): V3 => mul(a, 1 / (len(a) || 1));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerp3 = (a: V3, b: V3, t: number): V3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const bump = (x: number, c: number, w: number) => Math.exp(-(((x - c) / w) ** 2));

// C1 Hermite track through keys [t, v0, v1, ...] with zero end tangents (natural ease in/out)
function track(keys: number[][]) {
  const n = keys.length, d = keys[0].length - 1;
  const tang = keys.map((_, i) => {
    if (i === 0 || i === n - 1) return new Array(d).fill(0);
    const a = keys[i - 1], b = keys[i + 1];
    return Array.from({ length: d }, (_, c) => (b[c + 1] - a[c + 1]) / (b[0] - a[0]));
  });
  return (t: number): number[] => {
    if (t <= keys[0][0]) return keys[0].slice(1);
    if (t >= keys[n - 1][0]) return keys[n - 1].slice(1);
    let i = 0; while (keys[i + 1][0] < t) i++;
    const k0 = keys[i], k1 = keys[i + 1], h = k1[0] - k0[0], u = (t - k0[0]) / h;
    const u2 = u * u, u3 = u2 * u;
    const h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
    return Array.from({ length: d }, (_, c) => h00 * k0[c + 1] + h10 * h * tang[i][c] + h01 * k1[c + 1] + h11 * h * tang[i + 1][c]);
  };
}

// ------------------------------------------------------------------ heartbeat schedule (shared by visuals and audio)
export interface Beat { t: number; g: number; rate: number }
const B = (t: number, g: number, rate = 1): Beat => ({ t, g, rate });
export const BEATS: Beat[] = [
  B(0.9, 0.75), B(1.9, 0.85), B(2.9, 0.9), B(3.9, 0.95), B(4.9, 1.0), B(5.9, 1.0),
  B(6.75, 1.1, 1.05), B(7.5, 1.15, 1.1), B(8.2, 1.2, 1.15), B(8.85, 1.1, 1.2), B(9.45, 1.0, 1.2), B(10.0, 1.0, 1.2),
  B(10.55, 0.95, 1.15), B(11.1, 0.9, 1.1), B(11.7, 0.8, 1.05), B(12.35, 0.7, 1.0), B(13.1, 0.7, 1.0), B(13.9, 0.8, 0.95),
  ...Array.from({ length: 13 }, (_, k) => B(16.0 + 2.3 * k, 0.16, 0.9)),
  B(46.0, 0.22, 0.9), B(48.2, 0.28, 0.9), B(50.0, 0.34, 0.9), B(51.2, 0.8, 0.95), B(52.5, 0.8, 0.95), B(53.8, 0.85, 0.95),
  B(56.4, 0.65, 0.95), B(57.55, 0.85, 0.95), B(58.6, 1.2, 0.9),
];
export const S1_OFFSET = 0.06;

function pulseAt(t: number) {
  let p = 0, last = -10, lg = 0;
  for (const b of BEATS) {
    const tau = t - b.t;
    if (tau < -0.01) break;
    last = b.t; lg = b.g;
    if (tau < 1.2) p += Math.min(1.1, b.g) * (Math.exp(-(((tau - 0.06) / 0.075) ** 2)) + 0.62 * Math.exp(-(((tau - 0.4) / 0.09) ** 2)));
  }
  return { pulse: Math.min(1.3, p), beatT: Math.min(3, t - last), g: lg };
}

// ------------------------------------------------------------------ deer FK (drives both the shader and the camera)
export interface DeerPose { n0: V3; n1: V3; head: V3; f: V3; u: V3; a: [number, number, number, number] }
function fk(h: number, yaw: number) {
  const a1 = lerp(0.85, -1.0, h), a2 = a1 - lerp(0.55, 0.3, h);
  const N0: V3 = [0.5, 1.2, 0];
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const rotY = (v: V3): V3 => [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c];
  const d1: V3 = [Math.cos(a1), Math.sin(a1), 0];
  const d2: V3 = [Math.cos(a2), Math.sin(a2), 0];
  const n1rel = mul(d1, 0.75);
  const hrel = add(n1rel, mul(d2, 0.2));
  return { n0: N0, n1: add(N0, rotY(n1rel)), head: add(N0, rotY(hrel)), f: rotY(d2), u: rotY([-Math.sin(a2), Math.cos(a2), 0]) };
}
const headDownTrack = track([[0, 0.92], [24, 0.92], [26.2, 0.92], [26.9, 0.5], [27.8, 0.55], [28.7, 0.93], [31.0, 0.92], [34.6, 0.0], [60, 0]]);
const yawTrack = track([[0, 0], [33.5, 0], [36.8, -0.72], [60, -0.72]]);
function deerAt(t: number): DeerPose {
  let h = clamp(headDownTrack(t)[0]);
  if (h > 0.6) h = clamp(h + 0.025 * Math.sin(t * 5.1) * Math.max(0, Math.sin(t * 0.8) + 0.2));
  const yaw = yawTrack(t)[0];
  const k = fk(h, yaw);
  const chewEnv = smooth(19, 21, t) * (1 - smooth(36, 38, t));
  const jaw = chewEnv * (0.5 + 0.5 * Math.sin(2 * Math.PI * 2.3 * t));
  const breath = Math.sin(2 * Math.PI * 0.28 * t);
  const ear = 0.5 * bump(t, 25.5, 0.15) + 0.7 * bump(t, 29.2, 0.2) + 0.6 * bump(t, 33.0, 0.2) + 0.4 * bump(t, 39.0, 0.25) - 0.3 * bump(t, 41.5, 0.2);
  const tail = bump(t, 27.0, 0.4) * Math.sin(t * 16) + 0.4 * bump(t, 31.5, 0.3) * Math.sin(t * 14);
  return { ...k, a: [jaw, breath, ear, tail] };
}
const FINAL = fk(0, -0.72);
const sdF = cross(FINAL.f, FINAL.u);
const eyeLocal = (k: { head: V3; f: V3; u: V3 }): V3 => add(add(add(k.head, mul(k.f, 0.045)), mul(k.u, 0.036)), mul(cross(k.f, k.u), 0.066));
const toWorld = (v: V3): V3 => [v[0], v[1] + GY, v[2]];
const EYE_F = toWorld(eyeLocal(FINAL));
const AXIS = norm(add(sub(add(sdF, mul(FINAL.f, 0.2)), mul(FINAL.u, 0.25)), [0, 0, 0]));
const ROSE_D = AXIS[1] < -0.05 ? clamp((EYE_F[1] - (GY + 1.05)) / -AXIS[1], 1.8, 3.4) : 2.4;
export const ROSE0: V3 = add(EYE_F, mul(AXIS, ROSE_D));
ROSE0[1] = GY + 1.05;

// ------------------------------------------------------------------ rose
const T_LIFT = 44.6, T_EXIT = 51.15;
function roseAt(t: number) {
  let pos: V3 = [...ROSE0], scale = 1;
  if (t < T_EXIT) {
    const u = clamp((t - T_LIFT) / (T_EXIT - T_LIFT));
    const e = u * u * (1.6 - 0.6 * u);
    const y = lerp(ROSE0[1], 40, e);
    const m = smooth(0.1, 0.85, u);
    pos = [lerp(ROSE0[0], 0, m), y, lerp(ROSE0[2], 0, m)];
  } else {
    const w = clamp((t - T_EXIT) / 6.0);
    const y = 40 + 30 * (1 - (1 - w) * (1 - w));
    const bob = 0.7 * Math.sin(Math.max(0, t - 57) * 1.1) * smooth(56, 58, t);
    pos = [0, y + bob, 0];
    scale = 1 + 41 * smooth(0, 1, (t - T_EXIT) / 4.2);
  }
  const open = 0.5 + 0.35 * smooth(46, 52, t);
  const bend = smooth(T_LIFT, 47.5, t) * (1 - 0.55 * smooth(51.5, 55, t));
  const burn = 0.93 * smooth(55.0, 59.6, t);
  return { pos, scale, open, bend, burn };
}

// ------------------------------------------------------------------ cameras
export interface CamState { pos: V3; target: V3; up: V3; fov: number }
const tunnelPath = (s: number): V3 => [
  2.6 * Math.sin(s * 0.043) * smooth(10, 40, s), 36 - s, 1.8 * Math.sin(s * 0.031 + 1.0) * smooth(10, 40, s)];
const T_TUN0 = 8.45, T_GARDEN = 14.0;
const tunnelS = (t: number) => { const u = clamp((t - T_TUN0) / (T_GARDEN - T_TUN0)); return 5 + 250 * (1 - (1 - u) * (1 - u)); };

const extPos = track([[0, 0, 6, 235], [3.5, -10, 9, 175], [7.0, 12, 20, 120], [7.7, 0, 62, 48], [8.2, 0, 41, 3], [8.45, 0, 31, 0]]);
const extTgt = track([[0, 0, 0, 0], [3.5, 0, 1, 0], [7.0, 0, 6, 0], [7.7, 0, 28, 0], [8.2, 0, 0, 0], [8.45, 0, -30, 0]]);
const extFov = track([[0, 32], [3.5, 33], [7.0, 36], [7.7, 40], [8.2, 55], [8.45, 62]]);
const extUp = track([[0, 0, 1, 0], [7.7, 0, 1, 0], [8.2, 0, 0.3, -1], [8.45, 0, 0, -1]]);

const gPos = track([
  [14.0, 0.4, 26, 1.2], [16.8, -5, 10, 13], [19.8, -9.5, -2.2, 15], [22.0, -6.8, -6.6, 9.5], [24.0, -5.0, -7.4, 6.2],
  [28.0, -3.0, -7.7, 3.9], [31.0, -2.3, -7.8, 3.0],
]);
const gTgt = track([[14.0, 0, -9, -3], [16.8, 0, -6, -2], [19.8, 0, -6.5, 0], [22.0, 0.3, -7.8, 1.0], [24.0, 0.5, -8.0, 0.6], [28.0, 0.7, -8.0, 0.5]]);
const gFov = track([[14, 72], [16.8, 60], [19.8, 50], [22, 42], [24, 38], [28, 34], [31, 32], [34.5, 30], [38, 24], [41, 22], [43.5, 20], [44.2, 20], [45.3, 28], [46.6, 32], [49.8, 40], [51.1, 46]]);

const camFront = norm(add(mul(AXIS, 0.7), mul(FINAL.f, 0.7)));
const macroPos = (d: number): V3 => add(EYE_F, mul(AXIS, d));
const aPos = track([
  [31.0, -2.3, -7.8, 3.0],
  [34.5, ...add(add(toWorld(FINAL.head), mul(camFront, 1.9)), [0, 0.0, 0])],
  [38.0, ...add(macroPos(0.8), mul(FINAL.f, 0.25))],
  [41.0, ...macroPos(0.13)],
  [43.5, ...macroPos(0.115)],
  [44.2, ...macroPos(0.12)],
  [45.3, ...add(macroPos(0.55), mul(FINAL.f, 0.35))],
  [46.6, ...macroPos(1.0)],
]);
const aTgt = track([
  [44.2, ...EYE_F],
  [45.3, ...add(add(EYE_F, mul(FINAL.f, 0.7)), mul(AXIS, 0.3))],
  [46.6, ...roseAt(46.6).pos],
]);
const posAbs = (t: number): V3 => (t < 31 ? (gPos(t) as V3) : (aPos(t) as V3));

const offTrack = track([[46.6, 0, 0, 0], [48.0, -1.5, -1.2, 2.4], [49.8, -2.2, -3.0, 3.8], [51.1, 0, -4.5, 3.2]]);
const toffTrack = track([[46.6, 0, 0, 0], [49.8, 0, 1.2, 0], [51.1, 0, 1.5, 0]]);
const OFF0 = sub(macroPos(1.0), roseAt(46.6).pos);

const xPos = track([[51.1, 0, 31, 18], [53.0, 0, 45, 75], [55.0, 0, 36, 150], [57.5, 0, 30, 185], [60, 0, 26, 190]]);
const xTgt = track([[51.1, 0, 40, 0], [53.0, 0, 48, 0], [55.0, 0, 44, 0], [57.5, 0, 34, 0], [60, 0, 28, 0]]);
const xFov = track([[51.1, 58], [53.0, 44], [55.0, 40], [57.5, 39], [60, 38]]);

function headWorld(t: number): V3 { const d = deerAt(t); return toWorld(d.head); }
function eyeWorld(t: number): V3 { return toWorld(eyeLocal(deerAt(t))); }

function cameraAt(t: number, rose: ReturnType<typeof roseAt>): CamState {
  if (t < T_TUN0) {
    return { pos: extPos(t) as V3, target: extTgt(t) as V3, up: norm(extUp(t) as V3), fov: extFov(t)[0] };
  }
  if (t < T_GARDEN) {
    const s = tunnelS(t), la = tunnelPath(s + 18), roll = (s - 5) * 0.012;
    const spd = 1 - clamp((t - T_TUN0) / (T_GARDEN - T_TUN0));
    return { pos: tunnelPath(s), target: la, up: [Math.sin(roll), 0, -Math.cos(roll)], fov: 66 + 16 * spd };
  }
  if (t < 46.6) {
    const pos = posAbs(t);
    let tgt: V3;
    if (t < 28) tgt = gTgt(t) as V3;
    else {
      const w = smooth(28, 30.5, t);
      const focus = lerp3(headWorld(t), eyeWorld(t), smooth(36, 39, t));
      tgt = lerp3(gTgt(28) as V3, t < 44.2 ? focus : (aTgt(t) as V3), w);
      if (t >= 44.2) tgt = aTgt(t) as V3;
    }
    return { pos, target: tgt, up: [0, 1, 0], fov: gFov(t)[0] };
  }
  if (t < T_EXIT) {
    const o: V3 = t < 48.0 ? lerp3(OFF0, offTrack(48.0) as V3, smooth(46.6, 48.0, t)) : (offTrack(t) as V3);
    return { pos: add(rose.pos, o), target: add(rose.pos, toffTrack(t) as V3), up: [0, 1, 0], fov: gFov(t)[0] };
  }
  return { pos: xPos(t) as V3, target: xTgt(t) as V3, up: [0, 1, 0], fov: xFov(t)[0] };
}

// ------------------------------------------------------------------ full frame state
export interface FrameState {
  t: number; scene: "heart" | "garden"; mode: number;
  cam: CamState; pulse: number; beatT: number;
  flash: number; flashCol: V3; fade: number;
  rose: [number, number, number, number]; roseS: [number, number, number, number];
  glow: number; bright: number; root: number; burnVis: number;
  deer: DeerPose; pollen: number; corp: number; ember: number; hold: [number, number, number, number];
  act: number;
}
export const T_SWITCH = [T_TUN0, T_GARDEN, T_EXIT];

export function evaluate(tIn: number): FrameState {
  const t = clamp(tIn, 0, DURATION);
  const r = roseAt(t);
  const cam = cameraAt(t, r);
  const { pulse, beatT } = pulseAt(t);
  const scene: "heart" | "garden" = t < T_GARDEN || t >= T_EXIT ? "heart" : "garden";
  const mode = t >= T_TUN0 && t < T_GARDEN ? 1 : 0;
  const flash = Math.min(1, Math.max(0.92 * bump(t, T_TUN0, 0.3), bump(t, T_GARDEN, 0.36), bump(t, T_EXIT + 0.05, 0.36)));
  const flashCol: V3 = t < 10 ? [1.0, 0.55, 0.5] : [1.0, 0.93, 0.78];
  const fade = 1 - smooth(0, 1.6, t);
  const uRoot = smooth(0.25, 0.85, clamp((t - T_TUN0) / (T_GARDEN - T_TUN0)));
  const b = r.burn / 0.93;
  const burnVis = smooth(0, 0.06, b) * (1 - 0.72 * smooth(0.55, 1.0, b));
  const glow = 0.9 * smooth(55, 56.4, t) * (1 - 0.3 * smooth(58.5, 60, t));
  const bright = scene === "garden" ? 1 + 0.45 * smooth(46, 51, t) : 1;
  const pollen = scene === "garden" ? smooth(14.4, 16.5, t) * (1 - smooth(49.5, 51, t)) : 0;
  const corp = t > 7.7 && t < 14.0 ? 0.9 : 0;
  const act = t < 7 ? 1 : t < 14 ? 2 : t < 24 ? 3 : t < 35 ? 4 : t < 44 ? 5 : t < 54 ? 6 : 7;
  return {
    t, scene, mode, cam, pulse: t >= 59.5 ? pulse * 0.0 : pulse, beatT, flash, flashCol, fade,
    rose: [r.pos[0], r.pos[1], r.pos[2], r.scale], roseS: [r.open, r.bend, r.burn, 0],
    glow, bright, root: uRoot, burnVis, deer: deerAt(t), pollen, corp, ember: t >= 55 ? 1 : 0,
    hold: [0, 70, 0, 42], act,
  };
}

export const ACTS = [
  "I · The Heartbeat", "II · The Journey Inside", "III · The Hidden Garden", "IV · The Grazing Deer",
  "V · The Rose in the Eye", "VI · The Rose Escapes", "VII · The Rose Becomes Light",
];
// exposed so the shader/uniform layer and tests can reference exact eye geometry
export const EYE_INFO = { eye: EYE_F, axis: AXIS, rose0: ROSE0 };
export { eyeLocal };
