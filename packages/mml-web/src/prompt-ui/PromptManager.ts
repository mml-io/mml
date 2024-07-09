import { ConfirmModal } from "./ConfirmModal";
import { Modal } from "./Modal";
import { PromptModal } from "./PromptModal";
import { LinkProps, PromptProps } from "../MMLScene";

type PromptState = {
  prompt?: PromptModal;
  promptProps: PromptProps;
  resolve: (result: string | null) => void;
};

type LinkState = {
  href: string;
  popup: boolean;
  windowCallback: (openedWindow: Window | null) => void;
};

export class PromptManager {
  private promptHolderElement: HTMLDivElement;

  private queue = new Array<PromptState | LinkState>();
  private currentPrompt: PromptState | LinkState | null = null;
  private currentModal: Modal | null = null;

  private constructor(private container: HTMLElement) {
    const holderElement = document.createElement("div");
    holderElement.setAttribute("data-test-id", "prompt-holder");
    holderElement.style.zIndex = "100";
    holderElement.style.position = "absolute";
    holderElement.style.top = "50%";
    holderElement.style.left = "50%";
    holderElement.style.transform = "translate(-50%, -50%)";
    this.promptHolderElement = holderElement;
    this.container.appendChild(this.promptHolderElement);
  }

  static init(container: HTMLElement): PromptManager {
    return new PromptManager(container);
  }

  public dispose() {
    this.promptHolderElement.remove();
  }

  private showPrompt(promptState: PromptState | LinkState) {
    this.currentPrompt = promptState;
    if ("href" in promptState) {
      const confirmModal = new ConfirmModal(
        "Confirm Navigation",
        `Open ${promptState.href}?`,
        (result: boolean) => {
          this.currentPrompt = null;
          this.currentModal = null;
          if (result) {
            let features;
            if (promptState.popup) {
              const popupWidth = 500;
              const popupHeight = 500;

              const screenLeft =
                window.screenLeft !== undefined ? window.screenLeft : window.screenX;
              const screenTop = window.screenTop !== undefined ? window.screenTop : window.screenY;
              const windowWidth = window.innerWidth
                ? window.innerWidth
                : document.documentElement.clientWidth
                  ? document.documentElement.clientWidth
                  : screen.width;
              const windowHeight = window.innerHeight
                ? window.innerHeight
                : document.documentElement.clientHeight
                  ? document.documentElement.clientHeight
                  : screen.height;

              const left = (windowWidth - popupWidth) / 2 + screenLeft;
              const top = (windowHeight - popupHeight) / 2 + screenTop;
              features = `toolbar=no,menubar=no,width=${popupWidth},height=${popupHeight},left=${left},top=${top}`;
            }

            const openedWindow = window.open(promptState.href, "_blank", features);
            promptState.windowCallback(openedWindow);
          }
          this.showNextPromptIfAny();
        },
      );
      this.currentModal = confirmModal;
      this.promptHolderElement.appendChild(confirmModal.element);
    } else {
      const promptModal = new PromptModal(promptState.promptProps, (result: string | null) => {
        this.currentPrompt = null;
        this.currentModal = null;
        promptState.resolve(result);
        this.showNextPromptIfAny();
      });
      this.currentModal = promptModal;
      this.promptHolderElement.appendChild(promptModal.element);
      promptModal.focus();
    }
  }

  public prompt(
    promptProps: PromptProps,
    abortSignal: AbortSignal,
    callback: (message: string | null) => void,
  ) {
    abortSignal.addEventListener("abort", () => {
      if (this.currentPrompt === promptState) {
        // The current prompt is the one we are aborting
        this.currentPrompt = null;
        this.currentModal?.dispose();
        this.showNextPromptIfAny();
      } else {
        // Remove the link from the queue
        this.queue = this.queue.filter((item) => item !== promptState);
      }
    });
    const promptState: PromptState = {
      promptProps,
      resolve: callback,
    };
    if (this.currentPrompt !== null) {
      this.queue.push(promptState);
      return;
    }
    this.showPrompt(promptState);
  }

  public link(
    linkProps: LinkProps,
    abortSignal: AbortSignal,
    windowCallback: (openedWindow: Window | null) => void,
  ) {
    abortSignal.addEventListener("abort", () => {
      if (this.currentPrompt === linkState) {
        // The current prompt is the one we are aborting
        this.currentPrompt = null;
        this.currentModal?.dispose();
        this.showNextPromptIfAny();
      } else {
        // Remove the link from the queue
        this.queue = this.queue.filter((item) => item !== linkState);
      }
    });
    const linkState: LinkState = {
      href: linkProps.href,
      popup: linkProps.popup ?? false,
      windowCallback,
    };
    if (this.currentPrompt !== null) {
      this.queue.push(linkState);
      return;
    }
    this.showPrompt(linkState);
  }

  private showNextPromptIfAny() {
    const nextPrompt = this.queue.shift();
    if (nextPrompt !== undefined) {
      this.showPrompt(nextPrompt);
    }
  }
}
