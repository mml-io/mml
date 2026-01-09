# MML Editor VS Code Extension

A comprehensive MML preview and editing extension for VS Code / Cursor with live 3D preview, scene outline, element settings, and visual transform controls.

## Usage

### Opening the Preview
1. Open an `.mml` or `.html` file
2. Use one of these methods:
   - Press `Cmd+Shift+V` (Mac) or `Ctrl+Shift+V` (Windows/Linux)
   - Click the preview icon in the editor title bar
   - Command Palette: "MML: Open Preview to the Side"

### Keyboard Shortcuts
When the preview panel is focused:

| Key | Action |
|-----|--------|
| W | Set gizmo to Translate mode |
| E | Set gizmo to Rotate mode |
| R | Set gizmo to Scale mode |
| X | Toggle snapping |
| H | Toggle element visualizers |

### Commands
Available in the Command Palette (`Cmd+Shift+P`):

| Command | Description |
|---------|-------------|
| MML: Open Preview | Open preview in current editor group |
| MML: Open Preview to the Side | Open preview beside the code |
| MML: Show Code Only | Close preview, show only code editor |
| MML: Show Preview Only | Close code editor, show only preview |
| MML: Show Split View | Show both code and preview |
| MML: Toggle Element Visualizers | Show/hide element helpers |
| MML: Set Gizmo to Translate | Switch to translate mode |
| MML: Set Gizmo to Rotate | Switch to rotate mode |
| MML: Set Gizmo to Scale | Switch to scale mode |
| MML: Toggle Transform Snapping | Enable/disable snapping |
| MML: Focus Scene Outline | Focus the scene panel |
| MML: Focus Element Settings | Focus the element panel |

## Development

### Iterative Development
1. Run `npm run iterate` in this package directory to watch for changes
2. Launch the extension using VS Code's debugger (F5 or the Run panel)
3. A new VS Code window opens with the extension active
4. After code changes, reload the window (`Cmd+Shift+P` → "Reload Window")

### Debug Configuration
Add this to your `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Run MML Editor Extension",
      "type": "extensionHost",
      "request": "launch",
      "runtimeExecutable": "${execPath}",
      "args": [
        "--extensionDevelopmentPath=${workspaceFolder}/packages/mml-editor-vscode-extension"
      ],
      "outFiles": [
        "${workspaceFolder}/packages/mml-editor-vscode-extension/dist/**/*.js"
      ],
      "skipFiles": ["<node_internals>/**"]
    }
  ]
}
```

### Building
```bash
cd packages/mml-editor-vscode-extension
npm run build     # Build once
npm run iterate   # Build and watch for changes
```

`npm run iterate` from root also watches for changes here.
