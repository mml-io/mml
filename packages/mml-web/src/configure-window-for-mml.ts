import { MElement, registerCustomElementsToWindow } from "./elements";
import { setGlobalDocumentTimeManager, setGlobalMMLScene } from "./global";
import { StandaloneGraphicsAdapter } from "./graphics";
import { FullScreenMMLScene } from "./scene";
import { MMLDocumentTimeManager } from "./time";

export function configureWindowForMML(
  window: Window,
  getGraphicsAdapter: (element: HTMLElement) => Promise<StandaloneGraphicsAdapter>,
) {
  const fullScreenMMLScene = new FullScreenMMLScene();
  const mmlDocumentTimeManager = new MMLDocumentTimeManager();
  setGlobalMMLScene(fullScreenMMLScene);
  setGlobalDocumentTimeManager(mmlDocumentTimeManager);
  registerCustomElementsToWindow(window);
  const onload = async () => {
    window.document.body.append(fullScreenMMLScene.element);

    const graphicsAdapter = await getGraphicsAdapter(fullScreenMMLScene.element);

    fullScreenMMLScene.init(graphicsAdapter);

    // Traverse all the elements in the document and add them to the scene
    const traverse = (element: Element | Document) => {
      for (const i in element.children) {
        const child = element.children[i];
        if (child instanceof MElement) {
          child.connectedCallback?.();
        }
        traverse(child);
      }
    };
    traverse(window.document);

    const tick = () => {
      mmlDocumentTimeManager.tick();
      window.requestAnimationFrame(tick);
    };
    tick();
  };

  if (window.document.body) {
    onload();
  } else {
    // Wait for the window to load
    window.addEventListener("load", onload);
  }
}
