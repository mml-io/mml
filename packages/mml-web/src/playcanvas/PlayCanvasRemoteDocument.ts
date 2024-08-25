import { RemoteDocument } from "../elements";
import { RemoteDocumentGraphics } from "../MMLGraphicsInterface";

export class PlayCanvasRemoteDocument extends RemoteDocumentGraphics {
  constructor(private element: RemoteDocument) {
    super(element);

    this.element.getMMLScene().getRootContainer().addChild(this.element.getContainer());
  }

  public dispose() {}
}
