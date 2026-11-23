# Repository Analysis

All four repositories were cloned (`--depth 1`) into `research/repositories/` and licences checked: **all MIT** (auraascii © Sunil Gentyala, glif © Mark Farkas, ascii-render © Oleksandr Riasnyi, glyphbooth © Mustafa Saraç). **No source file was copied**; techniques were re-implemented independently in GLSL/TypeScript. No dependency from them is used.

## What I actually read
| Repo | Files read | Findings |
|---|---|---|
| auraascii | `engine/shaders/edge.frag.glsl`, `ascii.frag.glsl`, `engine/GlyphAtlas.ts` | Two-pass WebGL2: Sobel (r=magnitude, g=angle, b=luma; the angle channel is explicitly "reserved for future directional character selection"), then char index = floor(intensity·(N−1)) into a canvas-drawn atlas sorted dense→sparse. Brightness-only selection; atlas has no mipmaps. |
| glif | `src/sampling.c`, `contrast.c`, `match.c`, `temporal.c`, `vec6.h`, `font.c` (partly) | 6 internal circles (3×2 staggered, r=0.28) + 10 external circles; per-circle averages form a 6-vector; **directional contrast** `v=(v/max)^crunch·max` with max over the circle and its affecting externals; brute-force nearest glyph with a quantised (5 bit/dim) cache; temporal: EMA of 5th/95th percentile normalisation and snap thresholds. |
| glyphbooth | `render/shaders/cells.frag`, `post.frag`, `render/atlas.ts`, `renderer.ts` (pass structure) | Source→effect→post passes; atlas sorted by ink coverage with a 256-entry tone→glyph LUT; Sobel "edge bins" select `| \ - /`; post pass = grain/vignette/scanlines. |
| ascii-render | `src/ascii.ts` (density cache, trails), `scripts/scenes.ts` (deterministic procedural scenes) | Per-font density measurement cached; trail canvas with fading alpha; scenes are pure functions of time (same philosophy as my timeline). |

Not inspected in depth: ascii-render `audio.ts`/`mcp/*`/`export.ts` (export deliberately not used), glif WASM player/encoder, glyphbooth audio/beat modules.

## What was reimplemented
* Glif six-circle sampling + directional contrast + nearest-glyph matching → `src/shaders/glyphPass.ts` (`CELL_FRAG`), run on the GPU per cell (≈21 600 cells × 95 glyphs). Glyph vectors are computed from the *actual rendered atlas bitmap* (`src/engine/glyphs.ts`).
* Glif/AuraASCII/Glyphbooth edge orientation → orientation classes `- / | \` from external-circle gradients, or from a per-object **flow field** (grass lean, fur direction, flame rise) written by the world shader; used as a bias in the glyph error.
* Glif temporal ideas → ping-pong cell textures with hysteresis (no per-frame flicker when two glyphs tie).
* AuraASCII atlas/multipass → canvas atlas with mipmaps and padding, MRT world pass (colour + flow/distance/role), cell pass, display pass.
* Glyphbooth pass structure + grain → display pass bloom/grain/vignette.
* ascii-render determinism → every motion is a pure function of `t` (`src/animation/timeline.ts`).

## Rejected / not done
* Glif quantised match cache (unneeded on GPU). Percentile normalisation (scenes are tone-mapped in the world pass). ascii-render trails (would smear the deterministic scrub). Video export (out of scope).
* The brief's "build and test small prototypes" per technique: I did **not** build isolated prototypes; the production engine was iterated directly with browser captures (see QA_REPORT).
