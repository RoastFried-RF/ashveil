# v389 empty worn-accessory source —32 objects

This is **new empty garment/accessory art**, separate from the prior v381 body/thigh correction and its rejection. Main/publisher/previous staging are read-only. Exactly **1 new image_gen attempt,1 returned PNG,0 rejections,0 automatic/manual retries**. The prior rejected request/error hashes remain unchanged in `records/prior-rejections-unchanged.json`; no rejected anatomical request was rewritten or retried.

## Raw original and references

- Raw tool output: `/workspace/generated_images/exec-0797402a-f0bc-4530-941f-b61b9656f35e.png`
- Byte-identical preserved original: `originals/worn-accessories-four-facings-v1.png` — **1774×887 RGBA, 1,376,962bytes**.
- SHA256 `cd434a2070913380747181e7d871f067bdffa8459c079757e0ed856d0f653c3d`.
- Exact parent request `request.txt`; exact generation args `generation-args.json`; exact prompt `prompt.txt`.
- Directly viewed own v381 base original, actual `sprites.json` av320 equipment icon sheet, and av341 optical-goggle original. Their exact paths/SHA and source decision are in `records/references-and-budget.json`.
- No image was fed to generation: own shape/palette/framing were studied, while avoiding wearer/skin/limb contamination from the base sheet. External game pixels0.
- **No raster editing, crop export, PNG reencoding, resampling, alpha removal, diagnostic raster generation or external pixels.** All image measurements were read-only; the only new raster is the original tool PNG copied without byte changes.

## Source review and quick installation metadata

The complete new PNG and generated original preview were directly viewed. There are32 separated empty apparel objects,4 rows FRONT/LEFT/RIGHT/BACK by8 columns: leather apron, oilcloth cloak(no hood), scrap helmet, ash mask, brass protective goggles, leather quiver, waist belt, layered dark cuirass. No wearer/skin/body/limbs/gore or independent weapons are visible. Quiver contains a few short arrow-end hints; their exact count is not a new gameplay ammunition count.

`source-regions.json` contains exact original crop rectangles, source/crop/normalized graphic mounting points, each point RGBA and direction uncertainty. `sprites.fragment.json` is a **parent installation proposal**, with suggested public path only; this task did not create/edit public or register sprites. Graphic points are visible painted garment locations with about±4px manual uncertainty, not physical sockets, bones, anatomical ownership or proven body-fit coordinates. All anatomical owner fields are null and all graphic points have alpha≥16.

**Do not zip the new rows blindly to v381 source rows:** v381 Head/Torso raw row2 was actuallyRIGHT and row3LEFT. New garments visibly use row2LEFT and row3RIGHT; use reviewed facing.

| Object/requested row | Exact original crop x,y,w,h | Observed graphic facing | Primary graphic source point |
|---|---|---|---|
| `leather_apron.front` | `[32, 16, 166, 203]` | front | `[115, 76]` |
| `oilcloth_cloak.front` | `[257, 39, 170, 178]` | front | `[341, 77]` |
| `scrap_helmet.front` | `[483, 46, 168, 154]` | front | `[567, 143]` |
| `ash_mask.front` | `[694, 91, 180, 100]` | front | `[789, 145]` |
| `protective_goggles.front` | `[909, 91, 200, 89]` | front | `[1009, 139]` |
| `leather_quiver.front` | `[1159, 16, 111, 203]` | 미확정 | `[1220, 78]` |
| `leather_belt.front` | `[1351, 89, 184, 90]` | front | `[1445, 155]` |
| `chitin_cuirass.front` | `[1590, 36, 149, 179]` | front | `[1665, 76]` |
| `leather_apron.left` | `[67, 234, 113, 202]` | left | `[107, 283]` |
| `oilcloth_cloak.left` | `[280, 247, 131, 189]` | left | `[314, 284]` |
| `scrap_helmet.left` | `[470, 258, 177, 158]` | left | `[486, 345]` |
| `ash_mask.left` | `[694, 302, 185, 103]` | left | `[735, 357]` |
| `protective_goggles.left` | `[920, 305, 181, 88]` | left | `[951, 348]` |
| `leather_quiver.left` | `[1169, 230, 92, 206]` | 미확정 | `[1216, 289]` |
| `leather_belt.left` | `[1356, 305, 170, 80]` | left | `[1373, 351]` |
| `chitin_cuirass.left` | `[1601, 240, 118, 193]` | left | `[1643, 267]` |
| `leather_apron.right` | `[55, 453, 112, 201]` | right | `[115, 502]` |
| `oilcloth_cloak.right` | `[272, 467, 135, 185]` | right | `[380, 506]` |
| `scrap_helmet.right` | `[478, 478, 168, 155]` | right | `[628, 567]` |
| `ash_mask.right` | `[689, 523, 183, 100]` | right | `[833, 572]` |
| `protective_goggles.right` | `[914, 526, 181, 87]` | right | `[1061, 568]` |
| `leather_quiver.right` | `[1164, 447, 109, 206]` | 미확정 | `[1205, 503]` |
| `leather_belt.right` | `[1352, 520, 175, 78]` | right | `[1507, 564]` |
| `chitin_cuirass.right` | `[1605, 460, 120, 190]` | right | `[1684, 485]` |
| `leather_apron.back` | `[36, 667, 163, 198]` | back | `[115, 718]` |
| `oilcloth_cloak.back` | `[244, 677, 195, 188]` | back | `[341, 693]` |
| `scrap_helmet.back` | `[486, 692, 148, 147]` | back | `[560, 823]` |
| `ash_mask.back` | `[690, 728, 186, 108]` | 미확정 | `[788, 779]` |
| `protective_goggles.back` | `[913, 733, 196, 80]` | back | `[1007, 782]` |
| `leather_quiver.back` | `[1165, 665, 107, 204]` | 미확정 | `[1219, 725]` |
| `leather_belt.back` | `[1352, 734, 176, 80]` | back | `[1440, 787]` |
| `chitin_cuirass.back` | `[1590, 676, 146, 187]` | back | `[1662, 698]` |

