달걀과깨진달걀의원래임시버섯표시만새원본으로교체한다. 음식/충격/재고/UID/가격/신선도/소비규칙은그대로이며실제표시와입력검증은별도다.

# ASHVEIL original Hearth egg icons

Created 2026-10-21. This isolated pack contains original item artwork for an intact Hearth egg and its cracked counterpart. The product repository, Defs, Core, UI, save data and Git were not modified.

## Design and ownership

Both icons were directly authored as new integer-coordinate shapes in `tools/art/draw-egg-items.py`, without image inputs, tracing, crops, recoloring or reuse of another food's geometry. The intact egg has a narrow rounded top and a broader curved belly with pale yellow-grey shell shading. The cracked icon shows two distinct jagged shell halves with shadowed cavities and a small irregular raw white/yolk spill. There is no plate, frying pan, cooked white ring, mushroom cap, gills, tablet imprint or cheese wedge. Viewpoint is front/slightly above, matching item-icon presentation.

Generic Canvas/PNG/SVG/nearest-sampling helper code comes from this workflow's own earlier CC0 original packs. The 15-color egg palette and all egg/shell/yolk coordinate geometry are newly authored. The generator uses only Python's standard library and a local read-only reference contract. No game code is imported or executed. SVG files use integer rectangles with no filters, fonts, scripts, external images or embedded raster data.

The original art, palette, coordinate source, tools and documents are dedicated to **CC0-1.0** in `LICENSE.txt`. Commercial use, edits, redistribution and derivative game/mod/asset packages are allowed without attribution or additional permission. The reference contract records existing project facts and hashes; it does not change the licenses of other ASHVEIL materials. Preserve this pack license as **`tools/art/egg-LICENSE.txt`** when integrating so the repository's main license remains intact. The independent checker accepts that path or the isolated pack's `LICENSE.txt`.

## Keys and measured geometry

| Target context | Proposed public key | Native stem | Opaque inclusive bounds | Opaque width×height | Native/small opaque pixels |
| --- | --- | --- | --- | --- | --- |
| `Item.Egg` | `original_hearth_egg` | `ashveil-hearth-egg` | [7,3,24,29] | 18×27 | 355 / 89 |
| `Item.CrackedEgg` | `original_cracked_hearth_egg` | `ashveil-cracked-hearth-egg` | [3,10,28,29] | 26×20 | 397 / 99 |

Each stem has a **32×32 PNG**, an exactly matching editable **32×32 SVG**, and a **16×16 `-16.png`** nearest-center review sample under `public/sprites/original/items/`. All outermost frame edges are transparent. Both bottom opaque edges are **30**, with optional art footpoint **[16,30]** / anchor **[0.5,0.9375]** if a caller needs ground alignment. This metadata is illustrative; the fragment does not add runtime anchor fields or change item-world rendering.

`tools/art/egg-manifest.fragment.json` contains only two new independent sheets and their full-frame entries. It adds no characters, animations, aliases, item patches or gameplay data. The fragment uses 32px PNGs; the 16px files are review/fallback artifacts. `ItemIcon.vue` currently fits a frame into its caller's square using `size / max(frame.w, frame.h)`, centers it and clips the frame. Thus these complete square frames can use the normal item-icon path without a special crop. The actual caller size, world scale and chosen bindings remain Root's integration work.

## Captured source context and semantic limits

`tools/art/egg-reference-contract.json` records the actual pre-integration `src/content/core/defs/eggs.json` values and SHA-256 plus the observed `ItemIcon.vue` source hash. Both raw items currently own `sprite: ash_cap`, occupy 1×1 and stack to 3. Their identical food content is 80kcal, protein6, vitamin1 and water45; intact freshness is 336hours/14days and cracked freshness is 6hours. The intact item points to `Item.CrackedEgg` with its current 0.3 drop chance. These are read-only context, not a runtime Def resolution, new registration, balance proposal or implementation in this pack.

The illustration depicts one representative object, not exact stack quantity. A small visible amount of raw contents does not assert lost calories, changed quantity or a special cooked item. Color does not encode freshness, food safety or poisoning. The art does not implement or verify drop/break rules, same-UID conversion, bedding/water protection, freshness progression, consumption, stack merging, save compatibility or economic production. Root owns those rules and their actual-input regression checks.

## Direct visual review and static verification

The author directly opened all **five actual PNGs**: both 32px native images, both 16px samples, and the **384×352** contact sheet. The whole egg reads as an asymmetric egg rather than a circular tablet or mushroom. The broken shell rims, two cavities and warm ochre yolk remain distinct in the 16px sample. The contact sheet shows whole on the left and cracked on the right, with native/small images on dark and light matte fields. Neither icons nor contact sheet render text, digits, logos or status symbols. No game screenshot or runtime screen is included.

The following lightweight standalone checks passed:

```sh
python3 tools/art/draw-egg-items.py --check
python3 tools/art/check-egg-items.py
```

The generator reproduced **10 deterministic output files** byte for byte without writing. The separate checker verified all five PNGs' CRCs, single terminal IEND, 8-bit RGBA, alpha0/255, palette membership, transparent margins and measured dimensions; both SVGs against every native pixel; exact nearest-center 16px sampling; distinct whole/cracked native and small images; whole top narrower than its belly; shell cavities and yolk confined to the cracked icon; and **every contact-sheet pixel**, including label-free background regions. It also verified nine referenced generated-file hashes plus generator/reference-contract hashes. Checker output is saved in `docs/art-egg-originals-verification.json`.

No game, GPU, browser, TypeScript, build, Core test, full regression or world simulation was executed here. The project game-development skill's actual-input/render/state checks remain for Root's integrated build. These static original-art checks do not claim those checks passed.

## Exact-copy handoff

The pack has **17 files**. `docs/art-egg-originals-integrity.json` records byte counts, SHA-256 and proposed Root destinations for all other 16 files; copy that inventory too. Copy every art/tool/document file unchanged, and relocate `LICENSE.txt` to `tools/art/egg-LICENSE.txt`. No existing Root asset or license needs deletion or replacement. Source paths inside the provenance refer to the isolated pack layout; the checker explicitly supports the relocated license. Root may add a separate integration note without changing original art bytes.

The handoff consists of six native/SVG/small state assets, contact, palette, provenance, manifest fragment, generator, independent checker, local reference contract, CC0 license, this document, verification result and integrity inventory. Adding the two sheets/frames and binding the two actual items is a future integration step, outside this isolated pack.
