import * as THREE from "three";

import { TransformableElement } from "./TransformableElement";
import {
  AttributeHandler,
  parseBoolAttribute,
  parseFloatAttribute,
} from "../utils/attribute-handling";
import { CollideableHelper } from "../utils/CollideableHelper";

const defaultImageSrc = "";
const defaultImageWidth = null;
const defaultImageHeight = null;
const defaultImageOpacity = 1;
const defaultImageCastShadows = true;

export class Image extends TransformableElement {
  static tagName = "m-image";

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

  private static attributeHandler = new AttributeHandler<Image>({
    width: (instance, newValue) => {
      instance.props.width = parseFloatAttribute(newValue, defaultImageWidth);
      instance.updateHeightAndWidth();
    },
    height: (instance, newValue) => {
      instance.props.height = parseFloatAttribute(newValue, defaultImageHeight);
      instance.updateHeightAndWidth();
    },
    src: (instance, newValue) => {
      instance.setSrc(newValue);
    },
    opacity: (instance, newValue) => {
      instance.props.opacity = parseFloatAttribute(newValue, defaultImageOpacity);
      if (instance.material) {
        instance.material.transparent = instance.props.opacity === 1 ? false : true;
        instance.material.opacity = parseFloatAttribute(newValue, 1);
      }
    },
    "cast-shadows": (instance, newValue) => {
      instance.props.castShadows = parseBoolAttribute(newValue, defaultImageCastShadows);
      instance.mesh.castShadow = instance.props.castShadows;
    },
  });

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

  private setSrc(newValue: string | null) {
    this.props.src = (newValue || "").trim();
    if (this.loadedImage !== null) {
      // if the image has already been loaded, remove the image data from the THREE material
      this.loadedImage = null;
      this.srcApplyPromise = null;
      if (this.material && this.material.map) {
        this.material.map.dispose();
        this.material.map = null;
      }
    }
    if (!this.props.src) {
      // if the src attribute is empty, reset the dimensions and return
      this.updateHeightAndWidth();
      return;
    }
    if (!this.material) {
      // if the element is not yet connected, return
      return;
    }

    if (this.props.src.startsWith("data:image/")) {
      // if the src is a data url, load it directly rather than using the loader - this avoids a potential frame skip
      this.loadedImage = document.createElement("img");
      this.loadedImage.src = this.props.src;
      this.material.map = new THREE.CanvasTexture(this.loadedImage);
      this.material.needsUpdate = true;
      this.updateHeightAndWidth();
      return;
    }

    const srcApplyPromise = loadImageAsPromise(
      Image.imageLoader,
      this.contentSrcToContentAddress(this.props.src),
    );
    this.srcApplyPromise = srcApplyPromise;

    srcApplyPromise
      .then((image: HTMLImageElement) => {
        if (this.srcApplyPromise !== srcApplyPromise || !this.material) {
          // If we've loaded a different image since, or we're no longer connected, ignore this image
          return;
        }
        this.loadedImage = image;
        this.material.map = new THREE.CanvasTexture(this.loadedImage);
        this.material.needsUpdate = true;
        this.updateHeightAndWidth();
      })
      .catch((error) => {
        console.error("Error loading image:", newValue, error);
        this.updateHeightAndWidth();
      });
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
      transparent: this.props.opacity === 1 ? false : true,
      opacity: this.props.opacity,
      side: THREE.DoubleSide,
    });
    this.mesh.material = this.material;
    if (this.props.src) {
      this.setSrc(this.props.src);
    }
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
      const loadedWidth = this.loadedImage.width;
      const loadedHeight = this.loadedImage.height;

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
    this.collideableHelper.updateCollider(mesh);
  }
}

export function loadImageAsPromise(
  imageLoader: THREE.ImageLoader,
  path: string,
): Promise<HTMLImageElement> {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    imageLoader.load(
      path,
      (image: HTMLImageElement) => {
        resolve(image);
      },
      undefined,
      (error: ErrorEvent) => {
        reject(error);
      },
    );
  });
}
