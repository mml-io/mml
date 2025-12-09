import { MMLColor } from "../color";
import { MElement } from "../elements/MElement";
import { GraphicsAdapter } from "./GraphicsAdapter";

export abstract class BillboardVisualizerGraphics<G extends GraphicsAdapter = GraphicsAdapter> {
  protected element: MElement<G>;
  protected svgContent: string;
  protected size: number;
  protected color?: MMLColor;

  constructor(element: MElement<G>, svgContent: string, size: number, color?: MMLColor) {
    this.element = element;
    this.svgContent = svgContent;
    this.size = size;
    this.color = color;
  }

  abstract enable(): void;

  abstract disable(): void;

  abstract setSvgContent(svgContent: string): void;

  abstract setSize(size: number): void;

  abstract setColor(color: MMLColor): void;

  abstract dispose(): void;
}
