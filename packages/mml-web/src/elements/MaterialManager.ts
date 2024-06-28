import * as THREE from "three";

import { Material } from "./Material";
import { MElement } from "./MElement";

interface MaterialTextureCacheItem {
  userMaterials: Map<Material, Material>;
  texture: THREE.Texture | Promise<THREE.Texture | null>;
}

interface SharedMaterialItem {
  material: Material | null;
  userElements: Map<MElement, MElement>;
}

export class MaterialManager {
  public mapKeys: (keyof THREE.MeshStandardMaterial)[] = [
    "map",
    "lightMap",
    "aoMap",
    "emissiveMap",
    "bumpMap",
    "normalMap",
    "roughnessMap",
    "metalnessMap",
    "alphaMap",
    "envMap",
  ];
  private static instance: MaterialManager;
  private textureCache: Map<string, MaterialTextureCacheItem> = new Map();
  private textureLoader: THREE.TextureLoader;
  private sharedMaterials: Map<string, SharedMaterialItem> = new Map();

  private constructor() {
    this.textureLoader = new THREE.TextureLoader();
  }

  public static getInstance(): MaterialManager {
    if (!MaterialManager.instance) {
      MaterialManager.instance = new MaterialManager();
    }
    return MaterialManager.instance;
  }

  public getTexture(src: string) {
    return this.textureCache.get(src);
  }

  public async loadTexture(src: string, materialElement: Material): Promise<THREE.Texture | null> {
    if (!src) {
      return null;
    }
    if (this.textureCache.has(src)) {
      const cacheItem = this.textureCache.get(src)!;
      cacheItem.userMaterials.set(materialElement, materialElement);
      return cacheItem.texture;
    }

    const texturePromise = this.textureLoader.loadAsync(src).catch(() => null);
    this.textureCache.set(src, {
      userMaterials: new Map([[materialElement, materialElement]]),
      texture: texturePromise,
    });
    const texture = await texturePromise;
    if (!texture) {
      this.textureCache.delete(src);
      return null;
    }

    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 1);
    return texture;
  }

  public unloadTexture(src: string, materialElement: Material) {
    if (this.textureCache.has(src)) {
      const cacheItem = this.textureCache.get(src)!;
      cacheItem.userMaterials.delete(materialElement);
      if (cacheItem.userMaterials.size === 0) {
        if (cacheItem.texture instanceof THREE.Texture) {
          cacheItem.texture.dispose();
        }
        this.textureCache.delete(src);
      }
    }
  }

  registerSharedMaterial(id: string, material: Material) {
    if (!id) return;
    let sharedMaterial = this.sharedMaterials.get(id);

    // If the shared material already exists, update the material and update all the user elements that registered before it became available
    if (sharedMaterial) {
      sharedMaterial.material = material;
      sharedMaterial.userElements.forEach((element) => {
        element.addSideEffectChild(material);
      });
    } else {
      sharedMaterial = {
        material,
        userElements: new Map(),
      };
    }
    this.sharedMaterials.set(id, sharedMaterial);
  }

  registerMaterialUser(id: string, element: MElement) {
    let sharedMaterial = this.sharedMaterials.get(id);

    // If a user element tries to register before a material is available, create an empty shared material entry
    if (!sharedMaterial) {
      sharedMaterial = {
        material: null,
        userElements: new Map([[element, element]]),
      };
      this.sharedMaterials.set(id, sharedMaterial);
    }
    sharedMaterial.userElements.set(element, element);
    if (sharedMaterial.material?.getMaterial()) {
      element.addSideEffectChild(sharedMaterial.material);
    }
  }

  unregisterSharedMaterial(id: string) {
    if (!id) return;
    const sharedMaterial = this.sharedMaterials.get(id);
    if (sharedMaterial) {
      sharedMaterial.userElements.forEach((element) => {
        sharedMaterial.material && element.removeSideEffectChild(sharedMaterial.material);
      });
      sharedMaterial.material = null;
    }
  }

  unregisterMaterialUser(id: string, element: MElement) {
    const sharedMaterial = this.sharedMaterials.get(id);
    if (sharedMaterial) {
      sharedMaterial.userElements.delete(element);
    }
  }
}
