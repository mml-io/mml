import express from "express";
import type { Application } from "express-ws";
import enableWs from "express-ws";
import * as fs from "fs";
import http from "http";
import * as path from "path";

import { GameDirectoryScanner } from "./GameDirectoryScanner";
import { GameListHTMLGenerator } from "./GameListHTMLGenerator";
import { GameMMLDocumentManager } from "./GameMMLDocumentManager";

export interface GameServerOptions {
  gamesDirectory: string;
  assetsDirectory?: string;
  port?: number;
  host?: string;
  runnerUrl?: string;
  corsEnabled?: boolean;
  corsOrigins?: string | string[] | RegExp | RegExp[];
  mmlDocumentManager?: GameMMLDocumentManager;
}

export interface ServedGame {
  name: string;
  title: string;
  description?: string;
  url: string;
  runnerUrl?: string;
  buildPath: string;
  hasBuiltFiles: boolean;
}

type RequiredDeep<T> = {
  [K in keyof T]-?: T[K] extends object ? RequiredDeep<T[K]> : T[K];
};

export class GameServer {
  private app: Application;
  private scanner: GameDirectoryScanner;
  private options: RequiredDeep<GameServerOptions>;
  private server: http.Server | null = null;
  private mmlDocumentManager: GameMMLDocumentManager;
  private htmlGenerator: GameListHTMLGenerator;

  constructor(options: GameServerOptions) {
    this.options = {
      port: 3000,
      host: "localhost",
      runnerUrl: "http://localhost:3031",
      corsEnabled: true,
      corsOrigins: "*",
      mmlDocumentManager: new GameMMLDocumentManager(),
      ...options,
    } as RequiredDeep<GameServerOptions>;

    const { app } = enableWs(express());
    this.app = app;
    this.app.enable("trust proxy");

    this.scanner = new GameDirectoryScanner(options.gamesDirectory);
    this.mmlDocumentManager = this.options.mmlDocumentManager;
    this.htmlGenerator = new GameListHTMLGenerator(this.mmlDocumentManager);

    // Set asset server URL for document manager so it can resolve relative URLs
    const assetServerUrl = `http://${this.options.host}:${this.options.port}`;
    this.mmlDocumentManager.setAssetServerUrl(assetServerUrl);
    console.log(`Asset server URL set to: ${assetServerUrl}`);

    this.setupMiddleware();
    this.setupRoutes();

    // Initialize MML documents with existing games
    this.initializeMMLDocuments();
  }

  /**
   * Initializes MML documents for existing games
   */
  private initializeMMLDocuments(): void {
    const games = this.scanner.scanForGames();
    for (const game of games) {
      this.mmlDocumentManager.addGameDocument(game);
    }
    // Initialize MML documentsdocuments for existing games
    this.mmlDocumentManager.getAllDocumentKeys();
  }

  /**
   * Sets up Express middleware
   */
  private setupMiddleware(): void {
    // Enable CORS if configured
    if (this.options.corsEnabled) {
      this.app.use((req, res, next) => {
        const origin = req.headers.origin;
        const allowedOrigins = this.getAllowedOrigins();

        // Check if origin is allowed
        if (this.isOriginAllowed(origin, allowedOrigins)) {
          res.header("Access-Control-Allow-Origin", origin || "*");
        } else if (allowedOrigins.includes("*")) {
          res.header("Access-Control-Allow-Origin", "*");
        }

        res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
        res.header(
          "Access-Control-Allow-Headers",
          "Content-Type, Authorization, Accept, Origin, X-Requested-With",
        );
        // Removed Access-Control-Max-Age to prevent caching of preflight requests

        // Handle preflight OPTIONS requests
        if (req.method === "OPTIONS") {
          res.status(200).end();
          return;
        }

        next();
      });
    }

    // Parse JSON bodies
    this.app.use(express.json());

    // Parse URL-encoded bodies
    this.app.use(express.urlencoded({ extended: true }));

    // Disable client caching for all responses
    this.app.use((req, res, next) => {
      res.header("Cache-Control", "no-cache, no-store, must-revalidate");
      res.header("Pragma", "no-cache");
      res.header("Expires", "0");
      next();
    });
  }

