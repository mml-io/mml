import { Overlay } from "@mml-io/mml-web";
import { OverlayGraphics } from "@mml-io/mml-web";

import { PlayCanvasGraphicsAdapter } from "../PlayCanvasGraphicsAdapter";

export class PlayCanvasOverlay extends OverlayGraphics<PlayCanvasGraphicsAdapter> {
  constructor(private overlay: Overlay<PlayCanvasGraphicsAdapter>) {
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
