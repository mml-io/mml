import * as esbuild from "esbuild";
import * as fs from "fs";
import * as path from "path";
import { createRequire } from "module";

export interface ScriptConfig {
  src: string;
  configName?: string;
  config?: Record<string, unknown>;
  async?: boolean;
  defer?: boolean;
}

export interface ScriptsConfig {
  scripts: ScriptConfig[];
}

export interface ScriptInjectionPluginOptions {
  configPath?: string;
  htmlTemplate?: string;
  filename?: string;
  assetsDir?: string;
  manifestFilename?: string;
}

type Manifest = {
  worlds: string[];
  documentNameToPath: Record<string, string>;
  assetNameToPath: Record<string, string>;
  documentPrefix: string;
  assetPrefix: string;
};

function resolveScriptPath(src: string, buildRoot: string, configPath?: string): string {
  // If it's already an absolute path, return as-is
  if (path.isAbsolute(src)) {
    return src;
  }
  
  // If it starts with ./ or ../, treat as relative path
  if (src.startsWith('./') || src.startsWith('../')) {
    // Resolve relative to the directory containing the config file, or build root if no config path
    const baseDir = configPath ? path.dirname(path.resolve(configPath)) : buildRoot;
    return path.resolve(baseDir, src);
  }
  
  // Try to resolve as npm package first
  try {
    // Create require function relative to the build root
    const require = createRequire(path.join(buildRoot, 'package.json'));
    const resolvedPackagePath = require.resolve(src);
    return resolvedPackagePath;
  } catch (error) {
    // If all resolution attempts fail, treat as relative path
    console.warn(`Could not resolve package "${src}", treating as relative path`);
    return path.resolve(src);
  }
}

// Helper functions for better organization
function loadScriptsConfig(configPath: string): ScriptsConfig | null {
  const configFullPath = path.resolve(configPath);
  if (!fs.existsSync(configFullPath)) {
    return null;
  }
  
  try {
    const configContent = fs.readFileSync(configFullPath, "utf-8");
    return JSON.parse(configContent);
  } catch (error) {
    console.error(`Error parsing scripts config: ${configFullPath}`, error);
    return null;
  }
}

function collectWatchedFiles(htmlTemplate: string | undefined, configPath: string, buildRoot: string): string[] {
  const watchedFiles: string[] = [];
  
  // Add HTML template to watched files
  if (htmlTemplate) {
    watchedFiles.push(path.resolve(htmlTemplate));
  }
  
  // Add config file and script files to watched files
  const configFullPath = path.resolve(configPath);
  if (fs.existsSync(configFullPath)) {
    watchedFiles.push(configFullPath);
    
    const config = loadScriptsConfig(configPath);
    if (config) {
      for (const script of config.scripts) {
        try {
          const scriptPath = resolveScriptPath(script.src, buildRoot, configPath);
          if (fs.existsSync(scriptPath)) {
            watchedFiles.push(scriptPath);
          } else {
            console.warn(`Script file not found for watching: ${scriptPath} (from src: ${script.src})`);
          }
        } catch (error) {
          console.warn(`Could not resolve script path for watching: ${script.src}`, error);
        }
      }
    }
  }
  
  return watchedFiles;
}

function generateConfigScript(configName: string, config: Record<string, unknown>): string {
  return `
    (function() {
      console.log("Initializing ${configName} system");
      
      if (!window.systemsConfig) {
        window.systemsConfig = {};
      }
    
      window.systemsConfig["${configName}"] = ${JSON.stringify(config)};
    })();`;
}

function generateScriptTag(script: ScriptConfig, buildRoot: string, configPath?: string): string {
  const { configName, config: scriptConfig } = script;
  
  // Validate config setup
  if (scriptConfig && !configName) {
    console.warn("Config provided but no config name provided");
  } else if (configName && !scriptConfig) {
    console.warn("Config name provided but no config provided");
  }
  
  // Generate config initialization script
  const configScript = scriptConfig && configName 
    ? generateConfigScript(configName, scriptConfig)
    : "";
  
  // Resolve and read script file
  const scriptPath = resolveScriptPath(script.src, buildRoot, configPath);
  if (!fs.existsSync(scriptPath)) {
    console.warn(`Script file not found: ${scriptPath} (from src: ${script.src})`);
    return `<!-- Script not found: ${script.src} -->`;
  }
  
  const scriptContent = fs.readFileSync(scriptPath, "utf-8");
  return `<script>${configScript}(() => {${scriptContent}})()</script>`;
}

function loadHtmlTemplate(htmlTemplate: string | undefined): string {
  if (!htmlTemplate) {
    return "";
  }
  
  const templatePath = path.resolve(htmlTemplate);
  if (!fs.existsSync(templatePath)) {
    throw new Error(`HTML template not found: ${templatePath}`);
  }
  
  return fs.readFileSync(templatePath, "utf-8");
}

function addBuiltScripts(htmlContent: string, result: esbuild.BuildResult): string {
  if (!result.metafile) {
    return htmlContent;
  }
  
  const jsFiles = Object.keys(result.metafile.outputs).filter(file => 
    file.endsWith('.js') && !file.includes('chunk')
  );
  
  for (const jsFile of jsFiles) {
    const scriptContent = fs.readFileSync(jsFile, "utf-8");
    htmlContent += `\n<script>${scriptContent}</script>`;
  }
  return htmlContent;
}

