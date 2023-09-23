import { ConfirmModal } from "./ConfirmModal";
import { Modal } from "./Modal";
import { PromptModal } from "./PromptModal";
import { PromptProps } from "../MMLScene";

type PromptState = {
  prompt?: PromptModal;
  promptProps: PromptProps;
  resolve: (result: string | null) => void;
};

type LinkState = {
  href: string;
  windowCallback: (openedWindow: Window | null) => void;
};

export class PromptManager {
  private promptHolderElement: HTMLDivElement;

  private container: HTMLElement;

  private queue = new Array<PromptState | LinkState>();
  private currentPrompt: PromptState | LinkState | null = null;
  private currentModal: Modal | null = null;

  private constructor(container: HTMLElement) {
    this.container = container;

    const holderElement = document.createElement("div");
    holderElement.setAttribute("data-test-id", "prompt-holder");
    holderElement.style.zIndex = "100";
    holderElement.style.position = "absolute";
    holderElement.style.top = "50%";
    holderElement.style.left = "50%";
    holderElement.style.transform = "translate(-50%, -50%)";
    this.promptHolderElement = holderElement;
    container.appendChild(this.promptHolderElement);
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
        "Confirm",
        "Are you sure you want to navigate to: " + promptState.href,
        (result: boolean) => {
          this.currentPrompt = null;
          this.currentModal = null;
          if (result) {
            const openedWindow = window.open(
              promptState.href,
              "_blank",
              // "scrollbars=no," +
              //   "resizable=no," +
              //   "status=no," +
              //   "location=no," +
              "toolbar=no," + "menubar=no," + "width=500," + "height=500,", // +
              // "left=-1000," +
              // "top=-1000",
            );
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
        console.log("Abort current prompt");
        this.currentPrompt = null;
        this.currentModal?.dispose();
        this.showNextPromptIfAny();
      } else {
        // Remove the link from the queue
        console.log("Abort queued prompt");
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
    href: string,
    abortSignal: AbortSignal,
    windowCallback: (openedWindow: Window | null) => void,
  ) {
    abortSignal.addEventListener("abort", () => {
      if (this.currentPrompt === linkState) {
        console.log("Abort current link");
        // The current prompt is the one we are aborting
        this.currentPrompt = null;
        this.currentModal?.dispose();
        this.showNextPromptIfAny();
      } else {
        console.log("Abort queued link");
        // Remove the link from the queue
        this.queue = this.queue.filter((item) => item !== linkState);
      }
    });
    const linkState: LinkState = {
      href,
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
