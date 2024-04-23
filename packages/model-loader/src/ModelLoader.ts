// eslint-disable-next-line import/no-unresolved,@typescript-eslint/ban-ts-comment
// @ts-ignore
// eslint-disable-next-line import/no-unresolved
import DRACO_DECODER_WASM from "esbuild-embed-draco-decoder-wasm";
// eslint-disable-next-line import/no-unresolved,@typescript-eslint/ban-ts-comment
// @ts-ignore
// eslint-disable-next-line import/no-unresolved
import DRACO_WASM_WRAPPER from "esbuild-embed-draco-wasm-wrapper-js";
import { AnimationClip, FileLoader, Group, LoaderUtils, LoadingManager } from "three";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const textDecoder = new TextDecoder();

function convertArrayBufferToString(buffer: ArrayBuffer, from?: number, to?: number) {
  if (from === undefined) {
    from = 0;
  }
  if (to === undefined) {
    to = buffer.byteLength;
  }

  return textDecoder.decode(new Uint8Array(buffer, from, to));
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
          return "data:text/javascript;base64," + btoa(DRACO_WASM_WRAPPER);
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
    }).preload();
    return ModelLoader.dracoLoader;
  }

  constructor(
    private manager?: LoadingManager,
    private options: { requestHeader?: Record<string, string>; withCredentials?: boolean } = {},
  ) {
    this.gltfLoader = new GLTFLoader(this.manager)
      .setMeshoptDecoder(MeshoptDecoder)
      .setDRACOLoader(ModelLoader.getDracoLoader());

    this.fbxLoader = new FBXLoader(this.manager);
  }

  public async load(url: string, onProgress?: (loaded: number, total: number) => void) {
    return new Promise<ModelLoadResult>((resolve, reject) => {
      const resourcePath = LoaderUtils.extractUrlBase(url);

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
        (progressEvent) => {
          if (onProgress && progressEvent.lengthComputable) {
            onProgress(progressEvent.loaded, progressEvent.total);
          }
        },
        _onError,
      );
    });
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
