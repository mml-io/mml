import { CanvasText } from "@mml-io/mml-web";
import * as THREE from "three";

import {
  ThreeJSLabelHandle,
  ThreeJSLabelHandleImpl,
  ThreeJSLabelResourceResult,
} from "./ThreeJSLabelHandle";

export type ThreeJSLabelResourceOptions = {
  content: string;
  fontSize: number;
  paddingPx: number;
  textColorRGB255A1: { r: number; g: number; b: number; a: number };
  backgroundColorRGB255A1: { r: number; g: number; b: number; a: number };
  dimensions: { width: number; height: number };
  alignment: string;
  bold: boolean;
};

export class ThreeJSLabelResource {
  private static sharedCanvasText: CanvasText | null = null;
  private handles = new Set<ThreeJSLabelHandleImpl>();
  private result: { texture: THREE.DataTexture; width: number; height: number } | null = null;

  constructor(
    options: ThreeJSLabelResourceOptions,
    private onRemove: () => void,
  ) {
    // Synchronously generate texture
    if (!ThreeJSLabelResource.sharedCanvasText) {
      ThreeJSLabelResource.sharedCanvasText = new CanvasText();
    }
    const canvasText = ThreeJSLabelResource.sharedCanvasText;
    const canvas = canvasText.renderText(options.content, {
      bold: options.bold,
      fontSize: options.fontSize,
      paddingPx: options.paddingPx,
      textColorRGB255A1: options.textColorRGB255A1,
      backgroundColorRGB255A1: options.backgroundColorRGB255A1,
      dimensions: options.dimensions,
      alignment: options.alignment,
    });

    let texture: THREE.DataTexture;
    // If the canvas has zero dimensions, return a minimal transparent texture to avoid IndexSizeError
    if (canvas.width === 0 || canvas.height === 0) {
      const emptyPixel = new Uint8Array([0, 0, 0, 0]);
      texture = new THREE.DataTexture(emptyPixel, 1, 1, THREE.RGBAFormat);
    } else {
      const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      texture = new THREE.DataTexture(
        imageData.data as unknown as Uint8Array,
        canvas.width,
        canvas.height,
        THREE.RGBAFormat,
      );
    }
    texture.flipY = true;
    texture.colorSpace = THREE.NoColorSpace;
    texture.premultiplyAlpha = true;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;
    this.result = {
      texture,
      width: canvas.width,
      height: canvas.height,
    };
  }

  public getResult(): ThreeJSLabelResourceResult | null {
    return this.result;
  }

  public createHandle(): ThreeJSLabelHandle {
    const handle = new ThreeJSLabelHandleImpl({
      disposeHandle: this.disposeHandle.bind(this),
    });
    this.handles.add(handle);
    if (this.result) {
      handle.handleLoaded(this.result);
    }
    return handle;
  }

  public disposeHandle(handle: ThreeJSLabelHandleImpl): void {
    this.handles.delete(handle);
    if (this.handles.size === 0) {
      if (this.result && this.result.texture) {
        this.result.texture.dispose();
      }
      this.result = null;
      this.onRemove();
    }
  }
}
