/**
 * MCP (Model Context Protocol) server for the MML dev server.
 * Exposes debug API functionality as MCP tools for AI assistants.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { exec } from "child_process";
import type { Request, Response } from "express";
import fs from "fs";
import os from "os";
import path from "path";
import { promisify } from "util";
import { z } from "zod";

import { describeModel } from "../commands/describeModel";
import { type ClientLogEntry, createDebugSession, type DebugSession } from "./debugSession";

const execAsync = promisify(exec);

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

type ResolveTargetResult = { targetDir: string } | { error: string };

function resolveSubfolderTarget(baseDir: string, subfolder?: string): ResolveTargetResult {
  const resolvedBaseDir = path.resolve(baseDir);
  if (!subfolder) {
    return { targetDir: resolvedBaseDir };
  }

  const targetDirCandidate = path.resolve(resolvedBaseDir, subfolder);
  const relativePath = path.relative(resolvedBaseDir, targetDirCandidate);
  const isWithinBase =
    relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));

  if (!isWithinBase) {
    return { error: "Invalid subfolder path." };
  }

  return { targetDir: targetDirCandidate };
}

function toAssetsRelativePath(assetsDir: string, outputPath: string): string {
  const relativePath = path.relative(assetsDir, outputPath);
  const normalizedRelativePath = relativePath.split(path.sep).join("/");
  return `assets/${normalizedRelativePath}`;
}

/**
 * Register MCP server routes on the Express app at /mcp
 */
