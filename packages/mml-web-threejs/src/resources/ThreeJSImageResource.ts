import * as THREE from "three";

import {
  ThreeJSImageHandle,
  ThreeJSImageHandleImpl,
  ThreeJSImageResourceResult,
} from "./ThreeJSImageHandle";
import { ThreeJSImageLoader } from "./ThreeJSImageLoader";

export class ThreeJSImageResource {
  private imageHandles = new Set<ThreeJSImageHandleImpl>();
  private imageElement: HTMLImageElement | null = null;
  private texture: THREE.CanvasTexture | null = null;
  private hasTransparency: boolean = false;

  private abortController: AbortController | null = null;

  constructor(
    public readonly url: string,
    private onRemove: () => void,
  ) {
    this.abortController = new AbortController();

    // Load the image
    ThreeJSImageLoader.load(
      url,
      (image: HTMLImageElement) => {
        // Image loaded successfully
        this.imageElement = image;
        this.hasTransparency = hasTransparency(image);
        this.texture = new THREE.CanvasTexture(image);
        const result: ThreeJSImageResourceResult = {
          texture: this.texture,
          width: image.width,
          height: image.height,
          hasTransparency: this.hasTransparency,
        };
        for (const imageHandle of this.imageHandles) {
          imageHandle.handleLoaded(result);
        }
        this.abortController = null;
      },
      (error: ErrorEvent) => {
        // Error loading
        const errorObj = new Error(`Failed to load image: ${error.message}`);
        for (const imageHandle of this.imageHandles) {
          imageHandle.handleError(errorObj);
        }
        this.abortController = null;
      },
      this.abortController.signal,
    );
  }

  public getResult(): ThreeJSImageResourceResult | null {
    if (this.texture && this.imageElement) {
      return {
        texture: this.texture,
        width: this.imageElement.width,
        height: this.imageElement.height,
        hasTransparency: this.hasTransparency,
      };
    }
    return null;
  }

  public createHandle(): ThreeJSImageHandle {
    const imageHandle = new ThreeJSImageHandleImpl(this);
    this.imageHandles.add(imageHandle);
    const result = this.getResult();
    if (result !== null) {
      imageHandle.handleLoaded(result);
    }
    return imageHandle;
  }

  public disposeHandle(imageHandle: ThreeJSImageHandleImpl): void {
    this.imageHandles.delete(imageHandle);
    if (this.imageHandles.size === 0) {
      this.abortController?.abort();
      this.abortController = null;
      if (this.texture) {
        this.texture.dispose();
        this.texture = null;
      }
      this.imageElement = null;
      this.onRemove();
    }
  }
}

function hasTransparency(image: HTMLImageElement) {
  if (image.width === 0 || image.height === 0) {
    return false;
  }
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  ctx.drawImage(image, 0, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

  for (let i = 3, n = imageData.length; i < n; i += 4) {
    if (imageData[i] < 255) {
      return true;
    }
  }
  return false;
}
