import { PromptModal } from "./PromptModal";
import { PromptProps } from "../MMLScene";

type PromptState = {
  prompt?: PromptModal;
  promptProps: PromptProps;
  resolve: (result: string | null) => void;
};

export class PromptManager {
  private promptHolderElement: HTMLDivElement;

  private container: HTMLElement;

  private promptQueue = new Array<PromptState>();
  private currentPrompt: PromptState | null = null;

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

  private showPrompt(promptState: PromptState) {
    this.currentPrompt = promptState;
    const promptModal = new PromptModal(promptState.promptProps, (result: string | null) => {
      this.currentPrompt = null;
      promptState.resolve(result);
      const nextPrompt = this.promptQueue.shift();
      if (nextPrompt !== undefined) {
        this.showPrompt(nextPrompt);
      }
    });
    this.promptHolderElement.appendChild(promptModal.element);
    promptModal.focus();
  }

  public prompt(promptProps: PromptProps, callback: (message: string | null) => void) {
    const promptState: PromptState = {
      promptProps,
      resolve: callback,
    };
    if (this.currentPrompt !== null) {
      this.promptQueue.push(promptState);
      return;
    }
    this.showPrompt(promptState);
  }
}
