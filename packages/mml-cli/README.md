# mml CLI

Command line tools for creating, building, serving, and deploying a single MML game per project.

## Install

- Inside this monorepo: `npm run build` then `npm link` from `packages/mml-cli`, or use `npx mml` after workspace install.

## Commands

- `mml create <appname> [--dir .] [--force]` — scaffolds a starter game with physics + character controller in `src/main.mml` + `src/main.ts`.
- `mml build [--src src] [--assets assets] [--watch]` — builds the project with esbuild + mml-game-engine-build-plugin. Use `--bundle [--out dist]` to emit a single-file build via project-bundler.
- `mml editor [--port 3003] [--host localhost]` — watch + serve for local editing.
- `mml serve [--port 3004] [--host 0.0.0.0]` — watch + serve for devices on LAN.
- `mml deploy` — placeholder (no-op) for future deployment flow.

Defaults: editor port 3003, serve port 3004, src dir `./src`, assets dir `./assets`.
