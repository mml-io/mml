import { EditableNetworkedDOM, NetworkedDOM } from "@mml-io/networked-dom-document";
import { NetworkedDOMWebRunnerClient } from "@mml-io/networked-dom-web-runner";
import { GraphicsAdapter, IMMLScene, RemoteDocumentWrapper } from "@mml-io/mml-web";

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
  private connectedState: {
    networkedDOMWebRunnerClient: NetworkedDOMWebRunnerClient;
    remoteDocumentWrapper: RemoteDocumentWrapper<GraphicsAdapter>;
  } | null = null;

  constructor(
    private windowTarget: Window,
    private remoteHolderElement: HTMLElement,
    private mmlScene: IMMLScene<GraphicsAdapter>,
  ) {}

  public dispose() {
    if (!this.connectedState) {
      return;
    }
    this.connectedState.networkedDOMWebRunnerClient.dispose();
    this.connectedState = null;
  }

  public connect(document: NetworkedDOM | EditableNetworkedDOM) {
    let overriddenHandler: ((element: HTMLElement, event: CustomEvent) => void) | null = null;
    const eventHandler = (element: HTMLElement, event: CustomEvent) => {
      if (!overriddenHandler) {
        throw new Error("overriddenHandler not set");
      }
      overriddenHandler(element, event);
    };
    const remoteDocumentWrapper = new RemoteDocumentWrapper(
      window.location.href,
      this.windowTarget,
      this.mmlScene,
      eventHandler,
    );
    this.remoteHolderElement.append(remoteDocumentWrapper.remoteDocument);
    overriddenHandler = (element: HTMLElement, event: CustomEvent) => {
      if (!networkedDOMWebRunnerClient.connectedState) {
        throw new Error("connectedState not set");
      }
      networkedDOMWebRunnerClient.connectedState.domWebsocket.handleEvent(element, event);
    };

    const networkedDOMWebRunnerClient = new NetworkedDOMWebRunnerClient(
      false,
      remoteDocumentWrapper.remoteDocument,
    );
    networkedDOMWebRunnerClient.connect(document, (time: number) => {
      remoteDocumentWrapper.setDocumentTime(time);
    });
    this.connectedState = {
      networkedDOMWebRunnerClient,
      remoteDocumentWrapper,
    };
  }
}
