# Alien Armada black-background correction

Mode: built-in image_gen edit using referenced_image_paths. One targeted background edit per atlas. No pixel editing, resizing or cropping was performed outside imagegen. Originals preserved.

Files:
- C:/Users/Danie/Documents/Codex/2026-09-07/ca/work/armada-assets/commanders-black.png — 1981 x 793 RGB.
- C:/Users/Danie/Documents/Codex/2026-09-07/ca/work/armada-assets/ships-black.png — 1122 x 1402 RGB.
- C:/Users/Danie/Documents/Codex/2026-09-07/ca/work/armada-assets/pods-black.png — 1983 x 793 RGB.

All inspected visually. Pale checkerboard is removed. Background appears black. Top-left pixels are respectively RGB(1,1,1), RGB(1,0,0), RGB(0,0,0), so not every black-region pixel is numerically zero. Sprite identities, colors, orientation, and arrangement are closely preserved. Commander width changed by -2 pixels; other dimensions unchanged.

## Recommended display source rectangles

These are visually estimated padded display rectangles, not pixel-perfect segmentation. Format [x,y,width,height], source pixel coordinates. No files have been cropped.

Commanders, in Zog/Fizzle/Nerp/Vexa/Bloop order:
- Idle: [28,0,393,386], [453,0,337,386], [827,0,346,386], [1190,0,356,386], [1586,0,370,386].
- Panicked: [28,390,393,391], [453,390,337,391], [827,390,346,391], [1190,390,356,391], [1586,390,370,391].

Ships, in Mothership/Bio-Cruiser/Void Scout/Spore Pod/Probe order:
- [60,24,1020,318]
- [62,360,1010,247]
- [100,625,865,270]
- [100,910,880,193]
- [235,1125,480,238]

Pods, in Zog/Fizzle/Nerp/Vexa/Bloop order:
- [0,30,414,675]
- [414,95,374,610]
- [788,100,385,610]
- [1173,65,385,640]
- [1558,80,425,625]

## Exact edit prompts

### commanders

```text
Use case: precise-object-edit.
Input image: edit target, an existing ten alien portraits, five columns and two rows sprite atlas.
Primary request: replace only the pale white/gray checkerboard background with completely uniform pure solid black #000000, RGB(0,0,0). This is a targeted background correction. Do not make the background transparent. Use pure black in all existing checkerboard gaps and outside every sprite, including between sprites and at all canvas edges.
Preserve invariants: preserve every existing sprite exactly, its identity, shapes, colors, highlights, shadows on the objects, transparent glass appearance, details, proportions, count, current placement, spacing, orientation, size, and existing atlas arrangement. Preserve the source canvas dimensions 1983 x 793 as closely as possible. Do not reposition, recrop, enlarge or shrink sprites. Do not alter the ships or aliens or pods. All non-background content must remain unchanged. Keep all sprites complete.
Constraints: solid black background only, no checkerboard pattern, no gradients, no new backdrop objects, no new text, no labels, no grid lines, no UI. Do not add anything.
```

### ships

```text
Use case: precise-object-edit.
Input image: edit target, an existing five spacecraft, one column and five rows sprite atlas.
Primary request: replace only the pale white/gray checkerboard background with completely uniform pure solid black #000000, RGB(0,0,0). This is a targeted background correction. Do not make the background transparent. Use pure black in all existing checkerboard gaps and outside every sprite, including between sprites and at all canvas edges.
Preserve invariants: preserve every existing sprite exactly, its identity, shapes, colors, highlights, shadows on the objects, transparent glass appearance, details, proportions, count, current placement, spacing, orientation, size, and existing atlas arrangement. Preserve the source canvas dimensions 1122 x 1402 as closely as possible. Do not reposition, recrop, enlarge or shrink sprites. Do not alter the ships or aliens or pods. All non-background content must remain unchanged. Keep all sprites complete.
Constraints: solid black background only, no checkerboard pattern, no gradients, no new backdrop objects, no new text, no labels, no grid lines, no UI. Do not add anything.
```

### pods

```text
Use case: precise-object-edit.
Input image: edit target, an existing five escape pods in one horizontal row sprite atlas.
Primary request: replace only the pale white/gray checkerboard background with completely uniform pure solid black #000000, RGB(0,0,0). This is a targeted background correction. Do not make the background transparent. Use pure black in all existing checkerboard gaps and outside every sprite, including between sprites and at all canvas edges.
Preserve invariants: preserve every existing sprite exactly, its identity, shapes, colors, highlights, shadows on the objects, transparent glass appearance, details, proportions, count, current placement, spacing, orientation, size, and existing atlas arrangement. Preserve the source canvas dimensions 1983 x 793 as closely as possible. Do not reposition, recrop, enlarge or shrink sprites. Do not alter the ships or aliens or pods. All non-background content must remain unchanged. Keep all sprites complete.
Constraints: solid black background only, no checkerboard pattern, no gradients, no new backdrop objects, no new text, no labels, no grid lines, no UI. Do not add anything.
```

