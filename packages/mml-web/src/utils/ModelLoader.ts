// eslint-disable-next-line import/no-unresolved,@typescript-eslint/ban-ts-comment
// @ts-ignore
// eslint-disable-next-line import/no-unresolved
import DRACO_DECODER_WASM from "esbuild-embed-draco-decoder-wasm";
// eslint-disable-next-line import/no-unresolved,@typescript-eslint/ban-ts-comment
// @ts-ignore
// eslint-disable-next-line import/no-unresolved
import DRACO_WASM_WRAPPER from "esbuild-embed-draco-wasm-wrapper-js";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { GLTF, GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export class ModelLoader {
  private dracoLoader = new DRACOLoader({
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
    itemStart: (url: string) => {},
    itemEnd: (url: string) => {},
    itemError: (url: string) => {},
  }).preload();

  private gltfLoader = new GLTFLoader().setDRACOLoader(this.dracoLoader);

  async loadGltf(url: string, onProgress: (loaded: number, total: number) => void): Promise<GLTF> {
    return new Promise<GLTF>((resolve, reject) => {
      this.gltfLoader.load(
        url,
        (object: GLTF) => {
          resolve(object);
        },
        (progressEvent: ProgressEvent) => {
          if (onProgress) {
            onProgress(progressEvent.loaded, progressEvent.total);
          }
        },
        (error: ErrorEvent) => {
          reject(error);
        },
      );
    });
  }
}
