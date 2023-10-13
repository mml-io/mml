import { consumeEventEventName } from "../common";
import { RemoteDocument } from "../elements/RemoteDocument";
import { IMMLScene } from "../MMLScene";

/**
 * The RemoteDocumentWrapper class creates an m-remote-document (RemoteDocument) element and initialises it with the
 * given address. It is expected that the `remoteDocument` element will be added to the DOM by the caller.
 */
export class RemoteDocumentWrapper {
  public readonly remoteDocument: RemoteDocument;

  constructor(
    address: string,
    targetWindow: Window,
    mmlScene: IMMLScene,
    handleEvent: (element: HTMLElement, event: CustomEvent) => void,
  ) {
    this.remoteDocument = targetWindow.document.createElement(
      RemoteDocument.tagName,
    ) as RemoteDocument;
    this.remoteDocument.addEventListener(consumeEventEventName, (wrappedEvent: CustomEvent) => {
      const { originalEvent, element } = wrappedEvent.detail;
      handleEvent(element, originalEvent);
      wrappedEvent.stopPropagation();
    });
    this.remoteDocument.init(mmlScene, address);
  }

  public setDocumentTime(documentTime: number) {
    this.remoteDocument.getDocumentTimeManager().setDocumentTime(documentTime);
  }

  public overrideDocumentTime(documentTime: number) {
    this.remoteDocument.getDocumentTimeManager().overrideDocumentTime(documentTime);
  }
}
