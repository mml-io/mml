import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { GameBuildOrchestrator } from "./GameBuildOrchestrator";
import { GameDirectoryScanner } from "./GameDirectoryScanner";
import { GameDirectoryWatcher } from "./GameDirectoryWatcher";
import { GameMMLDocumentManager } from "./GameMMLDocumentManager";
import { GameServer } from "./GameServer";

export interface MultiGameBuilderOptions {
  rootPath: string;
  assetsDirectory?: string;
  watchMode?: boolean;
  serverOptions?: {
    port?: number;
    host?: string;
    runnerUrl?: string;
    corsEnabled?: boolean;
    corsOrigins?: string | string[];
  };
}

export class MultiGameBuilder {
  private scanner: GameDirectoryScanner;
  private orchestrator: GameBuildOrchestrator;
  private watcher: GameDirectoryWatcher | null = null;
  private mmlDocumentManager: GameMMLDocumentManager;
  private server: GameServer | null = null;
  private options: MultiGameBuilderOptions;

  constructor(options: MultiGameBuilderOptions) {
    this.options = options;
    this.scanner = new GameDirectoryScanner(options.rootPath);
    this.orchestrator = new GameBuildOrchestrator(options.watchMode || false);
    this.mmlDocumentManager = new GameMMLDocumentManager();

    if (options.watchMode) {
      this.watcher = new GameDirectoryWatcher(
        options.rootPath,
        this.orchestrator,
        this.mmlDocumentManager,
      );
    }
  }

  /**
   * Starts the multi-game builder
   */
  async start(): Promise<void> {
    console.log(`Multi-Game Builder starting...`);
    console.log(`Root path: ${this.options.rootPath}`);
    console.log(`Mode: ${this.options.watchMode ? "watch" : "build"}`);

    if (this.options.watchMode) {
      await this.startWatchMode();
    } else {
      await this.startBuildMode();
    }

    // Start the server if server options are provided
    if (this.options.serverOptions) {
      await this.startServer();
    }
  }

  /**
   * Starts in watch mode - continuously watches for changes
   */
  private async startWatchMode(): Promise<void> {
    if (!this.watcher) {
      throw new Error("Watcher not initialized for watch mode");
    }

    console.log("Starting in watch mode...");
    await this.watcher.startWatching();
  }

  /**
   * Starts in build mode - builds all games once and exits
   */
  private async startBuildMode(): Promise<void> {
    console.log("Starting in build mode...");

    const games = this.scanner.scanForGames();
    if (games.length === 0) {
      console.log("No valid game directories found.");
      return;
    }

    const gameConfigs = games.map((game) => this.scanner.getGameConfig(game));
    await this.orchestrator.buildAllGames(gameConfigs);

    console.log("Build completed successfully!");
  }

  /**
   * Starts the game server
   */
  private async startServer(): Promise<void> {
    if (!this.options.serverOptions) {
      return;
    }

    console.log("🎮 Starting Game Server...");

    this.server = new GameServer({
      gamesDirectory: this.options.rootPath,
      assetsDirectory: this.options.assetsDirectory,
      port: this.options.serverOptions.port || 3000,
      host: this.options.serverOptions.host || "localhost",
      runnerUrl: this.options.serverOptions.runnerUrl || "http://localhost:3031",
      corsEnabled: this.options.serverOptions.corsEnabled !== false,
      corsOrigins: this.options.serverOptions.corsOrigins || "*",
      mmlDocumentManager: this.mmlDocumentManager,
    });

    await this.server.start();
  }

  /**
   * Stops the multi-game builder
   */
  async stop(): Promise<void> {
    console.log("Stopping Multi-Game Builder...");

    if (this.server) {
      console.log("Stopping Game Server...");
      await this.server.stop();
    }

    if (this.watcher) {
      await this.watcher.stopWatching();
    }

    await this.orchestrator.dispose();
    this.mmlDocumentManager.dispose();
    console.log("Multi-Game Builder stopped.");
  }

  /**
   * Gets information about the current state
   */
  getStatus(): { gameCount: number; activeGames: string[]; mode: string } {
    return {
      gameCount: this.watcher?.getCurrentGameCount() || 0,
      activeGames: this.watcher?.getCurrentGames() || [],
      mode: this.options.watchMode ? "watch" : "build",
    };
  }

