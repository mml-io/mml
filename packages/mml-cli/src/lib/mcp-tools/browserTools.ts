import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { DebugSession } from "../debugSession";

export type EnsureDebugClient = () => Promise<DebugSession>;

export function registerBrowserTools(
  mcpServer: McpServer,
  ensureDebugClient: EnsureDebugClient,
): void {
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
}
