import { ChatProbe, MChatProbeProps } from "../elements";
import { GraphicsAdapter } from "../GraphicsAdapter";

export abstract class ChatProbeGraphics<G extends GraphicsAdapter = GraphicsAdapter> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(element: ChatProbe<G>) {}

  abstract enable(): void;

  abstract disable(): void;

  abstract setRange(range: number, mChatProbeProps: MChatProbeProps): void;

  abstract setDebug(debug: boolean, mChatProbeProps: MChatProbeProps): void;

  abstract dispose(): void;
}
