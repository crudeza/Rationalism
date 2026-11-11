# 00_STATE — RESONANCE

Last updated: 2026-11-11 (carril vertical, escalera de estímulo, final de pista)
Version: w2-v8 (Canvas 2D gray-box)
Phase: P2 gray-box. Game Sheet APPROVED; schemas v1 FROZEN (no schema change in w2-v8).

## Owner changes in force
- D-14 (2026-11-08): road, left/right only, instant movement; cue y ignored.
- D-15 (2026-11-09): hollow only when 70% of a phrase's cues can no longer be hit; silences land on the next downbeat within one frame.
- D-16 (2026-11-09): silences are a flip special with a close-follow camera, then back to normal.
- D-17 (2026-11-11): the action uses the full height of the screen, on phone too. The lane is a central column; the sides are for parallax, cinematics and effects.
- D-18 (2026-11-11): stimulus ladder 0 to 4. 9 hits in a row go up one level; a miss goes down one; the first 6 s of a run are a grace period (misses do not drop level or end the run); a miss at level 0 fades to black and ends the run. Visual and audio follow the same level.
- D-19 (2026-11-11): end of track. In the last 4 s the ship speeds up, shrinks and fades into the horizon.
- D-20 (2026-11-10): cinematics are hybrid. Big camera or ship moments pause the cues and only run in silences or phrase boundaries, aligned to a downbeat. Atmosphere and parallax run in parallel and never move the camera in a dense (elite) window.
- P-01 amended (by D-18): total silence can happen only at level 0, as a consequence of the ladder. Misses do not cause silence otherwise.

## Delivered in w2-v8
- index.html (file index_outro_w2-v8.html; NOT yet in the repo, see Repo status):
  - Lane: central column, full height (top about 7% of H, ship line about 86% of H). Desktop lane 40% of W; portrait lane 72% of W.
  - Perspective: y is linear in time-to-arrival over the lane height (P), width shrinks toward the top with FAR 0.45. Equal time gaps give equal screen gaps.
  - Sides: parallax columns (drawSides), more with a higher level. Placeholder for the cinematic layer.
  - Ladder: updateLadder reads run.stats (perfect, good, miss); no change to core.js.
  - Audio: Audio3.setLevel with level gains (kL, kM, kH) in series with the D-15 hollow gains. Level 1 lows at 45%, level 2 lows, level 3 adds mids, level 4 adds highs, level 0 silence.
  - Fail: fade to black over FADE_S, then results.
  - Outro: last OUTRO_S seconds, ship eases to the horizon and fades; speed streaks ramp up.
- Fisheye pass (WebGL) tried in w2-v6 and removed at the owner's request. Not in w2-v8.

## Tested (Node with stubbed DOM, NOT in a browser)
- Syntax of the full inline script: OK.
- draw() runs without errors on normal frames and at outro instants.
- Ladder: 7 transition cases pass (9 hits up, miss down, streak reset, grace, level 0 fail).
- Geometry: lane top and ship line at the expected pixels; equal time gaps give 88.9 px screen gaps.
- NOT tested: browser rendering and visuals, phone and touch, the audio path with real audio (setLevel), the fade and results screens, core.js (RES is stubbed), the outro in a real run.

## Repo status
- 2026-11-11: writing to crudeza/Rationalism failed with 403 (Resource not accessible by integration). Reads work. Nothing committed since w2-v5.
- Pending commits: resonance/index.html (= index_outro_w2-v8.html), resonance/00_STATE.md (this file), resonance/03_DECISIONS.md.
- resonance/README.md and core/test_bot.js still old. .gitignore to confirm.

## Findings / to tune [TUNE]
- DMAX 1.6, FAR 0.45 (lane top narrowing).
- HITS_UP 9, GRACE_S 6, FADE_S 1.5, OUTRO_S 4.
- Start level 2.
- Cinematic sides are a placeholder (columns). Real cinematics follow D-20.
- Fisheye constants (k, ca) no longer used.

## Open
- Owner checks w2-v8 on desktop and phone (portrait and landscape): does the lane read well, does the ladder feel right, does the outro land.
- Cinematic layer (D-20): first three instances (camera sweep in a silence, ring wave in parallel during a drop, route tilt on a phrase boundary).
- Repo write access, or manual commit of the three files.
- Q-03 final 3 songs confirmed by owner in W1 (Cry Me A Reverb, Nueva Anormalidad, Ganimedes); 03_DECISIONS updated.
- Q-04 links and prize link: parked.
- Ship designs: the owner will bring them later (Blender, W3/W4).

## Next step
Owner plays w2-v8 on desktop and on a phone, and reports: lane, ladder, outro. Then the cinematic layer (D-20), then P5/P6 tracks.
