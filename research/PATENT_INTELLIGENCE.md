# Patent Intelligence Database

Labels used throughout: **[EXPLICIT]** = stated in the patent text I downloaded and parsed; **[INFERRED]** = my reading of the mechanism; **[ARTISTIC]** = my own extrapolation (not demonstrated by the patent).

## Method and honest scope
* Source used: Google Patents (pages + its `xhr/query` endpoint). 31 queries across: character/shape matching, log-polar descriptors, halftone character selection, variable-radius morphology, optical colour averaging, glyph deformation, edge orientation, reaction-diffusion, L-systems/plants, fractal trees, flame/fluid rendering, temporal hysteresis/stabilisation, texture synthesis, iris/cornea rendering, metamaterials, biomimetics, SDF/glyph GPU rendering, noise, god-rays. Raw results: `research/patents_raw/candidates.json` (**176 unique documents screened** by title/abstract snippet; `research/patents_raw/search.mjs`).
* WIPO PATENTSCOPE, Espacenet, USPTO PPUBS were **not** queried programmatically (they need interactive sessions). Justia (US7659914) was blocked by Cloudflare, so US7659914B1 was read from Google Patents instead.
* A second discovery wave (Perlin/simplex noise, SDF text, flame particles) was blocked by Google rate-limiting (HTTP "Sorry…" page) and **was not completed**.
* **Deeply investigated (full text downloaded and parsed: abstract, claims, description, dates, legal events): 4 documents** – the four mandatory ones (`research/patents_raw/*.html|txt`). The brief asked for 5; I did not reach 5 because of the rate limit. The other selected candidates below were screened at title/abstract-snippet level only; I make no claims about their detailed mechanisms.
* Legal status: Google shows "Expired" for three of the four. That is **not** treated as worldwide freedom to use. **No patented method is copied**; ideas are re-implemented independently as generic image-processing techniques and this is not legal advice.

## Deep-read documents

### US8457348B2 — *Producing structure-based ASCII pictures*
* Inventors: Tien-Tsin Wong, Xuemiao Xu, Linling Zhang (Chinese University of Hong Kong). Filed 2010-06-28, granted 2013-06-04. Google status: Expired – Fee Related.  https://patents.google.com/patent/US8457348B2/en
* Problem **[EXPLICIT]**: ASCII art should preserve the *structure* (outline) of a picture, not just tone.
* Mechanism **[EXPLICIT, claim 1]**: rasterise a *vector outline image* into grid cells; match each cell's reference image to an ASCII character "based on log-polar histograms"; gather characters. Claims 2–3: sample reference and glyphs with the same layout, feature vector per sample point from log-polar histograms, minimise shape dissimilarity.
* Scope check: it targets **vector outline images**, not shaded 3D renders, and uses **log-polar histograms** — a different descriptor from Glif's 6 circles. I did *not* implement log-polar histograms.
* Takeaways used **[INFERRED→implemented]**: sample the cell and every glyph with the *same* layout, pick the glyph minimising a shape distance (done with Glif's six-circle layout in `CELL_FRAG`).
* Limitation: outline-only; matching cost grows with glyph count.

### US7659914 (B1) — *Generation of an image from text*
* Inventor: Sylvia Tatevosian Rostami. Filed 2006-06-12, granted 2010-02-09. Google: Expired – Fee Related (micro-entity fee events listed).
* Mechanism **[EXPLICIT, claim 1]**: relate a text "Graphical Elements Work" to a target image; measure the grey value the text averages; per target pixel compute a min/max kernel **radius** from its grey value; replace the text pixel by the darkest/lightest sampled value inside that radius (thickening/thinning).
* Not implemented as a morphological operation. **[INFERRED→applied]** the principle "locally vary glyph ink to hit a tone" is realised by choosing glyphs of different ink coverage (see US3806641A) plus the weight/threshold control of the glyph coverage in the display pass.

### US3806641A — *Method and apparatus for forming halftone images*
* Inventor: H. Crooks (Information International Inc.). Filed 1971-05-17, granted 1974-04-23. Google: Expired – Lifetime.
* Mechanism **[EXPLICIT, claims 1–4]**: store a *font* of halftone-dot characters of different sizes (one per tonal gradation); dissect the original into tonal measurements; fetch the dot character matching each measurement.
* Implemented idea **[INFERRED]**: the glyph table stores each glyph's ink coverage and per-circle densities; the cell's measured tone selects glyphs by density (`glyphs.ts`, `CELL_FRAG`).

### US7899265B1 — *Generating an image by averaging the colors of text with its background*
* Inventor: Sylvia Tatevosian Rostami. Filed 2007-05-01, granted 2011-03-01. Legal status line not captured by my parser (treat as unknown).
* Mechanism **[EXPLICIT, claim 1]**: subdivide work and target into corresponding subsections; measure average colour components of each; colourise text and adjacent background so that, viewed from a distance, they optically blend to the target colour.
* Implemented **[INFERRED→implemented]**: in `DISPLAY_FRAG` the background is `bg = C·0.11` and the foreground is solved as `fg = C·(1−0.11(1−c))/c`, where `c` is the chosen glyph's ink coverage, so that `c·fg + (1−c)·bg ≈ C` (optical colour averaging).

## Screened candidates carried forward (abstract-level only — **not** deeply read)
US7408555B2 *Adjusted Stroke Rendering* (stroke/typographic rendering); JP3133788B2 and JP3133790B2 *Halftone font generator*; US20190236820A1 *Rendering resolution-independent shapes from outline data*; US12002132B1 *Rendering using analytic signed distance fields*; WO2023043993A1 *Displaced micro-meshes for ray and path tracing* (organic surface displacement); CN109285217B *Procedural plant model reconstruction*; AU2019202063B2 *Synthesizing new font glyphs from partial observations*; EP3425899B1 *Scene-stabilized metadata* (temporal stability); US10950352B1 (texture learning); JP5330972B2 *Halftone image data generation*. Selected = the 4 deep-read + these (≥8 candidates). Visual relevance of the latter is hypothetical: SDF rendering and displacement ideas informed the *procedural SDF world* choice (an independent, textbook technique), temporal stability informed the hysteresis design (together with Glif).

## Variables / relationships used in the build
`v_i` (6 circle densities), external contrast `e_j`, `v' = (v/m)^crunch·m`, glyph error `E_g = Σ(v_i−s_{g,i})² + role penalty + orientation bias`, hysteresis `keep prev if E_prev ≤ E_best + 0.012`, optical colour `fg = C(1−k(1−c))/c`.

## Not demonstrated
Nothing here claims experimental validation of any artistic extrapolation (e.g. "corneal convex-mirror magnification" is a deliberate artistic exaggeration).
