import { ThreeJSImageHandle } from "./ThreeJSImageHandle";
import { ThreeJSImageResource } from "./ThreeJSImageResource";
import { ThreeJSLabelHandle } from "./ThreeJSLabelHandle";
import { ThreeJSLabelResource, ThreeJSLabelResourceOptions } from "./ThreeJSLabelResource";
import { ThreeJSModelHandle } from "./ThreeJSModelHandle";
import { ThreeJSModelResource } from "./ThreeJSModelResource";

export class ThreeJSResourceManager {
  private modelResources = new Map<string, ThreeJSModelResource>();
  private imageResources = new Map<string, ThreeJSImageResource>();
  private labelResources = new Map<string, ThreeJSLabelResource>();

  constructor() {}

  public loadModel(url: string): ThreeJSModelHandle {
    let modelResource = this.modelResources.get(url);
    if (!modelResource) {
      modelResource = new ThreeJSModelResource(url, () => {
        this.modelResources.delete(url);
      });
      this.modelResources.set(url, modelResource);
    }
    return modelResource.createHandle();
  }

  public loadImage(url: string): ThreeJSImageHandle {
    let imageResource = this.imageResources.get(url);
    if (!imageResource) {
      imageResource = new ThreeJSImageResource(url, () => {
        this.imageResources.delete(url);
      });
      this.imageResources.set(url, imageResource);
    }
    return imageResource.createHandle();
  }

  public loadLabel(options: ThreeJSLabelResourceOptions): ThreeJSLabelHandle {
    const key = buildLabelResourceKey(options);
    let labelResource = this.labelResources.get(key);
    if (!labelResource) {
      labelResource = new ThreeJSLabelResource(options, () => {
        this.labelResources.delete(key);
      });
      this.labelResources.set(key, labelResource);
    }
    return labelResource.createHandle();
  }
}

function buildLabelResourceKey(options: ThreeJSLabelResourceOptions): string {
  const key = {
    content: options.content,
    fontSize: options.fontSize * 2,
    paddingPx: options.paddingPx,
    textColorRGB255A1: {
      r: Math.round(options.textColorRGB255A1.r * 255),
      g: Math.round(options.textColorRGB255A1.g * 255),
      b: Math.round(options.textColorRGB255A1.b * 255),
      a: options.textColorRGB255A1.a ?? 1,
    },
    backgroundColorRGB255A1: {
      r: Math.round(options.backgroundColorRGB255A1.r * 255),
      g: Math.round(options.backgroundColorRGB255A1.g * 255),
      b: Math.round(options.backgroundColorRGB255A1.b * 255),
      a: options.backgroundColorRGB255A1.a ?? 1,
    },
    dimensions: {
      width: options.dimensions.width * 200,
      height: options.dimensions.height * 200,
    },
    alignment: options.alignment,
    bold: true,
  };
  return JSON.stringify(key);
}
