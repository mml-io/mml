import { getIframeTargetWindow } from "./mml/iframeTarget";
import { MMLWebClient } from "./mml/MMLWebClient";

export type CreateMMLGameClientOptions = {
  mode?: "editor" | "game";
};

export async function createMMLGameClient(options?: CreateMMLGameClientOptions): Promise<MMLWebClient> {
  return getIframeTargetWindow().then(async (wrapper) => {
    let remoteHolderElement = wrapper.iframeDocument.getElementById("play-panel-holder");
    if (!remoteHolderElement) {
      remoteHolderElement = wrapper.iframeDocument.createElement("div");
      remoteHolderElement.id = "play-panel-holder";
      wrapper.iframeDocument.body.append(remoteHolderElement);
    }

    const runnerClient = await MMLWebClient.create(wrapper.iframeWindow, remoteHolderElement, true, {
      isEditorMode: options?.mode === "editor",
    });
    return runnerClient;
  });
}
