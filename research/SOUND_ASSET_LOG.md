# Sound Asset Log

Source: Wikimedia Commons (queried through its API; licence strings taken from Commons `extmetadata.LicenseShortName`). Freesound.org was **not** queried directly (downloads require login); the heartbeat is a Commons mirror of a Freesound upload. I did not open each file's full description page, so creator/licence data comes from the Commons API response.

| Use | File (Commons) | Creator | Licence | URL | Processing |
|---|---|---|---|---|---|
| Heartbeat | `Human heart beating at 61 bpm (Cc-by-3.0).ogg` | "Benboncan" (Freesound.org) | CC BY 3.0 | https://commons.wikimedia.org/wiki/File:Human_heart_beating_at_61_bpm_(Cc-by-3.0).ogg | One lub-dub cycle cut at 2.00–3.04 s (S1≈+0.06 s, S2≈+0.39 s from onset analysis), mono, fades |
| Garden birds + breeze | `Gentle breeze and birds singing.ogg` | ezwa | Public domain | https://commons.wikimedia.org/wiki/File:Gentle_breeze_and_birds_singing.ogg | +14 dB, limiter, 32 kHz mono mp3; crossfaded loop |
| Leaves / wind / grass rustle | `Rustling leaves (Gravity Sound).wav` | Gravity Sound | CC BY 4.0 | https://commons.wikimedia.org/wiki/File:Rustling_leaves_(Gravity_Sound).wav | mono mp3; low-passed as wind; band-passed short segments as grass rustle |
| Fire | `Campfire sound ambience.ogg` | Glaneur de sons | CC BY 3.0 | https://commons.wikimedia.org/wiki/File:Campfire_sound_ambience.ogg | 5–45 s, high-pass 80 Hz, +22 dB, limiter, mono mp3 |

Downloaded, evaluated, **unused**: `Human heart rate.flac` (Wilfredor, CC0).

## Original synthesis (no licence issues)
Heartbeat body-resonance sine thumps (54/62 Hz), tunnel whoosh (noise + sweeping band-pass) and drone, rose-ascent bell figure (additive sine partials) and air, ignition whoosh, soft pad (G-D-G-D), generated reverb impulse response.

## Honest gaps
* **No authentic grazing/breathing deer recording was found/used.** Grass rustle is a processed segment of the CC BY rustling-leaves recording; it is not a recording of a deer. No claims are made otherwise.
* Audio could not be auditioned in the sandbox; scheduling, suspend/resume and context state were verified programmatically, not by ear.
* CC BY attribution is in `CREDITS.md` and must be kept.

Commands used: ffmpeg-static (see `research/audio_raw/`), e.g. `ffmpeg -ss 2.00 -t 1.04 -i heart61.ogg -ac 1 -b:a 128k heartbeat_cycle.mp3`.
