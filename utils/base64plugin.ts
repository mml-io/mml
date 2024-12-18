import { OnLoadArgs, OnResolveArgs, Plugin } from "esbuild";
import fs from "fs";
import path from "path";
import resolve from "resolve";

export type Base64PluginOptions = {
  replacements?: Record<string, string>;
};

export function base64Plugin(options: Base64PluginOptions = {}) {
  return {
    name: "base64",

    setup(build) {
      // Intercept imports starting with "base64:"
      build.onResolve({ filter: /^base64:/ }, (args: OnResolveArgs) => {
        const importPath = args.path.substring(7); // Remove the "base64:" prefix

        // Attempt to resolve as a module in node_modules
        try {
          const modulePath = resolve.sync(importPath, {
            basedir: args.resolveDir,
            extensions: [".js", ".jsx", ".ts", ".tsx"],
          });
          return { path: modulePath, namespace: "base64" };
        } catch {
          // If not found in node_modules, fallback to resolve as a regular file path
          const filePath = path.isAbsolute(importPath)
            ? importPath
            : path.join(args.resolveDir, importPath);

          return { path: filePath, namespace: "base64" };
        }
      });

      // Load the file and encode it in Base64
      build.onLoad({ filter: /.*/, namespace: "base64" }, async (args: OnLoadArgs) => {
        // Read the file content
        let contentsBuffer = await fs.promises.readFile(args.path);

        if (options.replacements) {
          // Apply replacements (assumes the content is text and can be converted to a string and back)
          for (const [searchValue, replaceValue] of Object.entries(options.replacements)) {
            let contents = contentsBuffer.toString();
            contents = contents.replace(searchValue, replaceValue);
            if (contents !== contentsBuffer.toString()) {
              contentsBuffer = Buffer.from(contents);
            }
          }
        }

        // Convert content to Base64
        const base64Content = Buffer.from(contentsBuffer).toString("base64");

        // Return as text
        return {
          contents: base64Content,
          loader: "text",
        };
      });
    },
  } as Plugin;
}
