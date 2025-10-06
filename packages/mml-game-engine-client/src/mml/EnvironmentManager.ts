import * as THREE from "three";

import { EnvironmentLightGraphics } from "./elements/EnvironmentLight";
import { EnvironmentMapGraphics } from "./elements/EnvironmentMap";
import { FogGraphics } from "./elements/Fog";
import { SunGraphics } from "./elements/Sun";

export type EnvironmentElement = {
  priority: number;
  environmentMapElement?: any;
  environmentLightElement?: any;
};

export class EnvironmentManager {
  private environmentMaps: EnvironmentMapGraphics[] = [];
  private sortedEnvironmentMaps: EnvironmentMapGraphics[] = [];
  private environmentMapsDirty: boolean = false;

  private environmentLights: EnvironmentLightGraphics[] = [];
  private sortedEnvironmentLights: EnvironmentLightGraphics[] = [];
  private environmentLightsDirty: boolean = false;

  private suns: SunGraphics[] = [];
  private sortedSuns: SunGraphics[] = [];
  private sunsDirty: boolean = false;

  private fogs: FogGraphics[] = [];
  private sortedFogs: FogGraphics[] = [];
  private fogsDirty: boolean = false;

  private threeScene: THREE.Scene;
  private renderer: THREE.WebGLRenderer;

  constructor(threeScene: THREE.Scene, renderer: THREE.WebGLRenderer) {
    this.threeScene = threeScene;
    this.renderer = renderer;
  }

  private sortByPriorityAndDocumentPosition<T extends { priority: number }>(
    elements: T[],
    getElement: (item: T) => Node,
  ): T[] {
    return elements.slice().sort((a, b) => {
      // higher priority first (like the cam one)
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      // then dom pos pos
      const aElement = getElement(a);
      const bElement = getElement(b);
      const position = aElement.compareDocumentPosition(bElement);

      if (position & Node.DOCUMENT_POSITION_FOLLOWING) {
        return -1;
      } else if (position & Node.DOCUMENT_POSITION_PRECEDING) {
        return 1;
      }

      return 0;
    });
  }

  getActiveEnvironmentMap(): EnvironmentMapGraphics | null {
    if (this.environmentMapsDirty) {
      this.sortedEnvironmentMaps = this.sortByPriorityAndDocumentPosition(
        this.environmentMaps,
        (item) => item.environmentMapElement,
      );
      this.environmentMapsDirty = false;
    }

    const firstEnvironmentMap = this.sortedEnvironmentMaps[0];
    return firstEnvironmentMap || null;
  }

  applyActiveEnvironmentMap() {
    const activeEnvMap = this.getActiveEnvironmentMap();
    if (activeEnvMap && activeEnvMap.currentEnvironmentMap) {
      this.threeScene.environment = activeEnvMap.currentEnvironmentMap;
      this.threeScene.background = activeEnvMap.currentEnvironmentMap;
      this.threeScene.environmentIntensity = activeEnvMap.environmentMapElement.props.intensity;
      this.threeScene.backgroundIntensity = activeEnvMap.environmentMapElement.props.intensity;

      const angle = activeEnvMap.environmentMapElement.props.azimuthalAngle;
      const azimuthalRad = THREE.MathUtils.degToRad(angle);
      const polarRad = 0;
      this.threeScene.environmentRotation = new THREE.Euler(polarRad, azimuthalRad, 0);
      this.threeScene.backgroundRotation = new THREE.Euler(polarRad, azimuthalRad, 0);

      this.threeScene.traverse((object) => {
        if ((object as THREE.Mesh).isMesh) {
          const mesh = object as THREE.Mesh;
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          materials.forEach((material) => {
            if (material) {
              material.needsUpdate = true;
            }
          });
        }
      });
    } else {
      this.threeScene.environment = null;
      this.threeScene.background = null;
      this.threeScene.environmentIntensity = 1;
      this.threeScene.backgroundIntensity = 1;
    }
  }

  registerEnvironmentMap(environmentMap: EnvironmentMapGraphics) {
    this.environmentMaps.push(environmentMap);
    this.environmentMapsDirty = true;
    this.applyActiveEnvironmentMap();
  }

  updateEnvironmentMapPriority(_environmentMap: EnvironmentMapGraphics) {
    // just triggering reapply with dirty flag. keeping the argument for the sake of API consistency
    // and (maybe?) future proofing (maybe we'll need element specific logic for this stuff)
    this.environmentMapsDirty = true;
    this.applyActiveEnvironmentMap();
  }

  unregisterEnvironmentMap(environmentMap: EnvironmentMapGraphics) {
    this.environmentMaps = this.environmentMaps.filter((e) => e !== environmentMap);
    this.environmentMapsDirty = true;
    this.applyActiveEnvironmentMap();
  }

  updateEnvironmentMapProperties() {
    this.applyActiveEnvironmentMap();
  }

