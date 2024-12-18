import { consumeEventEventName } from "../elements";
import { RemoteDocument } from "../elements";
import { GraphicsAdapter } from "../graphics";
import { IMMLScene } from "../scene";

/**
 * The RemoteDocumentWrapper class creates an m-remote-document (RemoteDocument) element and initialises it with the
 * given address. It is expected that the `remoteDocument` element will be added to the DOM by the caller.
 */
export class RemoteDocumentWrapper<G extends GraphicsAdapter = GraphicsAdapter> {
  public readonly remoteDocument: RemoteDocument<G>;

  constructor(
    address: string,
    targetWindow: Window,
    mmlScene: IMMLScene<G>,
    handleEvent: (element: HTMLElement, event: CustomEvent) => void,
  ) {
    this.remoteDocument = targetWindow.document.createElement(
      RemoteDocument.tagName,
    ) as RemoteDocument<G>;
    this.remoteDocument.addEventListener(consumeEventEventName, (wrappedEvent: CustomEvent) => {
      const { originalEvent, element } = wrappedEvent.detail;
      handleEvent(element, originalEvent);
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
