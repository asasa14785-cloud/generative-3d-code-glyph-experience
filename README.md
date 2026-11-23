# THE GARDEN WITHIN — a 60-second real-time code-glyph film

A beating heart holds a garden; a deer finds a rose in its own eye; the rose escapes the heart and burns into light. Everything is drawn with characters, generated live in the browser (no video).

## Run
* **Open `dist/index.html`** (after `npm run build`; single self-contained file, audio embedded) in a modern desktop browser (WebGL2). Click **BEGIN** (sound starts only after this click).
* Dev: `npm install && npm run dev`. Build: `npm run build`.
* Controls: Pause/Resume (Space), Replay, Sound (M), Fullscreen (F), progress bar. Quality auto-adapts; force with `?q=0|1|2`.
* Test: `node research/qa/capture.mjs "3,41,56" 0 shot` (frame captures), `node research/qa/playthrough.mjs` (full 60-s functional test). Requires Playwright Chromium.

## Architecture (see `research/`)
```
src/animation/timeline.ts   deterministic master timeline (camera, beats, deer FK, rose state, flashes)
src/shaders/common.ts       noise, SDFs, HERO ROSE, HEART
src/shaders/heart.ts        exterior heart, vascular→root tunnel, flame volume
src/shaders/garden.ts       garden, deer, eye + corneal mirror, birds
src/shaders/glyphPass.ts    Glif-style cell matcher, display pass, instanced particles
src/engine/                 glyph atlas/shape table, GlyphEngine (MRT → cells → display → particles), Player clock
src/audio/AudioDirector.ts  Web Audio scheduling
src/assets/audio, assets/audio   recorded audio (mp3)
research/                   PATENT_INTELLIGENCE, REPOSITORY_ANALYSIS, CREATIVE_CONCEPT_SELECTION, VISUAL_GRAMMAR, SOUND_ASSET_LOG, QA_REPORT, screenshots, raw data
```
Pipeline: procedural SDF world (MRT: colour + flow/distance/role) → per-cell shape matching on the GPU with role masks, orientation bias and hysteresis → optical-colour-averaged glyph display → instanced glyph particles (pollen, corpuscles, embers).

Read `research/QA_REPORT.md` for honest limitations (notably: tested only with software rendering, audio not auditioned, patent deep-read count = 4).
