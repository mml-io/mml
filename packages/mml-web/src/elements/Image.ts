import * as THREE from "three";

import { AnimationType } from "./AttributeAnimation";
import { MElement } from "./MElement";
import { TransformableElement } from "./TransformableElement";
import { LoadingInstanceManager } from "../loading/LoadingInstanceManager";
import { AnimatedAttributeHelper } from "../utils/AnimatedAttributeHelper";
import {
  AttributeHandler,
  parseBoolAttribute,
  parseFloatAttribute,
} from "../utils/attribute-handling";
import { CollideableHelper } from "../utils/CollideableHelper";
import { OrientedBoundingBox } from "../utils/OrientedBoundingBox";

const defaultImageSrc = "";
const defaultImageWidth = null;
const defaultImageHeight = null;
const defaultImageOpacity = 1;
const defaultImageCastShadows = true;

export class Image extends TransformableElement {
  static tagName = "m-image";

  private imageAnimatedAttributeHelper = new AnimatedAttributeHelper(this, {
    width: [
      AnimationType.Number,
      defaultImageWidth,
      (newValue: number) => {
        this.props.width = newValue;
        this.updateHeightAndWidth();
      },
    ],
    height: [
      AnimationType.Number,
      defaultImageHeight,
      (newValue: number) => {
        this.props.height = newValue;
        this.updateHeightAndWidth();
      },
    ],
    opacity: [
      AnimationType.Number,
      defaultImageOpacity,
      (newValue: number) => {
        this.props.opacity = newValue;
        if (this.material) {
          this.material.transparent = this.props.opacity !== 1 || this.loadedImageHasTransparency;
          this.material.opacity = newValue;
          this.material.needsUpdate = true;
        }
      },
    ],
  });

  private static imageLoader = new THREE.ImageLoader();
  private static planeGeometry = new THREE.PlaneGeometry(1, 1, 1, 1);

  private props = {
    src: defaultImageSrc,
    width: defaultImageWidth as number | null,
    height: defaultImageHeight as number | null,
    opacity: defaultImageOpacity,
    castShadows: defaultImageCastShadows,
  };

  private mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.Material | Array<THREE.Material>>;
  private material: THREE.MeshStandardMaterial | null = null;

  private srcApplyPromise: Promise<HTMLImageElement> | null = null;

  private collideableHelper = new CollideableHelper(this);
  private loadedImage: HTMLImageElement | null;
  private loadedImageHasTransparency = false;

  private srcLoadingInstanceManager = new LoadingInstanceManager(
    `${(this.constructor as typeof Image).tagName}.src`,
  );

  private static attributeHandler = new AttributeHandler<Image>({
    width: (instance, newValue) => {
      instance.imageAnimatedAttributeHelper.elementSetAttribute(
        "width",
        parseFloatAttribute(newValue, defaultImageWidth),
      );
    },
    height: (instance, newValue) => {
      instance.imageAnimatedAttributeHelper.elementSetAttribute(
        "height",
        parseFloatAttribute(newValue, defaultImageHeight),
      );
    },
    src: (instance, newValue) => {
      instance.setSrc(newValue);
    },
    opacity: (instance, newValue) => {
      instance.imageAnimatedAttributeHelper.elementSetAttribute(
        "opacity",
        parseFloatAttribute(newValue, defaultImageOpacity),
      );
    },
    "cast-shadows": (instance, newValue) => {
      instance.props.castShadows = parseBoolAttribute(newValue, defaultImageCastShadows);
      instance.mesh.castShadow = instance.props.castShadows;
    },
  });

  protected enable() {
    this.collideableHelper.enable();
  }

  protected disable() {
    this.collideableHelper.disable();
  }

  static get observedAttributes(): Array<string> {
    return [
      ...TransformableElement.observedAttributes,
      ...Image.attributeHandler.getAttributes(),
      ...CollideableHelper.observedAttributes,
    ];
  }

  constructor() {
    super();
    this.mesh = new THREE.Mesh(Image.planeGeometry);
    this.mesh.castShadow = this.props.castShadows;
    this.mesh.receiveShadow = true;
    this.container.add(this.mesh);
  }

  protected getContentBounds(): OrientedBoundingBox | null {
    return OrientedBoundingBox.fromSizeAndMatrixWorldProvider(
      new THREE.Vector3(this.mesh.scale.x, this.mesh.scale.y, 0),
      this.container,
    );
  }

  public addSideEffectChild(child: MElement): void {
    this.imageAnimatedAttributeHelper.addSideEffectChild(child);

    super.addSideEffectChild(child);
  }

