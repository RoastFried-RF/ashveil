# v381 human component pilot — frozen staging handoff

This is an inactive source/ownership prototype, not a complete four-direction human replacement or release approval. No authoring, publisher, game state, build, CI, commit, or push was changed by this task. New artwork was produced only through image generation; no raster crop, repair, resample, mirror, or compositing PNG was saved as original art.

## Original and actual scope

- `originals/wanderer-components-four-facings-v1.png`: 1536×1024 RGBA, 1,984,261 bytes, SHA256 `f05cfe92abe4e81218d5f415310a008a0335379729ad5b6af2c641c45938e25e`.
- One successful request produced 32 separated raw regions. Head/Torso rows requested LEFT/RIGHT were actually RIGHT/LEFT and are explicitly remapped. Limbs are individually selected rather than blindly remapping entire rows.
- 28 regions remain useful candidates: four heads, four TorsoPelvis, eight upper arms, eight forearm+hand objects, and four shin+foot objects. All four requested bare-thigh originals failed: they contain shorts/waist/crotch/opposite-leg content.
- A separately parent-authorized corrective request returned HTTP400 `moderation_blocked`, zero PNGs, request ID `223657f6-e8c2-4edb-b480-c5cd7127e23a`. Its exact request/error are preserved. Total attempts **2**, completed original PNGs **1**, automatic regenerations **0**. There were no further image calls or rewritten retries.
- `derived-thigh-mask.proposal.json` selects an explicitly **clothed** portion of the failed shorts object at runtime. FRONT/BACK are limited private candidates because TorsoPelvis covers the upper cut. LEFT/RIGHT are held/null: the upper cloth/opposite-short portion visibly protrudes behind the pelvis. They are hidden in the final preview. These masks are not authored bare thighs or additional original regions.
- Nominal assembly uses 10 source instances: head, torso, two upper arms, two forearm+hands, two derived clothed thighs, two shin+feet. Independent anatomical masks allocate 15 owner draw passes. LEFT/RIGHT display only 8 source instances/13 visible passes when their held thighs are omitted. Hand/Foot-only loss removes a distal pass while retaining Forearm/Shin.

## Review and existing-model audit

`records/existing-human-audit.json` resolves the often quoted 13 v322 model banks to **8 human families/21 registrations and 5 nonhuman families**. Aliases do not create independent original art. `diagnostics/existing-eight-models.png` was directly viewed: four idle directions from each human family plus hand windows. This was not an all-256-motion visual review. Those whole-body sheets retain baked clothing, limbs, hands, and footwear; actual limb/apparel/prosthetic game state cannot independently change their painted body.

Both original input sheets and the new original PNG were directly opened. `source-parts.json` records exact source crops. At alpha16, all 32 principal components are separated, with zero principal pixels lost and zero foreign major pixels in those crops. 5,977 alpha1-only pixels lie outside the selected crop set; they were measured and preserved, not erased. Wider-than-requested objects are recorded honestly rather than inferred to overlap. The raw PNG itself has not changed.

Directly reviewed diagnostic screenshots: existing-eight-models, new-limb-source, failed-shorts-and-mask-proposal, prototype-initial neutral, prototype-r2 neutral/two-hand/distal-loss/clean, and final neutral. The final front/back derived legs remain a pose candidate, with visible joint seams; no full anatomy acceptance is claimed. The profile gap in the final screenshot is deliberate evidence of the held thigh source, not an anatomical wound.

## Reusable ownership/pose API

`model.mjs` is a pure module; `HumanPilotRig` requires the JSON in `assembly-contract.json`, `joint-registration.json`, `derived-thigh-mask.proposal.json`, and `body-ownership-reference.json`.

```js
const rig = new HumanPilotRig({assembly, joints, thighs, body})
const pose = rig.update({
  root: [worldDisplayX, worldDisplayY], // exact external root, never a smoothed duplicate
  facing: 'down', pose: 'neutral', dt: seconds, moving: false,
  surface: humanSurfaceStateResult, // optional authoritative read-only flesh ownership
  anatomicalMissing: [], prostheticAt: {}, // standalone fallback only
})
```

