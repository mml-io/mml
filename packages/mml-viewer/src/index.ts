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

    /*
     Add a transparent pixel with a backdrop filter to force the background to
     be white in Chrome (and potentially other browsers). Without this the
     background is grey unless the menu UI is opened.
    */
    const transparentPixel = document.createElement("div");
    transparentPixel.style.width = "1px";
    transparentPixel.style.height = "1px";
    transparentPixel.style.position = "absolute";
    transparentPixel.style.top = "1px";
    transparentPixel.style.left = "1px";
    transparentPixel.style.userSelect = "none";
    transparentPixel.style.pointerEvents = "none";
    transparentPixel.style.backdropFilter = "blur(1px)";
    document.body.append(transparentPixel);

    const standaloneViewer = new StandaloneViewer(windowTarget, targetForWrappers);
    window["mml-viewer"] = standaloneViewer;
  })();
});
