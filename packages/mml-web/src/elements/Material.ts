import * as THREE from "three";

import { AnimationType } from "./AttributeAnimation";
import { MaterialManager } from "./MaterialManager";
import { MElement } from "./MElement";
import { TransformableElement } from "./TransformableElement";
import { AnimatedAttributeHelper } from "../utils/AnimatedAttributeHelper";
import {
  AttributeHandler,
  parseAttribute,
  parseBoolAttribute,
  parseColorAttribute,
  parseFloatAttribute,
} from "../utils/attribute-handling";
import { OrientedBoundingBox } from "../utils/OrientedBoundingBox";

export type MaterialLoadedEvent = CustomEvent<{ materialId: string }>;
export interface ElementWithMesh extends TransformableElement {
  mesh: THREE.Mesh;
  material: THREE.Material;
  getDefaultMaterial: () => THREE.Material;
}

const defaultMaterialColor = new THREE.Color(0xffffff);
const defaultMaterialOpacity = 1;
const defaultMaterialRoughness = 1;
const defaultMaterialMetalness = 0;
const defaultMaterialMap = "";
const defaultMaterialLightMap = "";
const defaultMaterialLightMapIntensity = 1;
const defaultMaterialAoMap = "";
const defaultMaterialAoMapIntensity = 1;
const defaultMaterialEmissive = new THREE.Color(0x000000);
const defaultMaterialEmissiveIntensity = 1;
const defaultMaterialEmissiveMap = "";
const defaultMaterialBumpMap = "";
const defaultMaterialBumpScale = 1;
const defaultMaterialNormalMap = "";
const defaultMaterialNormalMapType: THREE.NormalMapTypes = THREE.TangentSpaceNormalMap;
const defaultMaterialNormalScale = new THREE.Vector2(1, 1);
const defaultMaterialDisplacementMap = "";
const defaultMaterialDisplacementScale = 1;
const defaultMaterialDisplacementBias = 0;
const defaultMaterialRoughnessMap = "";
const defaultMaterialMetalnessMap = "";
const defaultMaterialAlphaMap = "";
const defaultMaterialEnvMap = "";
const defaultMaterialEnvMapRotation = new THREE.Euler(0, 0, 0);
const defaultMaterialEnvMapIntensity = 1;
const defaultMaterialWireframe = false;
const defaultMaterialWireframeLinewidth = 1;
const defaultMaterialFog = true;
const defaultMaterialFlatShading = false;

export class Material extends MElement {
  static tagName = "m-material";

  private materialAnimatedAttributeHelper = new AnimatedAttributeHelper(this, {
    color: [
      AnimationType.Color,
      defaultMaterialColor,
      (newValue: THREE.Color) => {
        this.props.color = newValue;
        if (this.material) {
          this.material.color = this.props.color;
        }
      },
    ],
    opacity: [
      AnimationType.Number,
      defaultMaterialOpacity,
      (newValue: number) => {
        this.props.opacity = newValue;
        if (this.material) {
          const needsUpdate = this.material.transparent === (this.props.opacity === 1);
          this.material.transparent = this.props.opacity !== 1;
          this.material.needsUpdate = needsUpdate;
          this.material.opacity = newValue;
        }
      },
    ],
  });

