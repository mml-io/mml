import { MultiGameBuilder, MultiGameBuilderOptions } from "@mml-io/multi-game-builder";
import path from "path";

export interface RunMultiGameBuilderOptions {
  rootPath: string;
  assetsDirectory?: string;
  watchMode?: boolean;
  server?: {
    port?: number;
    host?: string;
    runnerUrl?: string;
    corsEnabled?: boolean;
    corsOrigins?: string | string[];
  };
}

export async function runMultiGameBuilder(
  options: RunMultiGameBuilderOptions,
): Promise<MultiGameBuilder> {
  const normalizedRoot = path.resolve(options.rootPath);

  const builderOptions: MultiGameBuilderOptions = {
    rootPath: normalizedRoot,
    assetsDirectory: options.assetsDirectory ? path.resolve(options.assetsDirectory) : undefined,
    watchMode: options.watchMode,
    serverOptions: options.server
      ? {
          port: options.server.port,
          host: options.server.host,
          runnerUrl: options.server.runnerUrl,
          corsEnabled: options.server.corsEnabled,
          corsOrigins: options.server.corsOrigins,
        }
      : undefined,
  };

  const builder = new MultiGameBuilder(builderOptions);
  await builder.start();
  return builder;
}
