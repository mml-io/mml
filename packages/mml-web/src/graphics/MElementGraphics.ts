import { MElement } from "../elements";
import { GraphicsAdapter } from "../GraphicsAdapter";

export abstract class MElementGraphics<G extends GraphicsAdapter = GraphicsAdapter> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(element: MElement<G>) {}

  abstract getContainer(): G["containerType"];

  abstract dispose(): void;
}
