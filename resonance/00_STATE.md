# 00_STATE — RESONANCE

Last updated: 2026-11-07 (end of W1 draft, Audio and cue maps)
Version: none built yet
Phase: P1 essentially complete (owner approved marks, first map and the 3-song selection). Analysis script, cue map builder and reachability validator done. Cue map for song 1 (Cry Me A Reverb) validates. Audio chunk/encode step still to do.
Game Sheet: APPROVED. Schemas cue map v1, save v1, part manifest FROZEN (no schema change made in W1).

## Next step
W2 (gray-box prototype) can start. Optional first: MP3 chunk/encode script.

## Q-03 and Q-07 CLOSED (2026-11-07)
Owner approved: songs Cry Me A Reverb, Nueva Anormalidad, Ganimedes; the start marks below; the first cue map; and confirmed rights. Entelequia is out. Ganimedes now uses the final master (Ganimedes_MASTER-16441.wav, 434.27 s, same 133 BPM and structure, map rebuilt).

## W1 measurements (analysis by script, not by ear)
| Song | Duration | BPM | Proposed startMark | musicStart | Silences / breakdowns inside the level |
|---|---|---|---|---|---|
| Cry Me A Reverb | 5:07.8 | 131.0 | 58.125 s (bar 31, about 1:00) | 50.797 s | 205.6 to 212.5 s |
| Nueva Anormalidad | 5:49.1 | 132.0 | 58.129 s (about 1:00) | 50.856 s | 200.0-203.6, 284.5-286.3, 288.1-290.4, 334.5-end (outro) |
| Ganimedes | 7:13.1 | 133.0 | 56.786 s (about 1:00) | 49.568 s | 173-194 (long breakdown, in pieces), 200.7-202.0, 429.4-end |

Cue counts per map (cumulative tiers easy / normal / elite): Cry 132 / 278 / 958; Nueva 147 / 333 / 971; Ganimedes 194 / 666 / 1569. Reachability validator passes on all three at every tier; a deliberately broken map fails as expected.

## Open points for later chats
- Elite tier has about 4 cues per second: probably too dense; thin it in W2 playtests.
- Beat grid sits a constant 10 to 20 ms from kick onsets (steady, no drift). Calibrate with the latency screen; GRID_BIAS in build_cuemap.py can absorb it.
- Cue positions are a seeded smooth path, not musical yet (no melody-following). Ribbon and chord cues are not generated yet.
- Phrases are fixed 4-bar blocks; refine to musical phrases later.
- Audio chunking and MP3 encode not done in W1 yet.

## Needed from the owner
- Buy / listen / follow links and the prize link (parked)

## Handoff rule
At the end of every chat, replace this file with the updated version and list what changed under "Changelog".

## Changelog
- 2026-11-07: Project kit created.
- 2026-11-07: W0 Design lock finished (Game Sheet APPROVED, schemas frozen).
- 2026-11-07: W1 draft: scripts analyze.py, build_cuemap.py, validate_cuemap.py; three cue maps; start marks proposed (Q-07 pending approval).
- 2026-11-07: Owner approved marks, first map, selection and rights; final Ganimedes master received and its map rebuilt.
