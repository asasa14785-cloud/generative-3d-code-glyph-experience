// Glyph system: atlas + Glif-style 6-circle shape vectors + role (family) masks.
// Independent re-implementation of the idea studied in artalis-io/glif (MIT): each glyph is described by
// the average ink inside six staggered circles; the same circle layout is applied to the rendered image cell.
import * as THREE from "three";
import fontUrl from "@fontsource/jetbrains-mono/files/jetbrains-mono-latin-700-normal.woff2?inline";

export const ATLAS_COLS = 16;
export const CELL_W = 52; // atlas cell (px) incl. padding
export const CELL_H = 72;
export const PAD_X = 6;
export const PAD_Y = 6;
export const INNER_W = CELL_W - PAD_X * 2; // 40
export const INNER_H = CELL_H - PAD_Y * 2; // 60

// Role families (bit index = family id). Each string lists the glyphs that "belong" to that visual role.
export const FAMILIES: string[] = [
  // 0 atmosphere / light / void  (code ribbons override in shader)
  "const float vec2 vec3 vec4 return uniform texture sin cos fract mix smoothstep void main gl_FragCoord .,:;'`-_=+*/\\|<>(){}[]~^",
  // 1 heart / organic flesh / membrane
  "@%&#*+=~:;.,(){}[]/\\|sS8oO0Q$",
  // 2 foliage: letters and digits, leaf-like clusters
  "aeosczxvwyunmrkhbdpqg35689#%&*+~^<>/\\|{}ilt;:.",
  // 3 grass: directional strokes
  "|/\\!()lIi1j;:,.'\"`~^-_=+[]{}",
  // 4 deer fur / birds
  "#%@8&WMNHBR=+-/\\|~:.,;'\"mwnh",
  // 5 rose petals / flowers: curved formations
  "(){}@&%86905OoQqcCSs*+=~;:.,<>$",
  // 6 fire / embers
  "^~*+'\"`,.:;!|/\\()<>AVYvyi1^",
  // 7 eye: concentric
  "()oO0@~=-_|.:;'*+{}[]<>QCcDdUu",
];

export const CODE_STRING =
  "const float vec2 vec3 vec4 return uniform texture sin cos fract mix smoothstep void main gl_FragCoord ";

export interface GlyphSet {
  chars: string[];
  atlas: THREE.CanvasTexture;
  table: THREE.DataTexture; // NG x 3 floats (RGBA32F)
  count: number;
  inkMax: number;
  rows: number;
  index: (c: string) => number;
  code: Float32Array;
  canvas: HTMLCanvasElement;
  shapes: Float32Array;
}

// Glif sampling layout: 6 internal circles (3x2 staggered), y measured from the top of the cell.
const IX = [0.25, 0.75, 0.25, 0.75, 0.25, 0.75];
const IY = [0.2, 0.13, 0.53, 0.47, 0.87, 0.8];
const IR = 0.28;

export async function buildGlyphSet(): Promise<GlyphSet> {
  const face = new FontFace("GlyphMono", `url(${fontUrl})`, { weight: "700" });
  await face.load();
  document.fonts.add(face);

  const chars: string[] = [" "];
  for (let c = 33; c <= 126; c++) chars.push(String.fromCharCode(c));
  const rows = Math.ceil(chars.length / ATLAS_COLS);

  const canvas = document.createElement("canvas");
  canvas.width = ATLAS_COLS * CELL_W;
  canvas.height = rows * CELL_H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.font = `700 ${Math.round(INNER_H * 0.98)}px GlyphMono, monospace`;
  chars.forEach((ch, i) => {
    const cx = (i % ATLAS_COLS) * CELL_W + CELL_W / 2;
    const cy = Math.floor(i / ATLAS_COLS) * CELL_H + PAD_Y + INNER_H * 0.8;
    if (ch !== " ") ctx.fillText(ch, cx, cy);
  });

  // ---- shape vectors from the actual rendered bitmap ----
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const ng = chars.length;
  const shapes = new Float32Array(ng * 6);
  const ink = new Float32Array(ng);
  const orient = new Float32Array(ng).fill(-1);
  let inkMax = 0;
  const px = (gx: number, gy: number, x: number, y: number) =>
    img[((gy * CELL_H + PAD_Y + y) * canvas.width + gx * CELL_W + PAD_X + x) * 4] / 255;
  for (let g = 0; g < ng; g++) {
    const gx = g % ATLAS_COLS, gy = Math.floor(g / ATLAS_COLS);
    let total = 0;
    for (let y = 0; y < INNER_H; y++) for (let x = 0; x < INNER_W; x++) total += px(gx, gy, x, y);
    ink[g] = total / (INNER_W * INNER_H);
    for (let k = 0; k < 6; k++) {
      const ccx = IX[k] * INNER_W, ccy = IY[k] * INNER_H;
      const rx = IR * INNER_W, ry = IR * INNER_H;
      let s = 0, n = 0;
      for (let y = Math.max(0, Math.floor(ccy - ry)); y < Math.min(INNER_H, Math.ceil(ccy + ry)); y++)
        for (let x = Math.max(0, Math.floor(ccx - rx)); x < Math.min(INNER_W, Math.ceil(ccx + rx)); x++) {
          const dx = (x + 0.5 - ccx) / rx, dy = (y + 0.5 - ccy) / ry;
          if (dx * dx + dy * dy <= 1) { s += px(gx, gy, x, y); n++; }
        }
      const v = n ? s / n : 0;
      shapes[g * 6 + k] = v;
      inkMax = Math.max(inkMax, v);
    }
  }
  // orientation classes: 0 '-' 1 '/' 2 '|' 3 '\'
  const orientMap: Record<string, number> = { "-": 0, _: 0, "=": 0, "/": 1, "|": 2, "!": 2, l: 2, I: 2, "\\": 3, i: 2, j: 2 };
  chars.forEach((c, i) => { if (c in orientMap) orient[i] = orientMap[c]; });

  // ---- data table (3 rows) ----
  const data = new Float32Array(ng * 3 * 4);
  chars.forEach((c, g) => {
    let mask = 0;
    FAMILIES.forEach((f, fi) => { if (f.includes(c)) mask |= 1 << fi; });
    if (c === " ") mask = 255;
    if (mask === 0) mask = 1; // unassigned glyphs are atmosphere-only
    const s = shapes.subarray(g * 6, g * 6 + 6);
    data.set([s[0], s[1], s[2], s[3]], (0 * ng + g) * 4);
    data.set([s[4], s[5], mask, 0], (1 * ng + g) * 4);
    data.set([ink[g], orient[g], 0, 0], (2 * ng + g) * 4);
  });
  const table = new THREE.DataTexture(data, ng, 3, THREE.RGBAFormat, THREE.FloatType);
  table.minFilter = table.magFilter = THREE.NearestFilter;
  table.needsUpdate = true;

  const atlas = new THREE.CanvasTexture(canvas);
  atlas.minFilter = THREE.LinearMipmapLinearFilter;
  atlas.magFilter = THREE.LinearFilter;
  atlas.generateMipmaps = true;
  atlas.anisotropy = 4;
  atlas.needsUpdate = true;

  const index = (c: string) => Math.max(0, chars.indexOf(c));
  const code = new Float32Array(160);
  for (let i = 0; i < CODE_STRING.length && i < 160; i++) code[i] = index(CODE_STRING[i]);
  return { chars, atlas, table, count: ng, inkMax, rows, index, code, canvas, shapes };
}
