import { getIframeTargetWindow } from "./mml/iframeTarget";
import { MMLWebClient } from "./mml/MMLWebClient";

export async function createMMLGameClient(): Promise<MMLWebClient> {
  return getIframeTargetWindow().then(async (wrapper) => {
    let remoteHolderElement = wrapper.iframeDocument.getElementById("play-panel-holder");
    if (!remoteHolderElement) {
      remoteHolderElement = wrapper.iframeDocument.createElement("div");
      remoteHolderElement.id = "play-panel-holder";
      wrapper.iframeDocument.body.append(remoteHolderElement);
    }

    const runnerClient = await MMLWebClient.create(wrapper.iframeWindow, remoteHolderElement, true);
    return runnerClient;
  });
}
