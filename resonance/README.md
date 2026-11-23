# RESONANCE (gray-box w5-v1)
Serve statically: `python3 -m http.server` then open http://localhost:8000/ (add ?bot=1 for autoplay).
Headless core/cinematics test: `node core/test_bot.js`. Progression/saves/builder test: `node core/test_progression.js`.
Grind-curve tuning gate: `node scripts/sim_progression.js` (fails if the average-skill profile needs more than a
handful of runs to reach Full Resonance on any song).
Validate maps: `python3 scripts/validate_cuemap.py cuemaps/<map>.json`.
Re-encode audio: `python3 scripts/encode_audio.py <masters_dir>` (masters are never committed).
