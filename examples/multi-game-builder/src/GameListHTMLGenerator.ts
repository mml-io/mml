import { GameMMLDocumentManager } from "./GameMMLDocumentManager";

export interface ServedGame {
  name: string;
  title: string;
  description?: string;
  url: string;
  runnerUrl?: string;
  buildPath: string;
  hasBuiltFiles: boolean;
}

export interface GameListHTMLOptions {
  host: string;
  port: number;
  runnerUrl: string;
  gamesDirectory: string;
}

export class GameListHTMLGenerator {
  constructor(private mmlDocumentManager: GameMMLDocumentManager) {}

  /**
   * Generates HTML for the games listing page
   */
  generateGameListHTML(games: ServedGame[], options: GameListHTMLOptions): string {
    const builtGames = games.filter(g => g.hasBuiltFiles);
    const unbuiltGames = games.filter(g => !g.hasBuiltFiles);

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MML Games</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .games-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
        }
        .game-card {
            background: white;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            transition: transform 0.2s, box-shadow 0.2s;
        }
        .game-card.unavailable {
            opacity: 0.6;
            background: #f9f9f9;
        }
        .game-title {
            font-size: 1.2em;
            font-weight: bold;
            margin-bottom: 8px;
            color: #333;
        }
        .game-description {
            color: #666;
            margin-bottom: 12px;
            font-size: 0.9em;
        }
        .game-meta {
            font-size: 0.8em;
            color: #888;
            margin-bottom: 15px;
        }
        .game-meta code {
            background: #f0f0f0;
            padding: 2px 4px;
            border-radius: 3px;
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            font-size: 0.9em;
            word-break: break-all;
        }
        .game-actions {
            display: flex;
            gap: 10px;
        }
        .btn {
            padding: 8px 16px;
            border: none;
            border-radius: 4px;
            text-decoration: none;
            font-size: 0.9em;
            cursor: pointer;
            transition: background-color 0.2s;
        }
        .btn-primary {
            background: #007bff;
            color: white;
        }
        .btn-primary:hover {
            background: #0056b3;
        }
        .btn-secondary {
            background: #6c757d;
            color: white;
        }
        .btn-secondary:hover {
            background: #545b62;
        }
        .btn:disabled {
            background: #ccc;
            cursor: not-allowed;
        }
        .status-badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 0.7em;
            font-weight: bold;
            text-transform: uppercase;
        }
        .status-built {
            background: #d4edda;
            color: #155724;
        }
        .status-unbuilt {
            background: #f8d7da;
            color: #721c24;
        }
        .section-title {
            font-size: 1.5em;
            margin-bottom: 20px;
            color: #333;
            border-bottom: 2px solid #007bff;
            padding-bottom: 10px;
        }
        .stats {
            display: flex;
            justify-content: center;
            gap: 30px;
            margin-bottom: 20px;
        }
        .stat {
            text-align: center;
        }
        .stat-number {
            font-size: 2em;
            font-weight: bold;
            color: #007bff;
        }
        .stat-label {
            color: #666;
            font-size: 0.9em;
        }
    </style>
</head>
<body>
    ${builtGames.length > 0 ? `
    <h2 class="section-title">Available Games</h2>
    <div class="games-grid">
        ${builtGames.map(game => `
        <div class="game-card">
            <div class="game-title">${game.title}</div>
            ${game.description ? `<div class="game-description">${game.description}</div>` : ''}
            <div class="game-actions">
                ${game.runnerUrl 
                  ? `<a href="${game.runnerUrl}" class="btn btn-primary">Play Singleplayer</a>`
                  : `<a href="${game.url}" class="btn btn-primary">Play Game (Direct)</a>`
                }
                ${this.mmlDocumentManager.hasGameDocument(game.name)
                  ? `<a href="${options.runnerUrl}?url=${encodeURIComponent(`ws://${options.host}:${options.port}/mml/${game.name}`)}" class="btn btn-secondary">Play Multiplayer</a>`
                  : ''
                }
            </div>
            ${this.mmlDocumentManager.hasGameDocument(game.name)
              ? `<div class="game-meta">
                  <small>MML WebSocket: <code>ws://${options.host}:${options.port}/mml/${game.name}</code></small>
                </div>`
              : ''
            }
        </div>
        `).join('')}
    </div>
    ` : ''}

    ${unbuiltGames.length > 0 ? `
    <h2 class="section-title">⚠️ Unbuilt Games</h2>
    <div class="games-grid">
        ${unbuiltGames.map(game => `
        <div class="game-card unavailable">
            <div class="game-title">${game.title}</div>
            ${game.description ? `<div class="game-description">${game.description}</div>` : ''}
            <div class="game-meta">
                <span class="status-badge status-unbuilt">Not Built</span>
            </div>
            <div class="game-actions">
                <button class="btn btn-primary" disabled>Build Required</button>
            </div>
        </div>
        `).join('')}
    </div>
    <p style="text-align: center; color: #666; margin-top: 20px;">
        Run <code>npm run build</code> in the multi-game-builder directory to build these games.
    </p>
    ` : ''}

    ${games.length === 0 ? `
    <div style="text-align: center; padding: 40px; color: #666;">
        <h2>No games found</h2>
        <p>Add game directories to <code>${options.gamesDirectory}</code> to get started.</p>
    </div>
    ` : ''}

</body>
</html>`;
  }
}
