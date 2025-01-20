import { createRequire } from "node:module";

import { spawn } from "child_process";
import { PluginBuild } from "esbuild";
import kill from "tree-kill";

let runningProcess: ReturnType<typeof spawn> | undefined;

export const rebuildOnDependencyChangesPlugin = {
  name: "watch-dependencies",
  setup(build: PluginBuild) {
    build.onResolve({ filter: /.*/ }, (args) => {
      // Include dependent packages in the watch list
      if (args.kind === "import-statement") {
        if (!args.path.startsWith(".")) {
          const require = createRequire(args.resolveDir);
          let resolved;
          try {
            resolved = require.resolve(args.path);
          } catch {
            return;
          }
          return {
            external: true,
            watchFiles: [resolved],
          };
        }
      }
    });
    build.onEnd(async () => {
      console.log("Build finished. (Re)starting process");
      if (runningProcess) {
        await new Promise<void>((resolve) => {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          kill(runningProcess!.pid!, "SIGTERM", (err) => {
            resolve();
          });
        });
      }
      runningProcess = spawn("npm", ["run", "start-server"], {
        stdio: "inherit",
      });
    });
  },
};
