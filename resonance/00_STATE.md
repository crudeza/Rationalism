# 00_STATE — RESONANCE

Last updated: 2026-11-09 (musical cue layer + flip specials)
Version: w2-v5 (Canvas 2D gray-box)
Phase: P2 built; owner playtested v1/v2. Game Sheet APPROVED; schemas v1 FROZEN (no schema change in v5).

## Owner changes in force
- D-14 (2026-11-08): road, left/right only, instant movement; cue y ignored.
- D-15 (2026-11-09): hollow only when 70% of a phrase's cues can no longer be hit; silences land on the next downbeat within one frame.
- D-16 (2026-11-09): silences are a flip special with a close-follow camera, then back to normal. Replaces the leave-the-road flight and the stardust.

## Delivered in w2-v5
- core.js: each silence (merged when the landing would overlap the next) is a flip sequence. Flips are pitch loop, then barrel roll, alternating, one per about 4 beats, never touching the last 0.35 s. Camera pushes in over 0.45 s and pulls back by the landing. Core exposes run.cam, run.pitch, run.roll, run.lift and a flip event. Landing logic unchanged. Final silence = outro with up to 8 s of flips, camera stays close.
- index.html: close-follow camera (lower horizon, nearer and larger ship, speed streaks, slight bank on rolls), small 3D low-poly ship, ring burst on each flip and on landing. Stardust removed (Energy is now heard% only).
- scripts/relayout_cues.py (P-10, PROPOSED): rings follow one smooth path with an anchor per bar, 4-bar motifs (sweep, answer, zigzag, resolve), lane width follows phrase density, small beat bounce. Only ring x changes. All 3 cue maps regenerated.

## Tested (headless)
- 3 maps x 3 tiers: perfect bot hears 100%; noisy bot at 30-144 fps: landing error at most 22 ms (under one frame at 30 fps), no NaN, flips counted (6-8 per song).
- Reachability: worst speed in the new maps 0.56 u/s (limit used 0.6, old random walk allowed 0.96); validate_cuemap.py PASS on all 3.
- Chromium desktop 1280x720 and portrait 430x932: no console errors; screenshots of camera push-in, pitch loop, barrel roll and return look right. Audio-missing path runs silent.
- NOT tested: real audio by ear (the layout was not checked against the sound), real phone/touch, whether the new path feels musical to a human, flip timing against the music in a real run.

## Findings / to tune
- Path is structural (phrases and density), not melodic. A later step could blend in spectral centroid per bar from the WAV (needs the masters in the chat).
- Constants [TUNE]: dmax 0.5 per bar and BOUNCE 0.02 in relayout_cues.py; FLIP_BEATS 4, CAM_EDGE 0.45, FLIP_LEAD 0.3, FLIP_TAIL 0.35, OUTRO_MAX 8 in core.js.
- Ship can sit at the road edge during a flip in portrait (it follows the finger).
- Perspective still squeezes most of the 2 s lookahead near the horizon (not touched).
- Serve with a trailing slash (/resonance/). Version tag in the corner.

## Open
- Repo choice (new RESONANCE repo vs Rationalism/resonance); note the repo currently holds the game under resonance/resonance/. Links and prize link parked.
- Q-03 final 3 songs confirmed by owner in W1 (Cry Me A Reverb, Nueva Anormalidad, Ganimedes); update 03_DECISIONS when convenient.

## Next step
Owner plays w2-v5 and says: does the path feel like the music, are flips well timed and fun? Then: perspective fix, then P5/P6 tracks.