The model accepts the parent's `humanSurfaceState()` shape through `input.surface`; an absent/unknown surface owner does not borrow flesh. A replacement suppresses flesh separately from anatomical loss. The standalone fallback uses the copied actual Body.Humanoid parent table, not guessed `stumpParent` ancestry. The application adapter must convert actual interpolated map coordinates into the chosen display units; this pilot does not modify map interpolation or Core state.

`pose.parts[]` returns actual owner IDs, original source ID/crop, six-number affine **raw source → display-world** matrix, visibility, depth, source keep polygon or anatomical split half-plane, and held reason. `pose.anchors` exposes neck, shoulders, elbows, wrists, grip proxies, hips, knees, ankles, sole proxies, and foot world anchors. `pose.root` is precisely the supplied root. No source axes are presented as measured 3D axes.

`joint-registration.json` preserves raw/crop/normalized coordinates, point RGBA, observed vs inferred status and source-pixel uncertainty. Wrists/ankles are graphic narrow-band estimates, not painted mechanical pins. The elbow-side half-plane keeps Forearm/Shin; the distal half-plane selects Hand/Foot. Skull uses the head source; Chest/Abdomen share the upper TorsoPelvis source and cannot yet show isolated abdominal-only loss. Pelvis uses the waistband-side split. Independent fingers/toes, original opposite-side leg art, far-side arm surfaces, full directional grip rotation, and damaged stump/prosthetic art are open.

## Private DOM prototype and observations

`index.html` / `app.mjs` expose actual DOM facing, neutral/walk/two-hand grip, root movement, speed 0/.5/1/2, missing Hand/Foot/Pelvis, and a flesh-hiding unpainted replacement-root control. Canvas uses the original PNG with runtime transforms/masks only. Large ×10 and native 1×/2× displays share the same original. The rod and joint lines are diagnostic primitives, not authored equipment.

To serve locally: `python3 -m http.server 6405 --bind 127.0.0.1 --directory /workspace/.ashveil-planned/v381-human-body-parts`. Close the server afterward. The observation scripts already close their own browsers/servers in `finally`; no server is left running.

`window.humanPilotInspect()` returns a deep-copied read-only snapshot for all four directions; `window.humanPilotRenderPart(ctx, part)` draws a selected source instance with the same masks. Static final snapshots are in `diagnostics/final/*-api.json`. Equipment/prosthetic staging can consume these contracts without modifying this pilot or main content.

Finite observations and one geometry correction are preserved in `diagnostics/prototype-initial`, `prototype-r2`, and `final`. An intermediate app parse error and timeout are retained in `prototype-r2-load-failure`; it was corrected before successful r2 DOM observation. The first prototype's excessive crouch/arm length was adjusted using display assumptions only: torso/head .06, arm .052, hypothetical ground projection and bone lengths. This did not create new source poses.

- Actual missing LeftHand/RightFoot DOM controls hid those distal owners in all four views while retaining LeftForearm/RightShin; a two-hand rod was suppressed when a hand was absent.
- A replacement root hid only the corresponding flesh Hand; no prosthetic original or false biological palm was drawn.
- After DOM speed=0 and two animation frames, root/time/distance/matrix deltas were all zero. Moving-stop completed the active swing and retained ownership.
- r2 RIGHT two-hand requested-vs-clamped grip error was .0284 display px; BACK walking ankle reach error .3049 display px. These are retained 2D numerical diagnostics, not by themselves release blockers. Visible source semantics and cloth protrusion caused the profile-thigh hold.
- Sole proxy pin error is distinct from physical contact. Final metrics separately name source pin error and frame-to-frame stationary world-anchor drift; no algebraically exact pin is claimed to prove a real 3D sole plane or collision.

The reusable upper body, sockets, anatomical masks and finite pose API are handed off now. Further generation and broad tests are deliberately outside this completed subtask; actual HumanView/wardrobe/Body/Core integration remains the parent's work.
