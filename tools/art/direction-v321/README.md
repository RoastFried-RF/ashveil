# Revision321 original character and material artwork

OpenAI image generation created the original PNGs in `public/sprites/original/direction-v321/`. These are generated raster paintings with pixel texture, not hand-placed SVG pixels. No reference-game image was an image-generation input. Edits used this project's own generated models only. [Research](research.json) records the five official Steam scene references visually consulted, separately from the earlier Wiki study.

The31 accepted files contain13 walking/idle model sheets,13 attack sheets, one eight-face portrait sheet, and four material fields (stone, ground, walls, water). Six rejected atlases had overlapping pose bounds; their provenance remains in [generated-sources.json](generated-sources.json), with no installed path. Accepted files are unchanged copies of the recorded image-generation originals. Their SHA256 hashes are the preservation contract; generation is not bit-reproducible from a text prompt.

[actor-plan.json](actor-plan.json) explicitly maps13 models onto all28 character registrations. These are13 distinct models, not28 unique appearances. Role aliases, including some enemy variants, share models. Individual age/gender/clothing simulation remains outside this revision. The inert drone keeps a stationary pose.

The importers read alpha/header data and write JSON rectangles, pivots and scale only. They never rewrite PNG pixels. Actor registration fails if four direction rows and their separated pose columns cannot be identified. Six walk, two idle and four attack frames per direction produce624 body frames. Portraits add8 frames; material registration replaces52 existing frame keys. Per-frame transforms keep cropped native poses at their explicit world height. Large material fields are sampled8×8 at logical16px cells by the renderer.

From the repository root with Pillow installed:

```sh
python3 tools/art/direction-v321/import-actors.py --install
python3 tools/art/direction-v321/import-materials.py --install
python3 tools/art/direction-v321/import-portraits.py
node tools/art/update-sheet-sizes.mjs
node --import tsx tools/art/export-public-artbook.ts
node --import tsx tools/validate-sprites.ts
```

These steps reproduce registration from the preserved PNGs. They do not regenerate artwork. [Actor audit](actor-frame-audit.json), [material audit](material-audit.json), [game and artbook review](../../../docs/art-quality-v321.md), [CC0 notice](LICENSE.txt).