  private props = {
    id: `${this.parentElement?.nodeName}/`,
    color: defaultMaterialColor,
    opacity: defaultMaterialOpacity,
    roughness: defaultMaterialRoughness,
    metalness: defaultMaterialMetalness,
    map: defaultMaterialMap,
    lightMap: defaultMaterialLightMap,
    lightMapIntensity: defaultMaterialLightMapIntensity,
    aoMap: defaultMaterialAoMap,
    aoMapIntensity: defaultMaterialAoMapIntensity,
    emissive: defaultMaterialEmissive,
    emissiveIntensity: defaultMaterialEmissiveIntensity,
    emissiveMap: defaultMaterialEmissiveMap,
    bumpMap: defaultMaterialBumpMap,
    bumpScale: defaultMaterialBumpScale,
    normalMap: defaultMaterialNormalMap,
    normalMapType: defaultMaterialNormalMapType,
    normalScale: defaultMaterialNormalScale,
    displacementMap: defaultMaterialDisplacementMap,
    displacementScale: defaultMaterialDisplacementScale,
    displacementBias: defaultMaterialDisplacementBias,
    roughnessMap: defaultMaterialRoughnessMap,
    metalnessMap: defaultMaterialMetalnessMap,
    alphaMap: defaultMaterialAlphaMap,
    envMap: defaultMaterialEnvMap,
    envMapRotation: defaultMaterialEnvMapRotation,
    envMapIntensity: defaultMaterialEnvMapIntensity,
    wireframe: defaultMaterialWireframe,
    wireframeLinewidth: defaultMaterialWireframeLinewidth,
    fog: defaultMaterialFog,
    flatShading: defaultMaterialFlatShading,
  };

  private material: THREE.MeshStandardMaterial | null = null;
  private materialManager: MaterialManager = MaterialManager.getInstance();