  /**
   * Gets allowed origins as an array
   */
  private getAllowedOrigins(): string[] {
    if (typeof this.options.corsOrigins === "string") {
      return [this.options.corsOrigins];
    }
    if (Array.isArray(this.options.corsOrigins)) {
      return this.options.corsOrigins.filter((origin) => typeof origin === "string") as string[];
    }
    return ["*"];
  }

  /**
   * Checks if an origin is allowed
   */
  private isOriginAllowed(origin: string | undefined, allowedOrigins: string[]): boolean {
    if (!origin) return false;
    if (allowedOrigins.includes("*")) return true;
    return allowedOrigins.includes(origin);
  }

  /**
   * Sets up Express routes
   */
  private setupRoutes(): void {
    // Serve assets from assets directory if provided
    if (this.options.assetsDirectory) {
      const assetsPath = path.resolve(this.options.assetsDirectory);
      console.log(`[GameServer] Assets directory configured: ${this.options.assetsDirectory}`);
      console.log(`[GameServer] Assets directory resolved to: ${assetsPath}`);
      console.log(`[GameServer] Assets directory exists: ${fs.existsSync(assetsPath)}`);

      if (fs.existsSync(assetsPath)) {
        this.app.use(
          "/assets",
          express.static(assetsPath, {
            setHeaders: (res, _path) => {
              res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
              res.setHeader("Pragma", "no-cache");
              res.setHeader("Expires", "0");
            },
          }),
        );
        console.log(`[GameServer] Serving assets from /assets -> ${assetsPath}`);
      } else {
        console.warn(`[GameServer] Assets directory not found: ${assetsPath}`);
      }
    } else {
      console.log(`[GameServer] No assets directory configured`);
    }

    // WebSocket route for MML documents
    this.app.ws("/mml/:gameName", (ws: any, req: express.Request) => {
      const { gameName } = req.params;

      const currentDocument = this.mmlDocumentManager.ensureDocumentLoaded(gameName);

      if (!currentDocument) {
        ws.close();
        return;
      }

      currentDocument.addWebSocket(ws as unknown as WebSocket);
      ws.on("close", () => {
        currentDocument.removeWebSocket(ws as unknown as WebSocket);
      });
    });

    // API endpoint to get available MML documents
    this.app.get("/api/mml-documents", (req, res) => {
      const documents = this.mmlDocumentManager.getAllDocumentKeys();
      res.json(documents);
    });

    // API endpoint to check if a game has an MML document
    this.app.get("/api/games/:gameName/mml-document", (req, res) => {
      const { gameName } = req.params;
      const hasDocument = this.mmlDocumentManager.hasGameDocument(gameName);
      res.json({ hasDocument });
    });

    // Serve static files from games' build directories
    this.app.use("/games/:gameName", (req, res, next) => {
      const gameName = req.params.gameName;
      const games = this.getAvailableGames();
      const game = games.find((g) => g.name === gameName);

      if (!game || !game.hasBuiltFiles) {
        return res.status(404).send(`Game "${gameName}" not found or not built`);
      }

      // Serve static files from the game's build directory with no caching
      express.static(game.buildPath, {
        setHeaders: (res, _path) => {
          res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
          res.setHeader("Pragma", "no-cache");
          res.setHeader("Expires", "0");
        },
      })(req, res, next);
    });

    // Main games listing page
    this.app.get("/", (req, res) => {
      const games = this.getAvailableGames();
      const html = this.htmlGenerator.generateGameListHTML(games, {
        host: this.options.host,
        port: this.options.port,
        runnerUrl: this.options.runnerUrl,
        gamesDirectory: this.options.gamesDirectory,
      });
      res.send(html);
    });

    // API endpoint to get games as JSON
    this.app.get("/api/games", (req, res) => {
      const games = this.getAvailableGames();
      res.json(games);
    });

    // Direct game access (serves the game's index.html)
    this.app.get("/game/:gameName", (req, res) => {
      console.log(`🔍 Getting game: ${req.params.gameName}`);
      const gameName = req.params.gameName;
      const games = this.getAvailableGames();
      const game = games.find((g) => g.name === gameName);

      if (!game || !game.hasBuiltFiles) {
        return res.status(404).send(`Game "${gameName}" not found or not built`);
      }

      const indexPath = path.join(game.buildPath, "index.html");
      if (!fs.existsSync(indexPath)) {
        return res.status(404).send(`Game "${gameName}" index.html not found`);
      }

      res.sendFile(indexPath);
    });
  }

