import chokidar from "chokidar";
import * as path from "path";

import { GameBuildOrchestrator } from "./GameBuildOrchestrator";
import { GameDirectory, GameDirectoryScanner } from "./GameDirectoryScanner";
import { GameMMLDocumentManager } from "./GameMMLDocumentManager";

export class GameDirectoryWatcher {
  private scanner: GameDirectoryScanner;
  private orchestrator: GameBuildOrchestrator;
  private mmlDocumentManager: GameMMLDocumentManager;
  private watcher: chokidar.FSWatcher | null = null;
  private currentGames: Map<string, GameDirectory> = new Map();
  private rootPath: string;

  constructor(
    rootPath: string,
    orchestrator: GameBuildOrchestrator,
    mmlDocumentManager: GameMMLDocumentManager,
  ) {
    this.rootPath = path.resolve(rootPath);
    this.scanner = new GameDirectoryScanner(rootPath);
    this.orchestrator = orchestrator;
    this.mmlDocumentManager = mmlDocumentManager;
  }

  /**
   * Starts watching the root directory for game directory changes
   */
  async startWatching(): Promise<void> {
    console.log(`Starting to watch directory: ${this.rootPath}`);

    // Initial scan
    await this.performInitialScan();

    // Set up file watcher
    this.watcher = chokidar.watch(this.rootPath, {
      ignored: [
        "**/node_modules/**",
        "**/.git/**",
        "**/.*", // Hidden files
      ],
      persistent: true,
      ignoreInitial: true,
      depth: 2, // Only watch 2 levels deep to catch game directories and their immediate contents
    });

    // Watch for directory additions/removals
    this.watcher.on("addDir", (dirPath) => {
      this.handleDirectoryAdded(dirPath);
    });

    this.watcher.on("unlinkDir", (dirPath) => {
      this.handleDirectoryRemoved(dirPath);
    });

    // Watch for critical file changes that might make a directory valid/invalid
    this.watcher.on("add", (filePath) => {
      this.handleFileAdded(filePath);
    });

    this.watcher.on("unlink", (filePath) => {
      this.handleFileRemoved(filePath);
    });

    this.watcher.on("change", (filePath) => {
      this.handleFileChanged(filePath);
    });

    this.watcher.on("error", (error) => {
      console.error("Watcher error:", error);
    });

    console.log(`Watching ${this.currentGames.size} games for changes`);
  }

  /**
   * Stops watching for directory changes
   */
  async stopWatching(): Promise<void> {
    if (this.watcher) {
      console.log("Stopping directory watcher...");
      await this.watcher.close();
      this.watcher = null;
    }
  }

  /**
   * Performs initial scan and starts building existing games
   */
  private async performInitialScan(): Promise<void> {
    const games = this.scanner.scanForGames();
    console.log(`Found ${games.length} valid game directories`);

    for (const game of games) {
      this.currentGames.set(game.name, game);
      const gameConfig = this.scanner.getGameConfig(game);
      await this.orchestrator.addGame(gameConfig);
      this.mmlDocumentManager.addGameDocument(game);
    }
  }

  /**
   * Handles when a directory is added
   */
  private handleDirectoryAdded(dirPath: string): void {
    const relativePath = path.relative(this.rootPath, dirPath);
    const pathParts = relativePath.split(path.sep);

    // Only handle top-level directories (potential game directories)
    if (pathParts.length === 1 && pathParts[0] !== "") {
      const gameName = pathParts[0];

      // Debounce rapid directory creation
      setTimeout(async () => {
        await this.checkAndAddGame(gameName);
      }, 500);
    }
  }

  /**
   * Handles when a directory is removed
   */
  private async handleDirectoryRemoved(dirPath: string): Promise<void> {
    const relativePath = path.relative(this.rootPath, dirPath);
    const pathParts = relativePath.split(path.sep);

    // Only handle top-level directories (potential game directories)
    if (pathParts.length === 1 && pathParts[0] !== "") {
      const gameName = pathParts[0];

      if (this.currentGames.has(gameName)) {
        console.log(`Game directory removed: ${gameName}`);
        await this.orchestrator.removeGame(gameName);
        this.mmlDocumentManager.removeGameDocument(gameName);
        this.currentGames.delete(gameName);
      }
    }
  }

