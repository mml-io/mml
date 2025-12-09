import { MElement } from "../elements/MElement";
import { GraphicsAdapter } from "./GraphicsAdapter";

/**
 * Generic model-based visualizer contract (e.g. for camera icons).
 */
export abstract class ModelVisualizerGraphics<G extends GraphicsAdapter = GraphicsAdapter> {
  protected element: MElement<G>;
  protected url: string;
  protected scale: number;

  constructor(element: MElement<G>, url: string, scale: number) {
    this.element = element;
    this.url = url;
    this.scale = scale;
  }

  abstract setVisible(visible: boolean): void;

  abstract setScale(scale: number): void;

  abstract setUrl(url: string): void;

  abstract dispose(): void;
}


