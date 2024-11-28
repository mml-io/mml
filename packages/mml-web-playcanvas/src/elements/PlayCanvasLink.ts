import { Link } from "@mml-io/mml-web";
import { LinkGraphics } from "@mml-io/mml-web";

import { PlayCanvasGraphicsAdapter } from "../PlayCanvasGraphicsAdapter";

export class PlayCanvasLink extends LinkGraphics<PlayCanvasGraphicsAdapter> {
  constructor(private link: Link<PlayCanvasGraphicsAdapter>) {
    super(link);
  }

  disable(): void {}

  enable(): void {}

  setHref(): void {
    // no-op
  }

  setTarget(): void {
    // no-op
  }

  dispose() {}
}
