import { IframeWrapper, registerCustomElementsToWindow } from "mml-web";

import { StandaloneViewer } from "./StandaloneViewer";

declare global {
  interface Window {
    "mml-viewer": StandaloneViewer;
  }
}

window.addEventListener("load", () => {
  (async () => {
    const { iframeWindow, iframeBody } = await IframeWrapper.create();
    const windowTarget = iframeWindow;
    const targetForWrappers = iframeBody;
    registerCustomElementsToWindow(windowTarget);
    const standaloneViewer = new StandaloneViewer(windowTarget, targetForWrappers);
    window["mml-viewer"] = standaloneViewer;
  })();
});
