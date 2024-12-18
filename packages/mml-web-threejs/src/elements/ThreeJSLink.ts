import { Link } from "@mml-io/mml-web";
import { LinkGraphics } from "@mml-io/mml-web";

import { ThreeJSGraphicsAdapter } from "../ThreeJSGraphicsAdapter";

export class ThreeJSLink extends LinkGraphics<ThreeJSGraphicsAdapter> {
  constructor(private link: Link<ThreeJSGraphicsAdapter>) {
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
