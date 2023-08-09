import { registerCustomElementsToWindow } from "./elements/register-custom-elements";
import { FullScreenMScene } from "./FullScreenMScene";
import { setGlobalMScene } from "./global";
import { MMLDocumentRoot } from "./MMLDocumentRoot";

export function configureWindowForMML(window: Window) {
  const fullScreenMScene = new FullScreenMScene();
  setGlobalMScene(fullScreenMScene);
  registerCustomElementsToWindow(window);
  window.addEventListener("load", () => {
    const mmlDocument = new MMLDocumentRoot(document.body);
    const tick = () => {
      mmlDocument.tick();
      window.requestAnimationFrame(tick);
    };
    tick();
    document.body.append(fullScreenMScene.element);
  });
}
