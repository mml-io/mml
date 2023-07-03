import { registerCustomElementsToWindow } from "./elements/register-custom-elements";
import { FullScreenMScene } from "./FullScreenMScene";
import { setGlobalMScene } from "./global";

export function configureWindowForMML(window: Window) {
  const fullScreenMScene = new FullScreenMScene();
  setGlobalMScene(fullScreenMScene);
  registerCustomElementsToWindow(window);
  window.addEventListener("load", () => {
    document.body.append(fullScreenMScene.element);
  });
}
