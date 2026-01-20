import fs from "fs";
import { createRequire } from "module";
import os from "os";
import path from "path";
import { pathToFileURL } from "url";
import type { Argv } from "yargs";

import { loadPuppeteer } from "../lib/puppeteerLoader";

interface DescribeModelArgs {
  file: string;
  resolution?: string;
  count?: number;
}

interface AngleSpec {
  azimuthDeg: number;
  elevationDeg: number;
}

const defaultResolution = "384x384";
const defaultCount = 1;
const defaultAzimuthDeg = 45;
const defaultElevationDeg = 35.264;

function parseResolution(input: string): { width: number; height: number } {
  const trimmed = input.trim().toLowerCase();

  if (/^\d+$/.test(trimmed)) {
    const size = Number.parseInt(trimmed, 10);
    if (!Number.isFinite(size) || size <= 0) {
      throw new Error(`Invalid resolution: ${input}`);
    }
    return { width: size, height: size };
  }

  const match = trimmed.match(/^(\d+)\s*x\s*(\d+)$/);
  if (!match) {
    throw new Error(`Resolution must be formatted like 384x384 (got: ${input})`);
  }

  const width = Number.parseInt(match[1], 10);
  const height = Number.parseInt(match[2], 10);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error(`Invalid resolution: ${input}`);
  }

  return { width, height };
}

function buildAngles(count: number): AngleSpec[] {
  if (count <= 1) {
    return [{ azimuthDeg: defaultAzimuthDeg, elevationDeg: defaultElevationDeg }];
  }

  const angles: AngleSpec[] = [];
  for (let i = 0; i < count; i += 1) {
    angles.push({
      azimuthDeg: defaultAzimuthDeg + (360 * i) / count,
      elevationDeg: defaultElevationDeg,
    });
  }
  return angles;
}

function buildHtml(options: {
  modelBase64: string;
  width: number;
  height: number;
  threeUrl: string;
  gltfLoaderUrl: string;
}): string {
  const importMap = {
    imports: {
      three: options.threeUrl,
    },
  };

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, height=device-height, initial-scale=1.0">
    <style>
      html, body {
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
        background: #ffffff;
      }
      canvas {
        display: block;
        width: 100%;
        height: 100%;
      }
    </style>
    <script type="importmap">${JSON.stringify(importMap)}</script>
  </head>
  <body>
    <canvas id="mml-canvas"></canvas>
    <script type="module">
      import * as THREE from "three";
      import { GLTFLoader } from "${options.gltfLoaderUrl}";

      window.__MODEL_READY__ = false;
      window.__MODEL_ERROR__ = null;
      window.__SET_CAMERA__ = null;
      window.__MODEL_BOUNDS__ = null;

      const width = ${options.width};
      const height = ${options.height};
      const canvas = document.getElementById("mml-canvas");

      const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: false,
        preserveDrawingBuffer: true,
      });
      renderer.setSize(width, height, false);
      renderer.setPixelRatio(1);
      renderer.outputColorSpace = THREE.SRGBColorSpace;

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(1, 1, 1);

      const camera = new THREE.PerspectiveCamera(45, width / height, 0.01, 1000);

      const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
      scene.add(hemi);

      const dir = new THREE.DirectionalLight(0xffffff, 0.85);
      dir.position.set(5, 10, 7);
      scene.add(dir);

      const base64Model = ${JSON.stringify(options.modelBase64)};
      const buffer = Uint8Array.from(atob(base64Model), (c) => c.charCodeAt(0)).buffer;
      const loader = new GLTFLoader();

      function setCamera(params) {
        if (!params) return;
        const az = THREE.MathUtils.degToRad(params.azimuthDeg);
        const el = THREE.MathUtils.degToRad(params.elevationDeg);
        const r = params.radius || window.__FIT_DISTANCE__ || 1;

        const x = r * Math.cos(el) * Math.sin(az);
        const y = r * Math.sin(el);
        const z = r * Math.cos(el) * Math.cos(az);

        camera.position.set(x, y, z);
        camera.near = Math.max(r / 1000, 0.01);
        camera.far = r * 10;
        camera.lookAt(0, 0, 0);
        camera.updateProjectionMatrix();

        renderer.render(scene, camera);
      }

      loader.parse(
        buffer,
        "",
        (gltf) => {
          const model = gltf.scene || (gltf.scenes && gltf.scenes[0]);
          if (!model) {
            window.__MODEL_ERROR__ = "No scene found in glb.";
            window.__MODEL_READY__ = true;
            return;
          }

          scene.add(model);

          const box = new THREE.Box3().setFromObject(model);
          const center = box.getCenter(new THREE.Vector3());
          const size = box.getSize(new THREE.Vector3());
          model.position.sub(center);

          const maxDim = Math.max(size.x, size.y, size.z, 0.0001);
          const vFov = THREE.MathUtils.degToRad(camera.fov);
          const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
          const distV = (maxDim / 2) / Math.tan(vFov / 2);
          const distH = (maxDim / 2) / Math.tan(hFov / 2);
          window.__FIT_DISTANCE__ = Math.max(distV, distH) * 1.25;

          window.__MODEL_BOUNDS__ = {
            min: { x: box.min.x, y: box.min.y, z: box.min.z },
            max: { x: box.max.x, y: box.max.y, z: box.max.z },
            size: { x: size.x, y: size.y, z: size.z },
            center: { x: center.x, y: center.y, z: center.z },
          };

          window.__SET_CAMERA__ = setCamera;
          setCamera({ azimuthDeg: ${defaultAzimuthDeg}, elevationDeg: ${defaultElevationDeg}, radius: window.__FIT_DISTANCE__ });

          window.__MODEL_READY__ = true;
        },
        (error) => {
          window.__MODEL_ERROR__ = error ? (error.message || String(error)) : "Unknown model error.";
          window.__MODEL_READY__ = true;
        }
      );
    </script>
  </body>
