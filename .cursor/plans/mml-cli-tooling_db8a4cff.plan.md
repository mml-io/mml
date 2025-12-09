---
name: mml-cli-tooling
overview: Add a new mml CLI package with create/build/editor/serve/deploy commands wired to existing bundler/build systems and a starter template showing physics + character.
todos:
  - id: pkg-setup
    content: Create packages/mml-cli with bin and config
    status: completed
  - id: cli-commands
    content: Implement router for create/build/editor/serve/deploy
    status: completed
  - id: template-sample
    content: Add physics+character scaffold for create
    status: completed
  - id: build-integration
    content: Wire build to project-bundler/multi-game-builder
    status: completed
  - id: serve-editor
    content: Implement editor 3003 and serve 3004 defaults
    status: completed
  - id: deploy-stub
    content: Add placeholder deploy command output
    status: completed
  - id: docs-dx
    content: Write package usage docs/help flags
    status: completed
---

# Plan for mml CLI package

1) Package setup

- Add `packages/mml-cli` with bin `mml`; configure package.json, tsconfig, entrypoint, and link bin via workspace scripts.

2) CLI framework and command wiring

- Implement command router (e.g., yargs or lightweight custom) supporting `create`, `build`, `editor`, `serve`, `deploy` with help/flags; share logging and paths utilities.

3) Template for `mml create <appname>`

- Scaffold a new project folder with minimal physics + character example (new sample) including `index.mml`, config, package scripts; ensure ready-to-run with existing engine deps; add asset copies if needed.

4) Build command integration

- `mml build` should call existing builders in `packages/project-bundler` / `packages/multi-game-builder` with similar options; expose flags for input/output and mode; surface errors clearly.

5) Editor and serve commands

- `mml editor` default host/port 3003; `mml serve` default 3004; allow overrides; reuse current serve/edit flows if available (or lightweight static/dev server) consistent with example-builder.

6) Deploy stub

- Implement `mml deploy` as no-op with clear message placeholder for future infra.

7) Docs and DX polish

- Add README/usage docs in the package and root script entry (npx mml ...), examples in help text; basic tests/smoke where feasible.