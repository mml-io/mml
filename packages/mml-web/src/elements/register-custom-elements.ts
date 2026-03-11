import { MElement } from "./MElement";
import { MML_ELEMENTS } from "./mml-element-list";

export function registerCustomElementsToWindow(targetWindow: Window) {
  // TODO - copy the classes to generate window-specific classes rather than overwriting the superclass on each call
  const targetHTMLElement = (targetWindow as unknown as { HTMLElement: typeof HTMLElement })[
    "HTMLElement"
  ];
  MElement.overwriteSuperclass(targetHTMLElement, targetWindow as Window & typeof globalThis);
  // After overwriteSuperclass, MML element classes extend HTMLElement at runtime
  for (const Element of MML_ELEMENTS) {
    targetWindow.customElements.define(
      Element.tagName,
      Element as unknown as CustomElementConstructor,
    );
  }
}
