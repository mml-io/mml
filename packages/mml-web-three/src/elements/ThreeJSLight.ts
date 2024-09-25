import { Light, LightTypes } from "mml-web";
import { LightGraphics } from "mml-web";
import { MMLColor } from "mml-web";
import * as THREE from "three";

import { ThreeJSGraphicsAdapter } from "../ThreeJSGraphicsAdapter";

declare type LightHelper = THREE.PointLightHelper | THREE.SpotLightHelper;

const debugSphereSize = 0.25;

export class ThreeJSLight extends LightGraphics<ThreeJSGraphicsAdapter> {
  private threeLight: THREE.PointLight | THREE.SpotLight;
  private threeLightHelper: LightHelper | null;

  constructor(private light: Light<ThreeJSGraphicsAdapter>) {
    super(light);
    this.createLight();
  }

  private createLight() {
    if (this.threeLight) {
      this.threeLight.removeFromParent();
    }

    const { r, g, b } = this.light.props.color;
    const color = new THREE.Color(r, g, b);

    switch (this.light.props.type) {
      case LightTypes.spotlight: {
        const light = new THREE.SpotLight(
          color,
          this.light.props.intensity,
          this.light.props.distance ?? undefined,
          THREE.MathUtils.degToRad(this.light.props.angleDeg),
        );
        // create a target
        const target = new THREE.Object3D();
        target.position.set(0, -1, 0);
        light.position.set(0, 0, 0);
        light.add(target);
        light.target = target;
        this.threeLight = light;
        break;
      }
      case LightTypes.point:
        this.threeLight = new THREE.PointLight(
          color,
          this.light.props.intensity,
          this.light.props.distance ?? undefined,
        );
        break;
    }

    if (this.threeLight.shadow) {
      this.threeLight.castShadow = this.light.props.castShadows;
      this.threeLight.shadow.mapSize.width = 512;
      this.threeLight.shadow.mapSize.height = 512;
      if (this.threeLight.shadow.camera instanceof THREE.PerspectiveCamera) {
        this.threeLight.shadow.camera.near = 0.5;
        this.threeLight.shadow.camera.far = 500;
      }
      this.threeLight.shadow.bias = -0.001;
      this.threeLight.shadow.normalBias = 0.01;
      const d = 10;
      const c = this.threeLight.shadow.camera as any;
      c.left = -d;
      c.right = d;
      c.top = d;
      c.bottom = -d;
    }

    this.threeLight.intensity = this.light.props.intensity;

    this.light.getContainer().add(this.threeLight);

    if (this.threeLightHelper) {
      this.makeLightHelper();
    }
    if (!this.light.props.enabled) {
      this.threeLight.visible = false;
      if (this.threeLightHelper) {
        this.threeLightHelper.visible = false;
      }
    }
  }

  private makeLightHelper() {
    if (this.threeLightHelper) {
      this.threeLightHelper.removeFromParent();
      this.threeLightHelper = null;
    }

    if (this.light instanceof THREE.PointLight) {
      this.threeLightHelper = new THREE.PointLightHelper(this.light, debugSphereSize);
    } else if (this.light instanceof THREE.SpotLight) {
      this.threeLightHelper = new THREE.SpotLightHelper(this.light);
    }

    if (this.threeLightHelper) {
      this.light.getContainer().add(this.threeLightHelper);
      this.threeLightHelper.matrix = this.threeLight.matrix;
      this.threeLightHelper.visible = this.threeLight.visible;
    }
  }

  disable(): void {}

  enable(): void {}

  setEnabled(enabled: boolean): void {
    this.threeLight.visible = enabled;
    if (this.threeLightHelper) {
      this.threeLightHelper.visible = enabled;
    }
  }

  setCastShadows(castShadows: boolean) {
    this.threeLight.castShadow = castShadows;
  }

  setAngle(angle: number) {
    if (this.threeLight instanceof THREE.SpotLight) {
      (this.threeLight as THREE.SpotLight).angle = THREE.MathUtils.degToRad(angle);
    }
  }

  setIntensity(intensity: number) {
    this.threeLight.intensity = intensity;
  }

  setDistance(distance: number) {
    this.threeLight.distance = distance;
  }

  setType(): void {
    this.createLight();
  }

  setDebug(debug: boolean): void {
    if (debug && !this.threeLightHelper) {
      this.makeLightHelper();
    } else if (!debug && this.threeLightHelper) {
      this.threeLightHelper.removeFromParent();
      this.threeLightHelper = null;
    }
  }

  setColor(color: MMLColor): void {
    this.threeLight.color.set(new THREE.Color(color.r, color.g, color.b));
    if (this.threeLightHelper) {
      this.threeLightHelper.color = new THREE.Color(color.r, color.g, color.b);
    }
  }

  dispose() {
    this.light.getContainer().remove(this.threeLight);
    if (this.threeLightHelper) {
      this.threeLightHelper.removeFromParent();
    }
  }
}
