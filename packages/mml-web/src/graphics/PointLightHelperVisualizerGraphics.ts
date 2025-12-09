import { MMLColor } from "../color";
import { MElement } from "../elements/MElement";
import { GraphicsAdapter } from "./GraphicsAdapter";

export abstract class PointLightHelperVisualizerGraphics<G extends GraphicsAdapter = GraphicsAdapter> {
  protected element: MElement<G>;

  constructor(element: MElement<G>, _distance: number | null, _color: MMLColor) {
    this.element = element;
  }

  abstract setVisible(visible: boolean): void;

  abstract setDistance(distance: number | null): void;

  abstract setColor(color: MMLColor): void;

  abstract dispose(): void;
}

