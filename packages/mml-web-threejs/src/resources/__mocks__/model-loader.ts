import * as THREE from "three";

type ProgressCb = (loaded: number, total: number) => void;

export type ModelLoadResult = {
  group: THREE.Group;
  animations: THREE.AnimationClip[];
};

// expose last call info for tests
export let lastLoad: {
  url: string;
  onProgress: ProgressCb;
  abortController: AbortController;
} | null = null;

export class ModelLoader {
  load(
    url: string,
    onProgress: ProgressCb,
    abortController: AbortController,
  ): Promise<ModelLoadResult> {
    lastLoad = { url, onProgress, abortController };

    // emit one progress step
    onProgress(50, 100);

    return new Promise<ModelLoadResult>((resolve, reject) => {
      const listener = () => {
        abortController.signal.removeEventListener("abort", listener);
        reject(new Error("aborted"));
      };
      abortController.signal.addEventListener("abort", listener);

      // Resolve with a simple mesh that has a large texture to exercise resize code
      setTimeout(() => {
        abortController.signal.removeEventListener("abort", listener);
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshStandardMaterial();
        // attach an oversized texture
        const bigCanvas = document.createElement("canvas");
        bigCanvas.width = 4096;
        bigCanvas.height = 2048;
        const tex = new THREE.Texture(bigCanvas);
        tex.needsUpdate = true;
        (material as any).map = tex;

        const mesh = new THREE.Mesh(geometry, material);
        const group = new THREE.Group();
        group.add(mesh);

        resolve({ group, animations: [new THREE.AnimationClip("clip", 1, [])] });
      }, 0);
    });
  }
}
