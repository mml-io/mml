import * as THREE from "three";

export interface ThreeJSLabelResourceResult {
  texture: THREE.CanvasTexture | THREE.DataTexture;
  width: number;
  height: number;
}

export interface ThreeJSLabelHandle {
  onLoad(onLoad: (result: ThreeJSLabelResourceResult | Error) => void): void;
  getResult(): ThreeJSLabelResourceResult | Error | null;
  dispose(): void;
}

export class ThreeJSLabelHandleImpl implements ThreeJSLabelHandle {
  private onLoadCallbacks = new Set<(result: ThreeJSLabelResourceResult | Error) => void>();
  private result: ThreeJSLabelResourceResult | Error | null = null;

  constructor(private labelResource: { disposeHandle: (handle: ThreeJSLabelHandleImpl) => void }) {}

  onLoad(onLoad: (result: ThreeJSLabelResourceResult | Error) => void): void {
    this.onLoadCallbacks.add(onLoad);
    if (this.result) {
      onLoad(this.result);
    }
  }

  getResult(): ThreeJSLabelResourceResult | Error | null {
    return this.result;
  }

  handleLoaded(result: ThreeJSLabelResourceResult): void {
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
    this.labelResource.disposeHandle(this);
  }
}
