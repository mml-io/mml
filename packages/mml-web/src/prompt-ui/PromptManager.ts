import { ConfirmModal } from "./ConfirmModal";
import { PromptModal } from "./PromptModal";
import { PromptProps } from "../MMLScene";

type PromptState = {
  prompt?: PromptModal;
  promptProps: PromptProps;
  resolve: (result: string | null) => void;
};

type LinkState = {
  href: string;
};

export class PromptManager {
  private promptHolderElement: HTMLDivElement;

  private container: HTMLElement;

  private queue = new Array<PromptState | LinkState>();
  private currentPrompt: PromptState | LinkState | null = null;

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
          if (result) {
            window.open(promptState.href);
          }
          const nextPrompt = this.queue.shift();
          if (nextPrompt !== undefined) {
            this.showPrompt(nextPrompt);
          }
        },
      );
      this.promptHolderElement.appendChild(confirmModal.element);
    } else {
      const promptModal = new PromptModal(promptState.promptProps, (result: string | null) => {
        this.currentPrompt = null;
        promptState.resolve(result);
        const nextPrompt = this.queue.shift();
        if (nextPrompt !== undefined) {
          this.showPrompt(nextPrompt);
        }
      });
      this.promptHolderElement.appendChild(promptModal.element);
      promptModal.focus();
    }
  }

  public prompt(promptProps: PromptProps, callback: (message: string | null) => void) {
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

  public link(href: string) {
    const linkState: LinkState = {
      href,
    };
    if (this.currentPrompt !== null) {
      this.queue.push(linkState);
      return;
    }
    this.showPrompt(linkState);
  }
}
