import * as playcanvas from "playcanvas";

import { Light, LightProps, LightTypes } from "../elements";
import { LightGraphics, MMLColor } from "../MMLGraphicsInterface";

const lightIntensityFactor = 1 / 800;

export class PlayCanvasLight extends LightGraphics {
  private lightComponent: playcanvas.LightComponent;

  constructor(private light: Light) {
    super(light);
    this.createLight();
  }

  private createLight() {
    const lightEntity = this.light.getContainer() as playcanvas.Entity;
    if (this.lightComponent) {
      lightEntity.removeComponent("light");
    }

    const { r, g, b } = this.light.props.color;

    console.log("this.light.props.type", this.light.props.type);
    if (this.light.props.type === "spotlight") {
      this.lightComponent = lightEntity.addComponent("light", {
        type: "spot",
        intensity: this.light.props.intensity * lightIntensityFactor,
        castShadows: this.light.props.castShadow,
        shadowBias: 0.1,
        normalOffsetBias: 0.1,
        shape: playcanvas.LIGHTSHAPE_DISK,
        innerConeAngle: this.light.props.angleDeg,
        outerConeAngle: this.light.props.angleDeg,
        range: 100,
      } as playcanvas.LightComponent) as playcanvas.LightComponent;
    } else {
      this.lightComponent = lightEntity.addComponent("light", {
        type: "point",
        intensity: this.light.props.intensity * lightIntensityFactor,
        castShadows: this.light.props.castShadow,
        shadowBias: 0.1,
        normalOffsetBias: 0.1,
        range: 100,
      } as playcanvas.LightComponent) as playcanvas.LightComponent;
    }
  }

  disable(): void {}

  enable(): void {}

  setEnabled(enabled: boolean, lightProps: LightProps): void {
    // TODO
    // this.threeLight.visible = enabled;
  }

  setCastShadow(castShadow: boolean, mLightProps: LightProps) {
    // TODO
    // this.threeLight.castShadow = castShadow;
  }

  setAngle(angle: number, mLightProps: LightProps) {
    if (this.lightComponent.type !== "spot") {
      return;
    }
    this.lightComponent.innerConeAngle = angle;
    this.lightComponent.outerConeAngle = angle;
  }

  setIntensity(intensity: number, mLightProps: LightProps) {
    this.lightComponent.intensity = intensity * lightIntensityFactor;
  }

  setDistance(distance: number, mLightProps: LightProps) {
    // TODO
    // this.threeLight.distance = distance;
  }

  setType(type: LightTypes, lightProps: LightProps): void {
    this.createLight();
  }

  setDebug(debug: boolean, lightProps: LightProps): void {
    // TODO
  }

  setColor(color: MMLColor, lightProps: LightProps): void {
    // TODO
    // this.threeLight.color.set(color.r, color.g, color.b);
  }

  dispose() {
    const lightEntity = this.light.getContainer() as playcanvas.Entity;
    lightEntity.removeComponent("light");
  }
}
