import { Light } from "mml-web";
import { LightGraphics } from "mml-web";
import { MMLColor } from "mml-web";
import * as playcanvas from "playcanvas";

import { PlayCanvasGraphicsAdapter } from "../PlayCanvasGraphicsAdapter";

const lightIntensityFactor = 1 / 400;

export class PlayCanvasLight extends LightGraphics<PlayCanvasGraphicsAdapter> {
  private lightComponent: playcanvas.LightComponent;

  constructor(private light: Light<PlayCanvasGraphicsAdapter>) {
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
        castShadows: this.light.props.castShadows,
        color: new playcanvas.Color(r, g, b),
        shadowBias: 0.1,
        normalOffsetBias: 0.1,
        shape: playcanvas.LIGHTSHAPE_DISK,
        innerConeAngle: this.light.props.angleDeg,
        outerConeAngle: this.light.props.angleDeg,
        range: this.light.props.distance ?? 100,
        enabled: this.light.props.enabled,
      } as playcanvas.LightComponent) as playcanvas.LightComponent;
    } else {
      this.lightComponent = lightEntity.addComponent("light", {
        type: "point",
        intensity: this.light.props.intensity * lightIntensityFactor,
        castShadows: this.light.props.castShadows,
        color: new playcanvas.Color(r, g, b),
        shadowBias: 0.1,
        normalOffsetBias: 0.1,
        range: this.light.props.distance ?? 100,
        enabled: this.light.props.enabled,
      } as playcanvas.LightComponent) as playcanvas.LightComponent;
    }
  }

  disable(): void {}

  enable(): void {}

  setEnabled(enabled: boolean): void {
    this.lightComponent.enabled = enabled;
  }

  setCastShadows(castShadows: boolean) {
    // TODO
    this.lightComponent.castShadows = castShadows;
  }

  setAngle(angle: number) {
    if (this.lightComponent.type !== "spot") {
      return;
    }
    this.lightComponent.innerConeAngle = angle;
    this.lightComponent.outerConeAngle = angle;
  }

  setIntensity(intensity: number) {
    this.lightComponent.intensity = intensity * lightIntensityFactor;
  }

  setDistance(distance: number | null) {
    this.lightComponent.range = distance ?? 100;
  }

  setType(): void {
    this.createLight();
  }

  setDebug(): void {
    // TODO
  }

  setColor(color: MMLColor): void {
    this.lightComponent.color.set(color.r, color.g, color.b);
    this.lightComponent.refreshProperties();
  }

  dispose() {
    const lightEntity = this.light.getContainer() as playcanvas.Entity;
    lightEntity.removeComponent("light");
  }
}
