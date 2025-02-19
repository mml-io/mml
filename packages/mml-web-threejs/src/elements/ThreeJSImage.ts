import {
  calculateContentSize,
  Image,
  ImageGraphics,
  LoadingInstanceManager,
} from "@mml-io/mml-web";
import * as THREE from "three";

import { ThreeJSGraphicsAdapter } from "../ThreeJSGraphicsAdapter";

export class ThreeJSImage extends ImageGraphics<ThreeJSGraphicsAdapter> {
  private static planeGeometry = new THREE.PlaneGeometry(1, 1);
  private mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.Material | Array<THREE.Material>>;
  private material: THREE.MeshStandardMaterial;
  private static imageLoader = new THREE.ImageLoader();

  private srcApplyPromise: Promise<HTMLImageElement> | null = null;
  private loadedImage: HTMLImageElement | null;
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
    const src = (newValue || "").trim();
    const isDataUri = src.startsWith("data:image/");
    if (this.loadedImage !== null && !isDataUri) {
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
      this.applyImage(image);
      this.srcLoadingInstanceManager.abortIfLoading();
      return;
    }

    const contentSrc = this.image.contentSrcToContentAddress(src);
    const srcApplyPromise = loadImageAsPromise(
      ThreeJSImage.imageLoader,
      contentSrc,
      (loaded, total) => {
        this.srcLoadingInstanceManager.setProgress(loaded / total);
      },
    );
    this.srcLoadingInstanceManager.start(this.image.getLoadingProgressManager(), contentSrc);
    this.srcApplyPromise = srcApplyPromise;
    srcApplyPromise
      .then((image: HTMLImageElement) => {
        if (this.srcApplyPromise !== srcApplyPromise || !this.material) {
          // If we've loaded a different image since, or we're no longer connected, ignore this image
          return;
        }
        this.applyImage(image);
        this.srcLoadingInstanceManager.finish();
      })
      .catch((error) => {
        console.error("Error loading image:", newValue, error);
        if (this.srcApplyPromise !== srcApplyPromise || !this.material) {
          // If we've loaded a different image since, or we're no longer connected, ignore this image
          return;
        }
        this.clearImage();
        this.srcLoadingInstanceManager.error(error);
      });
  }

  private updateWidthAndHeight() {
    const mesh = this.mesh;

    const { width, height } = calculateContentSize({
      content: this.loadedImage
        ? { width: this.loadedImage.width, height: this.loadedImage.height }
        : undefined,
      width: this.image.props.width,
      height: this.image.props.height,
    });
    mesh.scale.x = width;
    mesh.scale.y = height;

    this.updateMeshCallback();
  }

  private applyImage(image: HTMLImageElement) {
    this.loadedImage = image;
    if (!image.complete) {
      // Wait for the image to be fully loaded (most likely a data uri that has not yet been decoded)
      image.addEventListener("load", () => {
        if (this.loadedImage !== image) {
          // if the image has changed since we started loading, ignore this image
          return;
        }
        this.applyImage(image);
      });
      return;
    }
    this.loadedImageHasTransparency = hasTransparency(this.loadedImage);
    if (!this.material) {
      return;
    }
    this.material.map = new THREE.CanvasTexture(this.loadedImage);
    this.material.transparent = this.image.props.opacity !== 1 || this.loadedImageHasTransparency;
    this.material.alphaTest = 0.01;
    this.material.needsUpdate = true;
    this.updateMaterialEmissiveIntensity();
    this.updateWidthAndHeight();
  }

  private clearImage() {
    this.loadedImage = null;
    this.srcApplyPromise = null;
    if (this.material && this.material.map) {
      this.material.map.dispose();
      this.material.needsUpdate = true;
      this.material.map = null;
      this.material.alphaMap = null;
      this.material.alphaTest = 0;
    }
    this.updateWidthAndHeight();
  }

  dispose() {
    if (this.material.map) {
      this.material.map.dispose();
      this.material.map = null;
    }
    if (this.material.emissiveMap) {
      this.material.emissiveMap.dispose();
      this.material.emissiveMap = null;
    }
    this.material.dispose();
    this.loadedImage = null;
    this.srcLoadingInstanceManager.dispose();
  }
}

export function loadImageAsPromise(
  imageLoader: THREE.ImageLoader,
  path: string,
  onProgress?: (loaded: number, total: number) => void,
): Promise<HTMLImageElement> {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    imageLoader.load(
      path,
      (image: HTMLImageElement) => {
        resolve(image);
      },
      (xhr: ProgressEvent) => {
        if (onProgress) {
          onProgress(xhr.loaded, xhr.total);
        }
      },
      (error: ErrorEvent) => {
        reject(error);
      },
    );
  });
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