  /**
   * Gets the MML document manager
   */
  getMMLDocumentManager(): GameMMLDocumentManager {
    return this.mmlDocumentManager;
  }
}

// CLI entry point when run as a standalone script
async function main() {
  const argv = await yargs(hideBin(process.argv))
    .parserConfiguration({
      "parse-numbers": false,
      "short-option-groups": true,
      "camel-case-expansion": false,
      "dot-notation": false,
      "duplicate-arguments-array": false,
      "flatten-duplicate-arrays": false,
      "negation-prefix": "no-",
      "populate--": false,
      "set-placeholder-key": false,
      "strip-aliased": false,
      "strip-dashed": false,
      "unknown-options-as-args": false,
    })
    .scriptName("multi-game-builder")
    .usage("$0 [games-directory] [options]")
    .command("$0 [games-directory]", "Build and optionally serve MML games", (yargs) => {
      return yargs.positional("games-directory", {
        describe: "Path to games directory",
        type: "string",
        default: "./games",
      });
    })
    .option("serve", {
      alias: "s",
      type: "boolean",
      description: "Enable the game server",
      default: false,
    })
    .option("port", {
      alias: "p",
      type: "number",
      description: "Port to run the server on",
      default: 3000,
      implies: "serve",
    })
    .option("host", {
      type: "string",
      description: "Host to bind the server to",
      default: "localhost",
      implies: "serve",
    })
    .option("runner", {
      alias: "r",
      type: "string",
      description: "URL of the game runner",
      default: "http://localhost:3031",
      implies: "serve",
    })
    .option("no-cors", {
      type: "boolean",
      description: "Disable CORS support",
      default: false,
      implies: "serve",
      boolean: true,
    })
    .option("cors-origins", {
      type: "string",
      description: "Comma-separated list of allowed CORS origins",
      default: "*",
      implies: "serve",
    })
    .option("assets", {
      type: "string",
      description: "Path to assets directory to serve",
      default: "./assets",
    })
    .option("build-only", {
      type: "boolean",
      description: "Build once only (disable file watching)",
      default: false,
    })
    .option("verbose", {
      alias: "v",
      type: "boolean",
      description: "Enable verbose logging",
      default: false,
    })
    .help("help")
    .alias("help", "h")
    .version("version")
    .alias("version", "V")
    .example("$0", "Build and watch games (no server)")
    .example("$0 --serve", "Build, watch games, and serve them")
    .example("$0 --port 8080", "Build, watch, and serve on port 8080")
    .example("$0 --build-only --serve", "Build once and serve")
    .example("$0 ../my-games --serve", "Use different games directory and serve")
    .example("$0 --host 0.0.0.0 --port 80", "Bind to all interfaces on port 80")
    .strict()
    .parse();

  const options: MultiGameBuilderOptions = {
    rootPath: argv["games-directory"] as string,
    assetsDirectory: argv.assets as string,
    watchMode: !argv["build-only"],
    serverOptions: argv.serve
      ? {
          port: argv.port,
          host: argv.host,
          runnerUrl: argv.runner,
          corsEnabled: !argv["no-cors"],
          corsOrigins: argv["cors-origins"]?.includes(",")
            ? argv["cors-origins"].split(",").map((s) => s.trim())
            : argv["cors-origins"],
        }
      : undefined,
  };

  console.log("🎮 Multi-Game Builder & Server");
  console.log(`📁 Games directory: ${options.rootPath}`);
  if (options.assetsDirectory) {
    console.log(`🎨 Assets directory: ${options.assetsDirectory}`);
  }
  console.log(`👁️ Watch mode: ${options.watchMode ? "enabled" : "disabled"}`);
  if (options.serverOptions) {
    console.log(`🌐 Server: ${options.serverOptions.host}:${options.serverOptions.port}`);
    console.log(`🎮 Runner URL: ${options.serverOptions.runnerUrl || "none"}`);
    console.log(
      `🌐 CORS: ${options.serverOptions.corsEnabled ? `enabled (${JSON.stringify(options.serverOptions.corsOrigins)})` : "disabled"}`,
    );
  }

  try {
    const builder = new MultiGameBuilder(options);
    await builder.start();
  } catch (error) {
    console.error("❌ Failed to start Multi-Game Builder:", error);
    process.exit(1);
  }
}

main();