  /**
   * Scans for available games and their build status
   */
  private getAvailableGames(): ServedGame[] {
    const gameDirectories = this.scanner.scanForGames();

    return gameDirectories.map((gameDir) => {
      const indexPath = path.join(gameDir.buildPath, "index.html");
      const hasBuiltFiles = fs.existsSync(indexPath);

      // Try to read title and description from README.md
      let title: string | undefined;
      let description: string | undefined;
      const readmePath = path.join(gameDir.path, "README.md");
      if (fs.existsSync(readmePath)) {
        try {
          const readmeContent = fs.readFileSync(readmePath, "utf-8");
          const lines = readmeContent.split("\n");

          // Extract title from first line (remove markdown heading syntax)
          if (lines.length > 0 && lines[0].trim()) {
            title = lines[0].replace(/^#+\s*/, "").trim();
          }

          // Extract description from third line (skip empty second line)
          if (lines.length > 2 && lines[2].trim()) {
            description = lines[2].trim();
          }
        } catch (_error) {
          // Ignore read errors
        }
      }

      const gameUrl = `http://${this.options.host}:${this.options.port}/game/${gameDir.name}`;
      const runnerUrl = this.options.runnerUrl
        ? `${this.options.runnerUrl}?url=${encodeURIComponent(gameUrl)}`
        : undefined;

      return {
        name: gameDir.name,
        title: title || this.formatGameTitle(gameDir.name),
        description,
        url: `/game/${gameDir.name}`,
        runnerUrl,
        buildPath: gameDir.buildPath,
        hasBuiltFiles,
      };
    });
  }

  /**
   * Formats a game directory name into a readable title
   */
  private formatGameTitle(name: string): string {
    return name
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  /**
   * Starts the server
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(this.options.port, this.options.host, () => {
        console.log(`🎮 Game Server started: http://${this.options.host}:${this.options.port}`);

        const games = this.getAvailableGames();
        const builtGames = games.filter((g) => g.hasBuiltFiles);
        console.log(`🎯 Found ${games.length} games (${builtGames.length} built)`);

        if (builtGames.length > 0) {
          console.log(`\n🚀 Available games:`);
          builtGames.forEach((game) => {
            if (game.runnerUrl) {
              console.log(`   • ${game.title}: ${game.runnerUrl}`);
            } else {
              console.log(
                `   • ${game.title}: http://${this.options.host}:${this.options.port}${game.url}`,
              );
            }
          });
        }

        if (this.options.runnerUrl) {
          console.log(`\n🎮 Game Runner: ${this.options.runnerUrl}`);
        }

        resolve();
      });

      this.server.on("error", (error: any) => {
        if (error.code === "EADDRINUSE") {
          reject(new Error(`Port ${this.options.port} is already in use`));
        } else {
          reject(error);
        }
      });
    });
  }

  /**
   * Stops the server
   */
  async stop(): Promise<void> {
    // Clean up MML documents
    this.mmlDocumentManager.dispose();

    if (this.server) {
      return new Promise((resolve) => {
        this.server?.close(() => {
          console.log("Game Server stopped.");
          resolve();
        });
      });
    }
  }
}
