/**
 * Debug commands for inspecting and controlling the MML dev server.
 * Provides CLI access to logs, DOM inspection, and more.
 */

import type { ArgumentsCamelCase, Argv } from "yargs";

interface DebugBaseOptions {
  host: string;
  port: number;
}

class HttpError extends Error {
  public readonly status: number;
  public readonly body: string;

  constructor(status: number, body: string) {
    super(`HTTP ${status}: ${body}`);
    this.status = status;
    this.body = body;
  }
}

function getBaseUrl(args: DebugBaseOptions): string {
  return `http://${args.host}:${args.port}`;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    const text = await response.text();
    throw new HttpError(response.status, text);
  }
  return response.json() as Promise<T>;
}

async function postJson<T>(url: string, body: unknown = {}): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new HttpError(response.status, text);
  }
  return response.json() as Promise<T>;
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url);
  const text = await response.text();
  if (!response.ok) {
    throw new HttpError(response.status, text);
  }
  return text;
}

// Start command
interface StartOptions extends DebugBaseOptions {
  headless: boolean;
}

async function handleStart(args: ArgumentsCamelCase<StartOptions>): Promise<void> {
  const baseUrl = getBaseUrl(args);
  try {
    const result = await postJson<{ status: string }>(`${baseUrl}/debug/client/start`, {
      headless: args.headless,
    });
    if (result.status === "already_running") {
      console.log("Debug client is already running.");
    } else {
      console.log("Debug client started. Browser console logs are now being captured.");
    }
  } catch (e) {
    console.error(`Failed to start debug client: ${e}`);
    console.error("Is the dev server running? Try: mml dev");
    process.exit(1);
  }
}

// Stop command
async function handleStop(args: ArgumentsCamelCase<DebugBaseOptions>): Promise<void> {
  const baseUrl = getBaseUrl(args);
  try {
    const result = await postJson<{ status: string }>(`${baseUrl}/debug/client/stop`);
    if (result.status === "not_running") {
      console.log("Debug client is not running.");
    } else {
      console.log("Debug client stopped.");
    }
  } catch (e) {
    console.error(`Failed to stop debug client: ${e}`);
    process.exit(1);
  }
}

// Refresh command
async function handleRefresh(args: ArgumentsCamelCase<DebugBaseOptions>): Promise<void> {
  const baseUrl = getBaseUrl(args);
  try {
    await postJson<{ status: string }>(`${baseUrl}/debug/client/refresh`);
    console.log("Debug client refreshed.");
  } catch (e) {
    console.error(`Failed to refresh debug client: ${e}`);
    process.exit(1);
  }
}

// Status command
interface StatusResult {
  connected: boolean;
  users: Array<{ id: string; connectedAt: number }>;
  logBufferSize: number;
  uptime: number;
}

interface ClientStatus {
  running: boolean;
  starting: boolean;
}

async function handleStatus(args: ArgumentsCamelCase<DebugBaseOptions>): Promise<void> {
  const baseUrl = getBaseUrl(args);
  try {
    const [status, clientStatus] = await Promise.all([
      fetchJson<StatusResult>(`${baseUrl}/debug/status`),
      fetchJson<ClientStatus>(`${baseUrl}/debug/client/status`),
    ]);

    console.log("Debug Server Status:");
    console.log(`  Connected: ${status.connected}`);
    console.log(`  Uptime: ${Math.round(status.uptime)}s`);
    console.log(`  Log buffer: ${status.logBufferSize} entries`);
    console.log(`  Users: ${status.users.length}`);
    if (status.users.length > 0) {
      for (const user of status.users) {
        console.log(`    - ${user.id} (connected ${new Date(user.connectedAt).toISOString()})`);
      }
    }
    console.log(
      `  Debug client: ${clientStatus.running ? "running" : clientStatus.starting ? "starting" : "not running"}`,
    );
  } catch (e) {
    console.error(`Failed to get status: ${e}`);
    console.error("Is the dev server running? Try: mml dev");
    process.exit(1);
  }
}

// Users command
interface UserInfo {
  id: string;
  connectedAt: number;
  position?: { x: number; y: number; z: number };
  rotation?: { x: number; y: number; z: number };
}

async function handleUsers(args: ArgumentsCamelCase<DebugBaseOptions>): Promise<void> {
  const baseUrl = getBaseUrl(args);
  try {
    const users = await fetchJson<UserInfo[]>(`${baseUrl}/debug/users`);
    if (users.length === 0) {
      console.log("No users connected.");
      return;
    }
    console.log(`Connected users (${users.length}):`);
    for (const user of users) {
      console.log(`  ${user.id}:`);
      console.log(`    Connected: ${new Date(user.connectedAt).toISOString()}`);
      if (user.position) {
        console.log(
          `    Position: (${user.position.x.toFixed(2)}, ${user.position.y.toFixed(2)}, ${user.position.z.toFixed(2)})`,
        );
      }
      if (user.rotation) {
        console.log(
          `    Rotation: (${user.rotation.x.toFixed(2)}, ${user.rotation.y.toFixed(2)}, ${user.rotation.z.toFixed(2)})`,
        );
      }
    }
  } catch (e) {
    console.error(`Failed to get users: ${e}`);
    process.exit(1);
  }
}

