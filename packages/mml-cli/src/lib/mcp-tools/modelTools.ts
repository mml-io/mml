import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { describeModel } from "../../commands/describeModel";

export function registerModelTools(mcpServer: McpServer): void {
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
}
