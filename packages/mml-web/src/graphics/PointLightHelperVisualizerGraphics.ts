import { MMLColor } from "../color";
import { MElement } from "../elements/MElement";
import { GraphicsAdapter } from "./GraphicsAdapter";
import { VisualizerOptions } from "./Visualizer";

export abstract class PointLightHelperVisualizerGraphics<G extends GraphicsAdapter = GraphicsAdapter> {
  protected element: MElement<G>;
  protected clickable: boolean;

  constructor(
    element: MElement<G>,
    _distance: number | null,
    _color: MMLColor,
    options?: VisualizerOptions,
  ) {
    this.element = element;
    this.clickable = options?.clickable ?? false;
  }

  abstract setVisible(visible: boolean): void;

  abstract setDistance(distance: number | null): void;

  abstract setColor(color: MMLColor): void;

  abstract dispose(): void;

  public isClickable(): boolean {
    return this.clickable;
  }
}

