import { IDocumentFactory, IElementLike } from "@mml-io/networked-dom-web";

import { consumeEventEventName } from "../elements";
import { RemoteDocument } from "../elements";
import { GraphicsAdapter } from "../graphics";
import { IMMLScene } from "../scene";
import { VirtualCustomEvent } from "../virtual-dom";

/**
 * A Window, a VirtualDocument, or any object that can create elements.
 * Used to construct RemoteDocument elements in the appropriate document context.
 */
export type DocumentSource = Window | IDocumentFactory | null;

/**
 * Extracts an IDocumentFactory from a DocumentSource.
 * - Window → window.document
 * - IDocumentFactory (e.g. VirtualDocument) → used directly
 * - null → returns null
 */
function resolveDocumentFactory(source: DocumentSource): IDocumentFactory | null {
  if (!source) return null;
  if ("document" in source && typeof (source as Window).document?.createElement === "function") {
    return (source as Window).document;
  }
  if (typeof (source as IDocumentFactory).createElement === "function") {
    return source as IDocumentFactory;
  }
  return null;
}

/**
 * The RemoteDocumentWrapper class creates an m-remote-document (RemoteDocument) element and initialises it with the
 * given address. It is expected that the `remoteDocument` element will be added to the DOM by the caller.
 */
export class RemoteDocumentWrapper<G extends GraphicsAdapter = GraphicsAdapter> {
  public readonly remoteDocument: RemoteDocument<G>;

  constructor(
    address: string,
    documentSource: DocumentSource,
    mmlScene: IMMLScene<G>,
    handleEvent: (element: IElementLike, event: Event | CustomEvent) => void,
  ) {
    const factory = resolveDocumentFactory(documentSource);
    if (factory) {
      // createElement returns IElementLike but our VirtualDocument registry returns the
      // registered subclass. The cast is safe because registerCustomElementsToVirtualDocument
      // ensures RemoteDocument.tagName maps to the RemoteDocument constructor.
      this.remoteDocument = factory.createElement(RemoteDocument.tagName) as RemoteDocument<G>;
    } else {
      // Fallback: direct construction (no registered custom elements)
      this.remoteDocument = new RemoteDocument<G>();
    }
    this.remoteDocument.addEventListener(
      consumeEventEventName,
      (wrappedEvent: CustomEvent | VirtualCustomEvent) => {
        const { originalEvent, element } = wrappedEvent.detail;
        handleEvent(element, originalEvent);
      },
    );
    this.remoteDocument.init(mmlScene, address);
  }

  public setDocumentTime(documentTime: number) {
    this.remoteDocument.getDocumentTimeManager().setDocumentTime(documentTime);
  }

  public overrideDocumentTime(documentTime: number) {
    this.remoteDocument.getDocumentTimeManager().overrideDocumentTime(documentTime);
  }
}
