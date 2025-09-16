import { MOverlayProps, Overlay } from "../elements";
import { GraphicsAdapter } from "./GraphicsAdapter";

export abstract class OverlayGraphics<G extends GraphicsAdapter = GraphicsAdapter> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(element: Overlay<G>) {}

  abstract enable(): void;

  abstract disable(): void;

  abstract setAnchor(anchor: string | null, props: MOverlayProps): void;

  abstract setOffsetX(target: number | null, props: MOverlayProps): void;

  abstract setOffsetY(target: number | null, props: MOverlayProps): void;

  abstract dispose(): void;
}
