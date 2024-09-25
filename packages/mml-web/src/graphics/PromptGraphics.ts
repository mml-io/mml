import { MPromptProps, Prompt } from "../elements";
import { GraphicsAdapter } from "../GraphicsAdapter";

export abstract class PromptGraphics<G extends GraphicsAdapter = GraphicsAdapter> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(element: Prompt<G>) {}

  abstract enable(): void;

  abstract disable(): void;

  abstract setMessage(message: string | undefined, mPromptProps: MPromptProps): void;

  abstract setPlaceholder(placeholder: string | undefined, mPromptProps: MPromptProps): void;

  abstract setPrefill(prefill: string | undefined, mPromptProps: MPromptProps): void;

  abstract setDebug(debug: boolean, mPromptProps: MPromptProps): void;

  abstract dispose(): void;
}
