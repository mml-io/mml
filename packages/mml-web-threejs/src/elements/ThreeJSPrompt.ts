import { Prompt } from "@mml-io/mml-web";
import { PromptGraphics } from "@mml-io/mml-web";

import { ThreeJSGraphicsAdapter } from "../ThreeJSGraphicsAdapter";

export class ThreeJSPrompt extends PromptGraphics<ThreeJSGraphicsAdapter> {
  constructor(private prompt: Prompt<ThreeJSGraphicsAdapter>) {
    super(prompt);
  }

  disable(): void {}

  enable(): void {}

  setMessage(): void {
    // no-op
  }

  setPlaceholder(): void {
    // no-op
  }

  setPrefill(): void {
    // no-op
  }

  setDebug(): void {
    // no-op
  }

  dispose() {}
}
