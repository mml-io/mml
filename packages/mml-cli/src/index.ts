import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { registerBuildCommand } from "./commands/build";
import { registerCreateCommand } from "./commands/create";
import { registerDebugCommand } from "./commands/debug";
import { registerDeployCommand } from "./commands/deploy";
import { registerDescribeModelCommand } from "./commands/describeModel";
import { registerDevCommand } from "./commands/dev";
import { registerDocsCommand } from "./commands/docs";
import { registerExamplesCommand } from "./commands/examples";
import { registerMusicCommand } from "./commands/music";
import { registerSfxCommand } from "./commands/sfx";

async function main(): Promise<void> {
  const parser = yargs(hideBin(process.argv))
    .scriptName("mml")
    .usage("$0 <command> [options]")
    .showHelpOnFail(true)
    .recommendCommands()
    .strict();

  registerCreateCommand(parser);
  registerBuildCommand(parser);
  registerDevCommand(parser);
  registerDeployCommand(parser);
  registerDebugCommand(parser);
  registerDocsCommand(parser);
  registerExamplesCommand(parser);
  registerDescribeModelCommand(parser);
  registerSfxCommand(parser);
  registerMusicCommand(parser);

  parser
    .demandCommand(1, "Please specify a command")
    .help("h")
    .alias("h", "help")
    .version("version")
    .alias("v", "version");

  await parser.parseAsync();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
