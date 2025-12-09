import type { Argv } from "yargs";

export function registerDeployCommand(yargs: Argv): Argv {
  return yargs.command(
    "deploy",
    "Deploy the current build (placeholder)",
    (command) => command,
    async () => {
      console.log("🚀 mml deploy: not implemented yet. Skipping.");
    },
  );
}
