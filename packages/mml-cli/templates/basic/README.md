# MML starter

Commands:
- `mml dev` to watch/build and serve at http://0.0.0.0:3004 (LAN-friendly)
- `mml build` for a one-shot build, or `mml build --bundle` for a single-file dist in `dist/`

Project layout:
- `src/main.mml` — starter scene with physics + character controller
- `src/main.ts` — helper script for spawning crates and controller events
- `src/scripts.json` — loads math + physics systems
- `assets/` — shared models/textures served at `/assets`
