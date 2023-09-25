import { TransformableElement } from "./TransformableElement";
import { AttributeHandler } from "../utils/attribute-handling";

export class MessageLink extends TransformableElement {
  static tagName = "m-message-link";

  private abortController: AbortController | null = null;

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

  constructor() {
    super();

    console.log("Link constructor");
    this.addEventListener("click", () => {
      console.log("Link click");
      if (this.props.href) {
        if (this.abortController) {
          this.abortController.abort();
          this.abortController = null;
        }
        this.abortController = new AbortController();
        this.getScene().link(
          this.props.href,
          this.abortController.signal,
          (openedWindow: Window | null) => {
            console.log("Link windowCallback");
            this.abortController = null;
            if (openedWindow) {
              this.dispatchEvent(new CustomEvent("opened"));
              // TODO - handle messages listening / unlistening
              openedWindow.postMessage("Hello, opened window!", "*");

              const closeInterval = setInterval(() => {
                console.log("openedWindow.closed", openedWindow.closed);
                if (openedWindow.closed) {
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
                  },100);
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

              window.addEventListener("unload", unload);

              window.addEventListener("message", messageListener);
            }
          },
        );
      }
    });
  }

  disconnectedCallback() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
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
}
