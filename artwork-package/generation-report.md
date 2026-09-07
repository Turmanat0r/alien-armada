# Alien Armada image generation record

Mode: built-in image_gen. Exactly three generation requests, one per atlas, run concurrently. Generated PNG bytes were copied without editing pixels.

| Atlas | File | Dimensions | Pixel format | Transparency |
|---|---|---|---|---|
| Commanders | commanders-atlas.png | 1983 x 793 | 24-bit RGB | None; pale checkerboard is baked into RGB |
| Ships | ships-atlas.png | 1122 x 1402 | 24-bit RGB | None; pale checkerboard is baked into RGB |
| Escape pods | pods-atlas.png | 1983 x 793 | 24-bit RGB | None; pale checkerboard is baked into RGB |

## Visual inspection

- Commanders: high quality, ten portraits with five consistent identities in the specified order. Top row smug/idle and bottom row shocked. Helmets complete. Layout approximately 5 x 2 square cells, but some edges run slightly past exact uniform column boundaries. Main top portrait region y=0..384, lower region y=393..768.
- Ships: high quality and all noses right, orthographic top-down. Five rows present in specified order. Row heights are not uniform: use custom source crop rectangles rather than 20% row steps. Approximate vertical source bands: mothership y=18..340; bio-cruiser y=354..610; void scout y=621..893; spore pod y=910..1105; probe y=1118..1365. Probe is much shorter than the other ships.
- Escape pods: high quality, recognizable commanders, all complete. One horizontal row, approximately equal column spacing. Tall pods fill about y=38..696 and the single row is about 2.5:1 overall, so individual cells are tall rectangles rather than squares. Gold first pod reaches almost to left edge. No flame trails.
- All requested assets have no text, labels, watermarks, or UI. None has genuine transparency. This failure is from generation output, not a conversion. No background removal, resizing, slicing, or other pixel editing was performed.

## Exact prompts

### Atlas 1

```text
Use case: stylized-concept.
Asset type: production sprite atlas for the Alien Armada game.
Primary request: exactly ten alien commander portraits arranged in a mathematically precise 5-column by 2-row grid. Canvas landscape 2560 x 1024 pixels if supported, each of the ten square cells 512 x 512 pixels. The invisible cell boundaries are x=0,512,1024,1536,2048,2560 and y=0,512,1024. Each sprite is centered inside its own cell with at least 8% transparent padding on every side. Same five commanders in each row, consistent identities and costumes.
Scene/backdrop: actual transparent alpha background over the entire canvas, no painted checkerboard, no scene, no floor, no card shapes, no grid lines.
Style/medium: premium polished stylized 3D cartoon original aliens, oversized expressive heads inspired by Megamind, retro Mars Attacks style glass bubble helmets with visible sculpted brain shapes, toothy grins, retro space uniforms, cinematic toy-like shading, colorful beautiful materials.
Top row: smug or idle head-and-shoulder portraits. Bottom row: the identical commanders with shocked or panicked expressions; same head, colors, outfit, and head size.
Column 1, Admiral Zog: huge cobalt-blue head, green visible brain under a glass dome, gold epaulettes, medals, villain moustache.
Column 2, Dr Fizzle: orange alien with huge ridged cranium, round goggles, teal lab coat, gleeful scientist.
Column 3, Captain Nerp: mint-green giant head, huge anxious eyes, orange flotation vest, clutches a tiny stuffed cow.
Column 4, Empress Vexa: violet enormous head, angular expressive brows, glamorous black and gold space uniform and crown-like helmet trim.
Column 5, Unit Bloop: small lime alien with an enormous brain, huge round eyes, many small teeth, chunky white and orange suit, gleeful troublemaker.
Constraints: exactly 5 columns and exactly 2 rows, exactly one portrait per square cell, all helmets and shoulders fully inside cells, no overlap, no clipping. No text, no labels, no logos, no watermarks, no UI.
```

### Atlas 2

```text
Use case: stylized-concept.
Asset type: production spacecraft sprite atlas for the Alien Armada game.
Primary request: exactly five different spacecraft in a precise 1-column by 5-row grid. Canvas 1024 x 1280 pixels if supported, five equal horizontal strips each 1024 x 256 pixels. Invisible horizontal boundaries y=0,256,512,768,1024,1280. Each whole ship centered inside its own strip, occupying approximately 85% of strip width and 65% of strip height. Every ship's long axis is horizontal, nose pointing RIGHT. Strict orthographic top-down view, no perspective angle.
Scene/backdrop: true transparent alpha background, no painted checkerboard, no starfield, no floor, no grid, no cast shadows beyond the sprite.
Style/medium: premium polished stylized 3D cartoon spacecraft, highly detailed but readable metallic sculpted alien hulls, reactor glows, beautiful toy-like rendering, coordinated retro alien space fleet.
Row 1: Mothership, elongated armored saucer with a domed glowing cyan reactor, gold and gunmetal plates, docking pods, five-cell long footprint.
Row 2: Bio-Cruiser, long organic ribbed green living spacecraft with luminous veins, four-cell length.
Row 3: Void Scout, sleek violet crescent spacecraft with swept wings running along its narrow elongated hull, three-cell length.
Row 4: Spore Pod, three connected luminous green and orange sacs in a protective metallic shell, three-cell length.
Row 5: Probe Drone, compact cyan spacecraft with a giant scanner eye, two-cell length.
Constraints: exactly five rows of equal height, one spacecraft per row, obvious distinct spaceships, each entirely within its strip with clear transparency between rows, all long axes horizontal and pointing right, no overlap, no clipping. No text, no lettering, no labels, no logos, no watermarks, no UI.
```

### Atlas 3

```text
Use case: stylized-concept.
Asset type: production escape-pod sprite atlas for the Alien Armada game.
Primary request: exactly five full escape pods arranged in one horizontal row, 5 equal square cells across the full canvas. Use the widest supported image size, ideally 2560 x 512 pixels, to keep the five cells square. If a 5:1 canvas cannot be supported, center the single row of five equal square cells in the widest landscape canvas with fully transparent extra vertical padding. All pods complete and centered in their respective cells, generous transparent padding, no overlap.
Scene/backdrop: true transparent alpha background across the whole canvas, no checkerboard, no scene, no floor, no cards, no grid lines.
Style/medium: premium polished stylized 3D cartoon original aliens, oversized expressive heads inspired by Megamind, Mars Attacks style glass bubble windows with visible sculpted brains, toothy grins, retro uniforms. Fun cinematic cartoon quality, detailed metallic toy-like pods with clear glass showing recognizable commander faces.
Column 1: gold luxury pod containing Admiral Zog, a huge cobalt-blue head with green visible brain, villain moustache, gold epaulettes and medals.
Column 2: improvised teal and orange pod pointing slightly backward, containing Dr Fizzle, orange mad scientist alien with huge ridged cranium, round goggles and teal lab coat.
Column 3: orange pod containing Captain Nerp, mint-green giant head with huge anxious eyes, wearing orange lifejacket and clutching a tiny stuffed cow; one suitcase stuck in hatch.
Column 4: luxurious violet and gold pod containing Empress Vexa, violet enormous head, angular expressive brows, glamorous black and gold uniform and crown-like helmet trim; she holds a tiny drink.
Column 5: round white and orange pod containing Unit Bloop, lime alien with enormous brain, huge round eyes and many small teeth, chunky white and orange suit; waving and grinning.
Constraints: exactly five pods, complete pods stay fully inside the five precisely equal square cells, no flame trails, no clipping. No text, no lettering, no labels, no logos, no watermarks, no UI.
```

