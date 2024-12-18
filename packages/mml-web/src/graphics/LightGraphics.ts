import { MMLColor } from "../color";
import { Light, LightTypes, MLightProps } from "../elements";
import { GraphicsAdapter } from "./GraphicsAdapter";

export abstract class LightGraphics<G extends GraphicsAdapter = GraphicsAdapter> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(element: Light<G>) {}

  abstract enable(): void;

  abstract disable(): void;

  abstract setEnabled(enabled: boolean, mLightProps: MLightProps): void;

  abstract setDebug(debug: boolean, mLightProps: MLightProps): void;

  abstract setCastShadows(castShadows: boolean, mLightProps: MLightProps): void;

  abstract setAngle(angle: number, mLightProps: MLightProps): void;

  abstract setIntensity(intensity: number, mLightProps: MLightProps): void;

  abstract setDistance(distance: number, mLightProps: MLightProps): void;

  abstract setType(type: LightTypes, mLightProps: MLightProps): void;

  abstract setColor(color: MMLColor, mLightProps: MLightProps): void;

  abstract dispose(): void;
}
