# 00_STATE — RESONANCE

Last updated: 2026-11-08 (W2 gray-box, road mode)
Version: w2-v3 (Canvas 2D gray-box)
Phase: P2 built, owner playtested v1/v2. Game Sheet APPROVED; schemas v1 FROZEN.

## Owner change 2026-11-08 (supersedes the free up/down movement, P-03/D-02)
- The ship runs on a road; the song's cues lie on the road.
- LEFT/RIGHT ONLY. Movement is INSTANT (no inertia).
- Cue map y is ignored; schema v1 unchanged.
- Core: ship.x = target.x; rings judged on |dx| only; span 0.2 [TUNE].
- To record in 01_GAME_SHEET / 03_DECISIONS as D-14 once the owner confirms.

## Tested
- Headless bot: perfect bot hears 100% of phrases on 3 maps x 3 tiers.
- Chromium desktop/portrait/landscape: no console errors, road renders.
- NOT tested: real audio by ear, real phone/touch, silence flights (P3).

## Findings / to tune
- Any miss hollows a whole 4-bar phrase: far too harsh at elite density.
- Cue x positions are a random walk; with instant steering, elite jumps are likely too wide/fast for a human.
- Perspective squeezes most of the 2 s lookahead near the horizon.
- Serve with a trailing slash (/resonance/). Version tag shown in the corner.

## Open
- Repo choice (new RESONANCE repo vs Rationalism/resonance); links and prize link parked.

## Next step
Owner plays w2-v3; then decide the miss rule and cue layout, then W2b silence flights.
