# MML Game Engine Build Plugin

An ESBuild plugin for building MML (Metaverse Markup Language) game projects with script injection and HTML generation capabilities.

## Features

- **Script Injection**: Automatically inject external scripts into your build
- **HTML Template Processing**: Process MML templates and generate HTML output
- **Package Resolution**: Resolve npm packages and local files
- **Configuration Support**: Support for system configurations
- **File Watching**: Watch template and script files for changes during development

## Installation

```bash
npm install @mml-io/mml-game-engine-build-plugin
```

## Usage

```typescript
import { mmlGameEngineBuildPlugin } from "@mml-io/mml-game-engine-build-plugin";
import * as esbuild from "esbuild";

const buildOptions: esbuild.BuildOptions = {
  entryPoints: ["src/index.ts"],
  bundle: true,
  outdir: "./build",
  metafile: true,
  plugins: [
    mmlGameEngineBuildPlugin({
      configPath: "./src/scripts.json",
      htmlTemplate: "./src/index.mml",
      filename: "index.html",
    }),
  ],
};

esbuild.build(buildOptions);
```

## Configuration

### Plugin Options

- `configPath` (optional): Path to the scripts configuration file (default: `"./scripts.json"`)
- `htmlTemplate` (optional): Path to the HTML/MML template file
- `filename` (optional): Output HTML filename (default: `"index.html"`)

### Scripts Configuration

Create a `scripts.json` file to define external scripts to inject:

```json
{
  "scripts": [
    {
      "src": "./src/utils/helper.js"
    },
    {
      "src": "mml-game-math-system"
    },
    {
      "src": "mml-game-physics-system",
      "configName": "physics",
      "config": {
        "gravity": 0.1
      }
    }
  ]
}
```

### Script Configuration Properties

- `src`: Path to the script file (can be a local file or npm package)
- `configName` (optional): Name for the system configuration
- `config` (optional): Configuration object for the system
- `async` (optional): Whether to load the script asynchronously
- `defer` (optional): Whether to defer script execution

## How It Works

1. **Script Resolution**: The plugin resolves script paths, supporting both local files and npm packages
2. **Configuration Injection**: If a script has a `configName` and `config`, it injects configuration into `window.systemsConfig`
3. **Template Processing**: Processes the HTML/MML template file
4. **Script Injection**: Injects all configured scripts into the HTML
5. **Build Integration**: Adds the built JavaScript files to the final HTML
6. **File Watching**: Watches template and script files for changes during development

## Example Output

The plugin generates an HTML file with all scripts injected:

```html
<script>/* helper.js content */</script>
<script>/* math system content */</script>
<script>
  // Configuration injection
  window.systemsConfig = {
    "physics": { "gravity": 0.1 }
  };
  /* physics system content */
</script>
<!-- Your MML template content -->
<script>/* Your built application code */</script>
```

