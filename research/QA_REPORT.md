# QA Report

Environment: headless Chromium (Playwright) with **software WebGL2 (SwiftShader)** — no GPU, no audio output. Captures at the lowest quality tier (canvas 960×540, world 640×360). Screenshots: `research/screenshots/` (`a_*`, `b_*`, `c_*`, `d_*` = successive iterations; `d_*` and `c_*` are latest). Scripts: `research/qa/capture.mjs`, `research/qa/playthrough.mjs`.

## Verified (automated)
* HTML loads from `file://`; WebGL2 context; all 6 shaders compile (heart, garden, cell, display, particle vert/frag) — **0 console errors** over a full 60-s playthrough.
* Start button → playing; audio context `running`; **Pause** froze time exactly (3.7499 s before and after 2.5 s) and suspended audio; **Resume** continued; timeline **ended at exactly 60.0 s**, audio context still running (silence); **Replay** restarted at 0 and played.
* Clock uses real elapsed time (no frame counting, no dt clamp); tab hidden → auto-pause.
* Build: single `dist/index.html` (audio embedded as data URIs, ~2 MB); no external requests.

## Visual review (honest critique of the captured frames)
| Question | Verdict |
|---|---|
| Heart reads as heart / alive? | Yes in silhouette (cleft, apex, light-pipe); pulse is driven by the beat table. Aliveness only judged from still frames. |
| Garden spatial? | Yes: tiered glyph scale, shadows, haze, birds, trees. |
| Flowers recognisable? | Reasonable (stalk + coloured heads); foreground heads read as tulips from low camera. |
| Deer anatomy? | Body/legs/antlers read at distance (t=23); close head is blobby. |
| Eye dimensional, rose identifiable? | Eyeball is glossy and mirrors the garden with a distinct red rose; **iris rings/pupil are weak** under the reflection — needs another pass. |
| Same rose throughout? | Yes by construction (one SDF/state), visually consistent. |
| Fire follows flower? | Partly: glowing plume + petals eroding; reads more as glow than distinct tongues. |
| Beautiful rather than noisy? | Mostly; grass/terrain colours are saturated and the heart exterior is quite uniform red. |

## Not verified / known limitations
* Real-GPU performance was **not measured** (SwiftShader only); adaptive quality (3 tiers) is implemented but untested on hardware. Heavy raymarch cost is a risk on integrated GPUs.
* Audio sync and mix were not heard. Fullscreen not exercised in headless mode.
* Not every second was inspected: captured t = 1, 3, 5, 7.4, 10, 12, 16, 19, 23, 28, 36, 41, 43, 46.8, 48, 49.5, 50.5, 52.5, 56, 56.5, 58.5, 59.5, 60.
* Act II tunnel switch and the two scene switches are hidden under flashes (8.45 s, 14.0 s, 51.15 s) rather than being continuous geometry.
* Temporal flicker was reasoned (hysteresis) but not quantitatively measured.
* No seek bar (by design).
