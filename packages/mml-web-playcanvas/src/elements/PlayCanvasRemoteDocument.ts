import { RemoteDocument, RemoteDocumentGraphics } from "mml-web";
import * as playcanvas from "playcanvas";

import { PlayCanvasGraphicsAdapter } from "../PlayCanvasGraphicsAdapter";
import { getPlayCanvasReconnectingStatus } from "../PlayCanvasReconnectingStatus";

export class PlayCanvasRemoteDocument extends RemoteDocumentGraphics<PlayCanvasGraphicsAdapter> {
  private statusElement: playcanvas.Entity | null = null;

  constructor(private element: RemoteDocument<PlayCanvasGraphicsAdapter>) {
    super(element);
  }

  public showError(showError: boolean): void {
    if (!showError) {
      if (this.statusElement !== null) {
        this.element.getContainer().removeChild(this.statusElement);
        this.statusElement = null;
      }
    } else {
      if (this.statusElement === null) {
        const playCanvasApp = this.element.getScene().getGraphicsAdapter().getPlayCanvasApp();
        this.statusElement = new playcanvas.Entity("label-internal", playCanvasApp);
        this.statusElement.rotate(90, 0, 0);

        const { material, width, height } = getPlayCanvasReconnectingStatus(playCanvasApp);

        this.statusElement.addComponent("render", {
          type: "plane",
          material,
        }) as playcanvas.RenderComponent;

        this.statusElement.setLocalScale(width, 1, height);

        this.statusElement.setPosition(0, height / 2, 0);
        this.element.getContainer().addChild(this.statusElement);
      }
    }
  }

  public dispose() {}
}
