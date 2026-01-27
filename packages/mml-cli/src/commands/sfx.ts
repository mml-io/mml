import fs from "fs";
import path from "path";
import type { Argv } from "yargs";

import { DEFAULT_ASSETS_DIR } from "../config/defaults";

interface SearchSfxArgs {
  query: string;
  page?: number;
  pageSize?: number;
  loop?: boolean;
}

interface DownloadSfxArgs {
  id: string;
  output?: string;
  subfolder?: string;
  format?: "mp3" | "wav" | "ogg";
  assets?: string;
}

function getApiKey(): string {
  const key = process.env.ELEVENLABS_API_KEY || "";
  if (!key) {
    throw new Error(
      "ElevenLabs API key not configured. Set ELEVENLABS_API_KEY environment variable.",
    );
  }
  return key;
}

async function searchSfx(argv: SearchSfxArgs): Promise<void> {
  const apiKey = getApiKey();

  const params = new URLSearchParams({
    sort: "trending_score_momentum_velocity",
    page_size: String(Math.min(argv.pageSize || 20, 100)),
    search: argv.query,
    page: String(argv.page || 1),
    loop: String(argv.loop || false),
    include_visual_waveforms: "false",
  });

  console.log(`Searching for "${argv.query}"...`);

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
    throw new Error(
      `ElevenLabs API error: ${response.status} ${response.statusText}\n${errorText}`,
    );
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

  if (data.shared_sound_generations.length === 0) {
    console.log("No results found.");
    return;
  }

  console.log(`\nFound ${data.shared_sound_generations.length} results:\n`);

  for (const sfx of data.shared_sound_generations) {
    const duration = sfx.audio_duration_seconds.toFixed(1);
    const isLoop = sfx.labels?.loop ? " [LOOP]" : "";
    const popularity = sfx.like_count + sfx.purchased_count;

    console.log(`ID: ${sfx.generation_id}`);
    console.log(`  Description: ${sfx.text.slice(0, 100)}${sfx.text.length > 100 ? "..." : ""}`);
    console.log(
      `  Category: ${sfx.category} | Duration: ${duration}s | Popularity: ${popularity}${isLoop}`,
    );
    console.log(`  Preview: ${sfx.preview_url}`);
    console.log("");
  }

  console.log(`\nTo download: mml sfx download --id <generation_id>`);
}

async function downloadSfx(argv: DownloadSfxArgs): Promise<void> {
  const apiKey = getApiKey();

  console.log(`Downloading SFX ${argv.id}...`);

  const response = await fetch(
    `https://api.us.elevenlabs.io/v1/shared-sound-generations/${argv.id}/purchase`,
    {
      method: "POST",
      headers: {
        "elevenlabs-api-key": apiKey,
      },
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `ElevenLabs download error: ${response.status} ${response.statusText}\n${errorText}`,
    );
  }

  // Get the audio data
  const audioBuffer = Buffer.from(await response.arrayBuffer());

  // Determine the output path
  const format = argv.format || "mp3";
  const baseFilename = argv.output || argv.id;
  const safeFilename = baseFilename.replace(/[^a-zA-Z0-9_-]/g, "_");
  const fullFilename = `${safeFilename}.${format}`;

  // Build the target directory
  const assetsDir = path.resolve(process.cwd(), argv.assets || DEFAULT_ASSETS_DIR);
  let targetDir = assetsDir;
  if (argv.subfolder) {
    const safeSubfolder = argv.subfolder.replace(/\.\./g, "").replace(/^\/+/, "");
    targetDir = path.join(assetsDir, safeSubfolder);
  }

  // Ensure target directory exists
  await fs.promises.mkdir(targetDir, { recursive: true });

  // Write the file
  const outputPath = path.join(targetDir, fullFilename);
  await fs.promises.writeFile(outputPath, audioBuffer);

  // Calculate relative path from cwd
  const relativePath = path.relative(process.cwd(), outputPath);

  console.log(`\nDownload complete!`);
  console.log(`  File: ${relativePath}`);
  console.log(`  Size: ${(audioBuffer.length / 1024).toFixed(1)} KB`);
  console.log(`  Format: ${format}`);
}

export function registerSfxCommand(yargs: Argv): Argv {
  return yargs.command("sfx", "Search and download sound effects from ElevenLabs", (command) =>
    command
      .command(
        "search <query>",
        "Search for sound effects",
        (searchCmd) =>
          searchCmd
            .positional("query", {
              type: "string",
              describe: "Search query (e.g., 'gunshot', 'explosion', 'footsteps')",
              demandOption: true,
            })
            .option("page", {
              type: "number",
              default: 1,
              describe: "Page number for pagination",
            })
            .option("page-size", {
              type: "number",
              default: 20,
              describe: "Number of results per page (max 100)",
            })
            .option("loop", {
              type: "boolean",
              default: false,
              describe: "Filter for looping sounds only",
            }),
        async (args) => {
          await searchSfx({
            query: args.query as string,
            page: args.page,
            pageSize: args.pageSize,
            loop: args.loop,
          });
        },
      )
      .command(
        "download",
        "Download a sound effect by ID",
        (downloadCmd) =>
          downloadCmd
            .option("id", {
              type: "string",
              describe: "Generation ID of the sound effect to download",
              demandOption: true,
            })
            .option("output", {
              type: "string",
              describe: "Output filename (without extension)",
            })
            .option("subfolder", {
              type: "string",
              describe: "Subfolder within assets (e.g., 'sfx' or 'audio/effects')",
            })
            .option("format", {
              type: "string",
              choices: ["mp3", "wav", "ogg"] as const,
              default: "mp3",
              describe: "Audio format to save as",
            })
            .option("assets", {
              type: "string",
              default: DEFAULT_ASSETS_DIR,
              describe: "Assets directory path",
            }),
        async (args) => {
          await downloadSfx({
            id: args.id,
            output: args.output,
            subfolder: args.subfolder,
            format: args.format as "mp3" | "wav" | "ogg",
            assets: args.assets,
          });
        },
      )
      .demandCommand(1, "Please specify a subcommand: search or download"),
  );
}
