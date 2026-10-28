# v322 original motion sources

99 unchanged generated PNGs in `public/sprites/original/direction-v322/` extend13own v321role models. OpenAI image generation was used; this is distinct from earlier hand-placed SVG art. No reference-game raster was supplied, traced, copied or installed. The v321 visual research remains credited in its own record; this revision does not claim a new external-image survey.

`generation-plan.json` preserves the first99jobs and their original/retry prompts. `sources/*.json` records every accepted or alpha-layout-rejected attempt, actual input/output paths, prompt, SHA-256 and32crop registrations. The last accepted attempt is the installed exact original PNG. Rejected experiments are separate. `layout-v2-jobs.json` records the reviewed replacement layouts; these replace existing file paths, not additional installed sheets. Semantic direction fixes and shared mirrored poses are explicit in `semantic_registration.py` and `motion-audit.json`.

The old two-directions-per-sheet locomotion layout uses two rows per facing. Reviewed v2 replacements instead put front/left/right/back on rows1/2/3/4 of each sheet: partA has8walk poses, partB has4walk plus4idle. Combat and active sheets retain paired direction rows; ground/ranged have four direction rows. No generated PNG is cropped, recolored or resampled on disk. Pillow reads alpha only; all changes are JSON crop/pivot/scale/facing/hand metadata. Some registered slots deliberately share source regions for correct mirrored profiles.

Re-register preserved originals with Python3/Pillow and the existing Node/tsx environment:

```sh
python3 tools/art/direction-v322/import-motions.py --install
node tools/art/update-sheet-sizes.mjs
node --import tsx tools/art/export-public-artbook.ts
node --import tsx tools/art/export-motion-comparison.ts
node --import tsx tools/validate-sprites.ts
```

Do not use `--partial` for publication. `baseline-characters.json` preserves role bindings/scale ratios/portraits and retired body sheets. `motion-baseline.json` is a filtered immutable v321snapshot for the portable motion comparison exporter. Old frame keys remain available for compatibility. Registration from preserved PNGs and hashes is reproducible; image generation itself is not bit-reproducible. Source identities, authored motions and exact displayed/shared region counts are separate in the release proof. Mobile transfer/GPU-memory performance is not benchmarked.
