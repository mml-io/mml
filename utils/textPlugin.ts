import { OnLoadArgs, OnResolveArgs, Plugin } from "esbuild";
import fs from "fs";
import path from "path";
import resolve from "resolve";

export function textPlugin() {
  return {
    name: "text",

    setup(build) {
      // Intercept imports ending with "?text"
      build.onResolve({ filter: /.*\?text$/ }, (args: OnResolveArgs) => {
        const importPath = args.path.substring(0, args.path.length - 5); // Remove the "?text" suffix

        // Attempt to resolve as a module in node_modules
        try {
          const modulePath = resolve.sync(importPath, {
            basedir: args.resolveDir,
            extensions: [".js", ".jsx", ".ts", ".tsx"],
          });
          return { path: modulePath, watchFiles: [modulePath], namespace: "text" };
        } catch {
          // If not found in node_modules, fallback to resolve as a regular file path
          const filePath = path.isAbsolute(importPath)
            ? importPath
            : path.join(args.resolveDir, importPath);

          return { path: filePath, watchFiles: [filePath], namespace: "text" };
        }
      });

      // Load the file and return its contents as text
      build.onLoad({ filter: /.*/, namespace: "text" }, async (args: OnLoadArgs) => {
        // Read the file content as text
        const contents = await fs.promises.readFile(args.path, "utf-8");

        // Return as text
        return {
          contents,
          loader: "text",
        };
      });
    },
  } as Plugin;
}
