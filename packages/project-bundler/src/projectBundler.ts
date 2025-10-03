import * as esbuild from "esbuild-wasm";
import esbuildWasmModuleBase64 from "esbuild-wasm/esbuild.wasm?base64";
import { SystemPackage } from "mml-game-systems-common";

import { loadSystemPackage } from "./loadSystem";
import { generateSystemScripts } from "./systemScript";

let esbuildInitializedPromise: Promise<void> | null = null;

const ensureEsbuild = async () => {
  if (esbuildInitializedPromise) {
    return esbuildInitializedPromise;
  }

  esbuildInitializedPromise = esbuild.initialize({
    wasmURL: "data:application/octet-stream;base64," + esbuildWasmModuleBase64,
    worker: true,
  });

  return esbuildInitializedPromise;
};

export class ProjectBundler {
  constructor() {}

  static async bundleProject(
    files: Record<string, string>,
    systems: Map<string, Record<string, unknown>>,
  ): Promise<{
    html: string;
    systemScripts: string;
    userScripts: string;
    combined: string;
  }> {
    await ensureEsbuild();

    const systemPackagesPromiseMap = new Map<string, Promise<SystemPackage>>();

    for (const systemName of systems.keys()) {
      systemPackagesPromiseMap.set(systemName, loadSystemPackage(systemName));
    }

    await Promise.all(Array.from(systemPackagesPromiseMap.values()));
    const systemPackagesMap = new Map<string, SystemPackage>();
    for (const [systemName, systemPackagePromise] of systemPackagesPromiseMap) {
      const systemPackage = await systemPackagePromise;
      systemPackagesMap.set(systemName, systemPackage);
    }

    // Combine MML and JavaScript content for loading into the local document
    const mmlContent = files["scene.mml"] || "";
    const userJsContent = files["script.js"] || "";

    let combinedJS = "";

    // Inject system scripts as ES modules at the beginning
    const systemNames: string[] = [];

    const scripts: string[] = [];

    for (const [, systemPackage] of systemPackagesMap) {
      const config: Record<string, unknown> = systems.get(systemPackage.schema.name) || {};
      systemNames.push(systemPackage.schema.name);
      const systemScripts = generateSystemScripts(systemPackage.schema.name, systemPackage, config);
      if (systemScripts) {
        scripts.push(...systemScripts);
      }
    }

    if (scripts.length > 0) {
      combinedJS += scripts.join("\n");
    }

    const buildResult = await esbuild.build({
      stdin: {
        contents: combinedJS,
        loader: "ts",
        resolveDir: "/",
        sourcefile: "systemScript.ts",
      },
      bundle: true,
      format: "iife",
      platform: "browser",
      write: false,
    });

    const systemJs = buildResult.outputFiles[0].text.trim();

    const html = mmlContent.trim();

    let combined = "";

    if (systemJs) {
      combined += `<script>${systemJs}</script>\n`;
    }

    if (html) {
      combined += html;
    }

    let userJs = "";
    const trimmedJsContent = userJsContent.trim();
    if (trimmedJsContent) {
      try {
        const userBuildResult = await esbuild.build({
          stdin: {
            contents: userJsContent,
            loader: "ts",
            resolveDir: "/",
            sourcefile: "userScript.ts",
          },
          bundle: true,
          format: "iife",
          platform: "browser",
          write: false,
        });

        userJs = userBuildResult.outputFiles[0].text.trim();

        combined += `<script>${userJs}</script>\n`;
      } catch (error) {
        console.error("Error building user script:", error);
      }
    }

    return {
      html,
      systemScripts: systemJs,
      userScripts: userJs,
      combined,
    };
  }
}
