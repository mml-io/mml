import * as THREE from "three";
import { GLTFLoader as GLTFLoaderImp } from "three/examples/jsm/loaders/GLTFLoader.js";

declare class GLTFLoader {
  constructor(loadingManager?: THREE.LoadingManager);

  load(
    path: string,
    onLoad: (result: GLTFResult) => void,
    onProgress?: (xhr: ProgressEvent) => void,
    onError?: (error: ErrorEvent) => void,
  ): void;
}
export { GLTFLoaderImp as GLTFLoader };

export type GLTFResult = {
  animations: THREE.AnimationClip[];
  scene: THREE.Group;
  scenes: THREE.Group[];
  cameras: THREE.Camera[];
  asset: {
    copyright?: string | undefined;
    generator?: string | undefined;
    version?: string | undefined;
    minVersion?: string | undefined;
    extensions?: any;
    extras?: any;
  };
  userData: any;
};

export function loadGltfAsPromise(
  gltfLoader: GLTFLoader,
  path: string,
  onProgress?: (loaded: number, total: number) => void,
): Promise<GLTFResult> {
  return new Promise<GLTFResult>((resolve, reject) => {
    gltfLoader.load(
      path,
      (object: GLTFResult) => {
        resolve(object);
      },
      (xhr: ProgressEvent) => {
        if (onProgress) {
          onProgress(xhr.loaded, xhr.total);
        }
      },
      (error: ErrorEvent) => {
        reject(error);
      },
    );
  });
}
