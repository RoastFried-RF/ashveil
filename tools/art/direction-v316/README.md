# Detailed people, revision316

Original SVG geometry is authored in `draw-people.mjs`, with no image input or traced shapes. Run `node tools/art/direction-v316/draw-people.mjs --install` from the repository root using installed Inkscape. This writes38 PNG sheets,912 frames and21 character registrations (19 designs and2 aliases), retaining previous frames. The contact sheet is a review aid, not an in-game asset. Sources and output are CC0-1.0.

Walk/idle frames48×64 at renderScale.5 preserve the previous24×32 world footprint. Four directions have6 walk,2 idle and4 attack frames. Feet anchors are62/64 and78/80. Actual held equipment is rendered separately from the visible actor's real main/off slots; body artwork contains no assumed weapons. Nonhuman actor sheets are unchanged. See `docs/movement-people-v316.md` for inspection scope and deferred checks.
