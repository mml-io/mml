import * as THREE from "three";

import { ThreeJSImageResource } from "./ThreeJSImageResource";

export interface ThreeJSImageResourceResult {
  texture: THREE.CanvasTexture;
  width: number;
  height: number;
  hasTransparency: boolean;
}

export interface ThreeJSImageHandle {
  onProgress(onProgress: (loaded: number, total: number) => void): void;
  onLoad(onLoad: (result: ThreeJSImageResourceResult | Error) => void): void;
  getResult(): ThreeJSImageResourceResult | Error | null;
  dispose(): void;
}

export class ThreeJSImageHandleImpl implements ThreeJSImageHandle {
  private onLoadCallbacks = new Set<(result: ThreeJSImageResourceResult | Error) => void>();
  private onProgressCallbacks = new Set<(loaded: number, total: number) => void>();
  private result: ThreeJSImageResourceResult | Error | null = null;

  constructor(private imageResource: ThreeJSImageResource) {}

  onProgress(onProgress: (loaded: number, total: number) => void): void {
    this.onProgressCallbacks.add(onProgress);
  }

  onLoad(onLoad: (result: ThreeJSImageResourceResult | Error) => void): void {
    this.onLoadCallbacks.add(onLoad);
    if (this.result) {
      onLoad(this.result);
    }
  }

  getResult(): ThreeJSImageResourceResult | Error | null {
    return this.result;
  }

  handleProgress(loaded: number, total: number): void {
    for (const onProgressCallback of this.onProgressCallbacks) {
      onProgressCallback(loaded, total);
    }
  }

  handleLoaded(result: ThreeJSImageResourceResult): void {
    this.result = result;
    for (const onLoadCallback of this.onLoadCallbacks) {
      onLoadCallback(result);
    }
  }

  handleError(error: Error): void {
    this.result = error;
    for (const onLoadCallback of this.onLoadCallbacks) {
      onLoadCallback(error);
    }
  }

  dispose(): void {
    this.imageResource.disposeHandle(this);
  }
}
