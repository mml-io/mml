import { Light } from "@mml-io/mml-web";
import { LightGraphics } from "@mml-io/mml-web";
import { MMLColor } from "@mml-io/mml-web";
import * as playcanvas from "playcanvas";

import { PlayCanvasGraphicsAdapter } from "../PlayCanvasGraphicsAdapter";

const lightIntensityFactor = 1 / 100;
const lightLuminanceFactor = 4000;

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

    const { r, g, b } = this.light.props.color;

    if (this.light.props.type === "spotlight") {
      this.lightComponent = lightEntity.addComponent("light", {
        type: "spot",
        luminance: this.light.props.intensity * lightLuminanceFactor,
        intensity: this.light.props.intensity * lightIntensityFactor,
        castShadows: this.light.props.castShadows,
        color: new playcanvas.Color(r, g, b),
        shadowBias: 0.2,
        normalOffsetBias: 0.05,
        shape: playcanvas.LIGHTSHAPE_DISK,
        innerConeAngle: this.light.props.angleDeg,
        outerConeAngle: this.light.props.angleDeg,
        range: this.light.props.distance ?? 100,
        falloffMode: playcanvas.LIGHTFALLOFF_INVERSESQUARED,
        enabled: this.light.props.enabled,
      } as playcanvas.LightComponent) as playcanvas.LightComponent;
    } else {
      this.lightComponent = lightEntity.addComponent("light", {
        type: "point",
        luminance: this.light.props.intensity * lightLuminanceFactor,
        intensity: this.light.props.intensity * lightIntensityFactor,
        castShadows: this.light.props.castShadows,
        color: new playcanvas.Color(r, g, b),
        shadowBias: 0.2,
        normalOffsetBias: 0.05,
        range: this.light.props.distance ?? 100,
        falloffMode: playcanvas.LIGHTFALLOFF_INVERSESQUARED,
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
    this.lightComponent.castShadows = castShadows;
    this.lightComponent.refreshProperties();
  }

  setAngle(angle: number) {
    if (this.lightComponent.type !== "spot") {
      return;
    }
    this.lightComponent.innerConeAngle = angle;
    this.lightComponent.outerConeAngle = angle;
    this.lightComponent.refreshProperties();
  }

  setIntensity(intensity: number) {
    this.lightComponent.luminance = intensity * lightLuminanceFactor;
    this.lightComponent.intensity = intensity * lightIntensityFactor;
    this.lightComponent.refreshProperties();
  }

  setDistance(distance: number | null) {
    this.lightComponent.range = distance ?? 100;
    this.lightComponent.refreshProperties();
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
