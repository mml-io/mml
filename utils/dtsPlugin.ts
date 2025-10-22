// Originally from Floffah https://github.com/Floffah/esbuild-plugin-d.ts/blob/master/LICENSE

import { LogLevel, OnLoadArgs, Plugin } from "esbuild";
import { existsSync, lstatSync, readFileSync } from "fs";
import jju from "jju";
import { basename, dirname, resolve } from "path";
import tmp from "tmp";
import ts from "typescript";

function getTSConfig(
  forcepath?: string,
  conf?: string,
  wd = process.cwd(),
): { loc: string; conf: any } {
  let f = forcepath ?? ts.findConfigFile(wd, ts.sys.fileExists, conf);
  if (!f) throw "No config file found";
  if (f.startsWith(".")) f = new URL(f, import.meta.url).pathname;
  const c = ts.readConfigFile(f, (path) => readFileSync(path, "utf-8"));
  if (c.error) throw c.error;
  else return { loc: f, conf: c.config };
}

interface DTSPluginOpts {
  /**
   * override the directory to output to.
   * @default undefined
   */
  outDir?: string;
  /**
   * path to the tsconfig to use. (some monorepos might need to use this)
   */
  tsconfig?: string;
}

function getLogLevel(level?: LogLevel): LogLevel[] {
  if (!level || level === "silent") return ["silent"];

  const levels: LogLevel[] = ["verbose", "debug", "info", "warning", "error", "silent"];

  for (const l of levels) {
    if (l === level) {
      break;
    } else {
      levels.splice(levels.indexOf(l), 1);
    }
  }

  return levels;
}

function humanFileSize(size: number): string {
  const i = Math.floor(Math.log(size) / Math.log(1024));
  return Math.round((size / Math.pow(1024, i)) * 100) / 100 + ["b", "kb", "mb", "gb", "tb"][i];
}

export const dtsPlugin = (opts: DTSPluginOpts = {}) =>
  ({
    name: "dts-plugin",
    setup(build) {
      // context
      const l = getLogLevel(build.initialOptions.logLevel);
      const conf = getTSConfig(opts.tsconfig);
      const finalconf = conf.conf;

      // get extended config
      if (Object.prototype.hasOwnProperty.call(conf.conf, "extends")) {
        const extendedfile = readFileSync(resolve(dirname(conf.loc), conf.conf.extends), "utf-8");
        const extended = jju.parse(extendedfile);
        if (
          Object.prototype.hasOwnProperty.call(extended, "compilerOptions") &&
          Object.prototype.hasOwnProperty.call(finalconf, "compilerOptions")
        ) {
          finalconf.compilerOptions = {
            ...extended.compilerOptions,
            ...finalconf.compilerOptions,
          };
        }
      }

      // get and alter compiler options
      const copts = ts.convertCompilerOptionsFromJson(
        finalconf.compilerOptions,
        process.cwd(),
      ).options;
      copts.declaration = true;
      copts.declarationMap = true;
      copts.emitDeclarationOnly = true;
      copts.incremental = true;
      if (!copts.declarationDir)
        copts.declarationDir = opts.outDir ?? build.initialOptions.outdir ?? copts.outDir;

      // auto incremental
      const pjloc = resolve(conf.loc, "../", "package.json");
      if (existsSync(pjloc)) {
        const packageData = JSON.parse(readFileSync(pjloc, "utf-8"));
        copts.tsBuildInfoFile = resolve(
          tmp.tmpdir,
          packageData.name ?? "unnamed",
          ".esbuild",
          ".tsbuildinfo",
        );
      }
      copts.listEmittedFiles = true;

      // ts compiler stuff
      const host = copts.incremental
        ? ts.createIncrementalCompilerHost(copts)
        : ts.createCompilerHost(copts);
      const files: string[] = [];

      // get all ts files
      build.onLoad({ filter: /(\.tsx|\.ts)$/ }, (args: OnLoadArgs) => {
        files.push(args.path);

        host.getSourceFile(
          args.path,
          copts.target ?? ts.ScriptTarget.Latest,
          (m) => console.log(m),
          true,
        );

        return {};
      });

      // finish compilation
      build.onEnd(() => {
        const finalprogram = copts.incremental
          ? ts.createIncrementalProgram({
              options: copts,
              host,
              rootNames: files,
            })
          : ts.createProgram(files, copts, host);

        const start = Date.now();
        const emit = finalprogram.emit();

        let final = "";
        if (emit.emitSkipped || typeof emit.emittedFiles === "undefined") {
          if (l.includes("warning")) console.warn(`Typescript did not emit anything`);
        } else {
          for (const emitted of emit.emittedFiles) {
            if (existsSync(emitted) && !emitted.endsWith(".tsbuildinfo")) {
              const stat = lstatSync(emitted);
              final += `  ${resolve(emitted)
                .replace(resolve(process.cwd()), "")
                .replace(/^[\\/]/, "")
                .replace(basename(emitted), `${basename(emitted)}`)} ${humanFileSize(stat.size)}\n`;
            }
          }
        }
        if (l.includes("info"))
          console.log(final + `\nFinished compiling declarations in ${Date.now() - start}ms`);
      });
    },
  }) as Plugin;
