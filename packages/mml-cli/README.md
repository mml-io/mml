# MML CLI
#### `@mml-io/mml-cli`

[![npm version](https://img.shields.io/npm/v/@mml-io/mml-cli.svg?style=flat)](https://www.npmjs.com/package/@mml-io/mml-cli)

A command-line tool for developing and validating MML documents.

## Quick Start

```bash
npx @mml-io/mml-cli serve my-document.html
```

## Commands

### `mml serve <file>`

Serve a single MML document with a WebSocket endpoint and live-reloading.

```bash
npx @mml-io/mml-cli serve my-document.html
```

The document is served on a WebSocket at `ws://127.0.0.1:7079/ws`. A web client is served at `http://127.0.0.1:7079/` by default.

| Option | Description | Default |
|---|---|---|
| `-p, --port <number>` | Port to serve on | `7079` |
| `--host <address>` | Host to listen on | `127.0.0.1` |
| `--no-watch` | Disable watching the file for changes | |
| `--no-client` | Disable serving the web client | |
| `--assets <path>` | Serve a directory as static assets | |
| `--assets-url-path <path>` | URL path to serve assets on | `/assets/` |

### `mml serve-dir <dir>`

Serve all top-level HTML files in a directory. An index page listing all documents is served at `/`. Each document gets its own WebSocket endpoint and client page.

```bash
npx @mml-io/mml-cli serve-dir ./my-documents/
```

Only HTML files directly inside the given directory are served (subdirectories are not scanned). Documents are lazily loaded on first WebSocket connection and stopped after an idle timeout with no connections.

| Option | Description | Default |
|---|---|---|
| `-p, --port <number>` | Port to serve on | `7079` |
| `--host <address>` | Host to listen on | `127.0.0.1` |
| `--no-client` | Disable serving the web client | |
| `--assets <path>` | Serve a directory as static assets | |
| `--assets-url-path <path>` | URL path to serve assets on | `/assets/` |
| `--idle-timeout <seconds>` | Stop document after N seconds with no connections (0 to disable) | `60` |

The following flags are intended for testing and CI use:

| Option | Description | Default |
|---|---|---|
| `--reset` | Enable `/:documentPath/reset` endpoint to reload documents | `false` |
| `--define-globals` | Pass `defineGlobals=true` to the web client | `false` |
| `--delay` | Enable `?delay=<ms>` query parameter to delay responses | `false` |

### `mml validate <files...>`

Validate MML documents against the MML schema.

```bash
npx @mml-io/mml-cli validate my-document.html
npx @mml-io/mml-cli validate *.html
```

Exits with code `1` if any errors are found.

Use `--json` for structured output:

```bash
npx @mml-io/mml-cli validate --json my-document.html
```

| Option | Description | Default |
|---|---|---|
| `--json` | Output errors as JSON | `false` |
