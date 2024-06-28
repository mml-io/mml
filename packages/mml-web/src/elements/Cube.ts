import * as THREE from "three";

import { AnimationType } from "./AttributeAnimation";
import { Material } from "./Material";
import { MaterialManager } from "./MaterialManager";
import { MElement } from "./MElement";
import { TransformableElement } from "./TransformableElement";
import { AnimatedAttributeHelper } from "../utils/AnimatedAttributeHelper";
import {
  AttributeHandler,
  parseBoolAttribute,
  parseColorAttribute,
  parseFloatAttribute,
} from "../utils/attribute-handling";
import { CollideableHelper } from "../utils/CollideableHelper";
import { OrientedBoundingBox } from "../utils/OrientedBoundingBox";

const defaultCubeColor = new THREE.Color(0xffffff);
const defaultCubeWidth = 1;
const defaultCubeHeight = 1;
const defaultCubeDepth = 1;
const defaultCubeOpacity = 1;
const defaultCubeCastShadows = true;
const defaultMaterialId = "";

export class Cube extends TransformableElement {
  static tagName = "m-cube";

  private cubeAnimatedAttributeHelper = new AnimatedAttributeHelper(this, {
    color: [
      AnimationType.Color,
      defaultCubeColor,
      (newValue: THREE.Color) => {
        this.props.color = newValue;
        if (this.material && !this.registeredChildMaterial) {
          this.material.color = this.props.color;
        }
      },
    ],
    width: [
      AnimationType.Number,
      defaultCubeWidth,
      (newValue: number) => {
        this.props.width = newValue;
        this.mesh.scale.x = this.props.width;
        this.applyBounds();
        this.collideableHelper.updateCollider(this.mesh);
      },
    ],
    height: [
      AnimationType.Number,
      defaultCubeHeight,
      (newValue: number) => {
        this.props.height = newValue;
        this.mesh.scale.y = this.props.height;
        this.applyBounds();
        this.collideableHelper.updateCollider(this.mesh);
      },
    ],
    depth: [
      AnimationType.Number,
      defaultCubeDepth,
      (newValue: number) => {
        this.props.depth = newValue;
        this.mesh.scale.z = this.props.depth;
        this.applyBounds();
        this.collideableHelper.updateCollider(this.mesh);
      },
    ],
    opacity: [
      AnimationType.Number,
      defaultCubeOpacity,
      (newValue: number) => {
        this.props.opacity = newValue;
        if (this.material && !this.registeredChildMaterial) {
          const needsUpdate = this.material.transparent === (this.props.opacity === 1);
          this.material.transparent = this.props.opacity !== 1;
          this.material.needsUpdate = needsUpdate;
          this.material.opacity = newValue;
        }
      },
    ],
  });

  static boxGeometry = new THREE.BoxGeometry(1, 1, 1);

  private props = {
    width: defaultCubeWidth,
    height: defaultCubeHeight,
    depth: defaultCubeDepth,
    color: defaultCubeColor,
    opacity: defaultCubeOpacity,
    castShadows: defaultCubeCastShadows,
    materialId: defaultMaterialId,
  };
  private mesh: THREE.Mesh<THREE.BoxGeometry, THREE.Material | Array<THREE.Material>>;
  private material: THREE.MeshStandardMaterial | null = null;
  private collideableHelper = new CollideableHelper(this);
  private registeredChildMaterial: Material | null = null;

  private static attributeHandler = new AttributeHandler<Cube>({
    width: (instance, newValue) => {
      instance.cubeAnimatedAttributeHelper.elementSetAttribute(
        "width",
        parseFloatAttribute(newValue, defaultCubeWidth),
      );
    },
    height: (instance, newValue) => {
      instance.cubeAnimatedAttributeHelper.elementSetAttribute(
        "height",
        parseFloatAttribute(newValue, defaultCubeHeight),
      );
    },
    depth: (instance, newValue) => {
      instance.cubeAnimatedAttributeHelper.elementSetAttribute(
        "depth",
        parseFloatAttribute(newValue, defaultCubeDepth),
      );
    },
    color: (instance, newValue) => {
      instance.cubeAnimatedAttributeHelper.elementSetAttribute(
        "color",
        parseColorAttribute(newValue, defaultCubeColor),
      );
    },
    opacity: (instance, newValue) => {
      instance.cubeAnimatedAttributeHelper.elementSetAttribute(
        "opacity",
        parseFloatAttribute(newValue, defaultCubeOpacity),
      );
    },
    "cast-shadows": (instance, newValue) => {
      instance.props.castShadows = parseBoolAttribute(newValue, defaultCubeCastShadows);
      instance.mesh.castShadow = instance.props.castShadows;
    },
    "material-id": (instance, newValue) => {
      instance.props.materialId = newValue ?? defaultMaterialId;

      // Check if child material is the registered material, if so do nothing
      const childMaterial = instance.querySelector("m-material") as Material;
      const materialManager = MaterialManager.getInstance();
      if (instance.props.materialId) {
        if (instance.registeredChildMaterial) {
          // remove previously attached element
          instance.disconnectChildMaterial();
        }
        materialManager.registerMaterialUser(instance.props.materialId, instance);
      } else {
        materialManager.unregisterMaterialUser(instance.props.materialId, instance);
        if (childMaterial) {
          instance.setChildMaterial(childMaterial);
        } else {
          instance.disconnectChildMaterial();
        }
      }
    },
  });

