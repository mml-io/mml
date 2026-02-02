import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

type LogEntry = {
  timestamp: number;
  level: string;
  source: string;
  message: string;
  data?: unknown;
};

export interface CoreToolsOptions {
  getConnectedClients: () => Map<string, { id: string; connectedAt: number }>;
  getLogBuffer: () => LogEntry[];
  isDebugClientRunning: () => boolean;
}

export function registerCoreTools(mcpServer: McpServer, options: CoreToolsOptions): void {
  const { getConnectedClients, getLogBuffer, isDebugClientRunning } = options;

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
                debugClientRunning: isDebugClientRunning(),
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
}
