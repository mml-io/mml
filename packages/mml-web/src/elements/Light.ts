import * as THREE from "three";

import { TransformableElement } from "./TransformableElement";
import {
  AttributeHandler,
  parseBoolAttribute,
  parseColorAttribute,
  parseEnumAttribute,
  parseFloatAttribute,
} from "../utils/attribute-handling";

declare type LightHelper =
  | THREE.PointLightHelper
  | THREE.DirectionalLightHelper
  | THREE.SpotLightHelper
  | THREE.AmbientLight;

enum lightTypes {
  spotlight = "spotlight",
  ambient = "ambient",
  point = "point",
  directional = "directional",
}

const debugSphereSize = 0.25;
const defaultLightColor = new THREE.Color(0xffffff);
const defaultLightIntensity = 1;
const defaultLightAngle = 45;
const defaultLightEnabled = true;
const defaultLightDebug = false;
const defaultLightDistance = 0;
const defaultLightType = lightTypes.spotlight;

export class Light extends TransformableElement {
  static tagName = "m-light";
  private lightHelper: LightHelper | null;

  private props = {
    color: defaultLightColor,
    intensity: defaultLightIntensity,
    enabled: defaultLightEnabled,
    angleDeg: defaultLightAngle,
    distance: defaultLightDistance,
    debug: defaultLightDebug,
    type: defaultLightType as lightTypes,
  };

  private static attributeHandler = new AttributeHandler<Light>({
    color: (instance, newValue) => {
      instance.props.color = parseColorAttribute(newValue, defaultLightColor);
      instance.light.color.set(instance.props.color);
      if (instance.lightHelper) {
        instance.lightHelper.color = instance.props.color;
      }
    },
    intensity: (instance, newValue) => {
      instance.props.intensity = parseFloatAttribute(newValue, defaultLightIntensity);
      instance.light.intensity = instance.props.intensity;
    },
    enabled: (instance, newValue) => {
      instance.props.enabled = parseBoolAttribute(newValue, defaultLightEnabled);
      instance.light.visible = instance.props.enabled;
      if (instance.lightHelper) {
        instance.lightHelper.visible = instance.props.enabled;
      }
    },
    angle: (instance, newValue) => {
      instance.props.angleDeg = parseFloatAttribute(newValue, defaultLightAngle);
      if (instance.light instanceof THREE.SpotLight) {
        (instance.light as THREE.SpotLight).angle = THREE.MathUtils.degToRad(
          instance.props.angleDeg,
        );
      }
    },
    distance: (instance, newValue) => {
      instance.props.distance = parseFloatAttribute(newValue, defaultLightDistance);
      if (instance.light instanceof THREE.SpotLight) {
        (instance.light as THREE.SpotLight).distance = instance.props.distance;
      } else if (instance.light instanceof THREE.PointLight) {
        (instance.light as THREE.PointLight).distance = instance.props.distance;
      }
    },
    debug: (instance, newValue) => {
      instance.props.debug = parseBoolAttribute(newValue, defaultLightDebug);
      if (instance.props.debug && !instance.lightHelper) {
        instance.makeLightHelper();
      } else if (!instance.props.debug && instance.lightHelper) {
        instance.container.remove(instance.lightHelper);
        instance.lightHelper = null;
      }
    },
    type: (instance, newValue) => {
      instance.props.type = parseEnumAttribute(newValue, lightTypes, defaultLightType);
      instance.createLight();
    },
  });

  static get observedAttributes(): Array<string> {
    return [...TransformableElement.observedAttributes, ...Light.attributeHandler.getAttributes()];
  }

  private light: THREE.Light;

  constructor() {
    super();
    this.createLight();
  }

  public getLight(): THREE.Light {
    return this.light;
  }

  public parentTransformed(): void {
    // no-op
  }

  public isClickable(): boolean {
    return false;
  }

  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    super.attributeChangedCallback(name, oldValue, newValue);
    Light.attributeHandler.handle(this, name, newValue);
    if (this.lightHelper) {
      this.lightHelper.matrix = this.light.matrix;
    }
  }

  private createLight() {
    if (this.light) {
      this.light.removeFromParent();
    }

    switch (this.props.type) {
      case lightTypes.spotlight: {
        const light = new THREE.SpotLight(
          this.props.color,
          this.props.intensity,
          this.props.distance,
          THREE.MathUtils.degToRad(this.props.angleDeg),
        );
        // create a target
        const target = new THREE.Object3D();
        target.position.set(0, -1, 0);
        light.position.set(0, 0, 0);
        light.add(target);
        light.target = target;
        this.light = light;
        break;
      }
      case lightTypes.ambient:
        this.light = new THREE.AmbientLight(this.props.color, this.props.intensity);
        break;
      case lightTypes.point:
        this.light = new THREE.PointLight(
          this.props.color,
          this.props.intensity,
          this.props.distance,
        );
        break;
      case lightTypes.directional:
        this.light = new THREE.DirectionalLight(
          this.props.color,
          THREE.MathUtils.degToRad(this.props.angleDeg),
        );
        break;
    }

    if (this.light.shadow && !(this.light instanceof THREE.AmbientLight)) {
      this.light.castShadow = true;
      this.light.shadow.mapSize.width = 512;
      this.light.shadow.mapSize.height = 512;
      if (this.light.shadow.camera instanceof THREE.PerspectiveCamera) {
        this.light.shadow.camera.near = 0.5;
        this.light.shadow.camera.far = 500;
      }
      this.light.shadow.bias = -0.0001;
      const d = 10;
      const c = this.light.shadow.camera as any;
      c.left = -d;
      c.right = d;
      c.top = d;
      c.bottom = -d;
    }

    this.light.intensity = this.props.intensity;

    this.container.add(this.light);

    if (this.lightHelper) {
      this.makeLightHelper();
    }
  }

  private makeLightHelper() {
    if (this.lightHelper) {
      this.lightHelper.removeFromParent();
      this.lightHelper = null;
    }

    if (this.light instanceof THREE.PointLight) {
      this.lightHelper = new THREE.PointLightHelper(this.light, debugSphereSize);
    } else if (this.light instanceof THREE.SpotLight) {
      this.lightHelper = new THREE.SpotLightHelper(this.light);
    } else if (this.light instanceof THREE.DirectionalLight) {
      this.lightHelper = new THREE.DirectionalLightHelper(this.light, debugSphereSize);
    }

    if (this.lightHelper) {
      this.container.add(this.lightHelper);
      this.lightHelper.matrix = this.light.matrix;
      this.lightHelper.visible = this.light.visible;
    }
  }
}
