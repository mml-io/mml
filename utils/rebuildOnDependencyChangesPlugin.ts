import { createRequire } from "node:module";

import { spawn } from "child_process";
import { PluginBuild } from "esbuild";
import { readFileSync } from "fs";
import { dirname, resolve } from "path";
import kill from "tree-kill";

let runningProcess: ReturnType<typeof spawn> | undefined;

export type RebuildOnDependencyChangesPluginOptions = {
  startCommand?: string;
  watchTransitiveDependencies?: boolean;
  maxDepth?: number;
};

// Cache to avoid re-resolving the same dependencies
const dependencyCache = new Map<string, string[]>();

function findPackageJsonPath(startPath: string): string | null {
  let currentPath = startPath;

  // Special handling for node_modules packages
  if (currentPath.includes("node_modules")) {
    const nodeModulesIndex = currentPath.lastIndexOf("node_modules");
    const afterNodeModules = currentPath.substring(
      nodeModulesIndex + "node_modules".length + 1,
    );

    // Handle scoped packages (e.g., @scope/package)
    const pathParts = afterNodeModules.split("/");
    let packagePath;

    if (pathParts[0].startsWith("@")) {
      // Scoped package: @scope/package
      packagePath = resolve(
        currentPath.substring(0, nodeModulesIndex),
        "node_modules",
        pathParts[0],
        pathParts[1],
      );
    } else {
      // Regular package
      packagePath = resolve(
        currentPath.substring(0, nodeModulesIndex),
        "node_modules",
        pathParts[0],
      );
    }

    const packageJsonPath = resolve(packagePath, "package.json");
    try {
      readFileSync(packageJsonPath, "utf-8");
      return packageJsonPath;
    } catch {
      // Fall back to walking up the directory tree
    }
  }

  // Walk up the directory tree looking for package.json
  while (currentPath !== dirname(currentPath)) {
    const packageJsonPath = resolve(currentPath, "package.json");
    try {
      // Check if package.json exists and is readable
      readFileSync(packageJsonPath, "utf-8");
      return packageJsonPath;
    } catch {
      // Move up one directory
      currentPath = dirname(currentPath);
    }
  }

  return null;
}

function getDependenciesFromPackageJson(packageJsonPath: string): string[] {
  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
    return Object.keys(packageJson.dependencies || {});
  } catch {
    return [];
  }
}

function resolveTransitiveDependencies(
  packagePath: string,
  resolveDir: string,
  visited: Set<string> = new Set(),
  depth: number = 0,
  maxDepth: number = 5,
): string[] {
  if (depth > maxDepth || visited.has(packagePath)) {
    return [];
  }

  visited.add(packagePath);

  // Check cache first
  if (dependencyCache.has(packagePath)) {
    return dependencyCache.get(packagePath)!;
  }

  const require = createRequire(resolveDir);
  const watchFiles: string[] = [packagePath];

  try {
    // Find the package.json for this dependency by walking up the directory tree
    const packageJsonPath = findPackageJsonPath(dirname(packagePath));

    if (packageJsonPath) {
      const dependencies = getDependenciesFromPackageJson(packageJsonPath);

      // Recursively resolve each dependency
      for (const dep of dependencies) {
        try {
          const resolvedPath = require.resolve(dep);
          if (
            resolvedPath.includes("/") &&
            !resolvedPath.includes("node_modules/.bin")
          ) {
            const transitiveDeps = resolveTransitiveDependencies(
              resolvedPath,
              dirname(resolvedPath),
              visited,
              depth + 1,
              maxDepth,
            );
            watchFiles.push(...transitiveDeps);
          }
        } catch {
          // Dependency might not be resolvable, skip it
        }
      }
    } else {
      // No package.json found for this dependency
    }
  } catch {
    // package.json might not exist or be readable
  }

  // Cache the result
  dependencyCache.set(packagePath, watchFiles);
  return watchFiles;
}

export const rebuildOnDependencyChangesPlugin = (
  options: RebuildOnDependencyChangesPluginOptions = {},
) => {
  // Default to watching transitive dependencies if a start command is
  // provided (this is likely a server that should restart if any of
  // its transitive dependencies change)
  const { watchTransitiveDependencies = !!options.startCommand, maxDepth = 5 } =
    options;

  return {
    name: "watch-dependencies",
    setup(build: PluginBuild) {
      build.onResolve({ filter: /.*/ }, (args) => {
        // Only watch files from other packages in this repo (not node_modules)
        if (args.kind === "import-statement") {
          if (!args.path.startsWith(".")) {
            const require = createRequire(args.resolveDir);
            let resolved;
            try {
              resolved = require.resolve(args.path);
            } catch {
              return;
            }
            if (!resolved.includes("/")) {
              // This could be a built-in package
              return;
            }

            // Only watch if it's not in node_modules (i.e., it's from another package in this repo)
            if (!resolved.includes("node_modules")) {
              let watchFiles = [resolved];

              if (watchTransitiveDependencies) {
                // Get all transitive dependencies
                const transitiveDeps = resolveTransitiveDependencies(
                  resolved,
                  args.resolveDir,
                  new Set(),
                  0,
                  maxDepth,
                );
                watchFiles = [...new Set(transitiveDeps)]; // Remove duplicates
              }

              const isExternal = build.initialOptions.packages === "external";

              return {
                external: isExternal,
                path: isExternal ? args.path : resolved,
                watchFiles,
              };
            }

            // For node_modules dependencies, let normal resolution happen
            return undefined;
          }
        }
      });

      build.onEnd(async () => {
        if (options.startCommand) {
          console.log("Build finished. (Re)starting process");
          if (runningProcess) {
            await new Promise<void>((resolve) => {
              kill(runningProcess!.pid!, "SIGTERM", () => {
                resolve();
              });
            });
          }
          runningProcess = spawn(options.startCommand, {
            stdio: "inherit",
            shell: true,
          });
        }
      });
    },
  };
};
