import * as fs from "fs";
import * as path from "path";

export interface GameDirectory {
  name: string;
  path: string;
  srcPath: string;
  buildPath: string;
  hasIndexTs: boolean;
  hasIndexMml: boolean;
  hasScriptsJson: boolean;
  hasBuildTs: boolean;
  hasPackageJson: boolean;
}

export class GameDirectoryScanner {
  private rootPath: string;

  constructor(rootPath: string) {
    this.rootPath = path.resolve(rootPath);
  }

  /**
   * Scans the root directory for valid game directories
   */
  scanForGames(): GameDirectory[] {
    if (!fs.existsSync(this.rootPath)) {
      console.warn(`Root path does not exist: ${this.rootPath}`);
      return [];
    }

    const entries = fs.readdirSync(this.rootPath, { withFileTypes: true });
    const gameDirectories: GameDirectory[] = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const gameDir = this.analyzeGameDirectory(entry.name);
        if (gameDir && this.isValidGameDirectory(gameDir)) {
          gameDirectories.push(gameDir);
        }
      }
    }

    return gameDirectories;
  }

  /**
   * Analyzes a single directory to determine if it's a valid game directory
   */
  private analyzeGameDirectory(dirName: string): GameDirectory | null {
    const dirPath = path.join(this.rootPath, dirName);
    const srcPath = path.join(dirPath, "src");
    const buildPath = path.join(dirPath, "build");

    // Check if src directory exists
    if (!fs.existsSync(srcPath)) {
      return null;
    }

    const gameDir: GameDirectory = {
      name: dirName,
      path: dirPath,
      srcPath,
      buildPath,
      hasIndexTs: fs.existsSync(path.join(srcPath, "index.ts")),
      hasIndexMml: fs.existsSync(path.join(srcPath, "index.mml")),
      hasScriptsJson: fs.existsSync(path.join(srcPath, "scripts.json")),
      hasBuildTs: fs.existsSync(path.join(dirPath, "build.ts")),
      hasPackageJson: fs.existsSync(path.join(dirPath, "package.json")),
    };

    return gameDir;
  }

  /**
   * Determines if a directory is a valid game directory based on required files
   */
  private isValidGameDirectory(gameDir: GameDirectory): boolean {
    // Minimum requirements: src/index.ts and src/index.mml
    return gameDir.hasIndexTs && gameDir.hasIndexMml;
  }

  /**
   * Gets the configuration for a specific game directory
   */
  getGameConfig(gameDir: GameDirectory): GameConfig {
    return {
      name: gameDir.name,
      entryPoints: [path.join(gameDir.srcPath, "index.ts")],
      outdir: gameDir.buildPath,
      scriptsConfigPath: gameDir.hasScriptsJson
        ? path.join(gameDir.srcPath, "scripts.json")
        : undefined,
      htmlTemplate: gameDir.hasIndexMml ? path.join(gameDir.srcPath, "index.mml") : undefined,
    };
  }

  /**
   * Watches for changes in game directories
   */
  getWatchPaths(): string[] {
    return [
      this.rootPath, // Watch for new/removed directories
    ];
  }
}

export interface GameConfig {
  name: string;
  entryPoints: string[];
  outdir: string;
  scriptsConfigPath?: string;
  htmlTemplate?: string;
}
