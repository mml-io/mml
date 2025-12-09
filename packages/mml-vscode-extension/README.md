# MML VSCode Extension

## Iterative development

The package is automatically built when `npm run iterate` is run in the root of the repository.

To iterate, first add a new debug launch configuration in VSCode/Cursor:

```json
    {
      "name": "Run MML VSCode Extension",
      "type": "extensionHost",
      "request": "launch",
      "runtimeExecutable": "${execPath}",
      "args": [
        // Point this to the extension package directory
        "--extensionDevelopmentPath=${workspaceFolder}/packages/mml-vscode-extension"
        // Optional: open a separate test workspace:
        // "--extensionDevelopmentPath=${workspaceFolder}/packages/your-extension",
        // "${workspaceFolder}/.vscode-dev-playground"
      ],
      "outFiles": [
        "${workspaceFolder}/packages/mml-vscode-extension/dist/**/*.js"
      ],
      // "preLaunchTask": "watch-extension",  // ensures watcher is running
      "skipFiles": [
        "<node_internals>/**"
      ]
    }
```

Then run the debug configuration. The extension will be built and the VSCode extension host will be launched.
The new window will have the extension loaded and ready to use.

After making a code change, refresh the window (Cmd/Ctrl+Shift+P -> Reload Window) to see the changes.