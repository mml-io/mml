import { consumeEventEventName } from "../common";
import { RemoteDocument } from "../elements/RemoteDocument";
import { IMMLScene } from "../MMLScene";

export class RemoteDocumentWrapper {
  public readonly element: RemoteDocument;

  constructor(
    address: string,
    targetWindow: Window,
    mScene: IMMLScene,
    handleEvent: (element: HTMLElement, event: CustomEvent) => void,
  ) {
    this.element = targetWindow.document.createElement(RemoteDocument.tagName) as RemoteDocument;
    this.element.addEventListener(consumeEventEventName, (wrappedEvent: CustomEvent) => {
      const { originalEvent, element } = wrappedEvent.detail;
      handleEvent(element, originalEvent);
      wrappedEvent.stopPropagation();
    });
    this.element.init(mScene, address);
  }

  public setDocumentTime(documentTime: number) {
    this.element.setDocumentTime(documentTime);
  }

  public overrideDocumentTime(documentTime: number) {
    this.element.overrideDocumentTime(documentTime);
  }
}
