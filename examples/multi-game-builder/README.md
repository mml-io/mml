# Multi-Game Builder

A build orchestrator that can build multiple MML games simultaneously, each in their own directory. Uses chokidar to watch for directory changes and automatically starts/stops individual esbuild processes.

## Features

- **Multi-Game Support**: Build multiple games simultaneously from separate directories
- **File Watching**: Automatically detect when game directories are added/removed/modified
- **Individual Build Contexts**: Each game gets its own esbuild context with proper isolation
- **MML Game Engine Integration**: Uses the `mmlGameEngineBuildPlugin` for proper MML game building
- **Flexible Configuration**: Each game can have its own scripts.json and build configuration
