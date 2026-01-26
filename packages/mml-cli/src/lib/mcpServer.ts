/**
 * MCP (Model Context Protocol) server for the MML dev server.
 * Exposes debug API functionality as MCP tools for AI assistants.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import type { Request, Response } from "express";
import { z } from "zod";

import { describeModel } from "../commands/describeModel";
import { type ClientLogEntry, createDebugSession, type DebugSession } from "./debugSession";

export interface McpServerOptions {
  app: any;
  getConnectedClients: () => Map<string, { id: string; connectedAt: number }>;
  host: string;
  port: number;
  getLogBuffer: () => Array<{
    timestamp: number;
    level: string;
    source: string;
    message: string;
    data?: unknown;
  }>;
  pushLogEntry: (entry: {
    timestamp: number;
    level: "debug" | "info" | "warn" | "error";
    source: "server" | "client";
    message: string;
    data?: unknown;
  }) => void;
}

/**
 * Register MCP server routes on the Express app at /mcp
 */
export function registerMcpServer(options: McpServerOptions): void {
  const { app, getConnectedClients, host, port, getLogBuffer, pushLogEntry } = options;

  // Managed debug client session for MCP
  let debugClient: DebugSession | null = null;
  let debugClientStartPromise: Promise<DebugSession> | null = null;

  const handleClientLog = (entry: ClientLogEntry) => {
    pushLogEntry({
      timestamp: Date.now(),
      level: entry.level,
      source: "client",
      message: entry.message,
      data: entry.data,
    });
  };

  /**
   * Ensure the debug client (Puppeteer) is running.
   * Auto-starts if not already running. Returns the active session.
   */
  async function ensureDebugClient(): Promise<DebugSession> {
    // Already running and connected
    if (debugClient && debugClient.isConnected()) {
      return debugClient;
    }

    // Already starting - wait for it
    if (debugClientStartPromise) {
      return debugClientStartPromise;
    }

    // Start new session
    console.log("MCP: Auto-starting debug client...");
    debugClientStartPromise = createDebugSession({
      host,
      port,
      headless: true,
      onClientLog: handleClientLog,
    });

    try {
      debugClient = await debugClientStartPromise;
      console.log("MCP: Debug client started");
      return debugClient;
    } catch (err) {
      console.error(`MCP: Failed to start debug client: ${err}`);
      throw err;
    } finally {
      debugClientStartPromise = null;
    }
  }

  // Create MCP server
  const mcpServer = new McpServer({
    name: "mml-dev-server",
    version: "1.0.0",
  });

  // --- MCP Tools ---

  // Get server status
  mcpServer.registerTool(
    "get_status",
    {
      description:
        "Get the current status of the MML dev server, including connected users, log buffer size, and uptime",
    },
    () => {
      const users = Array.from(getConnectedClients().values());
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                connected: true,
                users,
                logBufferSize: getLogBuffer().length,
                uptime: process.uptime(),
                debugClientRunning: debugClient !== null && debugClient.isConnected(),
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  // Get connected users
  mcpServer.registerTool(
    "get_users",
    {
      description: "Get a list of all connected users/clients",
    },
    () => {
      const users = Array.from(getConnectedClients().values());
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(users, null, 2),
          },
        ],
      };
    },
  );

  // Get logs
  mcpServer.registerTool(
    "get_logs",
    {
      description:
        "Get server and client logs with optional filtering by level, source, time, or pattern",
      inputSchema: {
        limit: z
          .number()
          .optional()
          .describe("Maximum number of log entries to return (default: 100)"),
        level: z
          .enum(["debug", "info", "warn", "error"])
          .optional()
          .describe("Filter by log level"),
        source: z.enum(["server", "client"]).optional().describe("Filter by log source"),
        since: z.number().optional().describe("Only return logs from the last N milliseconds"),
        grep: z.string().optional().describe("Filter logs by regex pattern"),
      },
    },
    ({ limit = 100, level, source, since, grep }) => {
      let logs = [...getLogBuffer()];

      if (since && since > 0) {
        const sinceTime = Date.now() - since;
        logs = logs.filter((l) => l.timestamp >= sinceTime);
      }

      if (level) {
        logs = logs.filter((l) => l.level === level);
      }

      if (source) {
        logs = logs.filter((l) => l.source === source);
      }

      if (grep) {
        const pattern = new RegExp(grep, "i");
        logs = logs.filter((l) => pattern.test(l.message));
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(logs.slice(-limit), null, 2),
          },
        ],
      };
    },
  );

  // --- Browser Tools (auto-start Puppeteer as needed) ---

  // Get DOM from client
  mcpServer.registerTool(
    "get_dom",
    {
      description: "Get the full DOM tree of the MML document as HTML from the browser",
    },
    async () => {
      try {
        const client = await ensureDebugClient();
        const html = await client.getClientDom();
        return {
          content: [{ type: "text" as const, text: html }],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Failed to get DOM: ${String(err)}` }],
          isError: true,
        };
      }
    },
  );

  // List MML elements
  mcpServer.registerTool(
    "list_elements",
    {
      description:
        "List all MML elements in the document from the browser, optionally filtered by type",
      inputSchema: {
        type: z.string().optional().describe("Filter by element type (e.g., 'm-cube', 'm-model')"),
      },
    },
    async ({ type }) => {
      try {
        const client = await ensureDebugClient();
        const elements = await client.getClientElements(type);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(elements, null, 2) }],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Failed to get elements: ${String(err)}` }],
          isError: true,
        };
      }
    },
  );

  // Take screenshot
  mcpServer.registerTool(
    "take_screenshot",
    {
      description: "Take a screenshot of the running game and return the image",
      inputSchema: {
        cameraX: z.number().optional().describe("Camera X position"),
        cameraY: z.number().optional().describe("Camera Y position"),
        cameraZ: z.number().optional().describe("Camera Z position"),
        targetX: z.number().optional().describe("Camera target X position"),
        targetY: z.number().optional().describe("Camera target Y position"),
        targetZ: z.number().optional().describe("Camera target Z position"),
        width: z.number().optional().describe("Screenshot width in pixels"),
        height: z.number().optional().describe("Screenshot height in pixels"),
        delay: z.number().optional().describe("Delay in ms before taking screenshot"),
      },
    },
    async ({ cameraX, cameraY, cameraZ, targetX, targetY, targetZ, width, height, delay }) => {
      try {
        const client = await ensureDebugClient();

        const cameraPosition =
          cameraX !== undefined || cameraY !== undefined || cameraZ !== undefined
            ? { x: cameraX ?? 0, y: cameraY ?? 0, z: cameraZ ?? 0 }
            : undefined;

        const cameraTarget =
          targetX !== undefined || targetY !== undefined || targetZ !== undefined
            ? { x: targetX ?? 0, y: targetY ?? 0, z: targetZ ?? 0 }
            : undefined;

        const buffer = await client.screenshotBuffer({
          width,
          height,
          cameraPosition,
          cameraTarget,
          delay,
        });

        const base64 = buffer.toString("base64");

        return {
          content: [
            {
              type: "image" as const,
              data: base64,
              mimeType: "image/png",
            },
          ],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Screenshot failed: ${String(err)}` }],
          isError: true,
        };
      }
    },
  );

  // Execute code in browser
  mcpServer.registerTool(
    "execute_client_code",
    {
      description: "Execute JavaScript code in the browser context",
      inputSchema: {
        code: z.string().describe("JavaScript code to execute in the browser"),
      },
    },
    async ({ code }) => {
      try {
        const client = await ensureDebugClient();
        const result = await client.clientExec(code);
        return {
          content: [
            {
              type: "text" as const,
              text: result !== undefined ? JSON.stringify(result, null, 2) : "undefined",
            },
          ],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Client exec failed: ${String(err)}` }],
          isError: true,
        };
      }
    },
  );

  // Refresh browser
  mcpServer.registerTool(
    "refresh_browser",
    {
      description: "Refresh the browser page to reload the MML document",
    },
    async () => {
      try {
        const client = await ensureDebugClient();
        await client.refresh();
        return {
          content: [{ type: "text" as const, text: "Browser refreshed" }],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Failed to refresh: ${String(err)}` }],
          isError: true,
        };
      }
    },
  );

  // Describe a GLB model (bounds + screenshots)
  mcpServer.registerTool(
    "describe_model",
    {
      description:
        "Take screenshots of a GLB model file from multiple angles and return bounds/extent. Images are base64 PNG.",
      inputSchema: {
        file: z.string().describe("Path to the .glb model file"),
        resolution: z
          .string()
          .optional()
          .describe("Resolution (e.g., '384x384' or '512'). Default: 384x384"),
        count: z
          .number()
          .optional()
          .describe("Number of angles to capture (rotates around model). Default: 1"),
      },
    },
    async ({ file, resolution, count }) => {
      try {
        const result = await describeModel({ file, resolution, count });

        const content = [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                file: result.file,
                width: result.width,
                height: result.height,
                count: result.count,
                format: result.format,
                bounds: result.bounds,
                extent: result.extent,
                center: result.center,
              },
              null,
              2,
            ),
          },
          ...result.images.map((img) => ({
            type: "image" as const,
            data: img.base64,
            mimeType: "image/png",
          })),
        ];

        return { content };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Describe model failed: ${String(err)}` }],
          isError: true,
        };
      }
    },
  );

  // --- SSE Transport Setup ---

  // Store transports by session ID for message routing
  const transports = new Map<string, SSEServerTransport>();

  // SSE endpoint for MCP
  app.get("/mcp/sse", async (req: Request, res: Response) => {
    console.log("MCP: SSE connection established");

    const transport = new SSEServerTransport("/mcp/messages", res);
    const sessionId = transport.sessionId;
    transports.set(sessionId, transport);
    const keepAliveIntervalMs = 30_000;
    const keepAliveTimer = setInterval(() => {
      if (!res.writableEnded) {
        res.write(": keep-alive\n\n");
      }
    }, keepAliveIntervalMs);

    res.on("close", () => {
      console.log(`MCP: SSE connection closed (session: ${sessionId})`);
      clearInterval(keepAliveTimer);
      transports.delete(sessionId);
    });

    await mcpServer.connect(transport);
  });

  // Messages endpoint for MCP
  app.post("/mcp/messages", async (req: Request, res: Response) => {
    const sessionId = req.query.sessionId as string;

    if (!sessionId) {
      res.status(400).json({ error: "Missing sessionId query parameter" });
      return;
    }

    const transport = transports.get(sessionId);
    if (!transport) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    await transport.handlePostMessage(req, res, req.body);
  });

  console.log("MCP server registered at /mcp/sse");
}
