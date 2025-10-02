# MML Game Runner

A universal game runner that can load and play MML games from URLs or local files. This runner provides a flexible interface for loading games dynamically without needing to rebuild the runner for each game.

## Overview

This runner creates an MML Game Client that can dynamically load game content from various sources. It provides a web interface for loading games via URL parameters, manual URL input, or drag-and-drop file upload.

## Features

- **Universal Game Loading**: Load any MML game HTML file from URLs or local files
- **URL Parameter Support**: Automatically load games via `?url=` parameter
- **URL Synchronization**: Address bar stays in sync with loaded games
- **Browser Navigation**: Back/forward buttons work correctly with games
- **Drag & Drop Interface**: Drop HTML files directly into the browser
- **Manual URL Input**: Paste game URLs to load them instantly
- **Loading States**: Proper loading indicators when arriving with URL parameters
- **MMLGameClient Integration**: Proper game rendering with 3D graphics
- **EditableNetworkedDOM**: Game content management and networking
- **Clean Game Switching**: Close and load different games seamlessly
- **Error Handling**: Comprehensive error messages and recovery
- **Express Server**: Development server with auto-rebuild and watch

## Usage

### Starting the Runner

```bash
# Development mode (auto-rebuild + server)
npm run iterate

# Production build
npm run build
```

The runner will be available at `http://localhost:3031`

### Loading Games

#### 1. Via URL Parameter
```
http://localhost:3031?url=http://localhost:3000/game/my-game
```
- Shows loading spinner immediately
- Updates address bar when game loads
- Works with browser back/forward buttons

#### 2. Via Web Interface
- Open `http://localhost:3031` in your browser
- Enter a game URL in the input field
- Click "Load Game"
- Address bar updates with `?url=` parameter

#### 3. Via Drag & Drop
- Open `http://localhost:3031` in your browser  
- Drag an HTML game file into the drop zone
- The game will load automatically
- Clears URL parameters (file-based loading)

#### 4. Browser Navigation
- Use back/forward buttons to navigate between games
- Close button removes URL parameter from address bar
- Escape key also closes current game

### Game Server Integration

The runner integrates seamlessly with the Multi-Game Builder server:

```bash
# Start the game server (serves games)
cd ../multi-game-builder
npm run iterate  # Builds games + starts server on :3000

# Start the runner (loads games)
cd ../standalone-game-example-runner  
npm run iterate  # Starts runner on :3031

# Games will link to: http://localhost:3031?url=http://localhost:3000/game/{name}
```

## Architecture

- **MML Client**: Uses `createMMLGameClient()` to create a proper MML game client
- **Game Document**: `EditableNetworkedDOM` manages the game content and state
- **Content Loading**: Text plugin loads the built game HTML at build time via `import gameContent from "...?text"`
- **Main Interface**: Simple HTML page with a container for the MML client
- **Server**: Express server that serves the built interface
- **Build**: esbuild-based build system with text plugin and HTML plugin

## Endpoints

- `/` - Main interface with embedded MML game client

## Differences from mml-game-engine-example

This runner is much simpler than the full `mml-game-engine-example`:

- **Single Game Focus**: Only loads one pre-built game (no example selection UI)
- **No Multi-Client Support**: Single client instance (no client management)
- **Simplified Content Loading**: Uses text plugin to load content at build time
- **Direct MML Integration**: Proper MMLGameClient usage without complex harness
- **Minimal Setup**: Streamlined dependencies and configuration

This makes it ideal for showcasing multiple games with proper MML client integration and seamless URL-based navigation.

## Key Technical Details

- **Dynamic Content Loading**: Games are fetched at runtime from URLs or loaded from local files
- **URL State Management**: Browser history API integration for proper navigation
- **EditableNetworkedDOM**: Manages the game content and provides the networked document interface  
- **MMLGameClient**: Renders the MML content with proper 3D graphics and interaction support
- **CORS Support**: Works with cross-origin game servers via proper CORS handling
- **State Synchronization**: Address bar, UI state, and game state stay synchronized

## URL State Management

The runner maintains proper URL state for a seamless browsing experience:

```javascript
// Loading a game updates the URL
loadGame(url) → window.location = "?url=encoded_game_url"

// Closing a game clears the URL  
closeGame() → window.location = "/"

// Browser navigation works correctly
back/forward → loads appropriate game state

// File loading clears URL params
loadFile() → window.location = "/"
```

This enables:
- **Bookmarkable Games**: Share direct links to specific games
- **Browser Navigation**: Back/forward buttons work as expected  
- **State Persistence**: Refresh preserves current game
- **Clean URLs**: File-based loading doesn't pollute URL history
