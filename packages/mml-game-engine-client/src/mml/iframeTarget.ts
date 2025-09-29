import {
  IframeWrapper,
  IframeWrapperResult,
  registerCustomElementsToWindow,
} from "@mml-io/mml-web";

import { MCamera } from "./elements/Camera";
import { MCharacterController } from "./elements/CharacterController";
import { MControl } from "./elements/Control";

let iframeRemoteSceneWrapperPromise: Promise<IframeWrapperResult>;

export function getIframeTargetWindow(): Promise<IframeWrapperResult> {
  if (iframeRemoteSceneWrapperPromise !== undefined) {
    return iframeRemoteSceneWrapperPromise;
  }
  iframeRemoteSceneWrapperPromise = IframeWrapper.create().then((wrapper) => {
    wrapper.iframeWindow.customElements.define(MCamera.tagName, MCamera);
    wrapper.iframeWindow.customElements.define(MCharacterController.tagName, MCharacterController);
    wrapper.iframeWindow.customElements.define(MControl.tagName, MControl);

    // register upstream elements
    registerCustomElementsToWindow(wrapper.iframeWindow);

    console.log("All MML elements registered successfully");
    console.log("Available elements:");
    console.log("- m-camera (local)");
    console.log("- m-character-controller (local)");
    console.log("- m-control (local)");

    return wrapper;
  });
  return iframeRemoteSceneWrapperPromise;
}
