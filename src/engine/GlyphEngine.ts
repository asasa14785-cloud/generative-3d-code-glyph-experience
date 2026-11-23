import * as THREE from "three";
import { buildGlyphSet, ATLAS_COLS, PAD_X, PAD_Y, CELL_W, CELL_H, GlyphSet } from "./glyphs";
import { FULLSCREEN_VERT, CELL_FRAG, DISPLAY_FRAG, PARTICLE_VERT, PARTICLE_FRAG } from "../shaders/glyphPass";
import { HEART_FRAG } from "../shaders/heart";
import { GARDEN_FRAG } from "../shaders/garden";
import type { FrameState, V3 } from "../animation/timeline";

export const GRID_W = 240;
export const GRID_H = 90;
const N_POLLEN = 1800, N_CORP = 1400, N_EMBER = 2600;

const QUALITY = [
  { name: "low", canvas: [960, 540], scene: [640, 360] },
  { name: "medium", canvas: [1280, 720], scene: [960, 540] },
  { name: "high", canvas: [1920, 1080], scene: [1280, 720] },
] as const;

const sv = (s: string) => s.replace(/^#version 300 es\n/, "");
const v3 = (a: V3) => new THREE.Vector3(a[0], a[1], a[2]);

export class GlyphEngine {
  renderer: THREE.WebGLRenderer;
  glyphs!: GlyphSet;
  quality = 2;
  auto = true;
  private sceneRT!: THREE.WebGLRenderTarget;
  private cellRT: THREE.WebGLRenderTarget[] = [];
  private flip = 0;
  private reset = 1;
  private fsGeo: THREE.BufferGeometry;
  private fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private sceneMat!: Record<"heart" | "garden", THREE.RawShaderMaterial>;
  private cellMat!: THREE.RawShaderMaterial;
  private dispMat!: THREE.RawShaderMaterial;
  private partMat!: THREE.RawShaderMaterial;
  private fsMesh: THREE.Mesh;
  private fsScene = new THREE.Scene();
  private partScene = new THREE.Scene();
  private shared: Record<string, THREE.IUniform> = {};
  private cam = new THREE.PerspectiveCamera(40, 16 / 9, 0.01, 2000);
  private ema = 16;
  private lastFrame = 0;
  private slow = 0;
  private fast = 0;
  info = { quality: "high", ms: 0, shaderErrors: [] as string[] };

  constructor(public canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: "high-performance", preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(1);
    this.renderer.autoClear = false;
    this.fsGeo = new THREE.BufferGeometry();
    this.fsGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    this.fsMesh = new THREE.Mesh(this.fsGeo);
    this.fsMesh.frustumCulled = false;
    this.fsScene.add(this.fsMesh);
  }

  async init(initialQuality?: number) {
    const gl2 = this.renderer.getContext();
    if (!(gl2 instanceof WebGL2RenderingContext)) throw new Error("WebGL2 is required");
    this.renderer.extensions.get("EXT_color_buffer_float");
    this.renderer.extensions.get("EXT_color_buffer_half_float");
    this.glyphs = await buildGlyphSet();
    const g = this.glyphs;
    const U = (v: unknown) => ({ value: v });
    const sh = this.shared;
    Object.assign(sh, {
      uRes: U(new THREE.Vector2(1280, 720)), uTime: U(0),
      uCamPos: U(new THREE.Vector3()), uCamRight: U(new THREE.Vector3()), uCamUp: U(new THREE.Vector3()), uCamFwd: U(new THREE.Vector3()),
      uTanF: U(0.4), uPulse: U(0), uBeatT: U(0), uRose: U(new THREE.Vector4()), uRoseS: U(new THREE.Vector4()),
      uGlow: U(0), uBright: U(1), uRoot: U(0), uMode: U(0), uBurnVis: U(0), uHold: U(new THREE.Vector4()),
      uDN0: U(new THREE.Vector3()), uDN1: U(new THREE.Vector3()), uDHead: U(new THREE.Vector3()), uDF: U(new THREE.Vector3()),
      uDU: U(new THREE.Vector3()), uDA: U(new THREE.Vector4()),
    });
    const mk = (frag: string) => new THREE.RawShaderMaterial({ vertexShader: sv(FULLSCREEN_VERT), fragmentShader: sv(frag), uniforms: sh, depthTest: false, depthWrite: false, glslVersion: THREE.GLSL3 });
    this.sceneMat = { heart: mk(HEART_FRAG), garden: mk(GARDEN_FRAG) };

    this.cellMat = new THREE.RawShaderMaterial({
      vertexShader: sv(FULLSCREEN_VERT), fragmentShader: sv(CELL_FRAG), depthTest: false, depthWrite: false, glslVersion: THREE.GLSL3,
      uniforms: {
        uColor: U(null), uData: U(null), uPrev: U(null), uGlyphT: U(g.table),
        uGrid: U(new THREE.Vector2(GRID_W, GRID_H)), uNG: U(g.count), uInkMax: U(g.inkMax), uTime: U(0), uHyst: U(0.012),
        uReset: U(1), uCodeLen: U(96), uCode: U(Array.from(g.code)),
      },
    });
    this.dispMat = new THREE.RawShaderMaterial({
      vertexShader: sv(FULLSCREEN_VERT), fragmentShader: sv(DISPLAY_FRAG), depthTest: false, depthWrite: false, glslVersion: THREE.GLSL3,
      uniforms: {
        uCellA: U(null), uCellB: U(null), uAtlas: U(g.atlas), uGrid: U(new THREE.Vector2(GRID_W, GRID_H)),
        uAtlasGrid: U(new THREE.Vector2(ATLAS_COLS, g.rows)), uPad: U(new THREE.Vector2(PAD_X / CELL_W, PAD_Y / CELL_H)),
        uTime: U(0), uFlash: U(0), uFade: U(0), uFlashCol: U(new THREE.Vector3(1, 0.93, 0.8)),
      },
    });
    // instanced glyph particles
    const base = new THREE.PlaneGeometry(1, 1);
    const ig = new THREE.InstancedBufferGeometry();
    ig.index = base.index;
    ig.setAttribute("position", base.getAttribute("position"));
    ig.instanceCount = N_POLLEN + N_CORP + N_EMBER;
    const pg = new Float32Array(18);
    const pick = (s: string) => Array.from(s).map((c) => g.index(c));
    pg.set([...pick(".,:;'*"), ...pick("oO0@()"), ...pick("*+'^.`")]);
    this.partMat = new THREE.RawShaderMaterial({
      vertexShader: sv(PARTICLE_VERT), fragmentShader: sv(PARTICLE_FRAG), glslVersion: THREE.GLSL3, depthTest: false, depthWrite: false, transparent: true,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
      uniforms: {
        uViewProj: U(new THREE.Matrix4()), uCamPos: sh.uCamPos, uCamRight: sh.uCamRight, uCamUp: sh.uCamUp, uTanF: sh.uTanF,
        uRes: U(new THREE.Vector2(1280, 720)), uTime: sh.uTime, uW: U(new THREE.Vector3()), uHold: sh.uHold,
        uEmber: U(new THREE.Vector2(55, 4.4)), uN0: U(N_POLLEN), uN1: U(N_POLLEN + N_CORP), uPG: U(Array.from(pg)),
        uAtlas: U(g.atlas), uSceneData: U(null), uAtlasGrid: U(new THREE.Vector2(ATLAS_COLS, g.rows)),
        uPad: U(new THREE.Vector2(PAD_X / CELL_W, PAD_Y / CELL_H)),
      },
    });
    const pm = new THREE.Mesh(ig, this.partMat);
    pm.frustumCulled = false;
    this.partScene.add(pm);

    this.setQuality(initialQuality ?? this.detectQuality());
    // pre-compile everything (also validates shaders)
    this.fsMesh.material = this.sceneMat.heart; this.renderer.compile(this.fsScene, this.fsCam);
    this.fsMesh.material = this.sceneMat.garden; this.renderer.compile(this.fsScene, this.fsCam);
    this.fsMesh.material = this.cellMat; this.renderer.compile(this.fsScene, this.fsCam);
    this.fsMesh.material = this.dispMat; this.renderer.compile(this.fsScene, this.fsCam);
  }

  private detectQuality() {
    const dbg = this.renderer.getContext().getExtension("WEBGL_debug_renderer_info");
    const r = dbg ? String(this.renderer.getContext().getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : "";
    if (/swiftshader|llvmpipe|software/i.test(r)) return 0;
    return /Intel|Mali|Adreno|Apple GPU/i.test(r) && !/Iris Xe|Arc/i.test(r) ? 1 : 2;
  }

  setQuality(q: number) {
    this.quality = Math.max(0, Math.min(2, q));
    const Q = QUALITY[this.quality];
    this.info.quality = Q.name;
    this.renderer.setSize(Q.canvas[0], Q.canvas[1], false);
    const mrt = (w: number, h: number, nearest: boolean, count = 2) => {
      const rt = new THREE.WebGLRenderTarget(w, h, { count, type: THREE.HalfFloatType, format: THREE.RGBAFormat, depthBuffer: false, stencilBuffer: false });
      rt.textures.forEach((t) => {
        t.minFilter = t.magFilter = nearest ? THREE.NearestFilter : THREE.LinearFilter;
        t.generateMipmaps = false;
      });
      return rt;
    };
    this.sceneRT?.dispose();
    this.sceneRT = mrt(Q.scene[0], Q.scene[1], false);
    this.sceneRT.textures[1].minFilter = this.sceneRT.textures[1].magFilter = THREE.NearestFilter; // data buffer must not blend
    if (!this.cellRT.length) this.cellRT = [mrt(GRID_W, GRID_H, true), mrt(GRID_W, GRID_H, true)];
    (this.shared.uRes.value as THREE.Vector2).set(Q.scene[0], Q.scene[1]);
    (this.partMat.uniforms.uRes.value as THREE.Vector2).set(Q.canvas[0], Q.canvas[1]);
    this.reset = 1;
  }

  resetHistory() { this.reset = 1; }

  render(s: FrameState) {
    const t0 = performance.now();
    const sh = this.shared;
    // camera basis
    const pos = v3(s.cam.pos), tgt = v3(s.cam.target);
    const fwd = tgt.clone().sub(pos).normalize();
    let right = new THREE.Vector3().crossVectors(fwd, v3(s.cam.up)).normalize();
    if (right.lengthSq() < 1e-6) right = new THREE.Vector3(1, 0, 0);
    const up = new THREE.Vector3().crossVectors(right, fwd).normalize();
    (sh.uCamPos.value as THREE.Vector3).copy(pos);
    (sh.uCamRight.value as THREE.Vector3).copy(right);
    (sh.uCamUp.value as THREE.Vector3).copy(up);
    (sh.uCamFwd.value as THREE.Vector3).copy(fwd);
    sh.uTanF.value = Math.tan((s.cam.fov * Math.PI) / 360);
    sh.uTime.value = s.t;
    sh.uPulse.value = s.pulse; sh.uBeatT.value = s.beatT;
    (sh.uRose.value as THREE.Vector4).set(...s.rose);
    (sh.uRoseS.value as THREE.Vector4).set(...s.roseS);
    sh.uGlow.value = s.glow; sh.uBright.value = s.bright; sh.uRoot.value = s.root; sh.uMode.value = s.mode; sh.uBurnVis.value = s.burnVis;
    (sh.uHold.value as THREE.Vector4).set(...s.hold);
    (sh.uDN0.value as THREE.Vector3).set(...s.deer.n0); (sh.uDN1.value as THREE.Vector3).set(...s.deer.n1);
    (sh.uDHead.value as THREE.Vector3).set(...s.deer.head); (sh.uDF.value as THREE.Vector3).set(...s.deer.f);
    (sh.uDU.value as THREE.Vector3).set(...s.deer.u); (sh.uDA.value as THREE.Vector4).set(...s.deer.a);

    const r = this.renderer;
    // 1. procedural world -> colour + (flow, distance, role) buffers
    this.fsMesh.material = this.sceneMat[s.scene];
    r.setRenderTarget(this.sceneRT); r.clear(); r.render(this.fsScene, this.fsCam);
    // 2. shape-aware glyph matching per cell (ping-pong for hysteresis)
    const src = this.cellRT[this.flip], dst = this.cellRT[1 - this.flip];
    const cu = this.cellMat.uniforms;
    cu.uColor.value = this.sceneRT.textures[0]; cu.uData.value = this.sceneRT.textures[1]; cu.uPrev.value = src.textures[0];
    cu.uTime.value = s.t; cu.uReset.value = this.reset;
    this.fsMesh.material = this.cellMat;
    r.setRenderTarget(dst); r.render(this.fsScene, this.fsCam);
    this.flip = 1 - this.flip; this.reset = 0;
    // 3. glyph compositing to the canvas
    const du = this.dispMat.uniforms;
    du.uCellA.value = dst.textures[0]; du.uCellB.value = dst.textures[1];
    du.uTime.value = s.t; du.uFlash.value = s.flash; du.uFade.value = s.fade;
    (du.uFlashCol.value as THREE.Vector3).set(...s.flashCol);
    this.fsMesh.material = this.dispMat;
    r.setRenderTarget(null); r.clear(); r.render(this.fsScene, this.fsCam);
    // 4. instanced world-space glyph particles (depth tested against the world distance buffer)
    this.cam.fov = s.cam.fov; this.cam.aspect = 16 / 9; this.cam.near = 0.01; this.cam.far = 2000;
    this.cam.position.copy(pos); this.cam.up.copy(up); this.cam.lookAt(tgt);
    this.cam.updateProjectionMatrix(); this.cam.updateMatrixWorld();
    const pu = this.partMat.uniforms;
    (pu.uViewProj.value as THREE.Matrix4).multiplyMatrices(this.cam.projectionMatrix, this.cam.matrixWorldInverse);
    (pu.uW.value as THREE.Vector3).set(s.pollen, s.corp, s.ember);
    pu.uSceneData.value = this.sceneRT.textures[1];
    r.render(this.partScene, this.fsCam);
    r.setRenderTarget(null);

    // adaptive quality (only while playing real time)
    const now = performance.now();
    if (this.auto && this.lastFrame) {
      const dt = now - this.lastFrame;
      if (dt < 250) this.ema = this.ema * 0.93 + dt * 0.07;
      if (this.ema > 30) { this.slow++; this.fast = 0; } else if (this.ema < 14) { this.fast++; this.slow = 0; } else { this.slow = 0; this.fast = 0; }
      if (this.slow > 45 && this.quality > 0) { this.setQuality(this.quality - 1); this.slow = 0; this.ema = 20; }
      if (this.fast > 600 && this.quality < 2) { this.setQuality(this.quality + 1); this.fast = 0; }
    }
    this.lastFrame = now;
    this.info.ms = this.ema;
    void t0;
  }

  dispose() { this.renderer.dispose(); }
}
