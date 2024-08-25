import { registerCustomElementsToWindow } from "./elements/register-custom-elements";
import { FullScreenMMLScene } from "./FullScreenMMLScene";
import { setGlobalDocumentTimeManager, setGlobalMMLScene } from "./global";
import { MMLDocumentTimeManager } from "./MMLDocumentTimeManager";
import { MMLSceneOptions } from "./MMLScene";
import { StandalonePlayCanvasAdapter } from "./playcanvas/StandalonePlayCanvasAdapter";

export function configureWindowForMML(window: Window) {
  const fullScreenMMLScene = new FullScreenMMLScene({
    createGraphicsAdapter: async (element: HTMLElement, options: MMLSceneOptions) => {
      return await StandalonePlayCanvasAdapter.create(element, {
        controlsType: options.controlsType,
      });
    },
  });
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
