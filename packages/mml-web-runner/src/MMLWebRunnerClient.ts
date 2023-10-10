import { EditableNetworkedDOM, NetworkedDOM } from "@mml-io/networked-dom-document";
import { NetworkedDOMWebRunnerClient } from "@mml-io/networked-dom-web-runner";
import { IMMLScene, RemoteDocumentWrapper } from "mml-web";

/**
 * The MMLWebRunnerClient class can be used to view and interact with a NetworkedDOM document instance that is available
 * directly in the browser (rather than exposed over the network). This is useful for usage modes where the document
 * does not need to be available to other clients, such as a single-user or an edit/preview mode.
 *
 * The class takes arguments for where the view of the document should be synchronized to in the DOM, and which window
 * instance to use to create any other elements (to allow for using iframes to isolate the document from the rest of
 * the page).
 */
export class MMLWebRunnerClient {
  private windowTarget: Window;
  private mmlScene: IMMLScene;
  private remoteHolderElement: HTMLElement;
  private networkedDOMWebRunnerClient: NetworkedDOMWebRunnerClient;
  private remoteDocumentWrapper: RemoteDocumentWrapper;

  constructor(windowTarget: Window, remoteHolderElement: HTMLElement, mmlScene: IMMLScene) {
    this.windowTarget = windowTarget;
    this.remoteHolderElement = remoteHolderElement;
    this.mmlScene = mmlScene;

    let overriddenHandler: ((element: HTMLElement, event: CustomEvent) => void) | null = null;
    const eventHandler = (element: HTMLElement, event: CustomEvent) => {
      if (!overriddenHandler) {
        throw new Error("overriddenHandler not set");
      }
      overriddenHandler(element, event);
    };
    this.remoteDocumentWrapper = new RemoteDocumentWrapper(
      window.location.href,
      this.windowTarget,
      this.mmlScene,
      eventHandler,
    );
    this.remoteHolderElement.append(this.remoteDocumentWrapper.remoteDocument);
    overriddenHandler = (element: HTMLElement, event: CustomEvent) => {
      if (!this.networkedDOMWebRunnerClient.connectedState) {
        throw new Error("connectedState not set");
      }
      this.networkedDOMWebRunnerClient.connectedState.domWebsocket.handleEvent(element, event);
    };

    this.networkedDOMWebRunnerClient = new NetworkedDOMWebRunnerClient(
      false,
      this.remoteDocumentWrapper.remoteDocument,
    );
  }

  public dispose() {
    this.networkedDOMWebRunnerClient.dispose();
  }

  public connect(document: NetworkedDOM | EditableNetworkedDOM) {
    this.networkedDOMWebRunnerClient.connect(document, (time: number) => {
      this.remoteDocumentWrapper.setDocumentTime(time);
    });
  }
}
