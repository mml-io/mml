import * as THREE from "three";




} = require("../../../../node_modules/three/examples/jsm/loaders/GLTFLoader");

declare class GLTFLoader {
  constructor(loadingManager?: THREE.LoadingManager);

  load(
    path: string,
    onLoad: (result: GLTFResult) => void,
    onProgress?: (xhr: ProgressEvent) => void,
    onError?: (error: Error) => void,
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

export function loadGltfAsPromise(gltfLoader: GLTFLoader, path: string): Promise<GLTFResult> {
  return new Promise<GLTFResult>((resolve, reject) => {
    gltfLoader.load(
      path,
      (object: GLTFResult) => {
        resolve(object);
      },
      undefined,
      (error: Error) => {
        reject(error);
      },
    );
  });
}
