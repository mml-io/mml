import { RemoteDocument, RemoteDocumentGraphics } from "@mml-io/mml-web";
import * as playcanvas from "playcanvas";

import { PlayCanvasGraphicsAdapter } from "../PlayCanvasGraphicsAdapter";
import { getPlayCanvasReconnectingStatus } from "../PlayCanvasReconnectingStatus";

export class PlayCanvasRemoteDocument extends RemoteDocumentGraphics<PlayCanvasGraphicsAdapter> {
  private statusUI: playcanvas.Entity | null = null;

  constructor(private element: RemoteDocument<PlayCanvasGraphicsAdapter>) {
    super(element);
  }

  public showError(showError: boolean): void {
    if (!showError) {
      if (this.statusUI !== null) {
        this.element.getContainer().removeChild(this.statusUI);
        this.statusUI = null;
      }
    } else {
      if (this.statusUI === null) {
        const playCanvasApp = this.element.getScene().getGraphicsAdapter().getPlayCanvasApp();
        this.statusUI = new playcanvas.Entity("label-internal", playCanvasApp);
        this.statusUI.rotate(90, 0, 0);

        const { material, width, height } = getPlayCanvasReconnectingStatus(playCanvasApp);

        this.statusUI.addComponent("render", {
          type: "plane",
          material,
        }) as playcanvas.RenderComponent;

        this.statusUI.setLocalScale(width, 1, height);

        this.statusUI.setPosition(0, height / 2, 0);
        this.element.getContainer().addChild(this.statusUI);
      }
    }
  }

  public dispose() {}
}
