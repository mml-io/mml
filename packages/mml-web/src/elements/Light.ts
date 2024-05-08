import * as THREE from "three";

import { AnimationType, AttributeAnimation } from "./AttributeAnimation";
import { MElement } from "./MElement";
import { TransformableElement } from "./TransformableElement";
import { AnimatedAttributeHelper } from "../utils/AnimatedAttributeHelper";
import {
  AttributeHandler,
  parseBoolAttribute,
  parseColorAttribute,
  parseEnumAttribute,
  parseFloatAttribute,
} from "../utils/attribute-handling";
import { OrientedBoundingBox } from "../utils/OrientedBoundingBox";

declare type LightHelper = THREE.PointLightHelper | THREE.SpotLightHelper;

enum lightTypes {
  spotlight = "spotlight",
  point = "point",
}

const debugSphereSize = 0.25;
const defaultLightColor = new THREE.Color(0xffffff);
const defaultLightIntensity = 1;
const defaultLightAngle = 45;
const defaultLightEnabled = true;
const defaultLightDebug = false;
const defaultLightDistance = 0;
const defaultLightCastShadow = true;
const defaultLightType = lightTypes.spotlight;

export class Light extends TransformableElement {
  static tagName = "m-light";

  private lightAnimatedAttributeHelper = new AnimatedAttributeHelper(this, {
    color: [
      AnimationType.Color,
      defaultLightColor,
      (newValue: THREE.Color) => {
        this.props.color = newValue;
        this.light.color.set(this.props.color);
        if (this.lightHelper) {
          this.lightHelper.color = this.props.color;
        }
      },
    ],
    intensity: [
      AnimationType.Number,
      defaultLightIntensity,
      (newValue: number) => {
        this.props.intensity = newValue;
        this.light.intensity = this.props.intensity;
      },
    ],
  });

  private lightHelper: LightHelper | null;

  private props = {
    color: defaultLightColor,
    intensity: defaultLightIntensity,
    enabled: defaultLightEnabled,
    angleDeg: defaultLightAngle,
    distance: defaultLightDistance,
    castShadow: defaultLightCastShadow,
    debug: defaultLightDebug,
    type: defaultLightType as lightTypes,
  };

  private static attributeHandler = new AttributeHandler<Light>({
    color: (instance, newValue) => {
      instance.lightAnimatedAttributeHelper.elementSetAttribute(
        "color",
        parseColorAttribute(newValue, defaultLightColor),
      );
    },
    intensity: (instance, newValue) => {
      instance.lightAnimatedAttributeHelper.elementSetAttribute(
        "intensity",
        parseFloatAttribute(newValue, defaultLightIntensity),
      );
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
    "cast-shadow": (instance, newValue) => {
      instance.props.castShadow = parseBoolAttribute(newValue, defaultLightCastShadow);
      instance.light.castShadow = instance.props.castShadow;
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

  protected enable() {
    // no-op
  }

  protected disable() {
    // no-op
  }

  protected getContentBounds(): OrientedBoundingBox | null {
    return OrientedBoundingBox.fromMatrixWorldProvider(this.container);
  }

  public getLight(): THREE.Light {
    return this.light;
  }

  public addSideEffectChild(child: MElement): void {
    if (child instanceof AttributeAnimation) {
      const attr = child.getAnimatedAttributeName();
      if (attr) {
        this.lightAnimatedAttributeHelper.addAnimation(child, attr);
      }
    }
    super.addSideEffectChild(child);
  }

  public removeSideEffectChild(child: MElement): void {
    if (child instanceof AttributeAnimation) {
      const attr = child.getAnimatedAttributeName();
      if (attr) {
        this.lightAnimatedAttributeHelper.removeAnimation(child, attr);
      }
    }
    super.removeSideEffectChild(child);
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
      case lightTypes.point:
        this.light = new THREE.PointLight(
          this.props.color,
          this.props.intensity,
          this.props.distance,
        );
        break;
    }

    if (this.light.shadow) {
      this.light.castShadow = this.props.castShadow;
      this.light.shadow.mapSize.width = 512;
      this.light.shadow.mapSize.height = 512;
      if (this.light.shadow.camera instanceof THREE.PerspectiveCamera) {
        this.light.shadow.camera.near = 0.5;
        this.light.shadow.camera.far = 500;
      }
      this.light.shadow.bias = -0.001;
      this.light.shadow.normalBias = 0.01;
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
    }

    if (this.lightHelper) {
      this.container.add(this.lightHelper);
      this.lightHelper.matrix = this.light.matrix;
      this.lightHelper.visible = this.light.visible;
    }
  }
}
