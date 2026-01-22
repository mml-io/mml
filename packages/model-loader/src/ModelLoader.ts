import BASIS_TRANSCODER_JS from "base64:three/examples/jsm/libs/basis/basis_transcoder.js";
import BASIS_TRANSCODER_WASM from "base64:three/examples/jsm/libs/basis/basis_transcoder.wasm";
import DRACO_DECODER_WASM from "base64:three/examples/jsm/libs/draco/gltf/draco_decoder.wasm";
import DRACO_WASM_WRAPPER from "base64:three/examples/jsm/libs/draco/gltf/draco_wasm_wrapper.js";
import { AnimationClip, FileLoader, Group, LoadingManager, WebGLRenderer } from "three";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";

let cachedTextDecoder: TextDecoder | null = null;

function getTextDecoder(): TextDecoder {
  if (cachedTextDecoder) {
    return cachedTextDecoder;
  }
  // Use global TextDecoder if available, fallback to Node's util
  let decoder: TextDecoder;
  if (typeof globalThis.TextDecoder === "function") {
    decoder = new globalThis.TextDecoder();
  } else {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const util = require("node:util");
    decoder = new util.TextDecoder();
  }
  cachedTextDecoder = decoder;
  return decoder;
}

function convertArrayBufferToString(buffer: ArrayBuffer, from?: number, to?: number) {
  if (from === undefined) {
    from = 0;
  }
  if (to === undefined) {
    to = buffer.byteLength;
  }

  return getTextDecoder().decode(new Uint8Array(buffer, from, to));
}

const fbxBinaryHeader = "Kaydara\u0020FBX\u0020Binary\u0020\u0020\0";
function IsFBXBinary(buffer: ArrayBuffer): boolean {
  return (
    buffer.byteLength >= fbxBinaryHeader.length &&
    fbxBinaryHeader === convertArrayBufferToString(buffer, 0, fbxBinaryHeader.length)
  );
}

const gtlfBinaryHeader = "glTF";
function IsGLB(buffer: ArrayBuffer): boolean {
  return buffer.byteLength >= 4 && gtlfBinaryHeader === convertArrayBufferToString(buffer, 0, 4);
}

const fbxTextHeader = [
  "K",
  "a",
  "y",
  "d",
  "a",
  "r",
  "a",
  "\\",
  "F",
  "B",
  "X",
  "\\",
  "B",
  "i",
  "n",
  "a",
  "r",
  "y",
  "\\",
  "\\",
];
function isFbxFormatASCII(text: string): boolean {
  let cursor = 0;

  function read(offset: number) {
    const result = text[offset - 1];
    text = text.slice(cursor + offset);
    cursor++;
    return result;
  }

  for (let i = 0; i < fbxTextHeader.length; ++i) {
    const num = read(1);
    if (num !== fbxTextHeader[i]) {
      return false;
    }
  }

  return true;
}

export type ModelLoadResult = { group: Group; animations: Array<AnimationClip> };

export class ModelLoader {
  private fbxLoader: FBXLoader;
  private gltfLoader: GLTFLoader;
  private static dracoLoader: DRACOLoader | null = null;
  private static ktx2Loader: KTX2Loader | null = null;

  private static getDracoLoader() {
    if (ModelLoader.dracoLoader) {
      return ModelLoader.dracoLoader;
    }
    ModelLoader.dracoLoader = new DRACOLoader({
      /*
       Implement the methods of the LoadingManager interface so that we can inject the embedded Draco decoder
       rather than retrieve it from the network by overriding the resolveURL method to return data URIs.
      */
      resolveURL: (url: string) => {
        if (url === "draco_wasm_wrapper.js") {
          return "data:text/javascript;base64," + DRACO_WASM_WRAPPER;
        } else if (url === "draco_decoder.wasm") {
          return "data:application/wasm;base64," + DRACO_DECODER_WASM;
        }
        return url;
      },
      itemStart: () => {
        // no-op
      },
      itemEnd: () => {
        // no-op
      },
      itemError: () => {
        // no-op
      },
      abortController: new AbortController(),
    }).preload();
    return ModelLoader.dracoLoader;
  }

