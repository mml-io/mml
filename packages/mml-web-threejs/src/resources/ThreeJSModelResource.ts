import { ModelLoader, ModelLoadResult } from "@mml-io/model-loader";
import * as THREE from "three";

import { ThreeJSModelHandle, ThreeJSModelHandleImpl } from "./ThreeJSModelHandle";

export class ThreeJSModelResource {
  private static readonly DEFAULT_MAX_TEXTURE_SIZE = 2048;

  private static modelLoader: ModelLoader | null = null;
  private static getModelLoader(): ModelLoader {
    if (!ThreeJSModelResource.modelLoader) {
      ThreeJSModelResource.modelLoader = new ModelLoader();
    }
    return ThreeJSModelResource.modelLoader;
  }

  private modelHandles = new Set<ThreeJSModelHandleImpl>();
  private modelResult: ModelLoadResult | null = null;

  private abortController: AbortController | null = null;

  constructor(
    public readonly url: string,
    private onRemove: () => void,
    private maxTextureSize: number = ThreeJSModelResource.DEFAULT_MAX_TEXTURE_SIZE,
  ) {
    this.abortController = new AbortController();
    ThreeJSModelResource.getModelLoader()
      .load(
        url,
        (loaded, total) => {
          // progress
          for (const modelHandle of this.modelHandles) {
            modelHandle.handleProgress(loaded, total);
          }
        },
        this.abortController,
      )
      .then((result) => {
        // load
        this.modelResult = result;
        // Clamp all material textures on this model to a maximum size
        try {
          ThreeJSModelResource.clampTexturesToMaxSize(result.group, this.maxTextureSize);
        } catch (e) {
          // Ignore texture clamping errors to avoid blocking model load

          console.warn("Texture clamping failed", e);
        }

        for (const modelHandle of this.modelHandles) {
          modelHandle.handleLoaded(result);
        }
      })
      .finally(() => {
        this.abortController = null;
      });
  }

  public getResult(): ModelLoadResult | null {
    return this.modelResult;
  }

  public createHandle(): ThreeJSModelHandle {
    const modelHandle = new ThreeJSModelHandleImpl(this);
    this.modelHandles.add(modelHandle);
    if (this.modelResult !== null) {
      modelHandle.handleLoaded(this.modelResult);
    }
    return modelHandle;
  }

  public disposeHandle(modelHandle: ThreeJSModelHandleImpl): void {
    this.modelHandles.delete(modelHandle);
    if (this.modelHandles.size === 0) {
      this.abortController?.abort();
      this.abortController = null;
      this.onRemove();
    }
  }

  private static clampTexturesToMaxSize(root: THREE.Object3D, maxSize: number): void {
    const processedTextures = new Set<THREE.Texture>();

    root.traverse((object) => {
      const maybeMesh = object as unknown as THREE.Mesh;
      if ((maybeMesh as any).isMesh) {
        const material = maybeMesh.material as THREE.Material | THREE.Material[] | undefined;
        if (!material) {
          return;
        }
        if (Array.isArray(material)) {
          for (const mat of material) {
            ThreeJSModelResource.processMaterialTextures(mat, maxSize, processedTextures);
          }
        } else {
          ThreeJSModelResource.processMaterialTextures(material, maxSize, processedTextures);
        }
      }
    });
  }

  private static processMaterialTextures(
    material: THREE.Material,
    maxSize: number,
    processed: Set<THREE.Texture>,
  ): void {
    const materialAny = material as any;
    for (const key of Object.keys(materialAny)) {
      const value = materialAny[key];
      if (value && typeof value === "object" && (value as any).isTexture) {
        const texture = value as THREE.Texture;
        if (processed.has(texture)) {
          continue;
        }
        processed.add(texture);
        ThreeJSModelResource.resizeTextureIfTooLarge(texture, maxSize);
      }
    }
  }

  private static resizeTextureIfTooLarge(texture: THREE.Texture, maxSize: number): void {
    const texAny = texture as any;
    if (texAny.isCompressedTexture || texAny.isCubeTexture || texAny.isVideoTexture) {
      return;
    }

    const image: any = texAny.image ?? texAny.source?.data;
    if (!image || typeof image.width !== "number" || typeof image.height !== "number") {
      return;
    }

    const width: number = image.width;
    const height: number = image.height;
    if (width <= maxSize && height <= maxSize) {
      return;
    }

    console.warn(
      "Texture resizing is being performed. Original size: ",
      width,
      height,
      "Maximum size: ",
      maxSize,
    );

    const scale = Math.min(maxSize / width, maxSize / height);
    const newWidth = Math.max(1, Math.floor(width * scale));
    const newHeight = Math.max(1, Math.floor(height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = newWidth;
    canvas.height = newHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }
    try {
      ctx.drawImage(image, 0, 0, newWidth, newHeight);
      if (texAny.source && texAny.source.data !== undefined) {
        texAny.source.data = canvas;
      }
      texture.image = canvas;
      texture.needsUpdate = true;
    } catch {
      // Ignore draw errors (e.g., cross-origin or unsupported image types)
    }
  }
}
