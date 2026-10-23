# 작물 성장 단계 원화 v313

Original oat, shade root, whitecap culture, cabbage, potato and turnip silhouettes, plus spent wood. 31 transparent64×64 frames in a320×448 atlas; in-world height16px. Authored paths in draw-crops.mjs, generated with Node and Inkscape. No image inputs, tracing, palette sampling, external fonts or filters. CC0; see LICENSE.txt.

Regenerate from the repository root:

```sh
node tools/art/direction-v313/draw-crops.mjs
inkscape tools/art/direction-v313/crops.svg --export-type=png --export-filename=public/sprites/original/direction-v313/crops.png
```

crop-art.json identifies the default visual settings and stage frames. crop-art.ts selects neutral frames when a field is outside current sight. Explicit mod visual overrides retain their own appearance. Visible legacy plots retain timer-based readiness. Actual planted crops show four growth stages; spent whitecap uses a separate frame.

The31-frame atlas has been opened for author review. Actual map/light/scale/hidden-state/mod review and independent regeneration are pending at this implementation checkpoint. Private R1/R2 reproduction evidence does not apply to this expanded atlas. Steam screenshots are research only; benchmark-notes.json describes the limited observations.