  private static attributeHandler = new AttributeHandler<Material>({
    color: (instance, newValue) => {
      instance.materialAnimatedAttributeHelper.elementSetAttribute(
        "color",
        parseColorAttribute(newValue, defaultMaterialColor),
      );
    },
    opacity: (instance, newValue) => {
      instance.materialAnimatedAttributeHelper.elementSetAttribute(
        "opacity",
        parseFloatAttribute(newValue, defaultMaterialOpacity),
      );
    },
    roughness: (instance, newValue) => {
      instance.props.roughness = parseFloatAttribute(newValue, 1);
      if (instance.material) {
        instance.material.roughness = instance.props.roughness;
        instance.material.needsUpdate = true;
      }
    },
    metalness: (instance, newValue) => {
      instance.props.metalness = parseFloatAttribute(newValue, 0);
      if (instance.material) {
        instance.material.metalness = instance.props.metalness;
        instance.material.needsUpdate = true;
      }
    },
    map: (instance, newValue) => {
      instance.props.map = newValue ?? defaultMaterialMap;
      if (instance.material) {
        instance.materialManager.loadTexture(instance.props.map, instance).then((texture) => {
          instance.material!.map = texture;
          instance.material!.needsUpdate = true;
        });
      }
    },
    "light-map": (instance, newValue) => {
      instance.props.lightMap = newValue ?? defaultMaterialLightMap;
      if (instance.material) {
        instance.materialManager.loadTexture(instance.props.lightMap, instance).then((texture) => {
          instance.material!.lightMap = texture;
          instance.material!.needsUpdate = true;
        });
      }
    },
    "light-map-intensity": (instance, newValue) => {
      instance.props.lightMapIntensity = parseFloatAttribute(
        newValue,
        defaultMaterialLightMapIntensity,
      );
      if (instance.material) {
        instance.material.lightMapIntensity = instance.props.lightMapIntensity;
        instance.material.needsUpdate = true;
      }
    },
    "ao-map": (instance, newValue) => {
      instance.props.aoMap = newValue ?? defaultMaterialAoMap;
      if (instance.material) {
        instance.materialManager.loadTexture(instance.props.aoMap, instance).then((texture) => {
          instance.material!.aoMap = texture;
          instance.material!.needsUpdate = true;
        });
      }
    },
    "ao-map-intensity": (instance, newValue) => {
      instance.props.aoMapIntensity = parseFloatAttribute(newValue, defaultMaterialAoMapIntensity);
      if (instance.material) {
        instance.material.aoMapIntensity = instance.props.aoMapIntensity;
        instance.material.needsUpdate = true;
      }
    },
    emissive: (instance, newValue) => {
      instance.props.emissive = parseColorAttribute(newValue, defaultMaterialEmissive);
      if (instance.material) {
        instance.material.emissive = instance.props.emissive;
        instance.material.needsUpdate = true;
      }
    },
    "emissive-intensity": (instance, newValue) => {
      instance.props.emissiveIntensity = parseFloatAttribute(
        newValue,
        defaultMaterialEmissiveIntensity,
      );
      if (instance.material) {
        instance.material.emissiveIntensity = instance.props.emissiveIntensity;
        instance.material.needsUpdate = true;
      }
    },
    "emissive-map": (instance, newValue) => {
      instance.props.emissiveMap = newValue ?? defaultMaterialEmissiveMap;
      if (instance.material) {
        instance.materialManager
          .loadTexture(instance.props.emissiveMap, instance)
          .then((texture) => {
            instance.material!.emissiveMap = texture;
            instance.material!.needsUpdate = true;
          });
      }
    },
    "bump-map": (instance, newValue) => {
      instance.props.bumpMap = newValue ?? defaultMaterialBumpMap;
      if (instance.material) {
        instance.materialManager.loadTexture(instance.props.bumpMap, instance).then((texture) => {
          instance.material!.bumpMap = texture;
          instance.material!.needsUpdate = true;
        });
      }
    },
    "bump-scale": (instance, newValue) => {
      instance.props.bumpScale = parseFloatAttribute(newValue, defaultMaterialBumpScale);
      if (instance.material) {
        instance.material.bumpScale = instance.props.bumpScale;
        instance.material.needsUpdate = true;
      }
    },
    "normal-map": (instance, newValue) => {
      instance.props.normalMap = newValue ?? defaultMaterialNormalMap;
      if (instance.material) {
        instance.materialManager.loadTexture(instance.props.normalMap, instance).then((texture) => {
          instance.material!.normalMap = texture;
          instance.material!.needsUpdate = true;
        });
      }
    },
    "normal-map-type": (instance, newValue) => {
      instance.props.normalMapType = parseAttribute(
        newValue,
        defaultMaterialNormalMapType,
        (value) => {
          switch (value) {
            case "TangentSpaceNormalMap":
              return THREE.TangentSpaceNormalMap;
            case "ObjectSpaceNormalMap":
              return THREE.ObjectSpaceNormalMap;
            default:
              return defaultMaterialNormalMapType;
          }
        },
      );
      if (instance.material) {
        instance.material.normalMapType = instance.props.normalMapType;
        instance.material.needsUpdate = true;
      }
    },
    "normal-scale": (instance, newValue) => {
      instance.props.normalScale = parseAttribute(newValue, defaultMaterialNormalScale, (value) => {
        const values = value.split(",");
        if (values.length !== 2) {
          console.warn(`Invalid normal-scale value: ${value}`);
          return defaultMaterialNormalScale;
        }
        return new THREE.Vector2(parseFloat(values[0].trim()), parseFloat(values[1].trim()));
      });
      if (instance.material) {
        instance.material.normalScale = instance.props.normalScale;
        instance.material.needsUpdate = true;
      }
    },
    "displacement-map": (instance, newValue) => {
      instance.props.displacementMap = newValue ?? defaultMaterialDisplacementMap;
      if (instance.material) {
        instance.materialManager
          .loadTexture(instance.props.displacementMap, instance)
          .then((texture) => {
            instance.material!.displacementMap = texture;
            instance.material!.needsUpdate = true;
          });
      }
    },
    "displacement-scale": (instance, newValue) => {
      instance.props.displacementScale = parseFloatAttribute(
        newValue,
        defaultMaterialDisplacementScale,
      );
      if (instance.material) {
        instance.material.displacementScale = instance.props.displacementScale;
        instance.material.needsUpdate = true;
      }
    },
    "displacement-bias": (instance, newValue) => {
      instance.props.displacementBias = parseFloatAttribute(
        newValue,
        defaultMaterialDisplacementBias,
      );
      if (instance.material) {
        instance.material.displacementBias = instance.props.displacementBias;
        instance.material.needsUpdate = true;
      }
    },
    "roughness-map": (instance, newValue) => {
      instance.props.roughnessMap = newValue ?? defaultMaterialRoughnessMap;
      if (instance.material) {
        instance.materialManager
          .loadTexture(instance.props.roughnessMap, instance)
          .then((texture) => {
            instance.material!.roughnessMap = texture;
            instance.material!.needsUpdate = true;
          });
      }
    },
    "metalness-map": (instance, newValue) => {
      instance.props.metalnessMap = newValue ?? defaultMaterialMetalnessMap;
      if (instance.material) {
        instance.materialManager
          .loadTexture(instance.props.metalnessMap, instance)
          .then((texture) => {
            instance.material!.metalnessMap = texture;
            instance.material!.needsUpdate = true;
          });
      }
    },
    "alpha-map": (instance, newValue) => {
      instance.props.alphaMap = newValue ?? defaultMaterialAlphaMap;
      if (instance.material) {
        instance.materialManager.loadTexture(instance.props.alphaMap, instance).then((texture) => {
          instance.material!.alphaMap = texture;
          instance.material!.needsUpdate = true;
        });
      }
    },
    "env-map": (instance, newValue) => {
      instance.props.envMap = newValue ?? defaultMaterialEnvMap;
      if (instance.material) {
        instance.materialManager.loadTexture(instance.props.envMap, instance).then((texture) => {
          instance.material!.envMap = texture;
          instance.material!.needsUpdate = true;
        });
      }
    },
    "env-map-rotation": (instance, newValue) => {
      instance.props.envMapRotation = parseAttribute(
        newValue,
        defaultMaterialEnvMapRotation,
        (value) => {
          const values = value.split(",");
          if (values.length !== 3) {
            console.warn(`Invalid env-map-rotation value: ${value}`);
            return defaultMaterialEnvMapRotation;
          }
          return new THREE.Euler(
            parseFloat(values[0]),
            parseFloat(values[1]),
            parseFloat(values[2]),
          );
        },
      );
      if (instance.material) {
        instance.material.envMapRotation = instance.props.envMapRotation;
        instance.material.needsUpdate = true;
      }
    },
    "env-map-intensity": (instance, newValue) => {
      instance.props.envMapIntensity = parseFloatAttribute(
        newValue,
        defaultMaterialEnvMapIntensity,
      );
      if (instance.material) {
        instance.material.envMapIntensity = instance.props.envMapIntensity;
        instance.material.needsUpdate = true;
      }
    },
    wireframe: (instance, newValue) => {
      instance.props.wireframe = parseBoolAttribute(newValue, defaultMaterialWireframe);
      if (instance.material) {
        instance.material.wireframe = instance.props.wireframe;
        instance.material.needsUpdate = true;
      }
    },
    "wireframe-line-width": (instance, newValue) => {
      instance.props.wireframeLinewidth = parseFloatAttribute(
        newValue,
        defaultMaterialWireframeLinewidth,
      );
      if (instance.material) {
        instance.material.wireframeLinewidth = instance.props.wireframeLinewidth;
        instance.material.needsUpdate = true;
      }
    },
    fog: (instance, newValue) => {
      instance.props.fog = parseBoolAttribute(newValue, defaultMaterialFog);
      if (instance.material) {
        instance.material.fog = instance.props.fog;
        instance.material.needsUpdate = true;
      }
    },
    "flat-shading": (instance, newValue) => {
      instance.props.flatShading = parseBoolAttribute(newValue, defaultMaterialFlatShading);
      if (instance.material) {
        instance.material.flatShading = instance.props.flatShading;
        instance.material.needsUpdate = true;
      }
    },
  });

