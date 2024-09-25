import { Interaction, MInteractionProps } from "../elements";
import { GraphicsAdapter } from "../GraphicsAdapter";

export abstract class InteractionGraphics<G extends GraphicsAdapter = GraphicsAdapter> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(element: Interaction<G>) {}

  abstract enable(): void;

  abstract disable(): void;

  abstract setRange(range: number, mInteractionProps: MInteractionProps): void;

  abstract setInFocus(inFocus: boolean, mInteractionProps: MInteractionProps): void;

  abstract setLineOfSight(lineOfSight: boolean, mInteractionProps: MInteractionProps): void;

  abstract setPriority(priority: number, mInteractionProps: MInteractionProps): void;

  abstract setPrompt(prompt: string | null, mInteractionProps: MInteractionProps): void;

  abstract setDebug(debug: boolean, mInteractionProps: MInteractionProps): void;

  abstract dispose(): void;
}
