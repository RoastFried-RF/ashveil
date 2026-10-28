# v386 — opaque sewn trouser-panel source candidates

Frozen staging only. **1 image-generation call, 1 original PNG, 8 authored clothing objects, 0 automatic regenerations, 0 source pixel edits.** No main content, sprites registry, renderer, Core, game state, build, publication, or previous staging was changed.

Original: `originals/cloth-trouser-panels-four-facings-v1.png`, 1024×1536 RGBA, 1,633,359 bytes. SHA256: `da657fa5718552d5acaf93d9fcd2c40cf914c8b0f3e2624a0d8a3e19cd16b997`. The default tool output is retained and the staged file is byte-identical. Exact prompt/arguments and the two own worker reference sheets with hashes are preserved under `requests/`, `references/`, and `records/`. This is a new garment-only request, not a retry of the earlier blocked anatomical request.

`Item.ClothTrousers` does **not** currently exist in the inspected content (317 JSON files and the previous resolved equipment catalog were checked). Parent confirmed this is a proposed new clothing source. No actual item, pelvis/leg slot, coverage, armor, inventory icon, tailoring recipe, or complete garment was added or claimed.

## Direct source review

The original PNG and the transparent checkerboard/native comparison in `diagnostics/source-rgba-and-native.png` were directly opened. All eight objects read as continuous sewn woven cloth with complete upper overlap cuffs, knee folds, and finished lower hems. No skin, wearer, foot, waist, pelvis, crotch bridge, or attached opposite leg is painted into them. The two front panels show front knee fabric; the two back panels show a different looser fold construction. Fabric is somewhat stiff/padded in appearance; no dynamic cloth physics or full garment fit is proved.

The requested side rows were not followed consistently. Individual observed direction is retained without rotating, reflecting, masking, repairing, or repainting anything:

| Observed direction | Raw source objects |
| --- | --- |
| FRONT | row1col1, row1col2 |
| LEFT | row2col1, row3col2 |
| RIGHT | row2col2, row3col1 |
| BACK | row4col1, row4col2 |

These are four directions with two generic panel sources per direction. Anatomical left/right identity and inner/outer garment ownership are **not proved** by the generated seam placement. `observedAnatomicalOwner` is null; the original requested owner is recorded separately. The parent independently opened the same raw PNG and confirmed the side-direction remapping. Eight useful raw garment regions are available; this is not evidence of a complete eight-part body or worn trousers.

## Crops, anchors and alpha

`panel-sources.json` contains exact end-exclusive `[x,y,width,height]` crops, raw requested vs observed direction, crop/source RGBA landmarks, alpha loss/foreign-neighbor counts, and the individual source remapping. `upperOverlapCenter`, `kneeFoldCenter`, and `lowerHemCenter` are observed graphic centers with ±6/8 raw-pixel uncertainty. They are not measured hip/knee axes. Actual attachment, fitting, depth order, deformation and anatomical owner selection remain unimplemented.

Read-only Pillow/SciPy analysis found eight disconnected alpha16 principal objects, **zero principal pixels lost, zero foreign major pixels in crops, and zero alpha16 crop-border pixels**. Outside the selected crops are 4,133 alpha1 pixels with maximum alpha1; they remain in the original. No alpha cleanup was applied. Interior medians are alpha252–253 (no pixel reaches255), so “opaque cloth” describes its visual/material meaning, not an assertion that every source alpha byte equals255. More than99.99% of the eroded interiors are alpha240 or higher. The sheet exceeds the requested65% cell-height target, but complete silhouettes remain separated and unclipped; it was not rescaled to hide this deviation.

`review.html` draws the unchanged original through Canvas crop selection, with a larger RGBA inspection and display scale .035 at ×1/×2/×4. At native scale the panels remain distinct narrow brown cloth shapes; fine seam direction needs the enlarged view. This is a diagnostic scale, not a fitted HumanView contract. No cropped or resized source PNG was saved.

`records/capture-review.mjs` used only its own private staging server on6407. The actual read-only DOM reported eight parts, the mapping above, null anatomical owners, active=false and no page errors. Browser/server were closed in `finally`; `diagnostics/lifecycle.json` records SIGTERM. No game, build, broad test or publication was run.

The parent can now review the original and select/assign sources separately. All activation and release flags remain false; further calls are zero.
