import { RemoteDocument } from "../elements";
import { GraphicsAdapter } from "./GraphicsAdapter";

export abstract class RemoteDocumentGraphics<G extends GraphicsAdapter = GraphicsAdapter> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(element: RemoteDocument<G>) {}

  abstract showError(showError: boolean): void;

  abstract dispose(): void;
}
