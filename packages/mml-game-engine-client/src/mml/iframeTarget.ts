import {
  IframeWrapper,
  IframeWrapperResult,
  registerCustomElementsToWindow,
} from "@mml-io/mml-web";

import { MCamera } from "./elements/Camera";
import { MCharacterController } from "./elements/CharacterController";
import { MControl } from "./elements/Control";
import { MEnvironmentLight } from "./elements/EnvironmentLight";
import { MEnvironmentMap } from "./elements/EnvironmentMap";
import { MFog } from "./elements/Fog";
import { MSun } from "./elements/Sun";

let iframeRemoteSceneWrapperPromise: Promise<IframeWrapperResult>;

export function getIframeTargetWindow(): Promise<IframeWrapperResult> {
  if (iframeRemoteSceneWrapperPromise !== undefined) {
    return iframeRemoteSceneWrapperPromise;
  }
  iframeRemoteSceneWrapperPromise = IframeWrapper.create().then((wrapper) => {
    wrapper.iframeWindow.customElements.define(MCamera.tagName, MCamera);
    wrapper.iframeWindow.customElements.define(MCharacterController.tagName, MCharacterController);
    wrapper.iframeWindow.customElements.define(MControl.tagName, MControl);
    wrapper.iframeWindow.customElements.define(MEnvironmentMap.tagName, MEnvironmentMap);
    wrapper.iframeWindow.customElements.define(MEnvironmentLight.tagName, MEnvironmentLight);
    wrapper.iframeWindow.customElements.define(MFog.tagName, MFog);
    wrapper.iframeWindow.customElements.define(MSun.tagName, MSun);

    // register upstream elements
    registerCustomElementsToWindow(wrapper.iframeWindow);

    console.log("All MML elements registered successfully");

    return wrapper;
  });
  return iframeRemoteSceneWrapperPromise;
}