// Logs command
interface LogsOptions extends DebugBaseOptions {
  limit: number;
  level?: string;
  source?: string;
  since?: number;
  grep?: string;
  follow: boolean;
}

interface LogEntry {
  timestamp: number;
  level: string;
  source: string;
  message: string;
  data?: unknown;
}

async function handleLogs(args: ArgumentsCamelCase<LogsOptions>): Promise<void> {
  const baseUrl = getBaseUrl(args);
  const params = new URLSearchParams();
  params.set("limit", String(args.limit));
  if (args.level) params.set("level", args.level);
  if (args.source) params.set("source", args.source);
  if (args.since) params.set("since", String(args.since));
  if (args.grep) params.set("grep", args.grep);

  try {
    const logs = await fetchJson<LogEntry[]>(`${baseUrl}/debug/logs?${params}`);

    for (const log of logs) {
      const time = new Date(log.timestamp).toISOString().slice(11, 23);
      const levelColor =
        {
          debug: "\x1b[90m",
          info: "\x1b[34m",
          warn: "\x1b[33m",
          error: "\x1b[31m",
        }[log.level] || "";
      const reset = "\x1b[0m";
      console.log(
        `${time} ${levelColor}[${log.level.toUpperCase().padEnd(5)}]${reset} [${log.source}] ${log.message}`,
      );
      if (log.data) {
        if (typeof log.data === "string") {
          console.log(`         ${log.data}`);
        } else {
          console.log(`         ${JSON.stringify(log.data)}`);
        }
      }
    }

    if (args.follow) {
      console.log("\n--- Following logs (Ctrl+C to stop) ---\n");
      let lastTimestamp = logs.length > 0 ? logs[logs.length - 1].timestamp : Date.now();

      const poll = async () => {
        try {
          const newParams = new URLSearchParams(params);
          newParams.set("since", String(Date.now() - lastTimestamp));
          const newLogs = await fetchJson<LogEntry[]>(`${baseUrl}/debug/logs?${newParams}`);

          for (const log of newLogs) {
            if (log.timestamp > lastTimestamp) {
              const time = new Date(log.timestamp).toISOString().slice(11, 23);
              const levelColor =
                {
                  debug: "\x1b[90m",
                  info: "\x1b[34m",
                  warn: "\x1b[33m",
                  error: "\x1b[31m",
                }[log.level] || "";
              const reset = "\x1b[0m";
              console.log(
                `${time} ${levelColor}[${log.level.toUpperCase().padEnd(5)}]${reset} [${log.source}] ${log.message}`,
              );
              if (log.data) {
                if (typeof log.data === "string") {
                  console.log(`         ${log.data}`);
                } else {
                  console.log(`         ${JSON.stringify(log.data)}`);
                }
              }
              lastTimestamp = log.timestamp;
            }
          }
        } catch {
          // Ignore polling errors
        }
        setTimeout(poll, 1000);
      };

      poll();
      // Keep process alive
      await new Promise(() => {});
    }
  } catch (e) {
    console.error(`Failed to get logs: ${e}`);
    process.exit(1);
  }
}

// Inspect command
interface InspectOptions extends DebugBaseOptions {
  selector: string;
}

interface ElementInfo {
  tagName: string;
  id?: string;
  className?: string;
  attributes: Record<string, string>;
  children: string[];
}

async function handleInspect(args: ArgumentsCamelCase<InspectOptions>): Promise<void> {
  const baseUrl = getBaseUrl(args);
  try {
    const info = await fetchJson<ElementInfo>(
      `${baseUrl}/debug/inspect?selector=${encodeURIComponent(args.selector)}`,
    );
    console.log(`Element: <${info.tagName}>`);
    if (info.id) console.log(`  id: "${info.id}"`);
    if (info.className) console.log(`  class: "${info.className}"`);
    console.log("  Attributes:");
    for (const [name, value] of Object.entries(info.attributes)) {
      console.log(`    ${name}="${value}"`);
    }
    if (info.children.length > 0) {
      console.log(`  Children (${info.children.length}):`);
      for (const child of info.children) {
        console.log(`    <${child}>`);
      }
    }
  } catch (e) {
    console.error(`Failed to inspect element: ${e}`);
    process.exit(1);
  }
}

