import * as playcanvas from "playcanvas";

import { Light, LightTypes, MLightProps } from "../elements";
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

    // TODO - light color
    const { r, g, b } = this.light.props.color;

    if (this.light.props.type === "spotlight") {
      this.lightComponent = lightEntity.addComponent("light", {
        type: "spot",
        intensity: this.light.props.intensity * lightIntensityFactor,
        castShadows: this.light.props.castShadow,
        color: new playcanvas.Color(r, g, b),
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
        color: new playcanvas.Color(r, g, b),
        shadowBias: 0.1,
        normalOffsetBias: 0.1,
        range: 100,
      } as playcanvas.LightComponent) as playcanvas.LightComponent;
    }
  }

  disable(): void {}

  enable(): void {}

  setEnabled(enabled: boolean, lightProps: MLightProps): void {
    // TODO
    // this.threeLight.visible = enabled;
  }

  setCastShadow(castShadow: boolean, mLightProps: MLightProps) {
    // TODO
    // this.threeLight.castShadow = castShadow;
  }

  setAngle(angle: number, mLightProps: MLightProps) {
    if (this.lightComponent.type !== "spot") {
      return;
    }
    this.lightComponent.innerConeAngle = angle;
    this.lightComponent.outerConeAngle = angle;
  }

  setIntensity(intensity: number, mLightProps: MLightProps) {
    this.lightComponent.intensity = intensity * lightIntensityFactor;
  }

  setDistance(distance: number, mLightProps: MLightProps) {
    // TODO
  }

  setType(type: LightTypes, lightProps: MLightProps): void {
    this.createLight();
  }

  setDebug(debug: boolean, lightProps: MLightProps): void {
    // TODO
  }

  setColor(color: MMLColor, lightProps: MLightProps): void {
    console.log("color", color);
    this.lightComponent.color.set(color.r, color.g, color.b);
    this.lightComponent.refreshProperties();
  }

  dispose() {
    const lightEntity = this.light.getContainer() as playcanvas.Entity;
    lightEntity.removeComponent("light");
  }
}
