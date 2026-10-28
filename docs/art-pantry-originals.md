정착지 장부용 직접 제작 원본3종을 실제공동식량0/생존인구하루분미만/이상에 연결한다. 수량·건강·수확을 보증하는 그림이 아니며 정확한 수치/문구를 함께 표시한다. 실제게임화면검사는별도로진행한다.

# ASHVEIL original pantry status icons

Created 2026-10-21. This isolated art pack supplies three qualitative UI pictures for a future settlement supply ledger. It does not choose an economic state or change ASHVEIL product files.

## Original design and rights

The basket, handle, wicker weave and wrapped contents were newly drawn as integer-coordinate geometry in `tools/art/draw-pantry-icons.py`. The same ash-worn wood/straw basket appears in every state. Ample cloth parcels fill its opening; a single small parcel leaves most of the opening dark; the empty state leaves the opening clear. No letters, numbers, logos or status glyphs occur in the icons or contact sheet. The neutral ash, linen and weathered wood palette fits the existing original art.

No external image input, crop, trace, extracted pixel, recoloring or existing item geometry was used. Generic Canvas/PNG/SVG/nearest-sampling helper code and the 19-color palette were reused from this workflow's own earlier CC0 bow pack; pantry geometry is new. Some palette entries are reserved and unused by this drawing. The generator uses only the Python standard library and its local art contract. The independent checker does not import the generator or game.

The new art, coordinate source, tools and documentation are dedicated to **CC0-1.0** in `LICENSE.txt`; commercial use, modification, redistribution and derivative asset packages are permitted without attribution. Other ASHVEIL assets and game code retain their existing licenses. When copying into the game repository, preserve this pack's license as `tools/art/pantry-LICENSE.txt`; the checker accepts that location so the repository's main license need not be replaced.

## Public keys and dimensions

| Public sprite key | Native PNG/SVG stem | Native / small | Opaque pixels native / small |
| --- | --- | --- | --- |
| `original_pantry_full` | `ashveil-pantry-full` | 32×32 / 16×16 | 506 / 126 |
| `original_pantry_low` | `ashveil-pantry-low` | 32×32 / 16×16 | 482 / 119 |
| `original_pantry_empty` | `ashveil-pantry-empty` | 32×32 / 16×16 | 482 / 119 |

Files are under `public/sprites/original/ui/`. The fragment `tools/art/pantry-manifest.fragment.json` adds only three new sheets and three complete 32px frames. It contains no characters, animation, item patch, terrain patch, aliases or runtime anchor fields. The small PNGs are review/fallback artifacts; the fragment references native 32px images. Render without smoothing when displaying integer scale.

All three images have the same inclusive opaque bounds **[3,4,28,29]**, transparent outer margins and ground bottom edge **30**. The shared art footpoint is **[16,30]**, equivalent to optional anchor **[0.5,0.9375]**. UI code may use that metadata when an explicit foot alignment is useful; no renderer/physics behavior is implemented here. The three entire bottom 12 rows are byte-identical. Every pixel outside the contents window **[4,8,28,20)** is identical across states (736 pixels). The state change therefore preserves the container profile, handle and base rather than making the icon jump.

Bright linen pixels inside the content region measure 51 → 7 → 0. These counts only verify that authored pictures visually differ. They are not supply thresholds. The two large visible parcels and one small parcel do not encode exact inventory units, calories, production, prices, quality, freshness, safety, capacity or forecasts. Root/calling UI must select the state from the actual economy rules and provide suitable accessible text.

## Review and checks

The author directly opened the **seven actual PNGs**: three native images, all three 16px samples and the 576×352 contact sheet. Full, low and empty remain distinguishable at 16px through the extent of pale cloth inside the same dark basket opening. No geometry clips the frame. The contact sheet uses three columns in **full / low / empty** order, shows native and small samples on dark and light fields, and uses no labels or rendered text. It is a review image, not a game screenshot.

Commands run from this isolated pack:

```sh
python3 tools/art/draw-pantry-icons.py --check
python3 tools/art/check-pantry-icons.py
```

Both passed. The first reproduced **13 deterministic output files** byte for byte without writing. The separate checker verified all seven PNGs' CRC, terminal IEND and 8-bit RGBA data, alpha limited to 0/255, palette bounds, transparent margins, all three SVGs against every native pixel, nearest-center 16px sampling, distinct native/small pictures, matching basket/base/anchor geometry, and the **whole** contact image including empty background areas. It also verified all 12 referenced output hashes plus generator and contract hashes. `docs/art-pantry-originals-verification.json` records its result. `docs/art-pantry-originals-integrity.json` inventories every handoff file except itself.

The SVGs use bounded integer rectangles and carry editable source geometry without filters, fonts, scripts, external references or embedded images. The Python drawing source is the practical editable coordinate master; regenerating replaces the derived SVG/PNG outputs. Source/palette/provenance and SHA-256 records are also in `ashveil-pantry-source.json`.

## Handoff boundary

Only `/workspace/ashveil-pantry-art` was changed. No product sprites manifest, Def, Core, economic rule, UI caller, save state or Git operation was modified. No game, browser, GPU, TypeScript, build or project test was executed. This is a completed original-art handoff with static pixel checks; actual ledger integration and in-game appearance remain for Root to implement and verify.

The pack contains 20 files: nine native/SVG/small state assets, contact, palette, provenance, manifest fragment, generator, independent checker, local art contract, CC0 license, this document, verification result and integrity inventory.
