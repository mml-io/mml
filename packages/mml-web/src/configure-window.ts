import { registerCustomElementsToWindow } from "./elements/register-custom-elements";
import { FullScreenMScene } from "./FullScreenMScene";
import { setGlobalMScene } from "./global";
import { MMLClickTrigger } from "./MMLClickTrigger";

export function configureWindowForMML(window: Window) {
  const fullScreenMScene = new FullScreenMScene();
  setGlobalMScene(fullScreenMScene);
  MMLClickTrigger.init(window.document, window.document, fullScreenMScene);
  registerCustomElementsToWindow(window);
  window.addEventListener("load", () => {
    fullScreenMScene.init();
  });
}