  protected enable() {
    // no-op
  }

  protected disable() {
    // no-op
  }

  protected getContentBounds(): OrientedBoundingBox | null {
    return null;
  }

  static get observedAttributes(): Array<string> {
    return [
      ...TransformableElement.observedAttributes,
      ...Material.attributeHandler.getAttributes(),
    ];
  }

  private generateMaterialId = (): string => {
    return `material-${Date.now()}`;
  };
  public materialId: string = this.generateMaterialId();

  constructor() {
    super();
  }

  public addSideEffectChild(child: MElement): void {
    this.materialAnimatedAttributeHelper.addSideEffectChild(child);

    super.addSideEffectChild(child);
  }

  public removeSideEffectChild(child: MElement): void {
    this.materialAnimatedAttributeHelper.removeSideEffectChild(child);

    super.removeSideEffectChild(child);
  }

  public parentTransformed(): void {
    // no-op
  }

  public isClickable(): boolean {
    return true;
  }

  private async loadTextures(): Promise<void> {
    if (!this.material) {
      return;
    }
    await Promise.all(
      this.materialManager.mapKeys.map(async (key: keyof typeof this.props) => {
        const value = this.props[key];
        if (value) {
          const texture = await this.materialManager.loadTexture(this.props[key].toString(), this);
          if (texture && this.material && key in this.material) {
            (this.material[key] as unknown as THREE.Texture) = texture;
          }
        }
      }),
    );
    this.material.needsUpdate = true;
  }

