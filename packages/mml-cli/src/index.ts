import { Command, InvalidArgumentError, Option } from "commander";

import { type FormatOption, serve } from "./serve.js";
import { serveDir } from "./serve-dir.js";
import { validate } from "./validate.js";

function parseIntArg(value: string): number {
  const n = parseInt(value, 10);
  if (Number.isNaN(n)) {
    throw new InvalidArgumentError("Not a number.");
  }
  return n;
}

const program = new Command();

program.name("mml").description("MML command-line tool");

program
  .command("serve")
  .description("Serve an HTML or JS file over WebSocket with live-reloading on file changes")
  .argument("<file>", "path to the HTML or JS file to serve")
  .option("-p, --port <number>", "port to serve on", parseIntArg, 7079)
  .option("--host <address>", "host to listen on", "127.0.0.1")
  .addOption(
    new Option("--format <format>", "file format: detect (from extension), html, or js")
      .choices(["detect", "html", "js"])
      .default("detect"),
  )
  .option("--no-watch", "disable watching the file for changes")
  .option("--no-client", "disable serving the web client")
  .option("--assets <path>", "serve a directory as static assets")
  .option("--assets-url-path <path>", "URL path to serve assets on", "/assets/")
  .action(
    (
      file: string,
      options: {
        port: number;
        host: string;
        format: FormatOption;
        watch: boolean;
        client: boolean;
        assets?: string;
        assetsUrlPath: string;
      },
    ) => {
      serve(file, {
        port: options.port,
        host: options.host,
        format: options.format,
        watch: options.watch,
        client: options.client,
        assets: options.assets,
        assetsUrlPath: options.assetsUrlPath,
      });
    },
  );

program
  .command("serve-dir")
  .description(
    "Serve all HTML and JS files in a directory over WebSocket with live-reloading (top-level files only)",
  )
  .argument("<dir>", "path to the directory containing HTML or JS files")
  .option("-p, --port <number>", "port to serve on", parseIntArg, 7079)
  .option("--host <address>", "host to listen on", "127.0.0.1")
  .option("--pattern <glob>", "glob pattern to filter served files (e.g. 'app-*.js')")
  .option("--no-client", "disable serving the web client")
  .option("--assets <path>", "serve a directory as static assets")
  .option("--assets-url-path <path>", "URL path to serve assets on", "/assets/")
  .option(
    "--idle-timeout <seconds>",
    "stop document after N seconds with no connections (0 to disable)",
    parseIntArg,
    60,
  )
  .option("--reset", "enable /:documentPath/reset endpoint to reload documents", false)
  .option("--define-globals", "pass defineGlobals=true to the web client for testing", false)
  .option("--delay", "enable ?delay=<ms> query parameter to delay responses (for testing)", false)
  .action(
    (
      dir: string,
      options: {
        port: number;
        host: string;
        pattern?: string;
        client: boolean;
        assets?: string;
        assetsUrlPath: string;
        idleTimeout: number;
        reset: boolean;
        defineGlobals: boolean;
        delay: boolean;
      },
    ) => {
      serveDir(dir, {
        port: options.port,
        host: options.host,
        pattern: options.pattern,
        client: options.client,
        assets: options.assets,
        assetsUrlPath: options.assetsUrlPath,
        idleTimeout: options.idleTimeout,
        reset: options.reset,
        defineGlobals: options.defineGlobals,
        delay: options.delay,
      });
    },
  );

program
  .command("validate")
  .description("Validate MML documents against the schema")
  .argument("<files...>", "paths to HTML files to validate")
  .option("--json", "output errors as JSON", false)
  .action((files: string[], options: { json: boolean }) => {
    validate(files, { json: options.json });
  });

program.parse();
