/**
 * Debug API endpoints for the MML dev server.
 * Provides inspection, logging, and control capabilities for AI agents.
 */

import type { EditableNetworkedDOM } from "@mml-io/networked-dom-server";
import type { Application, Request, Response } from "express";
import { inspect } from "util";

import { type ClientLogEntry, createDebugSession, type DebugSession } from "./debugSession";

export interface DebugApiOptions {
  app: Application;
  gameDocument: EditableNetworkedDOM;
  getConnectedClients: () => Map<string, ClientInfo>;
  host: string;
  port: number;
}

export interface ClientInfo {
  id: string;
  connectedAt: number;
  position?: { x: number; y: number; z: number };
  rotation?: { x: number; y: number; z: number };
}

export interface LogEntry {
  timestamp: number;
  level: "debug" | "info" | "warn" | "error";
  source: "server" | "client";
  message: string;
  data?: unknown;
}

// In-memory log buffer
const logBuffer: LogEntry[] = [];
const MAX_LOG_BUFFER = 1000;

// Connected users tracking
const connectedUsers = new Map<string, ClientInfo>();

const logListeners: Array<(entry: LogEntry) => void> = [];

/**
 * Add a log entry to the buffer (internal use)
 */
function makeLogDataJsonSafe(data: unknown): unknown {
  if (data === undefined) return undefined;
  if (data === null) return null;

  const t = typeof data;
  if (t === "string" || t === "number" || t === "boolean") return data;
  if (t === "bigint") return data.toString();
  if (t === "symbol") return data.toString();

  if (data instanceof Error) {
    return {
      name: data.name,
      message: data.message,
      stack: data.stack,
    };
  }

  // Ensure we never retain circular or otherwise non-JSON-safe structures in the log buffer.
  // `util.inspect` is resilient to circular refs and gives a readable debug representation.
  return inspect(data, {
    depth: 4,
    breakLength: 120,
    maxArrayLength: 50,
    maxStringLength: 4000,
  });
}

function pushLogEntry(entry: LogEntry): void {
  const safeEntry: LogEntry =
    entry.data !== undefined ? { ...entry, data: makeLogDataJsonSafe(entry.data) } : entry;

  logBuffer.push(safeEntry);
  if (logBuffer.length > MAX_LOG_BUFFER) {
    logBuffer.shift();
  }

  // Notify any connected log listeners
  for (const listener of logListeners) {
    try {
      listener(safeEntry);
    } catch {
      // Ignore listener errors
    }
  }
}

// Store original console methods
const originalConsole = {
  log: console.log.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
  debug: console.debug.bind(console),
};

let consoleHooked = false;

/**
 * Format console arguments into a string message
 */