  public getMaterial(): THREE.MeshStandardMaterial | null {
    return this.material;
  }

  public attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    super.attributeChangedCallback(name, oldValue, newValue);
    Material.attributeHandler.handle(this, name, newValue);
  }

  public connectedCallback(): void {
    super.connectedCallback();

    // Set unique id so that MElements can reference their materials without needing to pass references around, which involves considerable overhead when parsing to JSON
    this.setAttribute("data-material-id", this.materialId);

    this.material = new THREE.MeshStandardMaterial({
      color: this.props.color,
      transparent: this.props.opacity === 1 && !this.props.alphaMap ? false : true,
      opacity: this.props.opacity,
      roughness: this.props.roughness,
      metalness: this.props.metalness,
      lightMapIntensity: this.props.lightMapIntensity,
      aoMapIntensity: this.props.aoMapIntensity,
      emissive: this.props.emissive,
      emissiveIntensity: this.props.emissiveIntensity,
      bumpScale: this.props.bumpScale,
      normalMapType: this.props.normalMapType,
      normalScale: this.props.normalScale,
      displacementScale: this.props.displacementScale,
      displacementBias: this.props.displacementBias,
      envMapRotation: this.props.envMapRotation,
      envMapIntensity: this.props.envMapIntensity,
      wireframe: this.props.wireframe,
      wireframeLinewidth: this.props.wireframeLinewidth,
      fog: this.props.fog,
      flatShading: this.props.flatShading,
    });

    this.loadTextures().then(() => {
      if (this.parentElement && (this.parentElement as ElementWithMesh).mesh) {
        this.setParentMaterial(this.parentElement as ElementWithMesh);
        this.parentElement.dispatchEvent(
          new CustomEvent("materialLoaded", {
            detail: { materialId: this.materialId },
          }) satisfies MaterialLoadedEvent,
        );
      }
    });
  }

  public disconnectedCallback(): void {
    const parent = this.parentElement;
    if (parent && (parent as ElementWithMesh).mesh && (parent as ElementWithMesh).material) {
      this.disconnectParentMaterial(parent as ElementWithMesh);
      parent.dispatchEvent(new CustomEvent("materialDisconnected"));
    }
    if (this.material) {
      this.material.dispose();
      this.material = null;
    }
    super.disconnectedCallback();
  }

  public static getMaterialElementById(id: string, parentElement?: HTMLElement): Material | null {
    const container = parentElement ?? document.body;
    return container.querySelector(`[data-material-id="${id}"]`) as Material;
  }

  public setParentMaterial(parentElement: ElementWithMesh) {
    if (parentElement.material) {
      parentElement.material.dispose();
    }

    if (!this.material) {
      return;
    }

    parentElement.mesh.material = this.material;
    parentElement.material = this.material;
  }

  public disconnectParentMaterial(parentElement: ElementWithMesh) {
    if (parentElement.material) {
      parentElement.material = parentElement.material.clone();
      parentElement.mesh.material = parentElement.material;
    } else {
      parentElement.material = parentElement.getDefaultMaterial();
      parentElement.mesh.material = parentElement.material;
    }
  }
}
