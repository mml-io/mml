import { EditableNetworkedDOM, NetworkedDOM } from "@mml-io/networked-dom-document";
import { NetworkedDOMWebRunnerClient } from "@mml-io/networked-dom-web-runner";
import { MMLScene, RemoteDocumentWrapper } from "mml-web";

export class MMLWebRunnerClient extends NetworkedDOMWebRunnerClient {
  private windowTarget: Window;
  private mScene: MMLScene;
  private remoteHolderElement: HTMLElement;

  constructor(windowTarget: Window, remoteHolderElement: HTMLElement) {
    super(false);
    this.windowTarget = windowTarget;
    this.mScene = new MMLScene();
    this.remoteHolderElement = remoteHolderElement;
  }

  public dispose() {
    super.dispose();
    this.mScene.dispose();
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
      this.mScene,
      eventHandler,
    );
    this.remoteHolderElement.append(remoteDocumentWrapper.element);
    this.remoteDocumentHolder = remoteDocumentWrapper.element;
    this.element.append(this.mScene.element);
    overriddenHandler = (element: HTMLElement, event: CustomEvent) => {
      if (!this.connectedState) {
        throw new Error("connectedState not set");
      }
      this.connectedState.domWebsocket.handleEvent(element, event);
    };

    super.connect(document, (time: number) => {
      remoteDocumentWrapper.setDocumentTime(time);
    });
    this.mScene.fitContainer();
  }

  public fitContainer() {
    this.mScene.fitContainer();
  }
}
