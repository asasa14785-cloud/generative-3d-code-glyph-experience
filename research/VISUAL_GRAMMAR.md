# Visual Grammar

**Atlas**: JetBrains Mono Bold (SIL OFL) printable ASCII (95 glyphs), 16 columns, 52×72 px cells with padding + mipmaps. Grid: 240×90 cells (aspect 1:1.5), fine tier; **coarse tier** = 2×2 cells (120×45) for near foreground (grass, foliage, tunnel walls) so near structures use bigger glyphs than distant ones.

**Role families** (glyph mask per cell, chosen by the world shader):
| id | Role | Glyph pool | Behaviour |
|---|---|---|---|
| 0 | Atmosphere, light, void, sun rays | `const float vec2 vec3 vec4 return uniform texture sin cos fract mix smoothstep void main gl_FragCoord` + `.:;'-_=+*/\|<>(){}[]~^` | Wherever light exists, cells show scrolling code ribbons (the only readable text; kept to light/atmosphere) |
| 1 | Heart flesh, vessels, tunnel walls, membrane | `@%&#*+=~:;.,(){}[]/\|sS8oOQ$` | Dense; vein contour curves become `( ) { } /` through edge orientation |
| 2 | Foliage, leaves, tunnel roots | letters/digits `aeosczxvwyun…35689#%&*+~^<>` | Leaf clusters as letter textures |
| 3 | Grass, stems | `\| / \ ! ( ) l I i 1 j ; : , . ' " ~ ^ - _` | Orientation from per-object flow field (blade lean + wind) |
| 4 | Deer fur, birds | `#%@8&WMNH=+-/\|~:.,;'"` | Fur flow = surface-projected downward direction |
| 5 | Rose petals, flowers | `(){}@&%86905OoQqcCSs*+=~;:.,<>$` | Curved glyphs following petal contours |
| 6 | Fire, embers | `^~*+'"`,.:;!\|/\()<>AVYvyi1` | Vertical flow, gain boosted |
| 7 | Eye | `()oO0@~=-_\|.:;'*+{}[]<>QCcDdUu` | Concentric rings from iris pattern |

**Selection**: per cell, 6 internal + 10 external circle luminances (Glif layout) → directional contrast → error against every allowed glyph's vector + orientation bias (−0.05 match / +0.07 mismatch) → hysteresis 0.012. **Colour**: optical averaging (fg solved from glyph ink and tinted background). **Bloom**: 3×3 cell-neighbourhood glow in the display pass.

**Objects**
* Heart: SDF lobes + tapered body, coronary vessels as raised contour curves of a noise field; pulse scales the SDF, ripples a travelling ring and drives emissive vein glow (`uPulse` from the same beat table as the audio).
* Tunnel: spiral ribs/veins → ridged root structures as `uRoot` rises; colour red→moss/gold; light grows toward the exit.
* Garden: SDF terrain, domain-repeated trees (trunk + 4 noisy foliage lumps), 3D flowers (stem + 5-lobed head), 5 flapping-wing birds, soft shadows, god rays from the opening, pollen as instanced glyph billboards.
* Deer: SDF with FK joints from the timeline (neck pitch/yaw, jaw, ear twitch, breathing, tail), fallow spots, antlers.
* Eye: ellipsoid eyeball in a lid; iris rings + fibres + horizontal pupil; **corneal mirror** marches the same garden (incl. hero rose) with a deliberately magnified convex mapping (artistic).
* Rose: six nested scalloped petal cups, sepals, bent stem, two independently swaying leaves; burn front erodes petals from the rim; flame = volumetric flow-noise density hugging the petal shells plus a rising plume; embers = instanced glyph particles.
