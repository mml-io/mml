import { RemoteDocument } from "../elements";
import { RemoteDocumentGraphics } from "../MMLGraphicsInterface";

export class ThreeJSRemoteDocument extends RemoteDocumentGraphics {
  constructor(private element: RemoteDocument) {
    super(element);

    this.element.getMMLScene().getRootContainer().add(this.element.getContainer());
  }

  public dispose() {}
}