// Elements command
interface ElementsOptions extends DebugBaseOptions {
  type?: string;
}

async function handleElements(args: ArgumentsCamelCase<ElementsOptions>): Promise<void> {
  const baseUrl = getBaseUrl(args);
  const params = args.type ? `?type=${encodeURIComponent(args.type)}` : "";
  try {
    const elements = await fetchJson<Array<{ tagName: string; id?: string; class?: string }>>(
      `${baseUrl}/debug/client/elements${params}`,
    );
    console.log(`Elements (${elements.length}):`);
    for (const el of elements) {
      let desc = `<${el.tagName}`;
      if (el.id) desc += ` id="${el.id}"`;
      if (el.class) desc += ` class="${el.class}"`;
      desc += ">";
      console.log(`  ${desc}`);
    }
  } catch (e) {
    console.error(`Failed to list elements: ${e}`);
    if (e instanceof HttpError && e.status === 400 && e.body.includes("Debug client not running")) {
      console.error("Start the debug client first with: mml debug start");
    }
    process.exit(1);
  }
}

// DOM command
async function handleDom(args: ArgumentsCamelCase<DebugBaseOptions>): Promise<void> {
  const baseUrl = getBaseUrl(args);
  try {
    const html = await fetchText(`${baseUrl}/debug/client/dom`);
    console.log(html);
  } catch (e) {
    console.error(`Failed to get DOM: ${e}`);
    if (e instanceof HttpError && e.status === 400 && e.body.includes("Debug client not running")) {
      console.error("Start the debug client first with: mml debug start");
    }
    process.exit(1);
  }
}

// Exec command (server-side)
interface ExecOptions extends DebugBaseOptions {
  code: string;
}

async function handleExec(args: ArgumentsCamelCase<ExecOptions>): Promise<void> {
  const baseUrl = getBaseUrl(args);
  try {
    const result = await postJson<{ result: string | null }>(`${baseUrl}/debug/exec`, {
      code: args.code,
    });
    if (result.result !== null) {
      console.log(result.result);
    }
  } catch (e) {
    console.error(`Failed to execute code: ${e}`);
    process.exit(1);
  }
}

// Screenshot command
interface ScreenshotOptions extends DebugBaseOptions {
  output?: string;
  width?: number;
  height?: number;
  cameraX?: number;
  cameraY?: number;
  cameraZ?: number;
  targetX?: number;
  targetY?: number;
  targetZ?: number;
  delay?: number;
}

async function handleScreenshot(args: ArgumentsCamelCase<ScreenshotOptions>): Promise<void> {
  const baseUrl = getBaseUrl(args);

  const cameraPosition =
    args.cameraX !== undefined || args.cameraY !== undefined || args.cameraZ !== undefined
      ? { x: args.cameraX || 0, y: args.cameraY || 5, z: args.cameraZ || 10 }
      : undefined;

  const cameraTarget =
    args.targetX !== undefined || args.targetY !== undefined || args.targetZ !== undefined
      ? { x: args.targetX || 0, y: args.targetY || 0, z: args.targetZ || 0 }
      : undefined;

  try {
    const result = await postJson<{ path: string }>(`${baseUrl}/debug/client/screenshot`, {
      output: args.output,
      width: args.width,
      height: args.height,
      cameraPosition,
      cameraTarget,
      delay: args.delay,
    });
    console.log(`Screenshot saved to: ${result.path}`);
  } catch (e) {
    console.error(`Failed to take screenshot: ${e}`);
    console.error("Make sure the debug client is running: mml debug start");
    process.exit(1);
  }
}

// Client exec command (runs in browser via debug client)
interface ClientExecOptions extends DebugBaseOptions {
  code: string;
}

async function handleClientExec(args: ArgumentsCamelCase<ClientExecOptions>): Promise<void> {
  const baseUrl = getBaseUrl(args);
  try {
    const result = await postJson<{ result: unknown }>(`${baseUrl}/debug/client/exec`, {
      code: args.code,
    });
    if (result.result !== null) {
      console.log(JSON.stringify(result.result, null, 2));
    }
  } catch (e) {
    console.error(`Failed to execute in browser: ${e}`);
    console.error("Make sure the debug client is running: mml debug start");
    process.exit(1);
  }
}

// Click command
interface ClickOptions extends DebugBaseOptions {
  selector: string;
  userId?: string;
}

async function handleClick(args: ArgumentsCamelCase<ClickOptions>): Promise<void> {
  const baseUrl = getBaseUrl(args);
  try {
    const result = await postJson<{ success: boolean; selector: string }>(
      `${baseUrl}/debug/click`,
      {
        selector: args.selector,
        userId: args.userId,
      },
    );
    console.log(`Clicked: ${result.selector}`);
  } catch (e) {
    console.error(`Failed to simulate click: ${e}`);
    process.exit(1);
  }
}

