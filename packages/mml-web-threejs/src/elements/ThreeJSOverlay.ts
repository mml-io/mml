import { Overlay, OverlayGraphics } from "@mml-io/mml-web";

import { ThreeJSGraphicsAdapter } from "../ThreeJSGraphicsAdapter";

export class ThreeJSOverlay extends OverlayGraphics<ThreeJSGraphicsAdapter> {
  constructor(private overlay: Overlay<ThreeJSGraphicsAdapter>) {
    super(overlay);
  }

  disable(): void {}

  enable(): void {}

  setAnchor(): void {
    // no-op
  }

  setOffsetX(): void {
    // no-op
  }

  setOffsetY(): void {
    // no-op
  }

  dispose() {}
}
