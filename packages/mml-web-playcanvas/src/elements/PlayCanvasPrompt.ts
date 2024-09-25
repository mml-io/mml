import { Prompt } from "mml-web";
import { PromptGraphics } from "mml-web";

import { PlayCanvasGraphicsAdapter } from "../PlayCanvasGraphicsAdapter";

export class PlayCanvasPrompt extends PromptGraphics<PlayCanvasGraphicsAdapter> {
  constructor(private prompt: Prompt<PlayCanvasGraphicsAdapter>) {
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
