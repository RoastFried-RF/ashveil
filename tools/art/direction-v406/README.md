# v406 food and ash originals

Two new original transparent bitmaps created with the built-in image_gen tool. Exact prompts and source SHA256/dimensions/alpha observations are retained beside this file. PNGs remain byte-identical to the generated outputs; frames are non-destructive UV rectangles in src/client/sprites.json. The two Def sprite references use the new keys directly.

- public/sprites/original/direction-v406/ashcake.png → Item.Ashcake, original shallow bowl with oat/ash cake.
- public/sprites/original/direction-v406/tower-ash.png → Item.TowerAsh, fine grey ash in a paper sachet; no moth fragments.

Both originals were viewed individually. Source alpha has low-alpha outlying noise; selected frames use the alpha>=8 object bounds plus12 source pixels of margin. No alpha threshold or other bitmap edit was applied. Asset validation, small-size readability and the actual Native cooking/consumption display are still pending. These are two static item icons, not creature/character animation or a full resource acceptance.
