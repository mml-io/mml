import { jest } from "@jest/globals";
import * as THREE from "three";

import * as modelLoaderMock from "./__mocks__/model-loader";
import * as skeletonUtilsMock from "./__mocks__/SkeletonUtils.js";

jest.mock("@mml-io/model-loader", () => modelLoaderMock);
jest.mock("three/examples/jsm/utils/SkeletonUtils.js", () => skeletonUtilsMock);

import { ThreeJSModelResource } from "./ThreeJSModelResource";

function getAllTextures(root: THREE.Object3D): THREE.Texture[] {
  const found: THREE.Texture[] = [];
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if ((mesh as any).isMesh) {
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const mat of materials) {
        const anyMat = mat as any;
        for (const key of Object.keys(anyMat)) {
          const val = anyMat[key];
          if (val && typeof val === "object" && (val as any).isTexture) {
            found.push(val as THREE.Texture);
          }
        }
      }
    }
  });
  return found;
}

describe("ThreeJSModelResource", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("propagates load to handles; resizes oversized textures", async () => {
    const onRemove = jest.fn();

    // Patch static loader to avoid GLTF parsing and still provide a large texture
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshStandardMaterial();
    const bigCanvas = document.createElement("canvas");
    bigCanvas.width = 4096;
    bigCanvas.height = 2048;
    const tex = new THREE.Texture(bigCanvas);
    tex.needsUpdate = true;
    (material as any).map = tex;
    const mesh = new THREE.Mesh(geometry, material);
    const group = new THREE.Group();
    group.add(mesh);

    const fakeLoad: any = jest.fn(() =>
      Promise.resolve({ group, animations: [new THREE.AnimationClip("clip", 1, [])] }),
    );
    (ThreeJSModelResource as any).modelLoader = { load: fakeLoad };

    const resource = new ThreeJSModelResource("/model.glb", onRemove);
    const h1 = resource.createHandle();
    const h2 = resource.createHandle();

    const p1 = new Promise<any>((resolve) => h1.onLoad(resolve));
    const p2 = new Promise<any>((resolve) => h2.onLoad(resolve));

    const [r1, r2] = (await Promise.all([p1, p2])) as any[];

    expect(fakeLoad).toHaveBeenCalledTimes(1);
    expect(r1.group).toBeInstanceOf(THREE.Group);
    expect(r2.group).toBeInstanceOf(THREE.Group);

    for (const result of [r1, r2]) {
      const textures = getAllTextures(result.group);
      for (const t of textures) {
        const img: any = (t as any).image ?? (t as any).source?.data;
        if (img && typeof img.width === "number" && typeof img.height === "number") {
          expect(img.width).toBeLessThanOrEqual(1024);
          expect(img.height).toBeLessThanOrEqual(1024);
        }
      }
    }
  });

  test("aborts underlying load when last handle disposed before resolution", () => {
    const onRemove = jest.fn();

    let capturedAC: AbortController | null = null;
    const fakeLoad = jest.fn(
      (_url: string, _onProgress: (l: number, t: number) => void, ac: AbortController) => {
        capturedAC = ac;
        return new Promise(() => {});
      },
    );
    (ThreeJSModelResource as any).modelLoader = { load: fakeLoad };

    const resource = new ThreeJSModelResource("/late.glb", onRemove);
    const h = resource.createHandle();

    expect(capturedAC).not.toBeNull();
    const spy = jest.spyOn(capturedAC!, "abort");

    h.dispose();
    expect(spy).toHaveBeenCalled();
  });
});
