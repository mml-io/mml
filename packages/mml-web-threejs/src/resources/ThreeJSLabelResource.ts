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
  private static readonly DEFAULT_MAX_TEXTURE_SIZE = 1024;
  private static sharedCanvasText: CanvasText | null = null;
  private handles = new Set<ThreeJSLabelHandleImpl>();
  private result: { texture: THREE.DataTexture; width: number; height: number } | null = null;

  constructor(
    options: ThreeJSLabelResourceOptions,
    private onRemove: () => void,
    private maxTextureSize: number = ThreeJSLabelResource.DEFAULT_MAX_TEXTURE_SIZE,
  ) {
    // Synchronously generate texture
    if (!ThreeJSLabelResource.sharedCanvasText) {
      ThreeJSLabelResource.sharedCanvasText = new CanvasText();
    }
    const scale = Math.min(
      1,
      Math.min(
        this.maxTextureSize / options.dimensions.width,
        this.maxTextureSize / options.dimensions.height,
      ),
    );
    const clampedDimensions = {
      width: options.dimensions.width * scale,
      height: options.dimensions.height * scale,
    };

    const canvasText = ThreeJSLabelResource.sharedCanvasText;
    const canvas = canvasText.renderText(options.content, {
      bold: options.bold,
      fontSize: options.fontSize * scale,
      paddingPx: options.paddingPx * scale,
      textColorRGB255A1: options.textColorRGB255A1,
      backgroundColorRGB255A1: options.backgroundColorRGB255A1,
      dimensions: clampedDimensions,
      alignment: options.alignment,
    });

    let texture: THREE.DataTexture;
    // If the canvas has zero dimensions, return a minimal transparent texture to avoid IndexSizeError
    if (canvas.width === 0 || canvas.height === 0) {
      const emptyPixel = new Uint8Array([0, 0, 0, 0]);
      texture = new THREE.DataTexture(emptyPixel, 1, 1, THREE.RGBAFormat);
    } else {
      const ctx = canvas.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D;
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