  public removeSideEffectChild(child: MElement): void {
    this.imageAnimatedAttributeHelper.removeSideEffectChild(child);

    super.removeSideEffectChild(child);
  }

  private clearImage() {
    this.loadedImage = null;
    this.srcApplyPromise = null;
    if (this.material && this.material.map) {
      this.material.map.dispose();
      this.material.map = null;
    }
  }

  private setSrc(newValue: string | null) {
    this.props.src = (newValue || "").trim();
    const isDataUri = this.props.src.startsWith("data:image/");
    if (this.loadedImage !== null && !isDataUri) {
      // if the image has already been loaded, remove the image data from the THREE material
      this.clearImage();
    }
    if (!this.props.src) {
      // if the src attribute is empty, reset the dimensions and return
      this.updateHeightAndWidth();
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
      image.src = this.props.src;
      this.applyImage(image);
      this.srcLoadingInstanceManager.abortIfLoading();
      return;
    }

    const contentSrc = this.contentSrcToContentAddress(this.props.src);
    const srcApplyPromise = loadImageAsPromise(Image.imageLoader, contentSrc, (loaded, total) => {
      this.srcLoadingInstanceManager.setProgress(loaded / total);
    });
    this.srcLoadingInstanceManager.start(this.getLoadingProgressManager(), contentSrc);
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
        this.updateHeightAndWidth();
        this.srcLoadingInstanceManager.error(error);
      });
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
    if (this.loadedImageHasTransparency) {
      this.material.alphaMap = new THREE.CanvasTexture(this.loadedImage);
      this.material.alphaTest = 0.01;
    } else {
      this.material.alphaMap = null;
      this.material.alphaTest = 0;
    }
    this.material.transparent = this.props.opacity !== 1 || this.loadedImageHasTransparency;
    this.material.map = new THREE.CanvasTexture(this.loadedImage);
    this.material.needsUpdate = true;
    this.updateHeightAndWidth();
  }

  public parentTransformed(): void {
    this.collideableHelper.parentTransformed();
  }

  public isClickable(): boolean {
    return true;
  }

  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    super.attributeChangedCallback(name, oldValue, newValue);
    Image.attributeHandler.handle(this, name, newValue);
    this.collideableHelper.handle(name, newValue);
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      transparent: this.props.opacity !== 1 || this.loadedImageHasTransparency,
      opacity: this.props.opacity,
      side: THREE.DoubleSide,
    });
    this.mesh.material = this.material;
    if (this.props.src) {
      this.setSrc(this.props.src);
    }
    this.applyBounds();
    this.collideableHelper.updateCollider(this.mesh);
  }

  disconnectedCallback() {
    this.collideableHelper.removeColliders();
    if (this.material) {
      this.material.dispose();
      if (this.material.map) {
        this.material.map.dispose();
      }
      this.mesh.material = [];
      this.material = null;
    }
    this.loadedImage = null;
    this.srcLoadingInstanceManager.dispose();
    super.disconnectedCallback();
  }

  public getImageMesh(): THREE.Mesh<
    THREE.PlaneGeometry,
    THREE.Material | Array<THREE.Material>
  > | null {
    return this.mesh;
  }

  private updateHeightAndWidth() {
    const mesh = this.mesh;
    if (this.loadedImage) {
      const height = this.props.height;
      const width = this.props.width;
      const loadedWidth = Math.max(this.loadedImage.width, 1);
      const loadedHeight = Math.max(this.loadedImage.height, 1);

      if (height && width) {
        mesh.scale.x = width;
        mesh.scale.y = height;
      } else if (height && !width) {
        mesh.scale.y = height;
        // compute width
        mesh.scale.x = (mesh.scale.y * loadedWidth) / loadedHeight;
      } else if (!height && width) {
        mesh.scale.x = width;
        // compute height
        mesh.scale.y = (mesh.scale.x * loadedHeight) / loadedWidth;
      } else {
        mesh.scale.x = 1;
        // compute height
        mesh.scale.y = loadedHeight / loadedWidth;
      }
    } else {
      mesh.scale.x = this.props.width !== null ? this.props.width : 1;
      mesh.scale.y = this.props.height !== null ? this.props.height : 1;
    }
    this.applyBounds();
    this.collideableHelper.updateCollider(mesh);
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
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(image, 0, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

  for (let i = 3, n = imageData.length; i < n; i += 4) {
    if (imageData[i] < 255) {
      return true;
    }
  }
  return false;
}
