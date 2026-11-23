# Creative Concept Selection

Scores are my own design-review estimates (not measurements): uniqueness /25, research depth /20, originality /20, mathematical coherence /15, storytelling /10, glyph potential /10.

| # | Direction | Principle | Uniq | Res | Orig | Math | Story | Glyph | Total |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Organic vascular typography | Characters only along vessel splines | 17 | 11 | 12 | 10 | 7 | 8 | 65 |
| 2 | Particle-only glyph point clouds | Instanced billboards for everything | 15 | 9 | 10 | 8 | 6 | 9 | 57 |
| 3 | Layered volumetric glyph slabs | Depth-sliced text planes | 16 | 10 | 12 | 9 | 7 | 8 | 62 |
| 4 | Directional filament fields | Flow-line stroke rendering | 18 | 12 | 14 | 11 | 7 | 8 | 70 |
| 5 | **Shape-matched glyph anatomy over a procedural SDF world, with depth-tiered glyph scale and role families, plus an instanced world-space glyph particle layer** | Everything is an analytic field; characters are chosen by shape (Glif), role (family mask), orientation (flow/edge) and depth tier; optical colour averaging | 22 | 15 | 16 | 13 | 10 | 10 | **86** |

**Chosen: #5.** One analytic world (SDF heart, garden, deer, hero rose, flame volume) is the single source of truth, so the rose in the corneal reflection, the planted rose, the ascending rose and the burning rose are literally the same function with different state (`roseMap`/`roseColor` in `src/shaders/common.ts`).

## Rejected alternatives
1–3 would break "everything must be one coherent object": splines/point clouds cannot give a reflective eye or a shaded deer, and slabs lose silhouette. #4 was folded into #5 as the *flow field* feeding glyph orientation.

## Patent / repository links
US8457348 (same-layout shape matching) + Glif (6-circle vectors, directional contrast, hysteresis) → glyph selection; US3806641 (tone→halftone character font) → ink-coverage table; US7899265 (optical colour averaging) → foreground colour solve; AuraASCII/Glyphbooth → MRT/atlas/post architecture; ascii-render → deterministic time.

## Visual principles
Near = big glyphs, far = small (two tiers); roles by material (see VISUAL_GRAMMAR); light = code ribbons (`const float vec2 …`); beat = geometry + glow + glyph density; fire = rising flow-aligned strokes plus instanced ember glyphs.
