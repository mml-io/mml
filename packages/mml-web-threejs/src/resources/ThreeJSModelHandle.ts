import { ModelLoadResult } from "@mml-io/model-loader";
import { Group } from "three";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";

import { ThreeJSModelResource } from "./ThreeJSModelResource";

export interface ThreeJSModelHandle {
  onProgress(onProgress: (loaded: number, total: number) => void): void;
  onLoad(onLoad: (result: ModelLoadResult | Error) => void): void;
  getResult(): ModelLoadResult | Error | null;
  dispose(): void;
}

export class ThreeJSModelHandleImpl implements ThreeJSModelHandle {
  private onLoadCallbacks = new Set<(result: ModelLoadResult | Error) => void>();

  private onProgressCallbacks = new Set<(loaded: number, total: number) => void>();

  private result: ModelLoadResult | Error | null = null;

  constructor(private modelResource: ThreeJSModelResource) {}

  onProgress(onProgress: (loaded: number, total: number) => void): void {
    this.onProgressCallbacks.add(onProgress);
  }

  onLoad(onLoad: (result: ModelLoadResult | Error) => void): void {
    this.onLoadCallbacks.add(onLoad);
    if (this.result) {
      onLoad(this.result);
    }
  }

  getResult(): ModelLoadResult | Error | null {
    return this.result;
  }

  handleProgress(loaded: number, total: number): void {
    for (const onProgressCallback of this.onProgressCallbacks) {
      onProgressCallback(loaded, total);
    }
  }

  handleLoaded(result: ModelLoadResult): void {
    // This is a model result, so we need to clone it (shallow clone to reuse material instances)
    const clonedGroup = SkeletonUtils.clone(result.group);
    this.result = {
      group: clonedGroup as Group,
      animations: result.animations,
    };
    for (const onLoadCallback of this.onLoadCallbacks) {
      onLoadCallback(this.result);
    }
  }

  handleError(error: Error): void {
    this.result = error;
    for (const onLoadCallback of this.onLoadCallbacks) {
      onLoadCallback(error);
    }
  }

  dispose(): void {
    this.modelResource.disposeHandle(this);
  }
}