</html>`;
}

function resolveThreeModulePath(requireFn: NodeRequire): string {
  const threeMainPath = requireFn.resolve("three");
  const moduleCandidate = path.join(path.dirname(threeMainPath), "three.module.js");
  if (!fs.existsSync(moduleCandidate)) {
    throw new Error("Unable to resolve three.module.js from the installed three package.");
  }
  return moduleCandidate;
}

export interface DescribeModelResult {
  file: string;
  width: number;
  height: number;
  count: number;
  format: string;
  bounds: {
    min: { x: number; y: number; z: number };
    max: { x: number; y: number; z: number };
  };
  extent: { x: number; y: number; z: number };
  center: { x: number; y: number; z: number };
  images: Array<{
    index: number;
    azimuthDeg: number;
    elevationDeg: number;
    base64: string;
  }>;
}

export interface DescribeModelOptions {
  file: string;
  resolution?: string;
  count?: number;
}

/**
 * Take screenshots of a GLB model from multiple angles and return bounds info.
 * Returns the image data as base64.
 */
export async function describeModel(options: DescribeModelOptions): Promise<DescribeModelResult> {
  const filePath = path.resolve(options.file);
  const { width, height } = parseResolution(options.resolution || defaultResolution);
  const count = options.count !== undefined ? Number(options.count) : defaultCount;

  if (!Number.isFinite(count) || count < 1 || !Number.isInteger(count)) {
    throw new Error(`Count must be a positive integer (got: ${options.count})`);
  }

  const stat = await fs.promises.stat(filePath);
  if (!stat.isFile()) {
    throw new Error(`File not found: ${filePath}`);
  }

  const modelBase64 = (await fs.promises.readFile(filePath)).toString("base64");

  const require = createRequire(import.meta.url);
  const threeModulePath = resolveThreeModulePath(require);
  const gltfLoaderPath = require.resolve("three/examples/jsm/loaders/GLTFLoader.js");

  const html = buildHtml({
    modelBase64,
    width,
    height,
    threeUrl: pathToFileURL(threeModulePath).href,
    gltfLoaderUrl: pathToFileURL(gltfLoaderPath).href,
  });

  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "mml-describe-model-"));
  const htmlPath = path.join(tempDir, "index.html");
  await fs.promises.writeFile(htmlPath, html, "utf8");

  const puppeteer = await loadPuppeteer();

  let browser: any | null = null;

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-web-security",
        "--allow-file-access-from-files",
      ],
    });

    const page: any = await browser.newPage();
    await page.setViewport({ width, height });
    await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "load", timeout: 30000 });

    await page.waitForFunction(
      () => (window as unknown as { __MODEL_READY__?: boolean }).__MODEL_READY__ === true,
      {
        timeout: 30000,
      },
    );

    const modelError = await page.evaluate(() => {
      const w = window as unknown as { __MODEL_ERROR__?: string | null };
      return w.__MODEL_ERROR__ || null;
    });
    if (modelError) {
      throw new Error(`Failed to load model: ${modelError}`);
    }

    const bounds = await page.evaluate(() => {
      const w = window as unknown as {
        __MODEL_BOUNDS__?: {
          min: { x: number; y: number; z: number };
          max: { x: number; y: number; z: number };
          size: { x: number; y: number; z: number };
          center: { x: number; y: number; z: number };
        } | null;
      };
      return w.__MODEL_BOUNDS__ || null;
    });
    if (!bounds) {
      throw new Error("Failed to compute model bounds.");
    }

    const angles = buildAngles(count);
    const images: DescribeModelResult["images"] = [];

    for (let i = 0; i < angles.length; i += 1) {
      const angle = angles[i];
      await page.evaluate((params: AngleSpec) => {
        const w = window as unknown as { __SET_CAMERA__?: (p: AngleSpec) => void };
        if (w.__SET_CAMERA__) {
          w.__SET_CAMERA__(params);
        }
      }, angle);

      await new Promise((resolve) => setTimeout(resolve, 50));

      const buffer = (await page.screenshot({
        type: "png",
        fullPage: false,
      })) as Buffer;

      images.push({
        index: i,
        azimuthDeg: angle.azimuthDeg,
        elevationDeg: angle.elevationDeg,
        base64: buffer.toString("base64"),
      });
    }

    return {
      file: filePath,
      width,
      height,
      count: images.length,
      format: "png",
      bounds: {
        min: bounds.min,
        max: bounds.max,
      },
      extent: bounds.size,
      center: bounds.center,
      images,
    };
  } finally {
    if (browser) {
      await browser.close();
    }
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  }
}

async function runDescribeModel(argv: DescribeModelArgs): Promise<void> {
  const result = await describeModel({
    file: argv.file,
    resolution: argv.resolution,
    count: argv.count,
  });

  // Convert to dataUrl format for CLI output compatibility
  const output = {
    ...result,
    images: result.images.map((img) => ({
      ...img,
      dataUrl: `data:image/png;base64,${img.base64}`,
    })),
  };

  console.log(JSON.stringify(output));
}

export function registerDescribeModelCommand(yargs: Argv): Argv {
  return yargs.command(
    "describe-model <file>",
    "Take screenshots of a GLB model and return bounds/extent",
    (y) =>
      y
        .positional("file", {
          describe: "Path to a .glb file",
          type: "string",
          demandOption: true,
        })
        .option("resolution", {
          alias: "r",
          type: "string",
          describe: "Resolution (e.g. 384x384 or 512)",
          default: defaultResolution,
        })
        .option("count", {
          alias: "n",
          type: "number",
          describe: "Number of images to capture",
          default: defaultCount,
        })
        .example("$0 describe-model ./model.glb", "Capture a default isometric screenshot")
        .example("$0 describe-model ./model.glb -r 512x512 -n 4", "Capture four angles at 512x512"),
    async (argv) => {
      await runDescribeModel(argv as DescribeModelArgs);
    },
  );
}