export function registerMcpServer(options: McpServerOptions): void {
  const { app, getConnectedClients, host, port, assetsDir, getLogBuffer, pushLogEntry } = options;
  const resolvedAssetsDir = path.resolve(assetsDir);

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

  // --- External Service Tools ---

  // Store API keys per session (captured from headers on SSE connection)
  const sessionElevenLabsApiKeys = new Map<string, string>();
  const sessionMashApiKeys = new Map<string, string>();

  let elevenLabsToolsRegistered = false;
  let mashToolsRegistered = false;

  // Helper to get API key for a session (falls back to env vars)
  function getElevenLabsApiKey(sessionId?: string): string {
    if (sessionId) {
      const sessionKey = sessionElevenLabsApiKeys.get(sessionId);
      if (sessionKey) {
        return sessionKey;
      }
    }
    return process.env.ELEVENLABS_API_KEY || "";
  }

  function getMashApiKey(sessionId?: string): string {
    if (sessionId) {
      const sessionKey = sessionMashApiKeys.get(sessionId);
      if (sessionKey) {
        return sessionKey;
      }
    }
    return process.env.MASH_API_KEY || "";
  }

  function registerElevenLabsTools(): void {
    if (elevenLabsToolsRegistered) {
      return;
    }
    elevenLabsToolsRegistered = true;

    // Search for sound effects
    mcpServer.registerTool(
      "search_sfx",
      {
        description:
          "Search for sound effects from ElevenLabs. Returns a list of matching sound effects with their generation IDs for download.",
        inputSchema: {
          query: z
            .string()
            .describe("Search query for sound effects (e.g., 'gunshot', 'explosion', 'footsteps')"),
          page: z.number().optional().describe("Page number for pagination (default: 1)"),
          pageSize: z
            .number()
            .optional()
            .describe("Number of results per page (default: 20, max: 100)"),
          loop: z.boolean().optional().describe("Filter for looping sounds only (default: false)"),
        },
      },
      async ({ query, page = 1, pageSize = 20, loop = false }, extra) => {
        try {
          const sessionId = extra?.sessionId;
          const apiKey = getElevenLabsApiKey(sessionId);
          if (!apiKey) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: "ElevenLabs API key not configured. Set ELEVENLABS_API_KEY environment variable, or pass elevenlabs-api-key header in MCP config.",
                },
              ],
              isError: true,
            };
          }

          const params = new URLSearchParams({
            sort: "trending_score_momentum_velocity",
            page_size: String(Math.min(pageSize, 100)),
            search: query,
            page: String(page),
            loop: String(loop),
            include_visual_waveforms: "false",
          });

          const response = await fetch(
            `https://api.us.elevenlabs.io/v1/shared-sound-generations?${params}`,
            {
              headers: {
                "elevenlabs-api-key": apiKey,
              },
            },
          );

          if (!response.ok) {
            const errorText = await response.text();
            return {
              content: [
                {
                  type: "text" as const,
                  text: `ElevenLabs API error: ${response.status} ${response.statusText}\n${errorText}`,
                },
              ],
              isError: true,
            };
          }

          const data = (await response.json()) as {
            shared_sound_generations: Array<{
              generation_id: string;
              text: string;
              category: string;
              labels: Record<string, unknown>;
              preview_url: string;
              audio_duration_seconds: number;
              like_count: number;
              purchased_count: number;
            }>;
          };

          // Sanitize the response to include only useful fields
          const results = data.shared_sound_generations.map((sfx) => ({
            generation_id: sfx.generation_id,
            description: sfx.text,
            category: sfx.category,
            duration_seconds: sfx.audio_duration_seconds,
            is_loop: sfx.labels?.loop === true,
            preview_url: sfx.preview_url,
            popularity: sfx.like_count + sfx.purchased_count,
          }));

          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    query,
                    page,
                    pageSize,
                    resultCount: results.length,
                    results,
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        } catch (err) {
          return {
            content: [{ type: "text" as const, text: `Search SFX failed: ${String(err)}` }],
            isError: true,
          };
        }
      },
    );

    // Download a sound effect
    mcpServer.registerTool(
      "download_sfx",
      {
        description:
          "Download a sound effect from ElevenLabs by generation ID and save it to the project's assets folder. Returns the relative path to the downloaded file.",
        inputSchema: {
          generation_id: z.string().describe("The generation ID of the sound effect to download"),
          filename: z
            .string()
            .optional()
            .describe(
              "Optional filename (without extension). If not provided, uses the generation ID.",
            ),
          subfolder: z
            .string()
            .optional()
            .describe("Optional subfolder within assets (e.g., 'sfx' or 'audio/effects')"),
          format: z
            .enum(["mp3", "wav", "ogg"])
            .optional()
            .describe("Audio format to save as (default: mp3)"),
        },
      },
      async ({ generation_id, filename, subfolder, format = "mp3" }, extra) => {
        try {
          const sessionId = extra?.sessionId;
          const apiKey = getElevenLabsApiKey(sessionId);
          if (!apiKey) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: "ElevenLabs API key not configured. Set ELEVENLABS_API_KEY environment variable, or pass elevenlabs-api-key header in MCP config.",
                },
              ],
              isError: true,
            };
          }

          // Call the purchase/download endpoint
          const response = await fetch(
            `https://api.us.elevenlabs.io/v1/shared-sound-generations/${generation_id}/purchase`,
            {
              method: "POST",
              headers: {
                "elevenlabs-api-key": apiKey,
              },
            },
          );

          if (!response.ok) {
            const errorText = await response.text();
            return {
              content: [
                {
                  type: "text" as const,
                  text: `ElevenLabs download error: ${response.status} ${response.statusText}\n${errorText}`,
                },
              ],
              isError: true,
            };
          }

          // Get the audio data
          const audioBuffer = Buffer.from(await response.arrayBuffer());

          // Determine the output path
          const baseFilename = filename || generation_id;
          const safeFilename = baseFilename.replace(/[^a-zA-Z0-9_-]/g, "_");
          const fullFilename = `${safeFilename}.${format}`;

          // Build the target directory
          const targetDirResult = resolveSubfolderTarget(resolvedAssetsDir, subfolder);
          if ("error" in targetDirResult) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: "Download SFX error: Invalid subfolder path.",
                },
              ],
              isError: true,
            };
          }
          const targetDir = targetDirResult.targetDir;

          // Ensure target directory exists
          await fs.promises.mkdir(targetDir, { recursive: true });

          // Write the file
          const outputPath = path.join(targetDir, fullFilename);
          await fs.promises.writeFile(outputPath, audioBuffer);

          // Calculate relative path from assets dir for return
          const assetsRelativePath = toAssetsRelativePath(resolvedAssetsDir, outputPath);

          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    status: "complete",
                    generation_id,
                    filename: fullFilename,
                    format,
                    relativePath: assetsRelativePath,
                    absolutePath: outputPath,
                    size: audioBuffer.length,
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        } catch (err) {
          return {
            content: [{ type: "text" as const, text: `Download SFX failed: ${String(err)}` }],
            isError: true,
          };
        }
      },
    );

    // --- ElevenLabs Music Tools ---

    // Search for music
    mcpServer.registerTool(
      "search_music",
      {
        description:
          "Search for music tracks from ElevenLabs. Returns a list of matching songs with their IDs for download.",
        inputSchema: {
          query: z
            .string()
            .describe("Search query for music (e.g., 'zombie game dark evil', 'upbeat adventure')"),
          vocals: z
            .enum(["yes", "no", "any"])
            .optional()
            .describe(
              "Filter by vocals: 'yes' for with vocals, 'no' for instrumental, 'any' for both (default: any)",
            ),
          pageSize: z
            .number()
            .optional()
            .describe("Number of results per page (default: 20, max: 100)"),
        },
      },
      async ({ query, vocals, pageSize = 20 }, extra) => {
        try {
          const sessionId = extra?.sessionId;
          const apiKey = getElevenLabsApiKey(sessionId);
          if (!apiKey) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: "ElevenLabs API key not configured. Set ELEVENLABS_API_KEY environment variable, or pass elevenlabs-api-key header in MCP config.",
                },
              ],
              isError: true,
            };
          }

          const params = new URLSearchParams({
            search: query,
            page_size: String(Math.min(pageSize, 100)),
          });

          if (vocals && vocals !== "any") {
            params.set("vocals", vocals);
          }

          const response = await fetch(
            `https://api.us.elevenlabs.io/v1/music/explore/songs?${params}`,
            {
              headers: {
                "elevenlabs-api-key": apiKey,
              },
            },
          );

          if (!response.ok) {
            const errorText = await response.text();
            return {
              content: [
                {
                  type: "text" as const,
                  text: `ElevenLabs API error: ${response.status} ${response.statusText}\n${errorText}`,
                },
              ],
              isError: true,
            };
          }

          const data = (await response.json()) as {
            songs: Array<{
              id: string;
              title: string;
              description: string;
              vocals: string;
              duration_ms: number;
              bpm: number;
              seo_tags: string[];
              public_audio_url: string;
              artwork_url_small: string;
              play_count: number;
              download_count: number;
              like_count: number;
              sections: Array<{
                section_name: string;
                duration_ms: number;
              }>;
            }>;
          };

          // Sanitize the response to include only useful fields
          const results = data.songs.map((song) => {
            // Calculate section start times
            let currentTime = 0;
            const sectionsWithTimes = (song.sections || []).map((section) => {
              const start = currentTime;
              currentTime += section.duration_ms;
              return {
                name: section.section_name,
                start_ms: start,
                duration_ms: section.duration_ms,
              };
            });

            return {
              id: song.id,
              title: song.title,
              description: song.description,
              vocals: song.vocals,
              duration_seconds: Math.round(song.duration_ms / 1000),
              bpm: song.bpm,
              tags: song.seo_tags,
              preview_url: song.public_audio_url,
              artwork_url: song.artwork_url_small,
              popularity: song.play_count + song.download_count + song.like_count,
              sections: sectionsWithTimes,
            };
          });

          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    query,
                    vocals: vocals || "any",
                    resultCount: results.length,
                    results,
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        } catch (err) {
          return {
            content: [{ type: "text" as const, text: `Search music failed: ${String(err)}` }],
            isError: true,
          };
        }
      },
    );

    // Download music
    mcpServer.registerTool(
      "download_music",
      {
        description:
          "Download a music track from ElevenLabs using the public_audio_url from search results and save it to the project's assets folder. Optionally extract specific sections and make them loopable. Returns the relative path to the downloaded file.",
        inputSchema: {
          url: z.string().describe("The public_audio_url from the search results to download"),
          filename: z.string().describe("Filename to save as (without extension)"),
          subfolder: z
            .string()
            .optional()
            .describe("Optional subfolder within assets (e.g., 'music' or 'audio/music')"),
          sections: z
            .array(
              z.object({
                name: z.string().describe("Section name (e.g., 'Main Beat')"),
                start_ms: z.number().describe("Start time in milliseconds"),
                duration_ms: z.number().describe("Duration in milliseconds"),
              }),
            )
            .optional()
            .describe(
              "Optional array of sections to extract. If provided, only these sections will be included and the audio will be made loopable with crossfade.",
            ),
          crossfade_ms: z
            .number()
            .optional()
            .describe("Crossfade duration in milliseconds for looping (default: 100ms)"),
        },
      },
      async ({ url, filename, subfolder, sections, crossfade_ms = 100 }) => {
        try {
          let parsedUrl: URL;
          try {
            parsedUrl = new URL(url);
          } catch {
            return {
              content: [
                {
                  type: "text" as const,
                  text: "Download error: Invalid URL format.",
                },
              ],
              isError: true,
            };
          }

          const hostname = parsedUrl.hostname.toLowerCase();
          const isAllowedHost = hostname === "elevenlabs.io" || hostname.endsWith(".elevenlabs.io");
          if (parsedUrl.protocol !== "https:" || !isAllowedHost) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: "Download error: URL must use HTTPS and point to an ElevenLabs domain.",
                },
              ],
              isError: true,
            };
          }

          // Download from the public URL (no API key needed)
          const response = await fetch(parsedUrl.toString());

          if (!response.ok) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Download error: ${response.status} ${response.statusText}`,
                },
              ],
              isError: true,
            };
          }

          // Get the audio data
          const audioBuffer = Buffer.from(await response.arrayBuffer());

          // Determine file extension from URL
          let inputExtension = "mp3";
          const urlPath = parsedUrl.pathname.toLowerCase();
          if (urlPath.endsWith(".mp4")) {
            inputExtension = "mp4";
          } else if (urlPath.endsWith(".wav")) {
            inputExtension = "wav";
          } else if (urlPath.endsWith(".ogg")) {
            inputExtension = "ogg";
          }

          // Build the target directory
          const targetDirResult = resolveSubfolderTarget(resolvedAssetsDir, subfolder);
          if ("error" in targetDirResult) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: "Download error: Invalid subfolder path.",
                },
              ],
              isError: true,
            };
          }
          const targetDir = targetDirResult.targetDir;
          await fs.promises.mkdir(targetDir, { recursive: true });

          const safeFilename = filename.replace(/[^a-zA-Z0-9_-]/g, "_");
          let outputPath: string;
          let finalSize: number;

          if (sections && sections.length > 0) {
            // Process with ffmpeg to extract sections and make loopable
            const tempDir = os.tmpdir();
            const tempInput = path.join(tempDir, `mml_music_${Date.now()}_input.${inputExtension}`);
            const tempOutput = path.join(tempDir, `mml_music_${Date.now()}_output.mp3`);

            // Write input file
            await fs.promises.writeFile(tempInput, audioBuffer);

            try {
              const crossfadeSec = crossfade_ms / 1000;

              if (sections.length === 1) {
                // Single section: extract and apply crossfade for seamless loop
                const section = sections[0];
                const startSec = section.start_ms / 1000;
                const durationSec = section.duration_ms / 1000;

                // Extract section with crossfade at the end for looping
                // Use acrossfade to blend the end with the beginning
                const ffmpegCmd = `ffmpeg -y -i "${tempInput}" -ss ${startSec} -t ${durationSec} -af "afade=t=in:st=0:d=${crossfadeSec},afade=t=out:st=${durationSec - crossfadeSec}:d=${crossfadeSec}" -acodec libmp3lame -q:a 2 "${tempOutput}"`;

                await execAsync(ffmpegCmd);
              } else {
                // Multiple sections: concatenate them with crossfades between
                // First extract each section to temp files
                const sectionFiles: string[] = [];

                for (let i = 0; i < sections.length; i++) {
                  const section = sections[i];
                  const startSec = section.start_ms / 1000;
                  const durationSec = section.duration_ms / 1000;
                  const sectionFile = path.join(
                    tempDir,
                    `mml_music_${Date.now()}_section_${i}.mp3`,
                  );
                  sectionFiles.push(sectionFile);

                  const extractCmd = `ffmpeg -y -i "${tempInput}" -ss ${startSec} -t ${durationSec} -acodec libmp3lame -q:a 2 "${sectionFile}"`;
                  await execAsync(extractCmd);
                }

                // Concatenate with crossfades
                // Build complex filter for acrossfade between sections
                let currentInput = sectionFiles[0];
                for (let i = 1; i < sectionFiles.length; i++) {
                  const nextFile = sectionFiles[i];
                  const crossfadedOutput = path.join(
                    tempDir,
                    `mml_music_${Date.now()}_crossfaded_${i}.mp3`,
                  );

                  const crossfadeCmd = `ffmpeg -y -i "${currentInput}" -i "${nextFile}" -filter_complex "acrossfade=d=${crossfadeSec}:c1=tri:c2=tri" -acodec libmp3lame -q:a 2 "${crossfadedOutput}"`;
                  await execAsync(crossfadeCmd);

                  // Clean up previous temp file if it's not original
                  if (i > 1) {
                    await fs.promises.unlink(currentInput).catch(() => {});
                  }
                  currentInput = crossfadedOutput;
                }

                // Apply fade in/out for loopability
                const finalDuration = (
                  await execAsync(
                    `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${currentInput}"`,
                  )
                ).stdout.trim();
                const durationNum = parseFloat(finalDuration);

                const loopCmd = `ffmpeg -y -i "${currentInput}" -af "afade=t=in:st=0:d=${crossfadeSec},afade=t=out:st=${durationNum - crossfadeSec}:d=${crossfadeSec}" -acodec libmp3lame -q:a 2 "${tempOutput}"`;
                await execAsync(loopCmd);

                // Clean up section files
                for (const file of sectionFiles) {
                  await fs.promises.unlink(file).catch(() => {});
                }
                await fs.promises.unlink(currentInput).catch(() => {});
              }

              // Read the processed output and write to target
              const processedBuffer = await fs.promises.readFile(tempOutput);
              outputPath = path.join(targetDir, `${safeFilename}.mp3`);
              await fs.promises.writeFile(outputPath, processedBuffer);
              finalSize = processedBuffer.length;

              // Clean up temp files
              await fs.promises.unlink(tempInput).catch(() => {});
              await fs.promises.unlink(tempOutput).catch(() => {});
            } catch (ffmpegError) {
              // Clean up temp files on error
              await fs.promises.unlink(tempInput).catch(() => {});

              return {
                content: [
                  {
                    type: "text" as const,
                    text: `FFmpeg processing failed. Make sure ffmpeg is installed.\nError: ${String(ffmpegError)}`,
                  },
                ],
                isError: true,
              };
            }
          } else {
            // No sections specified - just save the file as-is
            outputPath = path.join(targetDir, `${safeFilename}.${inputExtension}`);
            await fs.promises.writeFile(outputPath, audioBuffer);
            finalSize = audioBuffer.length;
          }

          // Calculate relative path from assets dir for return
          const assetsRelativePath = toAssetsRelativePath(resolvedAssetsDir, outputPath);

          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    status: "complete",
                    url,
                    filename: path.basename(outputPath),
                    relativePath: assetsRelativePath,
                    absolutePath: outputPath,
                    size: finalSize,
                    sectionsExtracted: sections ? sections.map((s) => s.name) : null,
                    loopable: sections && sections.length > 0,
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        } catch (err) {
          return {
            content: [{ type: "text" as const, text: `Download music failed: ${String(err)}` }],
            isError: true,
          };
        }
      },
    );
  }

  // --- Mash 3D Model Tools ---
  function registerMashTools(): void {
    if (mashToolsRegistered) {
      return;
    }
    mashToolsRegistered = true;

    // Search for 3D models
    mcpServer.registerTool(
      "search_models",
      {
        description:
          "Search for 3D models from Mash. Returns a list of matching models for download.",
        inputSchema: {
          prompt: z.string().describe("Search prompt (e.g., 'sci-fi crate', 'robot character')"),
          k: z
            .number()
            .int()
            .min(1)
            .max(15)
            .optional()
            .describe("Number of results to return (default: 3, max: 15)"),
          categories: z
            .array(z.enum(["character", "object"]))
            .optional()
            .describe("Filter by model categories"),
        },
      },
      async ({ prompt, k, categories }, extra) => {
        try {
          const sessionId = extra?.sessionId;
          const apiKey = getMashApiKey(sessionId);
          if (!apiKey) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: "Mash API key not configured. Set MASH_API_KEY environment variable, or pass mash-api-key header in MCP config.",
                },
              ],
              isError: true,
            };
          }

          const resultLimit = Math.min(Math.max(k ?? 3, 1), 15);
          const query = {
            prompt,
            k: resultLimit,
            ...(categories && categories.length > 0 ? { categories } : {}),
          };

          const response = await fetch("https://mash.space/api/search", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "mash-api-key": apiKey,
            },
            body: JSON.stringify({ queries: [query] }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Mash search error: ${response.status} ${response.statusText}\n${errorText}`,
                },
              ],
              isError: true,
            };
          }

          const data = (await response.json()) as unknown;

          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    query,
                    results: data,
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        } catch (err) {
          return {
            content: [{ type: "text" as const, text: `Search models failed: ${String(err)}` }],
            isError: true,
          };
        }
      },
    );

    // Download a 3D model
    mcpServer.registerTool(
      "download_model",
      {
        description:
          "Download a 3D model by ID and save it to the project's assets/models folder. Returns the relative path to the downloaded file.",
        inputSchema: {
          id: z.string().describe("The model ID to download"),
          filename: z
            .string()
            .optional()
            .describe("Optional filename (without extension). If not provided, uses the model ID."),
          subfolder: z
            .string()
            .optional()
            .describe("Optional subfolder within assets/models (e.g., 'characters')"),
        },
      },
      async ({ id, filename, subfolder }, extra) => {
        try {
          const sessionId = extra?.sessionId;
          const apiKey = getMashApiKey(sessionId);
          if (!apiKey) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: "Mash API key not configured. Set MASH_API_KEY environment variable, or pass mash-api-key header in MCP config.",
                },
              ],
              isError: true,
            };
          }

          const downloadResponse = await fetch(
            `https://mash.space/api/data/${encodeURIComponent(id)}/download`,
            {
              headers: {
                "mash-api-key": apiKey,
              },
            },
          );

          if (!downloadResponse.ok) {
            const errorText = await downloadResponse.text();
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Mash download error: ${downloadResponse.status} ${downloadResponse.statusText}\n${errorText}`,
                },
              ],
              isError: true,
            };
          }

          const downloadData = (await downloadResponse.json()) as { url?: string };
          if (!downloadData.url) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: "Mash download error: Missing signed URL in response.",
                },
              ],
              isError: true,
            };
          }

          const modelResponse = await fetch(downloadData.url);
          if (!modelResponse.ok) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Model download error: ${modelResponse.status} ${modelResponse.statusText}`,
                },
              ],
              isError: true,
            };
          }

          const modelBuffer = Buffer.from(await modelResponse.arrayBuffer());

          let extension = ".glb";
          try {
            const parsedUrl = new URL(downloadData.url);
            const urlExtension = path.extname(parsedUrl.pathname);
            if (urlExtension) {
              extension = urlExtension;
            }
          } catch {
            // Fallback to .glb if URL parsing fails
          }

          const baseFilename = filename || id;
          const safeFilename = baseFilename.replace(/[^a-zA-Z0-9_-]/g, "_");
          const fullFilename = `${safeFilename}${extension}`;

          const baseModelsDir = path.resolve(resolvedAssetsDir, "models");
          const targetDirResult = resolveSubfolderTarget(baseModelsDir, subfolder);
          if ("error" in targetDirResult) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: "Model download error: Invalid subfolder path.",
                },
              ],
              isError: true,
            };
          }
          const targetDir = targetDirResult.targetDir;

          await fs.promises.mkdir(targetDir, { recursive: true });

          const outputPath = path.join(targetDir, fullFilename);
          await fs.promises.writeFile(outputPath, modelBuffer);

          const assetsRelativePath = toAssetsRelativePath(resolvedAssetsDir, outputPath);

          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    status: "complete",
                    id,
                    filename: fullFilename,
                    relativePath: assetsRelativePath,
                    absolutePath: outputPath,
                    size: modelBuffer.length,
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        } catch (err) {
          return {
            content: [{ type: "text" as const, text: `Download model failed: ${String(err)}` }],
            isError: true,
          };
        }
      },
    );
  }

  if (process.env.ELEVENLABS_API_KEY) {
    registerElevenLabsTools();
  }

  if (process.env.MASH_API_KEY) {
    registerMashTools();
  }

  // --- SSE Transport Setup ---

  // Store transports by session ID for message routing
  const transports = new Map<string, SSEServerTransport>();

  // SSE endpoint for MCP
  app.get("/mcp/sse", async (req: Request, res: Response) => {
    console.log("MCP: SSE connection established");

    const transport = new SSEServerTransport("/mcp/messages", res);
    const sessionId = transport.sessionId;
    transports.set(sessionId, transport);

    // Capture API keys from headers if provided
    const elevenLabsApiKey = (req.headers["elevenlabs-api-key"] as string) || "";
    if (elevenLabsApiKey) {
      sessionElevenLabsApiKeys.set(sessionId, elevenLabsApiKey);
      registerElevenLabsTools();
      console.log(`MCP: Captured ElevenLabs API key for session ${sessionId}`);
    }

    const mashApiKey = (req.headers["mash-api-key"] as string) || "";
    if (mashApiKey) {
      sessionMashApiKeys.set(sessionId, mashApiKey);
      registerMashTools();
      console.log(`MCP: Captured Mash API key for session ${sessionId}`);
    }

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
      sessionElevenLabsApiKeys.delete(sessionId);
      sessionMashApiKeys.delete(sessionId);
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