  getActiveEnvironmentLight(): EnvironmentLightGraphics | null {
    if (this.environmentLightsDirty) {
      this.sortedEnvironmentLights = this.sortByPriorityAndDocumentPosition(
        this.environmentLights,
        (item) => item.environmentLightElement,
      );
      this.environmentLightsDirty = false;
    }

    const firstEnvironmentLight = this.sortedEnvironmentLights[0];
    return firstEnvironmentLight || null;
  }

  applyActiveEnvironmentLight() {
    const existingAmbientLights = this.threeScene.children.filter(
      (child) => child instanceof THREE.AmbientLight,
    );
    existingAmbientLights.forEach((light) => {
      this.threeScene.remove(light);
    });

    const activeEnvLight = this.getActiveEnvironmentLight();
    if (activeEnvLight && activeEnvLight.currentAmbientLight) {
      this.threeScene.add(activeEnvLight.currentAmbientLight);
    }
  }

  registerEnvironmentLight(environmentLight: EnvironmentLightGraphics) {
    this.environmentLights.push(environmentLight);
    this.environmentLightsDirty = true;
    this.applyActiveEnvironmentLight();
  }

  updateEnvironmentLightPriority(_environmentLight: EnvironmentLightGraphics) {
    this.environmentLightsDirty = true;
    this.applyActiveEnvironmentLight();
  }

  unregisterEnvironmentLight(environmentLight: EnvironmentLightGraphics) {
    this.environmentLights = this.environmentLights.filter((e) => e !== environmentLight);
    this.environmentLightsDirty = true;
    this.applyActiveEnvironmentLight();
  }

  updateEnvironmentLightProperties() {
    this.applyActiveEnvironmentLight();
  }

  getActiveSun(): SunGraphics | null {
    if (this.sunsDirty) {
      this.sortedSuns = this.sortByPriorityAndDocumentPosition(
        this.suns,
        (item) => item.sunElement,
      );
      this.sunsDirty = false;
    }

    const firstSun = this.sortedSuns[0];
    return firstSun || null;
  }

  applyActiveSun() {
    const existingSuns = this.threeScene.children.filter(
      (child) => child.userData.isSun || child.userData.isSky,
    );
    existingSuns.forEach((sun) => {
      this.threeScene.remove(sun);
    });

    const activeSun = this.getActiveSun();
    if (activeSun) {
      const sunGroup = activeSun.getSunGroup();
      const sky = activeSun.getSky();
      const skyCubeCamera = activeSun.getSkyCubeCamera();
      const skyRenderTarget = activeSun.getSkyRenderTarget();

      if (sunGroup) {
        sunGroup.userData.isSun = true;
        this.threeScene.add(sunGroup);
      }

      if (sky && skyCubeCamera && skyRenderTarget) {
        sky.userData.isSky = true;
        this.threeScene.add(sky);

        if (this.renderer && this.renderer.domElement) {
          try {
            skyCubeCamera.update(this.renderer, sky);
            this.threeScene.environment = skyRenderTarget.texture;
            this.threeScene.environmentIntensity = 0.5;

            this.threeScene.traverse((object) => {
              if ((object as THREE.Mesh).isMesh) {
                const mesh = object as THREE.Mesh;
                const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
                materials.forEach((material) => {
                  if (material) {
                    material.needsUpdate = true;
                  }
                });
              }
            });
          } catch (error) {
            console.warn("Failed to update sky cube camera:", error);
            this.threeScene.background = skyRenderTarget.texture;
          }
        } else {
          console.warn("Renderer not ready, skipping sky environment update");
          this.threeScene.background = skyRenderTarget.texture;
        }
      }
    }
  }

  registerSun(sun: SunGraphics) {
    this.suns.push(sun);
    this.sunsDirty = true;
    this.applyActiveSun();
  }

  updateSunPriority(_sun: SunGraphics) {
    this.sunsDirty = true;
    this.applyActiveSun();
  }

  unregisterSun(sun: SunGraphics) {
    this.suns = this.suns.filter((s) => s !== sun);
    this.sunsDirty = true;
    this.applyActiveSun();
  }

  updateSunProperties() {
    this.applyActiveSun();
  }

  getActiveFog(): FogGraphics | null {
    if (this.fogsDirty) {
      this.sortedFogs = this.sortByPriorityAndDocumentPosition(
        this.fogs,
        (item) => item.fogElement,
      );
      this.fogsDirty = false;
    }

    const firstFog = this.sortedFogs[0];
    return firstFog || null;
  }

  applyActiveFog() {
    const activeFog = this.getActiveFog();
    if (activeFog && activeFog.currentFog) {
      this.threeScene.fog = activeFog.currentFog;
    } else {
      this.threeScene.fog = null;
    }
  }

  registerFog(fog: FogGraphics) {
    this.fogs.push(fog);
    this.fogsDirty = true;
    this.applyActiveFog();
  }

  updateFogPriority(_fog: FogGraphics) {
    this.fogsDirty = true;
    this.applyActiveFog();
  }

  unregisterFog(fog: FogGraphics) {
    this.fogs = this.fogs.filter((f) => f !== fog);
    this.fogsDirty = true;
    this.applyActiveFog();
  }

  updateFogProperties() {
    this.applyActiveFog();
  }
}