  /**
   * Handles when a file is added
   */
  private handleFileAdded(filePath: string): void {
    const relativePath = path.relative(this.rootPath, filePath);
    const pathParts = relativePath.split(path.sep);

    if (pathParts.length >= 2) {
      const gameName = pathParts[0];
      const fileName = path.basename(filePath);

      // Handle build/index.html file additions
      if (
        fileName === "index.html" &&
        pathParts[1] === "build" &&
        this.currentGames.has(gameName)
      ) {
        this.mmlDocumentManager.updateGameDocument(gameName);
      }

      // Check if this is a critical file that might make a directory valid
      if (this.isCriticalFile(fileName, pathParts)) {
        setTimeout(async () => {
          await this.checkAndAddGame(gameName);
        }, 500);
      }
    }
  }

  /**
   * Handles when a file is removed
   */
  private handleFileRemoved(filePath: string): void {
    const relativePath = path.relative(this.rootPath, filePath);
    const pathParts = relativePath.split(path.sep);

    if (pathParts.length >= 2) {
      const gameName = pathParts[0];
      const fileName = path.basename(filePath);

      // Handle build/index.html file removals
      if (
        fileName === "index.html" &&
        pathParts[1] === "build" &&
        this.currentGames.has(gameName)
      ) {
        this.mmlDocumentManager.removeGameDocument(gameName);
      }

      // Check if this is a critical file that might make a directory invalid
      if (this.isCriticalFile(fileName, pathParts) && this.currentGames.has(gameName)) {
        setTimeout(async () => {
          await this.recheckGame(gameName);
        }, 500);
      }
    }
  }

  /**
   * Handles when a file is changed
   */
  private handleFileChanged(filePath: string): void {
    const relativePath = path.relative(this.rootPath, filePath);
    const pathParts = relativePath.split(path.sep);

    if (pathParts.length >= 2) {
      const gameName = pathParts[0];
      const fileName = path.basename(filePath);

      // Handle build/index.html file changes - potentially reload the MML document
      if (
        fileName === "index.html" &&
        pathParts[1] === "build" &&
        this.currentGames.has(gameName)
      ) {
        this.mmlDocumentManager.updateGameDocument(gameName);
      }
    }
  }

  /**
   * Checks if a file is critical for game validity
   */
  private isCriticalFile(fileName: string, pathParts: string[]): boolean {
    // Critical files in src directory
    if (pathParts[1] === "src") {
      return fileName === "index.ts" || fileName === "index.mml" || fileName === "scripts.json";
    }

    // Critical files in root directory
    if (pathParts.length === 2) {
      return fileName === "build.ts" || fileName === "package.json";
    }

    return false;
  }

  /**
   * Checks if a game directory is valid and adds it if so
   */
  private async checkAndAddGame(gameName: string): Promise<void> {
    const games = this.scanner.scanForGames();
    const game = games.find((g) => g.name === gameName);

    if (game && !this.currentGames.has(gameName)) {
      console.log(`New valid game directory detected: ${gameName}`);
      this.currentGames.set(gameName, game);
      const gameConfig = this.scanner.getGameConfig(game);
      await this.orchestrator.addGame(gameConfig);
      this.mmlDocumentManager.addGameDocument(game);
    }
  }

  /**
   * Rechecks if a game is still valid and removes it if not
   */
  private async recheckGame(gameName: string): Promise<void> {
    const games = this.scanner.scanForGames();
    const game = games.find((g) => g.name === gameName);

    if (!game && this.currentGames.has(gameName)) {
      console.log(`Game directory no longer valid: ${gameName}`);
      await this.orchestrator.removeGame(gameName);
      this.mmlDocumentManager.removeGameDocument(gameName);
      this.currentGames.delete(gameName);
    } else if (game && this.currentGames.has(gameName)) {
      // Game still exists but might have changed - update it
      console.log(`Game directory updated: ${gameName}`);
      this.currentGames.set(gameName, game);
      const gameConfig = this.scanner.getGameConfig(game);
      await this.orchestrator.updateGame(gameConfig);
      this.mmlDocumentManager.addGameDocument(game); // Refresh MML documents
    }
  }

  /**
   * Gets the current list of watched games
   */
  getCurrentGames(): string[] {
    return Array.from(this.currentGames.keys());
  }

  /**
   * Gets the number of currently watched games
   */
  getCurrentGameCount(): number {
    return this.currentGames.size;
  }

  /**
   * Gets the MML document manager
   */
  getMMLDocumentManager(): GameMMLDocumentManager {
    return this.mmlDocumentManager;
  }
}
