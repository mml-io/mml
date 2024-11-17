import { MMLColor } from "../color";
import { Label, MLabelAlignment, MLabelProps } from "../elements";
import { GraphicsAdapter } from "./GraphicsAdapter";

export abstract class LabelGraphics<G extends GraphicsAdapter = GraphicsAdapter> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(element: Label<G>) {}

  abstract enable(): void;

  abstract disable(): void;

  abstract getCollisionElement(): G["collisionType"];

  abstract setContent(content: string, mLabelProps: MLabelProps): void;

  abstract setAlignment(alignment: MLabelAlignment, mLabelProps: MLabelProps): void;

  abstract setWidth(width: number, mLabelProps: MLabelProps): void;

  abstract setHeight(height: number, mLabelProps: MLabelProps): void;

  abstract setFontSize(fontSize: number, mLabelProps: MLabelProps): void;

  abstract setPadding(padding: number, mLabelProps: MLabelProps): void;

  abstract setColor(color: MMLColor, mLabelProps: MLabelProps): void;

  abstract setFontColor(fontColor: MMLColor, mLabelProps: MLabelProps): void;

  abstract setCastShadows(castShadows: boolean, mLabelProps: MLabelProps): void;

  abstract setEmissive(emissive: number, mLabelProps: MLabelProps): void;

  abstract dispose(): void;
}
