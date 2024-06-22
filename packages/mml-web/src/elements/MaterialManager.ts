import * as THREE from "three";

import { Material } from "./Material";

interface MaterialTextureCacheItem {
  userMaterials: Map<Material, Material>;
  texture: THREE.Texture;
}

export class MaterialManager {
  public mapKeys: (keyof THREE.MeshStandardMaterial)[] = [
    "map",
    "lightMap",
    "aoMap",
    "emissiveMap",
    "bumpMap",
    "normalMap",
    "displacementMap",
    "roughnessMap",
    "metalnessMap",
    "alphaMap",
    "envMap",
  ];
  private static instance: MaterialManager;
  private textureCache: Map<string, MaterialTextureCacheItem> = new Map();
  private textureLoader: THREE.TextureLoader;

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

  public getMaterialKey(material: Material) {
    return this.mapKeys.reduce((acc, key) => {
      const textureSrc = material.getAttribute(key);
      if (textureSrc) {
        return acc + `${key}=${textureSrc},`;
      }
      return acc;
    }, "");
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
    const texture = await this.textureLoader.loadAsync(src);
    this.textureCache.set(src, {
      userMaterials: new Map([[materialElement, materialElement]]),
      texture,
    });
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
        cacheItem.texture.dispose();
        this.textureCache.delete(src);
      }
    }
  }
}