async function collectAssetFiles(assetRoot: string, relativePrefix = ""): Promise<string[]> {
  const entries = await fs.promises.readdir(assetRoot, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = path.join(assetRoot, entry.name);
    const relativePath = relativePrefix ? path.join(relativePrefix, entry.name) : entry.name;

    if (entry.isDirectory()) {
      const nested = await collectAssetFiles(entryPath, relativePath);
      files.push(...nested);
      continue;
    }

    if (entry.isFile()) {
      files.push(relativePath);
    }
  }

  return files;
}

async function copyAssetsToOutdir(
  sourceDir: string,
  outputAssetsDir: string,
): Promise<Record<string, string>> {
  if (!fs.existsSync(sourceDir)) {
    return {};
  }

  const assetFiles = await collectAssetFiles(sourceDir);
  if (assetFiles.length === 0) {
    return {};
  }

  await fs.promises.mkdir(outputAssetsDir, { recursive: true });

  const assetNameToPath: Record<string, string> = {};
  for (const relativeFile of assetFiles) {
    const normalizedRelative = relativeFile.split(path.sep).join("/");
    const destination = path.join(outputAssetsDir, relativeFile);
    await fs.promises.mkdir(path.dirname(destination), { recursive: true });
    await fs.promises.copyFile(path.join(sourceDir, relativeFile), destination);
    assetNameToPath[normalizedRelative] = ["assets", normalizedRelative].join("/").replace(/\/+/g, "/");
  }

  return assetNameToPath;
}

async function loadManifest(manifestPath: string): Promise<Manifest | null> {
  if (!fs.existsSync(manifestPath)) {
    return null;
  }

  const content = await fs.promises.readFile(manifestPath, "utf-8");
  return JSON.parse(content) as Manifest;
}

function createDefaultManifest(): Manifest {
  return {
    worlds: [],
    documentNameToPath: {},
    assetNameToPath: {},
    documentPrefix: "ws:///",
    assetPrefix: "/assets/",
  };
}


export function mmlGameEngineBuildPlugin(options: ScriptInjectionPluginOptions = {}): esbuild.Plugin {
  const configPath = options.configPath || "./scripts.json";
  const htmlTemplate = options.htmlTemplate;
  const filename = options.filename || "index.html";
  const manifestFilename = options.manifestFilename || "manifest.json";
  
  return {
    name: "script-injection-html",
    setup(build: esbuild.PluginBuild) {
      let buildRoot: string | null = null;
      
      // Capture the resolveDir from the first entry point resolution
      build.onResolve({ filter: /.*/, namespace: 'file' }, (args) => {
        if (args.kind === 'entry-point' && !buildRoot) {
          buildRoot = args.resolveDir;
        }
        return null; // Let esbuild handle the resolution
      });

      // Add file watching by intercepting the main entry point
      build.onLoad({ filter: /src\/index\.ts$/ }, async (args) => {
        // Use the resolveDir from the args if we haven't captured buildRoot yet
        const currentBuildRoot = buildRoot || path.dirname(args.path);
        
        const watchedFiles = collectWatchedFiles(htmlTemplate, configPath, currentBuildRoot);
        
        const contents = await fs.promises.readFile(args.path, 'utf8');
        return {
          contents,
          loader: 'ts',
          watchFiles: watchedFiles
        };
      });

      // Hook into the HTML generation process
      build.onEnd(async (result) => {
        if (result.errors.length > 0) {
          return;
        }

        try {
          const outdir = build.initialOptions.outdir || "./build";
          const htmlPath = path.join(outdir, filename);
          
          // Use buildRoot if available, otherwise fall back to outdir
          const currentBuildRoot = buildRoot || outdir;
          
          // Load HTML template
          let htmlContent = loadHtmlTemplate(htmlTemplate);

          // Add external scripts from configuration
          const config = loadScriptsConfig(configPath);
          if (config) {
            const externalScriptTags = config.scripts.map(script => generateScriptTag(script, currentBuildRoot, configPath));
            htmlContent = externalScriptTags.join("\n") + "\n" + htmlContent;
          }

          // Add built scripts
          htmlContent = addBuiltScripts(htmlContent, result);

          // Write the final HTML
          fs.writeFileSync(htmlPath, htmlContent);

          // Copy assets and update manifest
          const assetsSourceDir =
            options.assetsDir !== undefined
              ? path.resolve(options.assetsDir)
              : path.join(currentBuildRoot, "assets");
          const outputAssetsDir = path.join(outdir, "assets");
          const manifestPath = path.join(outdir, manifestFilename);

          const manifest = (await loadManifest(manifestPath)) ?? createDefaultManifest();
          manifest.assetPrefix = manifest.assetPrefix || "/assets/";
          const copiedAssets = await copyAssetsToOutdir(assetsSourceDir, outputAssetsDir);
          manifest.assetNameToPath = {
            ...manifest.assetNameToPath,
            ...copiedAssets,
          };

          await fs.promises.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
        } catch (error) {
          console.error("Error in script injection HTML plugin:", error);
        }
      });
    },
  } satisfies esbuild.Plugin;
}