  constructor(
    private manager?: LoadingManager,
    private options: { requestHeader?: Record<string, string>; withCredentials?: boolean } = {},
  ) {
    this.gltfLoader = new GLTFLoader(this.manager)
      .setMeshoptDecoder(MeshoptDecoder)
      .setDRACOLoader(ModelLoader.getDracoLoader())
      .setKTX2Loader(ModelLoader.getKTX2Loader());

    this.fbxLoader = new FBXLoader(this.manager);
  }

  private static getKTX2Loader() {
    if (ModelLoader.ktx2Loader) {
      return ModelLoader.ktx2Loader;
    }
    ModelLoader.ktx2Loader = new KTX2Loader({
      resolveURL: (url: string) => {
        if (url.endsWith("basis_transcoder.js")) {
          return "data:text/javascript;base64," + BASIS_TRANSCODER_JS;
        } else if (url.endsWith("basis_transcoder.wasm")) {
          return "data:application/wasm;base64," + BASIS_TRANSCODER_WASM;
        }
        return url;
      },
      itemStart: () => {
        // no-op
      },
      itemEnd: () => {
        // no-op
      },
      itemError: () => {
        // no-op
      },
      abortController: new AbortController(),
    } as unknown as LoadingManager);
    // Ensure the loader does not try to fetch from network paths
    ModelLoader.ktx2Loader.setTranscoderPath("");

    // Attempt to detect GPU compressed texture support when a WebGL context can be created.
    // In non-browser/test environments without WebGL (e.g. Node), skip detection gracefully.
    try {
      const tempRenderer = new WebGLRenderer();
      ModelLoader.ktx2Loader.detectSupport(tempRenderer);
      tempRenderer.dispose();
    } catch {
      // WebGL context could not be created; skip detection in this environment.
    }

    return ModelLoader.ktx2Loader;
  }

  public static getSharedKTX2Loader() {
    return ModelLoader.getKTX2Loader();
  }

  public async load(
    url: string,
    onProgress?: (loaded: number, total: number) => void,
    abortController?: AbortController,
  ) {
    return new Promise<ModelLoadResult>((resolve, reject) => {
      const resourcePath = ModelLoader.extractUrlBase(url);

      this.manager?.itemStart(url);

      const _onError = (e: Error) => {
        reject(e);

        this.manager?.itemError(url);
        this.manager?.itemEnd(url);
      };

      const loader = new FileLoader(this.manager);
      loader.setResponseType("arraybuffer");
      if (this.options.requestHeader) {
        loader.setRequestHeader(this.options.requestHeader);
      }
      if (this.options.withCredentials !== undefined) {
        loader.setWithCredentials(this.options.withCredentials);
      }

      if (abortController) {
        abortController.signal.addEventListener("abort", () => {
          console.log(`Aborting ModelLoader for ${url}`);
          loader.abort();
        });
      }

      loader.load(
        url,
        async (data: ArrayBuffer) => {
          try {
            const loadResult = await this.loadFromBuffer(data, resourcePath);
            this.manager?.itemEnd(url);
            resolve(loadResult);
          } catch (e) {
            _onError(e);
          }
        },
        (progressEvent: ProgressEvent) => {
          if (onProgress && progressEvent.lengthComputable) {
            onProgress(progressEvent.loaded, progressEvent.total);
          }
        },
        _onError,
      );
    });
  }

  private static extractUrlBase(url: string): string {
    const index = url.lastIndexOf("/");

    if (index === -1) {
      return "./";
    }

    return url.slice(0, index + 1);
  }

  public async loadFromBuffer(buffer: ArrayBuffer, pathName: string): Promise<ModelLoadResult> {
    // fbx binary
    if (IsFBXBinary(buffer)) {
      const group = this.fbxLoader.parse(buffer, pathName);
      return { group, animations: [] };
    }

    // gltf/glb binary
    if (IsGLB(buffer)) {
      const gltf = await this.gltfLoader.parseAsync(buffer, pathName);
      return { group: gltf.scene, animations: gltf.animations };
    }

    const text = convertArrayBufferToString(buffer);
    // fbx text
    if (isFbxFormatASCII(text)) {
      const group = this.fbxLoader.parse(text, pathName);
      return { group, animations: [] };
    }

    // gltf text
    const gltf = await this.gltfLoader.parseAsync(text, pathName);
    return { group: gltf.scene, animations: gltf.animations };
  }
}