  protected enable() {
    this.collideableHelper.enable();
  }

  protected disable() {
    this.collideableHelper.disable();
  }

  protected getContentBounds(): OrientedBoundingBox | null {
    return OrientedBoundingBox.fromSizeAndMatrixWorldProvider(
      new THREE.Vector3(this.props.width, this.props.height, this.props.depth),
      this.container,
    );
  }

  static get observedAttributes(): Array<string> {
    return [
      ...TransformableElement.observedAttributes,
      ...Cube.attributeHandler.getAttributes(),
      ...CollideableHelper.observedAttributes,
    ];
  }

  constructor() {
    super();
    this.mesh = new THREE.Mesh(Cube.boxGeometry);
    this.mesh.scale.x = this.props.width;
    this.mesh.scale.y = this.props.height;
    this.mesh.scale.z = this.props.depth;
    this.mesh.castShadow = this.props.castShadows;
    this.mesh.receiveShadow = true;
    this.container.add(this.mesh);
  }

  public addSideEffectChild(child: MElement): void {
    this.cubeAnimatedAttributeHelper.addSideEffectChild(child);
    if (child instanceof Material) {
      this.setChildMaterial(child);
    }
    super.addSideEffectChild(child);
  }

  public removeSideEffectChild(child: MElement): void {
    this.cubeAnimatedAttributeHelper.removeSideEffectChild(child);
    if (child === this.registeredChildMaterial) {
      this.disconnectChildMaterial();
    }
    super.removeSideEffectChild(child);
  }

  public parentTransformed(): void {
    this.collideableHelper.parentTransformed();
  }

  public isClickable(): boolean {
    return true;
  }

  public getCube(): THREE.Mesh<THREE.BoxGeometry, THREE.Material | Array<THREE.Material>> | null {
    return this.mesh;
  }

  public attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    super.attributeChangedCallback(name, oldValue, newValue);
    Cube.attributeHandler.handle(this, name, newValue);
    this.collideableHelper.handle(name, newValue);
  }

  public connectedCallback(): void {
    super.connectedCallback();
    this.material = this.getDefaultMaterial();
    this.mesh.material = this.material;

    if (this.props.materialId) {
      const materialManager = MaterialManager.getInstance();
      materialManager.registerMaterialUser(this.props.materialId, this);
    }

    this.applyBounds();
    this.collideableHelper.updateCollider(this.mesh);
  }

  public disconnectedCallback(): void {
    this.collideableHelper.removeColliders();
    const materialManager = MaterialManager.getInstance();
    if (this.registeredChildMaterial) {
      this.disconnectChildMaterial();
      materialManager.unregisterMaterialUser(this.props.materialId, this);
    }
    if (this.material && !this.registeredChildMaterial) {
      this.material.dispose();
      this.mesh.material = [];
      this.material = null;
    }
    super.disconnectedCallback();
  }

  public getDefaultMaterial() {
    return new THREE.MeshStandardMaterial({
      color: this.props.color,
      transparent: this.props.opacity === 1 ? false : true,
      opacity: this.props.opacity,
    });
  }

  private setChildMaterial(materialElement: Material) {
    const newMaterial = materialElement?.getMaterial();
    if (newMaterial) {
      if (this.material) {
        this.material.dispose();
      }
      this.material = newMaterial;
      this.mesh.material = this.material;
      this.registeredChildMaterial = materialElement;
    }
  }

  private disconnectChildMaterial() {
    const childMaterialElement = this.registeredChildMaterial;
    if (childMaterialElement) {
      this.material = this.getDefaultMaterial();
      this.mesh.material = this.material;
      this.registeredChildMaterial = null;
    }
  }
}