function formatArgs(args: unknown[]): { message: string; data?: unknown } {
  if (args.length === 0) return { message: "" };

  const firstArg = args[0];

  // If first arg is a string, use it as message
  if (typeof firstArg === "string") {
    if (args.length === 1) {
      return { message: firstArg };
    }
    // Multiple args: first is message, rest is data
    return {
      message: firstArg,
      data: args.length === 2 ? args[1] : args.slice(1),
    };
  }

  // Otherwise stringify everything
  const message = args
    .map((arg) => {
      if (typeof arg === "string") return arg;
      try {
        return JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    })
    .join(" ");

  return { message };
}

/**
 * Install console hooks to capture logs
 */
export function installConsoleHooks(): void {
  if (consoleHooked) return;
  consoleHooked = true;

  const createHook = (level: LogEntry["level"], original: (...args: unknown[]) => void) => {
    return (...args: unknown[]) => {
      // Call the original console method
      original(...args);

      // Add to log buffer
      const { message, data } = formatArgs(args);
      pushLogEntry({
        timestamp: Date.now(),
        level,
        source: "server",
        message,
        data,
      });
    };
  };

  console.log = createHook("info", originalConsole.log);
  console.info = createHook("info", originalConsole.info);
  console.warn = createHook("warn", originalConsole.warn);
  console.error = createHook("error", originalConsole.error);
  console.debug = createHook("debug", originalConsole.debug);
}

/**
 * Restore original console methods
 */
export function uninstallConsoleHooks(): void {
  if (!consoleHooked) return;
  consoleHooked = false;

  console.log = originalConsole.log;
  console.info = originalConsole.info;
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
  console.debug = originalConsole.debug;
}

/**
 * Subscribe to log events
 */
export function subscribeToLogs(callback: (entry: LogEntry) => void): () => void {
  logListeners.push(callback);
  return () => {
    const idx = logListeners.indexOf(callback);
    if (idx >= 0) logListeners.splice(idx, 1);
  };
}

/**
 * Get the current log buffer (for MCP server access)
 */
export function getLogBuffer(): LogEntry[] {
  return logBuffer;
}

/**
 * Add a log entry to the buffer (for external use)
 */
export function addLogEntry(entry: LogEntry): void {
  pushLogEntry(entry);
}

/**
 * Register a user connection
 */
export function registerUser(id: string, info?: Partial<ClientInfo>): void {
  connectedUsers.set(id, {
    id,
    connectedAt: Date.now(),
    ...info,
  });
  console.log(`User connected: ${id}`);
}

/**
 * Update user position
 */
export function updateUserPosition(
  id: string,
  position: { x: number; y: number; z: number },
  rotation?: { x: number; y: number; z: number },
): void {
  const user = connectedUsers.get(id);
  if (user) {
    user.position = position;
    if (rotation) user.rotation = rotation;
  }
}

/**
 * Unregister a user
 */
export function unregisterUser(id: string): void {
  connectedUsers.delete(id);
  console.log(`User disconnected: ${id}`);
}

/**
 * Get all connected users
 */
export function getConnectedUsers(): ClientInfo[] {
  return Array.from(connectedUsers.values());
}

/**
 * Register debug API routes on the Express app
 */
export function registerDebugApi(options: DebugApiOptions): void {
  const { app, gameDocument } = options;

  // Managed debug client session
  let debugClient: DebugSession | null = null;
  let debugClientStarting = false;

  const handleClientLog = (entry: ClientLogEntry) => {
    pushLogEntry({
      timestamp: Date.now(),
      level: entry.level,
      source: "client",
      message: entry.message,
      data: entry.data,
    });
  };

  // Install console hooks to capture all console.log/warn/error calls
  installConsoleHooks();

  // Status endpoint
  app.get("/debug/status", (_req: Request, res: Response) => {
    res.json({
      connected: true,
      users: getConnectedUsers(),
      logBufferSize: logBuffer.length,
      uptime: process.uptime(),
    });
  });

  // Users endpoint
  app.get("/debug/users", (_req: Request, res: Response) => {
    res.json(getConnectedUsers());
  });

  // Logs endpoint
  app.get("/debug/logs", (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 100;
    const level = req.query.level as string | undefined;
    const source = req.query.source as string | undefined;
    const since = parseInt(req.query.since as string) || 0;
    const grep = req.query.grep as string | undefined;

    let logs = [...logBuffer];

    // Filter by time
    if (since > 0) {
      const sinceTime = Date.now() - since;
      logs = logs.filter((l) => l.timestamp >= sinceTime);
    }

    // Filter by level
    if (level) {
      logs = logs.filter((l) => l.level === level);
    }

    // Filter by source
    if (source) {
      logs = logs.filter((l) => l.source === source);
    }

    // Filter by grep pattern
    if (grep) {
      const pattern = new RegExp(grep, "i");
      logs = logs.filter((l) => pattern.test(l.message));
    }

    // Return most recent entries up to limit
    res.json(logs.slice(-limit));
  });

  // Inspect element endpoint
  app.get("/debug/inspect", (req: Request, res: Response) => {
    const selector = req.query.selector as string;

    if (!selector) {
      return res.status(400).json({ error: "selector query parameter required" });
    }

    try {
      const doc = (gameDocument as any).document;
      if (!doc) {
        return res.status(503).json({ error: "Document not loaded" });
      }

      const element = doc.querySelector(selector);
      if (!element) {
        return res.status(404).json({ error: `Element not found: ${selector}` });
      }

      // Extract element info
      const info = {
        tagName: element.tagName?.toLowerCase(),
        id: element.id,
        className: element.className,
        attributes: {} as Record<string, string>,
        children: [] as string[],
      };

      // Get all attributes
      if (element.attributes) {
        for (let i = 0; i < element.attributes.length; i++) {
          const attr = element.attributes[i];
          info.attributes[attr.name] = attr.value;
        }
      }

      // Get child element names
      if (element.children) {
        for (let i = 0; i < element.children.length; i++) {
          const child = element.children[i];
          info.children.push(child.tagName?.toLowerCase() || "unknown");
        }
      }

      res.json(info);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // Execute code in server context
  app.post("/debug/exec", (req: Request, res: Response) => {
    const { code } = req.body as { code: string };

    if (!code) {
      return res.status(400).json({ error: "code body parameter required" });
    }

    try {
      const doc = (gameDocument as any).document;
      if (!doc) {
        return res.status(503).json({ error: "Document not loaded" });
      }

      // Create a function that has access to the document
      // This is a simplified implementation - in production you'd want sandboxing
      const fn = new Function("document", `return (${code})`);
      const result = fn(doc);

      res.json({ result: result !== undefined ? String(result) : null });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // Simulate click event
  app.post("/debug/click", (req: Request, res: Response) => {
    const { selector, userId } = req.body as { selector: string; userId?: string };

    if (!selector) {
      return res.status(400).json({ error: "selector body parameter required" });
    }

    try {
      const doc = (gameDocument as any).document;
      if (!doc) {
        return res.status(503).json({ error: "Document not loaded" });
      }

      const element = doc.querySelector(selector);
      if (!element) {
        return res.status(404).json({ error: `Element not found: ${selector}` });
      }

      // Create a synthetic click event
      const event = new (doc.defaultView?.Event || Event)("click", {
        bubbles: true,
        cancelable: true,
      });

      // Add MML-specific properties
      (event as any).connectionId = userId || "debug-user";
      (event as any).position = { x: 0, y: 0, z: 0 };

      element.dispatchEvent(event);

      console.log(`Simulated click on ${selector}${userId ? ` as ${userId}` : ""}`);

      res.json({ success: true, selector });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // --- Debug Client Management (Puppeteer) ---

  // Start debug client
  app.post("/debug/client/start", async (req: Request, res: Response) => {
    const { headless = true } = req.body as { headless?: boolean };

    if (debugClient && debugClient.isConnected()) {
      return res.json({ status: "already_running" });
    }

    if (debugClientStarting) {
      return res.status(409).json({ error: "Client is already starting" });
    }

    try {
      debugClientStarting = true;
      console.log("Starting debug client...");

      debugClient = await createDebugSession({
        host: options.host,
        port: options.port,
        headless,
        onClientLog: handleClientLog,
      });

      debugClientStarting = false;
      console.log("Debug client started");
      res.json({ status: "started" });
    } catch (err) {
      debugClientStarting = false;
      console.error(`Failed to start debug client: ${err}`);
      res.status(500).json({ error: String(err) });
    }
  });

  // Stop debug client
  app.post("/debug/client/stop", async (_req: Request, res: Response) => {
    if (!debugClient) {
      return res.json({ status: "not_running" });
    }

    try {
      await debugClient.close();
      debugClient = null;
      console.log("Debug client stopped");
      res.json({ status: "stopped" });
    } catch (err) {
      console.error(`Failed to stop debug client: ${err}`);
      res.status(500).json({ error: String(err) });
    }
  });

  // Refresh debug client
  app.post("/debug/client/refresh", async (_req: Request, res: Response) => {
    if (!debugClient || !debugClient.isConnected()) {
      return res.status(400).json({ error: "Debug client not running" });
    }

    try {
      await debugClient.refresh();
      console.log("Debug client refreshed");
      res.json({ status: "refreshed" });
    } catch (err) {
      console.error(`Failed to refresh debug client: ${err}`);
      res.status(500).json({ error: String(err) });
    }
  });

  // Debug client status
  app.get("/debug/client/status", (_req: Request, res: Response) => {
    res.json({
      running: debugClient !== null && debugClient.isConnected(),
      starting: debugClientStarting,
    });
  });

  // Screenshot via debug client
  app.post("/debug/client/screenshot", async (req: Request, res: Response) => {
    if (!debugClient || !debugClient.isConnected()) {
      return res
        .status(400)
        .json({ error: "Debug client not running. Start it first with POST /debug/client/start" });
    }

    const { output, width, height, cameraPosition, cameraTarget, delay } = req.body as {
      output?: string;
      width?: number;
      height?: number;
      cameraPosition?: { x: number; y: number; z: number };
      cameraTarget?: { x: number; y: number; z: number };
      delay?: number;
    };

    try {
      const outputPath = await debugClient.screenshot({
        output,
        width,
        height,
        cameraPosition,
        cameraTarget,
        delay,
      });
      res.json({ path: outputPath });
    } catch (err) {
      console.error(`Screenshot failed: ${err}`);
      res.status(500).json({ error: String(err) });
    }
  });

  // Execute code in browser via debug client
  app.post("/debug/client/exec", async (req: Request, res: Response) => {
    if (!debugClient || !debugClient.isConnected()) {
      return res
        .status(400)
        .json({ error: "Debug client not running. Start it first with POST /debug/client/start" });
    }

    const { code } = req.body as { code: string };

    if (!code) {
      return res.status(400).json({ error: "code body parameter required" });
    }

    try {
      const result = await debugClient.clientExec(code);
      res.json({ result: result !== undefined ? result : null });
    } catch (err) {
      console.error(`Client exec failed: ${err}`);
      res.status(500).json({ error: String(err) });
    }
  });

  // Get DOM from client via debug client
  app.get("/debug/client/dom", async (_req: Request, res: Response) => {
    if (!debugClient || !debugClient.isConnected()) {
      return res
        .status(400)
        .json({ error: "Debug client not running. Start it first with: mml debug start" });
    }

    try {
      const html = await debugClient.getClientDom();
      res.type("text/html").send(html);
    } catch (err) {
      console.error(`Client DOM failed: ${err}`);
      res.status(500).json({ error: String(err) });
    }
  });

  // Get elements from client via debug client
  app.get("/debug/client/elements", async (req: Request, res: Response) => {
    if (!debugClient || !debugClient.isConnected()) {
      return res
        .status(400)
        .json({ error: "Debug client not running. Start it first with: mml debug start" });
    }

    const type = req.query.type as string | undefined;

    try {
      const elements = await debugClient.getClientElements(type);
      res.json(elements);
    } catch (err) {
      console.error(`Client elements failed: ${err}`);
      res.status(500).json({ error: String(err) });
    }
  });

  console.log("Debug API registered");
}
