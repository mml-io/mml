import * as THREE from "three";

import { Material } from "./Material";
import { MElement } from "./MElement";
import { RemoteDocument } from "./RemoteDocument";

interface MaterialTextureCacheItem {
  userMaterials: Map<Material, Material>;
  texture: THREE.Texture | Promise<THREE.Texture | null>;
}

interface SharedMaterialItem {
  material: Material | null;
  remoteDocument: RemoteDocument | null;
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

  static getScopedMaterialKey(remoteAddress: string, materialId: string) {
    return `${remoteAddress}#${materialId}`;
  }

  public getTexture(src: string) {
    return this.textureCache.get(src);
  }

  public getSharedMaterial(remoteAddress: string, id: string) {
    const scopedId = MaterialManager.getScopedMaterialKey(remoteAddress, id);
    return this.sharedMaterials.get(scopedId)?.material;
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

  registerSharedMaterial(remoteAddress: string, id: string, material: Material) {
    const scopedId = MaterialManager.getScopedMaterialKey(remoteAddress, id);
    let sharedMaterial = this.sharedMaterials.get(scopedId);

    if (sharedMaterial && sharedMaterial.material?.getMaterial()) {
      const conflictingNodes = sharedMaterial.remoteDocument?.querySelectorAll(
        `m-material[id="${id}"]`,
      );
      const topMaterial = conflictingNodes?.[0] as Material;
      if (topMaterial === sharedMaterial.material) {
        console.warn(
          `${remoteAddress}: Higher priority material with id ${id} already exists in their scope.`,
        );
        return;
      }
    }

    // If the shared material already exists, update the material
    // and update all the user elements that registered before it became available
    if (sharedMaterial) {
      sharedMaterial.material = material;
      sharedMaterial.remoteDocument = material.getRemoteDocument() || null;
      sharedMaterial.userElements.forEach((element) => {
        element.addSideEffectChild(material);
      });
    } else {
      sharedMaterial = {
        material,
        remoteDocument: material.getRemoteDocument() || null,
        userElements: new Map(),
      };
    }
    this.sharedMaterials.set(scopedId, sharedMaterial);
  }

  registerMaterialUser(remoteAddress: string, id: string, element: MElement) {
    const scopedId = MaterialManager.getScopedMaterialKey(remoteAddress, id);
    let sharedMaterial = this.sharedMaterials.get(scopedId);

    if (!sharedMaterial) {
      // If a user element tries to register before a material is available, create an empty shared material entry
      sharedMaterial = {
        material: null,
        remoteDocument: null,
        userElements: new Map([[element, element]]),
      };
      this.sharedMaterials.set(scopedId, sharedMaterial);
    }

    if (sharedMaterial.userElements.has(element)) {
      console.warn(
        `${remoteAddress}: Element with id ${element.id} already uses material with id ${id}.`,
      );
      return;
    }

    sharedMaterial.userElements.set(element, element);
    if (sharedMaterial.material) {
      element.addSideEffectChild(sharedMaterial.material);
    }
  }

  unregisterSharedMaterial(remoteAddress: string, id: string, material: Material) {
    const scopedId = MaterialManager.getScopedMaterialKey(remoteAddress, id);
    const sharedMaterial = this.sharedMaterials.get(scopedId);

    if (!id || material !== sharedMaterial?.material) return;
    if (sharedMaterial && sharedMaterial.material) {
      sharedMaterial.userElements.forEach((element) => {
        sharedMaterial.material && element.removeSideEffectChild(sharedMaterial.material);
        sharedMaterial.material && element.dispatchEvent(new CustomEvent("materialDisconnected"));
      });
      const oldMaterial = sharedMaterial.material;
      sharedMaterial.material = null;

      // Fallback to a previously conflicting shared material if available
      const newMaterial = this.getSharedMaterialFallback(remoteAddress, id);
      if (newMaterial && newMaterial !== oldMaterial) {
        this.registerSharedMaterial(remoteAddress, id, newMaterial);
      }
    }
  }

  getSharedMaterialFallback(remoteAddress: string, id: string): Material | null {
    const scopedId = MaterialManager.getScopedMaterialKey(remoteAddress, id);
    const sharedMaterial = this.sharedMaterials.get(scopedId);
    if (sharedMaterial) {
      const newMaterial = (sharedMaterial.remoteDocument?.querySelector(`m-material[id="${id}"]`) ??
        null) as Material | null;
      const isSameDocument =
        newMaterial?.getRemoteDocument()?.getDocumentAddress() === remoteAddress;
      return isSameDocument ? newMaterial : null;
    }
    return null;
  }

  unregisterMaterialUser(remoteAddress: string, id: string, element: MElement) {
    const scopedId = MaterialManager.getScopedMaterialKey(remoteAddress, id);
    const sharedMaterial = this.sharedMaterials.get(scopedId);
    if (sharedMaterial) {
      sharedMaterial.userElements.delete(element);
    }
  }
}
