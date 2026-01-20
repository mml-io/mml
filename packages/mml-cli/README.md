# mml CLI

Command line tools for creating, building, serving, and deploying a single MML game per project.

## Install (local dev)

Run the CLI globally from this repo and have it rebuild automatically while you edit it:

1) From the repo root run `npm install` to get workspace deps.
2) In `packages/mml-cli`, or in root, start a watch build: `npm run iterate`. This keeps `build/index.js` fresh on every edit so the `mml` binary picks up changes instantly.
3) In another terminal, still in `packages/mml-cli`, run `npm link` to expose the `mml` command globally. (If you see a syntax error when running `mml`, re-run the watch build to refresh `build/index.js`.)
4) Use `mml --help` (or any command) anywhere on your machine. For a specific project you can also run `npm link @mml-io/mml-cli` inside that project to consume the local build.

For a one-off build without watching, run `npm run build` in `packages/mml-cli` then `npm link`.

## Commands

- `mml create <appname> [--dir .] [--force]` — scaffolds a starter game with physics + character controller in `src/main.mml` + `src/main.ts`.
- `mml build [--src src] [--assets assets] [--watch]` — builds the project with esbuild + mml-game-engine-build-plugin. Use `--bundle [--out dist]` to emit a single-file build via project-bundler.
- `mml dev [--port 3004] [--host 0.0.0.0]` — watch + serve for devices on LAN or locally. Also starts an MCP server at `/mcp/sse`.
- `mml deploy` — placeholder (no-op) for future deployment flow.
- `mml debug <subcommand>` — debug commands for inspecting the dev server:
  - `start [--headless]` — start a Puppeteer browser to capture client logs.
  - `stop` — stop the debug client.
  - `status` — show server status (connected users, uptime, log buffer).
  - `logs [--level] [--source] [--grep] [-f]` — view server/client logs.
  - `dom` — dump the full DOM as HTML.
  - `elements [--type]` — list all MML elements in the document.
  - `inspect <selector>` — inspect a DOM element by CSS selector.
  - `exec <code>` — execute JS in the server context.
  - `client-exec <code>` — execute JS in the browser context.
  - `click <selector>` — simulate a click event.
  - `screenshot [--output] [--width] [--height]` — take a screenshot.
- `mml docs [--element] [--output] [--format]` — generate MML element documentation (markdown, json, or xsd).
- `mml examples [--element] [--category] [--output]` — show MML usage examples.
- `mml describe-model <file> [--resolution] [--count]` — take screenshots of a GLB model and return bounds/extent as JSON.

Defaults: editor port 3003, serve port 3004, src dir `./src`, assets dir `./assets`.

## MCP Server (for AI Assistants)

When running `mml dev`, an MCP server is exposed at `http://localhost:3004/mcp/sse` (SSE transport). AI assistants can connect to inspect and control the running game.

### Registering with Cursor

Add to your Cursor MCP config (`.cursor/mcp.json` in your project or global settings):

```json
{
  "mcpServers": {
    "mml-dev": {
      "url": "http://localhost:3004/mcp/sse"
    }
  }
}
```

### Available MCP Tools

- `get_status` — server status (users, uptime, logs).
- `get_users` — list connected users.
- `get_logs` — get server/client logs with filtering.
- `get_dom` — get full DOM as HTML.
- `list_elements` — list MML elements.
- `take_screenshot` — screenshot the game.
- `execute_client_code` — run JS in the browser.
- `refresh_browser` — reload the page.
- `describe_model` — screenshot a GLB model and return bounds.
