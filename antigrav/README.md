# ANTIGRAV · Rationalism Records

Antigravity racer in Three.js. Soundtrack: Martin Bellomo and the Rationalism family.
Static, self-contained folder: no build step, no backend. Everything lives inside `antigrav/`, so it can sit next to other sites in the same repo.

- `antigrav/` (URL `/antigrav/`): full game for desktop and tablets. Phones are redirected to `mobile/` automatically; add `?full` to force the full version on a phone.
- `antigrav/mobile/` (URL `/antigrav/mobile/`): lean mobile version (simple materials, guarded audio, loading log, red error banner).
- `config.js`: buy / listen / follow links. Edit and redeploy.
- `audio/`: 24 MP3 chunks at 192 kbps (4 per track: start, middle, final part, 2:30 preview).
- `vendor/`: three.js r128 and fonts, self-hosted. The only external requests are the links the player clicks.
- `vercel-headers.example.json`: optional cache headers (see below).

All paths are relative, so the folder works under any name or location.

## Put it on GitHub and Vercel (repo with other sites)
1. Copy the whole `antigrav` folder into the root of your repo (same level as your other site folders) and commit. Via the GitHub web UI: Add file > Upload files > drag the folder (44 files, largest 2 MB).
2. Vercel, option A (one project for the whole repo): the game is served at `https://<your-domain>/antigrav/` after the next deploy. Nothing else to configure.
3. Vercel, option B (separate project for the game): New Project > import the repo > set **Root Directory** to `antigrav`, Framework Preset **Other**, empty Build Command and Output Directory. The game is then served at the project root (`/` and `/mobile/`).
4. Optional caching: Vercel only reads a `vercel.json` at the repo root. Merge the `headers` array from `vercel-headers.example.json` into your root `vercel.json` (option A) or copy the file to `antigrav/vercel.json` as `{"headers": [...]}` with the `/antigrav` prefix removed from the sources (option B). The game works without it.

The folder name is lowercase on purpose: URLs on Vercel are case-sensitive (`/antigrav/`, not `/ANTIGRAV/`).

## Local preview
From the folder that contains `antigrav/`: `python3 -m http.server 8000` and open http://localhost:8000/antigrav/ (audio uses `fetch`, so opening the HTML as a file will not play music).

## Changing things
- Links: `config.js`.
- Audio: `python3 scripts/encode_audio.py /path/to/wav-masters 192k` (needs ffmpeg). If track durations change, paste the printed JSON into `const TRACKS=` in `index.html` and `mobile/index.html`.
- WAV masters are not in the repo (`.gitignore`).

## Notes
- Music starts after the first tap or click (browser autoplay rule). Race music: lap 1 from 0:00, lap 2 from the middle, lap 3 from the final part. Menu previews start at 2:30.
- The menu shows the version (`WEB v8` / `MOBILE v8`). On a phone any JS error appears in a red banner; send its text if something fails.
