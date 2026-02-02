/**
 * MCP (Model Context Protocol) server for the MML dev server.
 * Exposes debug API functionality as MCP tools for AI assistants.
 */

import { randomUUID } from "node:crypto";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import type { Request, Response } from "express";

import { type ClientLogEntry, createDebugSession, type DebugSession } from "./debugSession";
import { registerBrowserTools } from "./mcp-tools/browserTools";
import { registerCoreTools } from "./mcp-tools/coreTools";
import { registerDocsTools } from "./mcp-tools/docsTools";
import {
  createExternalToolsRegistry,
  type ExternalToolSessionKeys,
} from "./mcp-tools/externalTools";
import { registerModelTools } from "./mcp-tools/modelTools";

export interface McpServerOptions {
  app: any;
  getConnectedClients: () => Map<string, { id: string; connectedAt: number }>;
  host: string;
  port: number;
  assetsDir: string;
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

export interface McpServerCleanup {
  /** Close all active MCP transports and clean up resources */
  close: () => Promise<void>;
}

/**
 * Register MCP server routes on the Express app at /mcp
 */
export function registerMcpServer(options: McpServerOptions): McpServerCleanup {
  const { app, getConnectedClients, host, port, assetsDir, getLogBuffer, pushLogEntry } = options;

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

  registerCoreTools(mcpServer, {
    getConnectedClients,
    getLogBuffer,
    isDebugClientRunning: () => debugClient !== null && debugClient.isConnected(),
  });
  registerDocsTools(mcpServer);
  registerBrowserTools(mcpServer, ensureDebugClient);
  registerModelTools(mcpServer);

  const externalTools = createExternalToolsRegistry(mcpServer, assetsDir);
  externalTools.registerEnvTools();

  // --- Streamable HTTP Transport Setup ---

  const transports = new Map<string, StreamableHTTPServerTransport>();

  const getHeaderValue = (req: Request, headerName: string): string | undefined => {
    const value = req.headers[headerName.toLowerCase()];
    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    }
    if (Array.isArray(value)) {
      const entry = value.find((item) => item.trim().length > 0);
      return entry ? entry.trim() : undefined;
    }
    return undefined;
  };

  const getSessionKeysFromRequest = (req: Request): ExternalToolSessionKeys => {
    const elevenLabsApiKey = getHeaderValue(req, "elevenlabs-api-key");
    const mashApiKey = getHeaderValue(req, "mash-api-key");

    return {
      ...(elevenLabsApiKey ? { elevenLabsApiKey } : {}),
      ...(mashApiKey ? { mashApiKey } : {}),
    };
  };

  const hasSessionKeys = (keys: ExternalToolSessionKeys): boolean =>
    Boolean(keys.elevenLabsApiKey || keys.mashApiKey);

  const attachSessionKeys = (sessionId: string, keys: ExternalToolSessionKeys): void => {
    if (hasSessionKeys(keys)) {
      externalTools.storeSessionKeys(sessionId, keys);
    }
  };

  const cleanupSession = (sessionId?: string): void => {
    if (!sessionId) {
      return;
    }
    transports.delete(sessionId);
    externalTools.clearSessionKeys(sessionId);
  };

  const getTransportForSession = (
    req: Request,
    res: Response,
  ): { sessionId: string; transport: StreamableHTTPServerTransport } | null => {
    const sessionId = getHeaderValue(req, "mcp-session-id");
    if (!sessionId) {
      res.status(400).send("Invalid or missing session ID");
      return null;
    }

    const transport = transports.get(sessionId);
    if (!transport) {
      res.status(404).send("Session not found");
      return null;
    }

    const requestKeys = getSessionKeysFromRequest(req);
    attachSessionKeys(sessionId, requestKeys);

    return { sessionId, transport };
  };

  const mcpPostHandler = async (req: Request, res: Response) => {
    const sessionId = getHeaderValue(req, "mcp-session-id");
    const requestKeys = getSessionKeysFromRequest(req);

    if (sessionId) {
      console.log(`Received MCP request for session: ${sessionId}`);
    } else {
      console.log("Request body:", req.body);
    }

    try {
      if (sessionId) {
        const transport = transports.get(sessionId);
        if (!transport) {
          res.status(404).json({
            jsonrpc: "2.0",
            error: {
              code: -32_000,
              message: "Session not found",
            },
            id: null,
          });
          return;
        }

        attachSessionKeys(sessionId, requestKeys);
        await transport.handleRequest(req, res, req.body);
        return;
      }

      if (!isInitializeRequest(req.body)) {
        res.status(400).json({
          jsonrpc: "2.0",
          error: {
            code: -32_000,
            message: "Bad Request: No valid session ID provided",
          },
          id: null,
        });
        return;
      }

      const pendingKeys = requestKeys;
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (newSessionId) => {
          console.log(`Session initialized with ID: ${newSessionId}`);
          transports.set(newSessionId, transport);
          attachSessionKeys(newSessionId, pendingKeys);
        },
        onsessionclosed: (closedSessionId) => {
          cleanupSession(closedSessionId);
        },
      });

      transport.onclose = () => {
        cleanupSession(transport.sessionId);
      };

      await mcpServer.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error("Error handling MCP request:", error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: {
            code: -32_603,
            message: "Internal server error",
          },
          id: null,
        });
      }
    }
  };

  const mcpGetHandler = async (req: Request, res: Response) => {
    const session = getTransportForSession(req, res);
    if (!session) {
      return;
    }

    try {
      await session.transport.handleRequest(req, res);
    } catch (error) {
      console.error("Error handling MCP stream:", error);
      if (!res.headersSent) {
        res.status(500).send("Internal server error");
      }
    }
  };

  const mcpDeleteHandler = async (req: Request, res: Response) => {
    const session = getTransportForSession(req, res);
    if (!session) {
      return;
    }

    try {
      await session.transport.handleRequest(req, res);
    } catch (error) {
      console.error("Error handling MCP session termination:", error);
      if (!res.headersSent) {
        res.status(500).send("Error processing session termination");
      }
    }
  };

  app.post("/mcp", mcpPostHandler);
  app.get("/mcp", mcpGetHandler);
  app.delete("/mcp", mcpDeleteHandler);

  console.log("MCP server registered at /mcp");

  return {
    close: async () => {
      console.log("MCP server shutting down...");

      // Close all active transports
      const closePromises: Promise<void>[] = [];
      for (const [sessionId, transport] of transports.entries()) {
        console.log(`Closing MCP session: ${sessionId}`);
        closePromises.push(transport.close().catch(() => {}));
        externalTools.clearSessionKeys(sessionId);
      }
      await Promise.all(closePromises);
      transports.clear();

      // Close the debug client if running
      if (debugClient) {
        try {
          await debugClient.close();
        } catch {
          // Ignore errors during cleanup
        }
        debugClient = null;
      }

      // Close the MCP server
      await mcpServer.close();

      console.log("MCP server shutdown complete");
    },
  };
}