/**
 * Register the debug command and all subcommands
 */
export function registerDebugCommand(yargs: Argv): Argv {
  return yargs.command(
    "debug",
    "Debug commands for inspecting the MML dev server",
    (yargs) => {
      return yargs
        .option("host", {
          type: "string",
          default: "localhost",
          describe: "Dev server host",
        })
        .option("port", {
          type: "number",
          default: 3004,
          describe: "Dev server port",
        })
        .command(
          "start",
          "Start the debug client (Puppeteer browser that captures client logs)",
          (yargs) => {
            return yargs.option("headless", {
              type: "boolean",
              default: true,
              describe: "Run browser in headless mode",
            });
          },
          handleStart,
        )
        .command("stop", "Stop the debug client", () => {}, handleStop)
        .command("refresh", "Refresh the debug client browser", () => {}, handleRefresh)
        .command("status", "Get debug server status", () => {}, handleStatus)
        .command("users", "List connected users with positions", () => {}, handleUsers)
        .command(
          "logs",
          "View server and client logs",
          (yargs) => {
            return yargs
              .option("limit", {
                type: "number",
                default: 100,
                describe: "Maximum number of log entries",
              })
              .option("level", {
                type: "string",
                choices: ["debug", "info", "warn", "error"],
                describe: "Filter by log level",
              })
              .option("source", {
                type: "string",
                choices: ["server", "client"],
                describe: "Filter by log source",
              })
              .option("since", {
                type: "number",
                describe: "Show logs from the last N milliseconds",
              })
              .option("grep", {
                type: "string",
                describe: "Filter logs by regex pattern",
              })
              .option("follow", {
                alias: "f",
                type: "boolean",
                default: false,
                describe: "Follow log output (like tail -f)",
              });
          },
          handleLogs,
        )
        .command(
          "inspect <selector>",
          "Inspect a DOM element by CSS selector",
          (yargs) => {
            return yargs.positional("selector", {
              type: "string",
              describe: "CSS selector (e.g., #myElement, m-cube)",
              demandOption: true,
            });
          },
          handleInspect,
        )
        .command(
          "elements",
          "List all MML elements in the document",
          (yargs) => {
            return yargs.option("type", {
              type: "string",
              describe: "Filter by element type (e.g., m-cube)",
            });
          },
          handleElements,
        )
        .command("dom", "Dump the full DOM as HTML", () => {}, handleDom)
        .command(
          "exec <code>",
          "Execute JavaScript code in the server context",
          (yargs) => {
            return yargs.positional("code", {
              type: "string",
              describe: "JavaScript expression to evaluate",
              demandOption: true,
            });
          },
          handleExec,
        )
        .command(
          "click <selector>",
          "Simulate a click event on an element",
          (yargs) => {
            return yargs
              .positional("selector", {
                type: "string",
                describe: "CSS selector of element to click",
                demandOption: true,
              })
              .option("user-id", {
                type: "string",
                describe: "User ID to simulate click as",
              });
          },
          handleClick,
        )
        .command(
          "screenshot",
          "Take a screenshot of the game (requires debug client running)",
          (yargs) => {
            return yargs
              .option("output", {
                alias: "o",
                type: "string",
                describe: "Output file path (default: screenshot-<timestamp>.png)",
              })
              .option("width", {
                alias: "w",
                type: "number",
                default: 1920,
                describe: "Screenshot width in pixels",
              })
              .option("height", {
                alias: "H",
                type: "number",
                default: 1080,
                describe: "Screenshot height in pixels",
              })
              .option("camera-x", {
                type: "number",
                describe: "Camera X position",
              })
              .option("camera-y", {
                type: "number",
                describe: "Camera Y position",
              })
              .option("camera-z", {
                type: "number",
                describe: "Camera Z position",
              })
              .option("target-x", {
                type: "number",
                describe: "Camera look-at target X",
              })
              .option("target-y", {
                type: "number",
                describe: "Camera look-at target Y",
              })
              .option("target-z", {
                type: "number",
                describe: "Camera look-at target Z",
              })
              .option("delay", {
                type: "number",
                describe: "Delay before screenshot (ms)",
              });
          },
          handleScreenshot,
        )
        .command(
          "client-exec <code>",
          "Execute JavaScript in the browser context (requires debug client running)",
          (yargs) => {
            return yargs.positional("code", {
              type: "string",
              describe: "JavaScript expression to evaluate in browser",
              demandOption: true,
            });
          },
          handleClientExec,
        )
        .demandCommand(
          1,
          "Specify a debug subcommand (start, stop, status, logs, screenshot, etc.)",
        );
    },
    () => {
      // This is called when just "mml debug" is run without a subcommand
      // yargs will show help due to demandCommand
    },
  );
}
