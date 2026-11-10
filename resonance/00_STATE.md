# 00_STATE — RESONANCE

Last updated: 2026-11-09 (W2 + W2b: miss rule and silence flights)
Version: w2-v4 (Canvas 2D gray-box)
Phase: P2 built, owner playtested v1/v2. Game Sheet APPROVED; schemas v1 FROZEN.

## Owner change 2026-11-08 (supersedes the free up/down movement, P-03/D-02)
- The ship runs on a road; the song's cues lie on the road.
- LEFT/RIGHT ONLY. Movement is INSTANT (no inertia).
- Cue map y is ignored; schema v1 unchanged.
- Core: ship.x = target.x; rings judged on |dx| only; span 0.2 [TUNE].
- To record in 01_GAME_SHEET / 03_DECISIONS as D-14 once the owner confirms.

## W2b delivered (w2-v4)
- Miss rule (owner chose the 70% ratio): a phrase goes hollow only when it is impossible to still hit 70% of its cues (HEAR_RATIO in core.js [TUNE]).
- Silence flights: each silence (merged when the landing would overlap the next one) is a flight: the ship leaves the road, arcs and rolls toward wherever the player points, and lands on the next downbeat (bar line). Landing is clock-driven: first frame at or after the downbeat (error under one frame at 30-144 fps in the bot test; 0.4 ms in browser). Last silence of a track is an outro glide (no landing).
- Stardust: one mote per beat in each flight; collecting adds bonus Energy.
- Cues inside a flight window are removed from the run.

## Tested
- Headless bot: perfect bot hears 100% of phrases on 3 maps x 3 tiers.
- Chromium desktop/portrait/landscape: no console errors, road renders.
- NOT tested: real audio by ear, real phone/touch, silence flights (P3).

## Findings / to tune
- With the 70% rule a bot that misses at random hears about half the elite phrases: real players miss in clusters, so needs human playtest.
- Cue x positions are a random walk; with instant steering, elite jumps are likely too wide/fast for a human.
- Perspective squeezes most of the 2 s lookahead near the horizon.
- Serve with a trailing slash (/resonance/). Version tag shown in the corner.

## Open
- Repo choice (new RESONANCE repo vs Rationalism/resonance); links and prize link parked.

## Next step
Owner plays w2-v4. Then: musical cue layout (path follows the music, cap jump size/density), perspective, record D-14, then P5/P6 tracks.
