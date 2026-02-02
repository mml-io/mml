import * as THREE from "three";

import type { TextureChannel } from "./types";

export function getTextureImageSize(image: unknown): {
  width: number;
  height: number;
} | null {
  if (image instanceof HTMLImageElement) {
    return {
      width: image.naturalWidth || image.width,
      height: image.naturalHeight || image.height,
    };
  }
  if (image instanceof HTMLCanvasElement) {
    return { width: image.width, height: image.height };
  }
  if (image instanceof ImageBitmap) {
    return { width: image.width, height: image.height };
  }
  return null;
}

export function applyChannelFilterToImageData(imageData: ImageData, channel: TextureChannel): void {
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];

    switch (channel) {
      case "rgb":
        data[i + 3] = 255;
        break;
      case "r":
        data[i] = r;
        data[i + 1] = 0;
        data[i + 2] = 0;
        data[i + 3] = 255;
        break;
      case "g":
        data[i] = 0;
        data[i + 1] = g;
        data[i + 2] = 0;
        data[i + 3] = 255;
        break;
      case "b":
        data[i] = 0;
        data[i + 1] = 0;
        data[i + 2] = b;
        data[i + 3] = 255;
        break;
      case "a":
        data[i] = a;
        data[i + 1] = a;
        data[i + 2] = a;
        data[i + 3] = 255;
        break;
    }
  }
}

export function extractTextureDataUrl(texture: THREE.Texture, maxSize?: number): string | null {
  try {
    if (!texture.image) return null;

    const size = getTextureImageSize(texture.image);
    if (!size || size.width <= 0 || size.height <= 0) return null;

    const maxDim = Math.max(size.width, size.height);
    const scale = maxSize && maxDim > maxSize ? maxSize / maxDim : 1;
    const targetWidth = Math.max(1, Math.round(size.width * scale));
    const targetHeight = Math.max(1, Math.round(size.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    if (texture.image instanceof HTMLImageElement || texture.image instanceof HTMLCanvasElement) {
      ctx.drawImage(texture.image, 0, 0, targetWidth, targetHeight);
      return canvas.toDataURL("image/png");
    }

    if (texture.image instanceof ImageBitmap) {
      ctx.drawImage(texture.image, 0, 0, targetWidth, targetHeight);
      return canvas.toDataURL("image/png");
    }

    return null;
  } catch {
    return null;
  }
}

export function getTextureFormat(texture: THREE.Texture): string {
  if (texture.format === THREE.RGBAFormat) return "RGBA";
  if (texture.format === THREE.RGBFormat) return "RGB";
  return "Unknown";
}
