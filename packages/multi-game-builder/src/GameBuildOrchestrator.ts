import { mmlGameEngineBuildPlugin } from "@mml-io/mml-game-engine-build-plugin";
import * as esbuild from "esbuild";

import { GameConfig } from "./GameDirectoryScanner";

export interface BuildContext {
  name: string;
  context: esbuild.BuildContext;
  config: GameConfig;
}

export class GameBuildOrchestrator {
  private buildContexts: Map<string, BuildContext> = new Map();
  private isWatchMode: boolean;

  constructor(isWatchMode: boolean = false) {
    this.isWatchMode = isWatchMode;
  }

  /**
   * Creates esbuild options for a game
   */
  private createBuildOptions(gameConfig: GameConfig): esbuild.BuildOptions {
    const buildOptions: esbuild.BuildOptions = {
      entryPoints: gameConfig.entryPoints,
      entryNames: "[dir]/[name]-[hash]",
      assetNames: "[dir]/[name]-[hash]",
      bundle: true,
      minify: !this.isWatchMode,
      outdir: gameConfig.outdir,
      metafile: true,
      sourcemap: "inline",
      publicPath: "/",
      platform: "browser",
      target: "es2020",
      loader: {
        ".png": "file",
        ".jpg": "file",
        ".jpeg": "file",
        ".gif": "file",
        ".svg": "file",
        ".glb": "file",
        ".hdr": "file",
        ".mml": "text",
        ".html": "text",
      },
      plugins: [
        mmlGameEngineBuildPlugin({
          configPath: gameConfig.scriptsConfigPath,
          htmlTemplate: gameConfig.htmlTemplate,
          filename: "index.html",
        }),
      ],
    };

    return buildOptions;
  }

  /**
   * Adds a game to the build orchestrator
   */
  async addGame(gameConfig: GameConfig): Promise<void> {
    if (this.buildContexts.has(gameConfig.name)) {
      console.log(`Game "${gameConfig.name}" is already being built`);
      return;
    }

    try {
      console.log(`Adding game "${gameConfig.name}" to build orchestrator`);

      const buildOptions = this.createBuildOptions(gameConfig);

      if (this.isWatchMode) {
        const context = await esbuild.context(buildOptions);
        await context.watch();

        this.buildContexts.set(gameConfig.name, {
          name: gameConfig.name,
          context,
          config: gameConfig,
        });

        console.log(`Started watching game "${gameConfig.name}"`);
      } else {
        // For build mode, just build once
        await esbuild.build(buildOptions);
        console.log(`Built game "${gameConfig.name}"`);
      }
    } catch (error) {
      console.error(`Failed to add game "${gameConfig.name}":`, error);
    }
  }

  /**
   * Removes a game from the build orchestrator
   */
  async removeGame(gameName: string): Promise<void> {
    const buildContext = this.buildContexts.get(gameName);
    if (!buildContext) {
      console.log(`Game "${gameName}" is not being built`);
      return;
    }

    try {
      console.log(`Removing game "${gameName}" from build orchestrator`);

      if (this.isWatchMode) {
        await buildContext.context.dispose();
      }

      this.buildContexts.delete(gameName);
      console.log(`Stopped building game "${gameName}"`);
    } catch (error) {
      console.error(`Failed to remove game "${gameName}":`, error);
    }
  }

  /**
   * Updates a game's build configuration
   */
  async updateGame(gameConfig: GameConfig): Promise<void> {
    await this.removeGame(gameConfig.name);
    await this.addGame(gameConfig);
  }

  /**
   * Builds all games (for build mode)
   */
  async buildAllGames(gameConfigs: GameConfig[]): Promise<void> {
    console.log(`Building ${gameConfigs.length} games...`);

    const buildPromises = gameConfigs.map(async (gameConfig) => {
      try {
        const buildOptions = this.createBuildOptions(gameConfig);
        await esbuild.build(buildOptions);
        console.log(`✓ Built game "${gameConfig.name}"`);
      } catch (error) {
        console.error(`✗ Failed to build game "${gameConfig.name}":`, error);
        throw error;
      }
    });

    await Promise.all(buildPromises);
    console.log(`Successfully built all ${gameConfigs.length} games`);
  }

  /**
   * Starts watching all games (for watch mode)
   */
  async watchAllGames(gameConfigs: GameConfig[]): Promise<void> {
    console.log(`Starting to watch ${gameConfigs.length} games...`);

    for (const gameConfig of gameConfigs) {
      await this.addGame(gameConfig);
    }

    console.log(`Now watching ${this.buildContexts.size} games`);
  }

  /**
   * Disposes all build contexts
   */
  async dispose(): Promise<void> {
    console.log("Disposing all build contexts...");

    const disposePromises = Array.from(this.buildContexts.values()).map(async (buildContext) => {
      try {
        if (this.isWatchMode) {
          await buildContext.context.dispose();
        }
      } catch (error) {
        console.error(`Failed to dispose context for "${buildContext.name}":`, error);
      }
    });

    await Promise.all(disposePromises);
    this.buildContexts.clear();
    console.log("All build contexts disposed");
  }

  /**
   * Gets the current list of games being built
   */
  getActiveGames(): string[] {
    return Array.from(this.buildContexts.keys());
  }

  /**
   * Gets the number of active build contexts
   */
  getActiveGameCount(): number {
    return this.buildContexts.size;
  }
}
