import { TransformableElement } from "./TransformableElement";
import { AttributeHandler } from "../utils/attribute-handling";
import { OrientedBoundingBox } from "../utils/OrientedBoundingBox";

enum MessageLinkState {
  IDLE,
  QUEUED,
  OPENED,
}

export class MessageLink extends TransformableElement {
  static tagName = "m-message-link";

  private state:
    | {
        state: MessageLinkState.IDLE;
      }
    | {
        state: MessageLinkState.QUEUED;
        abortController: AbortController;
      }
    | {
        state: MessageLinkState.OPENED;
        openedWindow: Window;
        closeInterval: NodeJS.Timeout;
        unload: () => void;
        messageListener: (event: MessageEvent) => void;
        clearListeners: () => void;
      } = {
    state: MessageLinkState.IDLE,
  };

  private props = {
    href: undefined as string | undefined,
  };

  private static attributeHandler = new AttributeHandler<MessageLink>({
    href: (instance, newValue) => {
      instance.props.href = newValue !== null ? newValue : undefined;
    },
  });

  static get observedAttributes(): Array<string> {
    return [
      ...TransformableElement.observedAttributes,
      ...MessageLink.attributeHandler.getAttributes(),
    ];
  }

  private clearState() {
    switch (this.state.state) {
      case MessageLinkState.IDLE:
        break;
      case MessageLinkState.QUEUED:
        this.state.abortController.abort();
        this.state = { state: MessageLinkState.IDLE };
        break;
      case MessageLinkState.OPENED:
        this.state.clearListeners();
        clearInterval(this.state.closeInterval);
        this.state.unload();
        this.state.openedWindow.close();
        this.state = { state: MessageLinkState.IDLE };
        break;
    }
  }

  constructor() {
    super();

    console.log("Link constructor");
    this.addEventListener("click", () => {
      console.log("Link click");
      if (this.props.href) {
        this.clearState();

        const abortController = new AbortController();
        this.state = {
          state: MessageLinkState.QUEUED,
          abortController,
        };
        this.getScene().link(
          { href: this.props.href, popup: true },
          abortController.signal,
          (openedWindow: Window | null) => {
            console.log("Link windowCallback");

            if (!openedWindow) {
              this.clearState();
            } else {
              this.dispatchEvent(new CustomEvent("opened"));

              const closeInterval = setInterval(() => {
                console.log("openedWindow.closed", openedWindow.closed);
                if (openedWindow.closed) {
                  this.clearState();
                  clearInterval(closeInterval);
                  this.dispatchEvent(new CustomEvent("closed"));
                }
              }, 1000);

              window.addEventListener("focus", () => {
                console.log("Opener window focused");
                if (openedWindow && !openedWindow.closed) {
                  console.log("Opener window focused - focusing opened window");
                  openedWindow.focus();
                  setTimeout(() => {
                    console.log("Opener window focused - focusing opened window - again");
                    openedWindow.focus();
                  }, 100);
                }
              });
              (window as any).openedWindow = openedWindow;

              const unload = () => {
                if (openedWindow && !openedWindow.closed) {
                  openedWindow.close();
                }
              };

              const messageListener = (event: MessageEvent) => {
                if (event.source !== openedWindow) return;
                console.log("Link message", event.data);
                this.dispatchEvent(new CustomEvent("message", { detail: event.data }));
              };

              const clearListeners = () => {
                window.removeEventListener("unload", unload);
                window.removeEventListener("message", messageListener);
              };
              this.state = {
                state: MessageLinkState.OPENED,
                openedWindow,
                closeInterval,
                unload,
                messageListener,
                clearListeners,
              };

              window.addEventListener("unload", unload);

              window.addEventListener("message", messageListener);
            }
          },
        );
      }
    });
  }

  disconnectedCallback() {
    this.clearState();
    super.disconnectedCallback();
  }

  public parentTransformed(): void {
    // no-op
  }

  public isClickable(): boolean {
    return false;
  }

  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    super.attributeChangedCallback(name, oldValue, newValue);
    MessageLink.attributeHandler.handle(this, name, newValue);
  }

  protected disable(): void {
    // no-op
  }

  protected enable(): void {
    // no-op
  }

  protected getContentBounds(): OrientedBoundingBox | null {
    return null;
  }
}
