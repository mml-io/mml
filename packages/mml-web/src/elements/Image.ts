import * as THREE from "three";

import { TransformableElement } from "./TransformableElement";
import {
  AttributeHandler,
  parseBoolAttribute,
  parseFloatAttribute,
} from "../utils/attribute-handling";
import { CollideableHelper } from "../utils/CollideableHelper";

const defaultImageWidth = null;
const defaultImageHeight = null;

export class Image extends TransformableElement {
  static tagName = "m-image";

  private props = {
    width: defaultImageWidth as number | null,
    height: defaultImageHeight as number | null,
  };

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
      if (newValue === null || newValue.trim().length === 0) {
        // if the src attribute is empty, remove the image data from the THREE material
        instance.loadedImage = null;
        instance.mesh.material.map = null;
        instance.updateHeightAndWidth();
        instance.srcApplyPromise = null;
        return;
      }

      instance.srcApplyPromise = loadImageAsPromise(Image.imageLoader, newValue)
        .then((image: HTMLImageElement) => {
          if (instance.getAttribute("src") === newValue) {
            // if the current src attribute still matches the requested URL, add
            // image data to the THREE material
            instance.loadedImage = image;
            instance.mesh.material.map = new THREE.CanvasTexture(image);
            instance.mesh.material.needsUpdate = true;
            instance.updateHeightAndWidth();
          }
        })
        .catch((error) => {
          console.error("Error loading image:", newValue, error);
          instance.updateHeightAndWidth();
        });
    },
    "cast-shadows": (instance, newValue) => {
      instance.mesh.castShadow = parseBoolAttribute(newValue, true);
    },
  });

  static get observedAttributes(): Array<string> {
    return [
      ...TransformableElement.observedAttributes,
      ...Image.attributeHandler.getAttributes(),
      ...CollideableHelper.observedAttributes,
    ];
  }

  private srcApplyPromise: Promise<void> | null = null;

  private collideableHelper = new CollideableHelper(this);
  private static imageLoader = new THREE.ImageLoader();
  private mesh: THREE.Mesh<
    THREE.PlaneGeometry,
    THREE.MeshStandardMaterial | THREE.MeshBasicMaterial
  >;
  private loadedImage: HTMLImageElement | HTMLVideoElement | null;

  constructor() {
    super();
    const geometry = new THREE.PlaneGeometry(1, 1, 1, 1);
    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      transparent: true,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = false;
    this.container.add(this.mesh);
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
    this.collideableHelper.updateCollider(this.mesh);
  }

  disconnectedCallback() {
    this.collideableHelper.removeColliders();
    super.disconnectedCallback();
  }

  public getImageMesh(): THREE.Mesh<
    THREE.PlaneGeometry,
    THREE.MeshStandardMaterial | THREE.MeshBasicMaterial
  > {
    return this.mesh;
  }

  private updateHeightAndWidth() {
    if (this.loadedImage) {
      const height = this.props.height;
      const width = this.props.width;
      const loadedWidth = this.loadedImage.width;
      const loadedHeight = this.loadedImage.height;

      if (height && width) {
        this.mesh.scale.x = width;
        this.mesh.scale.y = height;
      } else if (height && !width) {
        this.mesh.scale.y = height;
        // compute width
        this.mesh.scale.x = (this.mesh.scale.y * loadedWidth) / loadedHeight;
      } else if (!height && width) {
        this.mesh.scale.x = width;
        // compute height
        this.mesh.scale.y = (this.mesh.scale.x * loadedHeight) / loadedWidth;
      } else {
        this.mesh.scale.x = 1;
        // compute height
        this.mesh.scale.y = loadedHeight / loadedWidth;
      }
    } else {
      this.mesh.scale.x = this.props.width !== null ? this.props.width : 1;
      this.mesh.scale.y = this.props.height !== null ? this.props.height : 1;
    }
    this.collideableHelper.updateCollider(this.mesh);
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