Primary meanings are in `mounting-notes.json`: apron upper bib/waist, cloak clasp or rear collar stitch, helmet rim, mask panel, goggles bridge/profile lens/rear buckle, quiver upper collar, belt buckle/rear leather, cuirass upper/lower plate. No source anatomy owner is invented. Body fitting/masks/scales must come from the parent's actual runtime/Defs.

## Direction/opacity cautions that remain

- All32 objects were individually reviewed;27 have a readable graphic facing. **All4 quiver worn yaws remain unproved** despite visible seam/strap differences; `observedDirection:null` is preserved. Parent may share source regions using actual body occlusion with explicit provenance rather than claim newly proved yaw.
- BACK mask has a plausible reversed/inner panel but front/back fabric semantics are not unique; observedDirection remains null. Its painted panel must not show through an actual head.
- Goggles BACK clearly has a strap/buckle crossing **still-painted lens cups**. Visible upper lens samples `[965,755]`, `[1059,755]`; cup geometric center estimates `[965,774]`, `[1059,774]` are under the strap and **are not observed lens-surface points**. Conservative strap band rect proposal `[918,770,187,20]`, buckle rect `[987,764,43,34]` are runtime clip suggestions, not exported images or a proven exclusive leather segmentation. Actual rear accessory belongs behind the parent's actual opaque head.
- Dark segmented/laced cuirass front/profile/back graphics are distinct, but surface is metal-like; **biological chitin material is not independently proved**. Keep this source caveat.
- No exact body fit, limb-loss ownership, attachment deformation, wearer direction continuity, clipping under animation or Native rendering was observed here. Empty garment framing is not anatomical ownership evidence.

## Numeric alpha/crop isolation and real prompt misses

At alpha16, there are **32 principal components≥100px**. Each exact crop is alpha≥8 per-cell bbox+4px. Owned principal pixels lost0; foreign principal pixels inside any crop0; alpha≥8 pixels outside all crops0. Minimum gap between alpha16 object bboxes is19px. Canvas edge nonzero0. All major art is isolated and uncut.

**4,470 nonzero alpha1–7 pixels remain outside the crop union**. They are preserved, not erased. Strict all-empty-pixels-alpha0 was not satisfied. The request's small object target50% cell width/65% height was also missed: all32 exceed at least one requested fraction, although the actual objects are isolated. Do not treat crop isolation as proof every prompt condition succeeded. Full alpha1/8/16/32/128/248/255 boundaries, cell fractions and hashes are in `records/source-alpha-analysis.json`.

`sourceCandidatesReadyForParentFit:true` while `strictPromptContractPassed:false`, `actualWornFourDirectionFitAccepted:false`, `activationReady:false`, `releaseAccepted:false`. Parent owns installation, actual equipment/body occlusion, fitting, state ownership and final runtime acceptance.32 regions are not32 animation frames or a finished4direction worn wardrobe.

All writes are within this new staging. Main authoring/publisher/existing staging/registration/browser/game/build/tests/commit/push0. `manifest.sha256` excludes itself.
