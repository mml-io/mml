import { exec } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { promisify } from "util";
import type { Argv } from "yargs";

import { DEFAULT_ASSETS_DIR } from "../config/defaults";

const execAsync = promisify(exec);

interface SearchMusicArgs {
  query: string;
  vocals?: "yes" | "no" | "any";
  pageSize?: number;
}

interface Section {
  name: string;
  start_ms: number;
  duration_ms: number;
}

interface DownloadMusicArgs {
  url: string;
  output: string;
  subfolder?: string;
  assets?: string;
  sections?: string;
  crossfade?: number;
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

async function searchMusic(argv: SearchMusicArgs): Promise<void> {
  const apiKey = getApiKey();

  const params = new URLSearchParams({
    search: argv.query,
    page_size: String(Math.min(argv.pageSize || 20, 100)),
  });

  if (argv.vocals && argv.vocals !== "any") {
    params.set("vocals", argv.vocals);
  }

  console.log(`Searching for "${argv.query}"...`);

  const response = await fetch(`https://api.us.elevenlabs.io/v1/music/explore/songs?${params}`, {
    headers: {
      "elevenlabs-api-key": apiKey,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `ElevenLabs API error: ${response.status} ${response.statusText}\n${errorText}`,
    );
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
      play_count: number;
      download_count: number;
      like_count: number;
      sections: Array<{
        section_name: string;
        duration_ms: number;
      }>;
    }>;
  };

  if (data.songs.length === 0) {
    console.log("No results found.");
    return;
  }

  console.log(`\nFound ${data.songs.length} results:\n`);

  for (const song of data.songs) {
    const duration = Math.round(song.duration_ms / 1000);
    const mins = Math.floor(duration / 60);
    const secs = duration % 60;
    const durationStr = `${mins}:${secs.toString().padStart(2, "0")}`;
    const vocalsLabel = song.vocals === "no" ? " [INSTRUMENTAL]" : "";
    const popularity = song.play_count + song.download_count + song.like_count;

    console.log(`ID: ${song.id}`);
    console.log(`  Title: ${song.title}${vocalsLabel}`);
    console.log(
      `  Description: ${song.description.slice(0, 120)}${song.description.length > 120 ? "..." : ""}`,
    );
    console.log(`  Duration: ${durationStr} | BPM: ${song.bpm} | Popularity: ${popularity}`);

    // Show sections with timing info
    if (song.sections && song.sections.length > 0) {
      let currentTime = 0;
      const sectionsInfo = song.sections.map((s) => {
        const startSec = currentTime / 1000;
        const durSec = s.duration_ms / 1000;
        currentTime += s.duration_ms;
        return `${s.section_name} (${startSec.toFixed(1)}s-${(startSec + durSec).toFixed(1)}s)`;
      });
      console.log(`  Sections: ${sectionsInfo.join(", ")}`);
    }

    if (song.seo_tags && song.seo_tags.length > 0) {
      console.log(`  Tags: ${song.seo_tags.slice(0, 5).join(", ")}`);
    }
    console.log(`  Preview: ${song.public_audio_url}`);
    console.log("");
  }

  console.log(`\nTo download full track:`);
  console.log(`  mml music download --url <public_audio_url> --output <filename>`);
  console.log(`\nTo extract specific sections as loopable audio:`);
  console.log(
    `  mml music download --url <url> --output <filename> --sections "Main Beat:15000:30000"`,
  );
  console.log(`  Format: "SectionName:start_ms:duration_ms" (comma-separated for multiple)`);
}

async function downloadMusic(argv: DownloadMusicArgs): Promise<void> {
  console.log(`Downloading music from ${argv.url}...`);

  const response = await fetch(argv.url);

  if (!response.ok) {
    throw new Error(`Download error: ${response.status} ${response.statusText}`);
  }

  // Get the audio data
  const audioBuffer = Buffer.from(await response.arrayBuffer());

  // Determine file extension from URL
  let inputExtension = "mp3";
  if (argv.url.includes(".mp4")) {
    inputExtension = "mp4";
  } else if (argv.url.includes(".wav")) {
    inputExtension = "wav";
  } else if (argv.url.includes(".ogg")) {
    inputExtension = "ogg";
  }

  // Build the target directory
  const assetsDir = path.resolve(process.cwd(), argv.assets || DEFAULT_ASSETS_DIR);
  let targetDir = assetsDir;
  if (argv.subfolder) {
    const safeSubfolder = argv.subfolder.replace(/\.\./g, "").replace(/^\/+/, "");
    targetDir = path.join(assetsDir, safeSubfolder);
  }
  await fs.promises.mkdir(targetDir, { recursive: true });

  const safeFilename = argv.output.replace(/[^a-zA-Z0-9_-]/g, "_");
  let outputPath: string;
  let finalSize: number;

  // Parse sections if provided
  let sections: Section[] | undefined;
  if (argv.sections) {
    sections = argv.sections.split(",").map((s) => {
      const parts = s.trim().split(":");
      if (parts.length !== 3) {
        throw new Error(
          `Invalid section format: "${s}". Expected "SectionName:start_ms:duration_ms"`,
        );
      }
      const start_ms = Number.parseInt(parts[1], 10);
      const duration_ms = Number.parseInt(parts[2], 10);
      if (
        !Number.isFinite(start_ms) ||
        start_ms < 0 ||
        !Number.isFinite(duration_ms) ||
        duration_ms < 0
      ) {
        throw new Error(
          `Invalid section timing in "${s}". "start_ms" and "duration_ms" must be non-negative integers (milliseconds).`,
        );
      }
      return {
        name: parts[0],
        start_ms,
        duration_ms,
      };
    });
  }

  if (sections && sections.length > 0) {
    console.log(`Extracting sections: ${sections.map((s) => s.name).join(", ")}`);
    console.log(`Making loopable with ${argv.crossfade || 100}ms crossfade...`);

    // Process with ffmpeg to extract sections and make loopable
    const tempDir = os.tmpdir();
    const tempInput = path.join(tempDir, `mml_music_${Date.now()}_input.${inputExtension}`);
    const tempOutput = path.join(tempDir, `mml_music_${Date.now()}_output.mp3`);

    // Write input file
    await fs.promises.writeFile(tempInput, audioBuffer);

    try {
      const crossfadeSec = (argv.crossfade || 100) / 1000;

      if (sections.length === 1) {
        // Single section: extract and apply crossfade for seamless loop
        const section = sections[0];
        const startSec = section.start_ms / 1000;
        const durationSec = section.duration_ms / 1000;

        // Extract section with crossfade at the end for looping
        const ffmpegCmd = `ffmpeg -y -i "${tempInput}" -ss ${startSec} -t ${durationSec} -af "afade=t=in:st=0:d=${crossfadeSec},afade=t=out:st=${durationSec - crossfadeSec}:d=${crossfadeSec}" -acodec libmp3lame -q:a 2 "${tempOutput}"`;

        await execAsync(ffmpegCmd);
      } else {
        // Multiple sections: concatenate them with crossfades between
        const sectionFiles: string[] = [];

        for (let i = 0; i < sections.length; i++) {
          const section = sections[i];
          const startSec = section.start_ms / 1000;
          const durationSec = section.duration_ms / 1000;
          const sectionFile = path.join(tempDir, `mml_music_${Date.now()}_section_${i}.mp3`);
          sectionFiles.push(sectionFile);

          const extractCmd = `ffmpeg -y -i "${tempInput}" -ss ${startSec} -t ${durationSec} -acodec libmp3lame -q:a 2 "${sectionFile}"`;
          await execAsync(extractCmd);
        }

        // Concatenate with crossfades
        let currentInput = sectionFiles[0];
        for (let i = 1; i < sectionFiles.length; i++) {
          const nextFile = sectionFiles[i];
          const crossfadedOutput = path.join(
            tempDir,
            `mml_music_${Date.now()}_crossfaded_${i}.mp3`,
          );

          const crossfadeCmd = `ffmpeg -y -i "${currentInput}" -i "${nextFile}" -filter_complex "acrossfade=d=${crossfadeSec}:c1=tri:c2=tri" -acodec libmp3lame -q:a 2 "${crossfadedOutput}"`;
          await execAsync(crossfadeCmd);

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
      throw new Error(
        `FFmpeg processing failed. Make sure ffmpeg is installed.\nError: ${String(ffmpegError)}`,
      );
    }
  } else {
    // No sections specified - just save the file as-is
    outputPath = path.join(targetDir, `${safeFilename}.${inputExtension}`);
    await fs.promises.writeFile(outputPath, audioBuffer);
    finalSize = audioBuffer.length;
  }

  // Calculate relative path from cwd
  const relativePath = path.relative(process.cwd(), outputPath);

  console.log(`\nDownload complete!`);
  console.log(`  File: ${relativePath}`);
  console.log(`  Size: ${(finalSize / 1024 / 1024).toFixed(2)} MB`);
  if (sections && sections.length > 0) {
    console.log(`  Sections: ${sections.map((s) => s.name).join(", ")}`);
    console.log(`  Loopable: Yes`);
  }
}

export function registerMusicCommand(yargs: Argv): Argv {
  return yargs.command("music", "Search and download music from ElevenLabs", (command) =>
    command
      .command(
        "search <query>",
        "Search for music tracks",
        (searchCmd) =>
          searchCmd
            .positional("query", {
              type: "string",
              describe: "Search query (e.g., 'zombie game dark', 'upbeat adventure')",
              demandOption: true,
            })
            .option("vocals", {
              type: "string",
              choices: ["yes", "no", "any"] as const,
              default: "any",
              describe: "Filter by vocals: yes, no (instrumental), or any",
            })
            .option("page-size", {
              type: "number",
              default: 20,
              describe: "Number of results per page (max 100)",
            }),
        async (args) => {
          await searchMusic({
            query: args.query as string,
            vocals: args.vocals as "yes" | "no" | "any",
            pageSize: args.pageSize,
          });
        },
      )
      .command(
        "download",
        "Download a music track from its public URL",
        (downloadCmd) =>
          downloadCmd
            .option("url", {
              type: "string",
              describe: "The public_audio_url from search results",
              demandOption: true,
            })
            .option("output", {
              type: "string",
              describe: "Output filename (without extension)",
              demandOption: true,
            })
            .option("subfolder", {
              type: "string",
              describe: "Subfolder within assets (e.g., 'music' or 'audio/music')",
            })
            .option("sections", {
              type: "string",
              describe:
                'Sections to extract as loopable audio. Format: "Name:start_ms:duration_ms" (comma-separated for multiple)',
            })
            .option("crossfade", {
              type: "number",
              default: 100,
              describe: "Crossfade duration in ms for looping (default: 100)",
            })
            .option("assets", {
              type: "string",
              default: DEFAULT_ASSETS_DIR,
              describe: "Assets directory path",
            }),
        async (args) => {
          await downloadMusic({
            url: args.url,
            output: args.output,
            subfolder: args.subfolder,
            sections: args.sections,
            crossfade: args.crossfade,
            assets: args.assets,
          });
        },
      )
      .demandCommand(1, "Please specify a subcommand: search or download"),
  );
}
