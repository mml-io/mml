import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { registerBuildCommand } from "./commands/build";
import { registerCreateCommand } from "./commands/create";
import { registerDeployCommand } from "./commands/deploy";
import { registerDevCommand } from "./commands/serve";

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
