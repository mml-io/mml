import { registerCustomElementsToWindow } from "./elements/register-custom-elements";
import { FullScreenMMLScene } from "./FullScreenMMLScene";
import { setGlobalDocumentTimeManager, setGlobalMMLScene } from "./global";
import { MMLDocumentTimeManager } from "./MMLDocumentTimeManager";

export function configureWindowForMML(window: Window) {
  const fullScreenMMLScene = new FullScreenMMLScene();
  const mmlDocumentTimeManager = new MMLDocumentTimeManager();
  setGlobalMMLScene(fullScreenMMLScene);
  setGlobalDocumentTimeManager(mmlDocumentTimeManager);
  registerCustomElementsToWindow(window);
  window.addEventListener("load", () => {
    const tick = () => {
      mmlDocumentTimeManager.tick();
      window.requestAnimationFrame(tick);
    };
    tick();
    document.body.append(fullScreenMMLScene.element);
  });
}
