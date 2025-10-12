import {
  calculateContentSize,
  Image,
  ImageGraphics,
  LoadingInstanceManager,
} from "@mml-io/mml-web";
import * as THREE from "three";

import { ThreeJSImageHandle, ThreeJSImageResourceResult } from "../resources/ThreeJSImageHandle";
import { ThreeJSGraphicsAdapter } from "../ThreeJSGraphicsAdapter";

export class ThreeJSImage extends ImageGraphics<ThreeJSGraphicsAdapter> {
  private static planeGeometry = new THREE.PlaneGeometry(1, 1);
  private mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.Material | Array<THREE.Material>>;
  private material: THREE.MeshStandardMaterial;

  private latestImageHandle: ThreeJSImageHandle | null = null;
  private loadedImageDimensions: { width: number; height: number } | null;
  private loadedImageHasTransparency = false;
  private srcLoadingInstanceManager = new LoadingInstanceManager(`${Image.tagName}.src`);
  constructor(
    private image: Image<ThreeJSGraphicsAdapter>,
    private updateMeshCallback: () => void,
  ) {
    super(image, updateMeshCallback);

    this.material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      transparent: this.image.props.opacity !== 1 || this.loadedImageHasTransparency,
      opacity: this.image.props.opacity,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(ThreeJSImage.planeGeometry, this.material);
    this.mesh.castShadow = image.props.castShadows;
    this.mesh.receiveShadow = true;
    this.image.getContainer().add(this.mesh);
  }

  public getWidthAndHeight(): { width: number; height: number } {
    return {
      width: this.mesh.scale.x,
      height: this.mesh.scale.y,
    };
  }

  disable(): void {}

  enable(): void {}

  getCollisionElement(): THREE.Object3D {
    return this.mesh;
  }

  setWidth(): void {
    this.updateWidthAndHeight();
  }

  setHeight(): void {
    this.updateWidthAndHeight();
  }

  setCastShadows(castShadows: boolean): void {
    this.mesh.castShadow = castShadows;
  }

  setOpacity(opacity: number): void {
    const shouldBeTransparent = opacity !== 1 || this.loadedImageHasTransparency;
    const needsUpdate = this.material.transparent !== shouldBeTransparent;

    this.material.transparent = shouldBeTransparent;
    this.material.opacity = opacity;

    if (needsUpdate) {
      this.material.needsUpdate = true;
    }
  }

  setEmissive() {
    this.updateMaterialEmissiveIntensity();
  }

  private updateMaterialEmissiveIntensity() {
    if (this.material) {
      const map = this.material.map as THREE.Texture;
      if (this.image.props.emissive > 0) {
        this.material.emissive = new THREE.Color(0xffffff);
        this.material.emissiveMap = map;
        this.material.emissiveIntensity = this.image.props.emissive;
        this.material.needsUpdate = true;
      } else {
        this.material.emissive = new THREE.Color(0x000000);
        this.material.emissiveMap = null;
        this.material.emissiveIntensity = 1;
        this.material.needsUpdate = true;
      }
    }
  }

  setSrc(newValue: string | null): void {
    if (this.latestImageHandle) {
      this.latestImageHandle.dispose();
    }
    this.latestImageHandle = null;

    const src = (newValue || "").trim();
    const isDataUri = src.startsWith("data:image/");
    if (this.loadedImageDimensions !== null && !isDataUri) {
      // if the image has already been loaded, remove the image data from the THREE material
      this.clearImage();
    }
    if (!src) {
      // if the src attribute is empty, reset the dimensions and return
      this.updateWidthAndHeight();
      this.srcLoadingInstanceManager.abortIfLoading();
      return;
    }
    if (!this.material) {
      // if the element is not yet connected, return
      return;
    }

    if (isDataUri) {
      // if the src is a data url, load it directly rather than using the loader - this avoids a potential frame skip
      const image = document.createElement("img");
      image.src = src;
      this.loadedImageDimensions = {
        width: image.width,
        height: image.height,
      };
      const finalize = () => {
        const texture = new THREE.CanvasTexture(image);
        const result: ThreeJSImageResourceResult = {
          texture,
          width: image.width,
          height: image.height,
          hasTransparency: hasTransparency(image),
        };
        this.applyTexture(result);
      };
      if (image.complete) {
        finalize();
      } else {
        image.addEventListener("load", finalize);
      }
      this.srcLoadingInstanceManager.abortIfLoading();
      return;
    }

    const contentSrc = this.image.contentSrcToContentAddress(src);
    this.srcLoadingInstanceManager.start(this.image.getLoadingProgressManager(), contentSrc);
    const imageHandle = this.image
      .getScene()
      .getGraphicsAdapter()
      .getResourceManager()
      .loadImage(contentSrc);
    this.latestImageHandle = imageHandle;
    imageHandle.onProgress((loaded, total) => {
      if (this.latestImageHandle !== imageHandle) {
        return;
      }
      this.srcLoadingInstanceManager.setProgress(loaded / total);
    });
    imageHandle.onLoad((result: ThreeJSImageResourceResult | Error) => {
      if (result instanceof Error) {
        console.error("Error loading image:", newValue, result);
        this.srcLoadingInstanceManager.error(result);
        return;
      }
      if (this.latestImageHandle !== imageHandle || !this.material) {
        // If we've loaded a different image since, or we're no longer connected, ignore this image
        return;
      }
      this.applyTexture(result);
      this.srcLoadingInstanceManager.finish();
    });
  }

  private updateWidthAndHeight() {
    const mesh = this.mesh;

    const { width, height } = calculateContentSize({
      content: this.loadedImageDimensions
        ? { width: this.loadedImageDimensions.width, height: this.loadedImageDimensions.height }
        : undefined,
      width: this.image.props.width,
      height: this.image.props.height,
    });
    mesh.scale.x = width;
    mesh.scale.y = height;

    this.updateMeshCallback();
  }

  private applyTexture(result: ThreeJSImageResourceResult) {
    this.loadedImageHasTransparency = result.hasTransparency;
    if (!this.material) {
      return;
    }

    this.loadedImageDimensions = {
      width: result.width,
      height: result.height,
    };
    this.material.map = result.texture;
    this.material.transparent = this.image.props.opacity !== 1 || result.hasTransparency;
    this.material.alphaTest = 0.01;
    this.material.needsUpdate = true;
    this.updateMaterialEmissiveIntensity();
    this.updateWidthAndHeight();
  }

  private clearImage() {
    this.loadedImageDimensions = null;
    if (this.material && this.material.map) {
      // Do not dispose shared texture here
      this.material.needsUpdate = true;
      this.material.map = null;
      this.material.alphaMap = null;
      this.material.alphaTest = 0;
    }
    this.updateWidthAndHeight();
  }

  dispose() {
    if (this.latestImageHandle) {
      this.latestImageHandle.dispose();
    }
    this.latestImageHandle = null;
    // Do not dispose shared texture
    this.material.map = null;
    if (this.material.emissiveMap) {
      this.material.emissiveMap.dispose();
      this.material.emissiveMap = null;
    }
    this.material.dispose();
    this.loadedImageDimensions = null;
    this.srcLoadingInstanceManager.dispose();
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
