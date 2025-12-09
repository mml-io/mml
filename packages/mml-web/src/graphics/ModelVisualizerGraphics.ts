import { MElement } from "../elements/MElement";
import { GraphicsAdapter } from "./GraphicsAdapter";
import { VisualizerOptions } from "./Visualizer";

/**
 * Generic model-based visualizer contract (e.g. for camera icons).
 */
export abstract class ModelVisualizerGraphics<G extends GraphicsAdapter = GraphicsAdapter> {
  protected element: MElement<G>;
  protected url: string;
  protected scale: number;
  protected clickable: boolean;

  constructor(element: MElement<G>, url: string, scale: number, options?: VisualizerOptions) {
    this.element = element;
    this.url = url;
    this.scale = scale;
    this.clickable = options?.clickable ?? true;
  }

  abstract setVisible(visible: boolean): void;

  abstract setScale(scale: number): void;

  abstract setUrl(url: string): void;

  abstract dispose(): void;

  public isClickable(): boolean {
    return this.clickable;
  }
}


