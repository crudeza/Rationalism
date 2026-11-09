# RESONANCE (gray-box w2-v1)
Serve statically: `python3 -m http.server` then open http://localhost:8000/ (add ?bot=1 for autoplay).
Headless test: `node core/test_bot.js`. Validate maps: `python3 scripts/validate_cuemap.py cuemaps/<map>.json`.
Re-encode audio: `python3 scripts/encode_audio.py <masters_dir>` (masters are never committed).
