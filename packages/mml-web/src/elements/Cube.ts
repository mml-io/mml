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
      const oldId = instance.props.materialId;
      instance.props.materialId = newValue ?? defaultMaterialId;
      if (
        instance.registeredChildMaterial &&
        instance.registeredChildMaterial.parentElement === instance
      ) {
        // Ignore changes in material id if the element has a direct child material
        return;
      }

      const materialManager = MaterialManager.getInstance();
      if (oldId && instance.registeredChildMaterial) {
        materialManager.unregisterMaterialUser(oldId, instance);
        instance.disconnectChildMaterial();
      }
      if (instance.props.materialId) {
        materialManager.registerMaterialUser(instance.props.materialId, instance);
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
    if (
      child instanceof Material &&
      (!this.registeredChildMaterial || child.parentElement === this)
    ) {
      this.registeredChildMaterial = child;
      if (child.isLoaded) {
        this.setChildMaterial(child);
      } else {
        child.addEventListener("materialLoaded", () => {
          this.setChildMaterial(child);
        });
      }
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
    if (!this.material) {
      this.material = this.getDefaultMaterial();
      this.mesh.material = this.material;
    }

    this.applyBounds();
    this.collideableHelper.updateCollider(this.mesh);
  }

  public disconnectedCallback(): void {
    this.collideableHelper.removeColliders();
    const materialManager = MaterialManager.getInstance();

    // Disconnect shared material
    if (
      this.registeredChildMaterial &&
      this.props.materialId &&
      this.props.materialId === this.registeredChildMaterial.id
    ) {
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
    const registeredMaterialElement = this.registeredChildMaterial;
    const childMaterial = this.querySelector("m-material") as Material;
    const sharedMaterialId = this.props.materialId;
    const sharedMaterial = document.getElementById(sharedMaterialId) as Material;
    if (
      registeredMaterialElement &&
      childMaterial instanceof Material &&
      registeredMaterialElement !== childMaterial
    ) {
      // Fallback to child
      this.registeredChildMaterial = null;
      this.addSideEffectChild(childMaterial);
    } else if (
      registeredMaterialElement &&
      sharedMaterial instanceof Material &&
      registeredMaterialElement !== sharedMaterial
    ) {
      // Fallback to shared material
      this.registeredChildMaterial = null;
      this.addSideEffectChild(sharedMaterial);
    }
    if ((!childMaterial && !sharedMaterial) || childMaterial === sharedMaterial) {
      this.material = this.getDefaultMaterial();
      this.mesh.material = this.material;
      this.registeredChildMaterial = null;
    }
  }
}
