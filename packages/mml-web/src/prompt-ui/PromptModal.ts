import { Modal } from "./Modal";
import { PromptProps } from "../MMLScene";
import { EventHandlerCollection } from "../utils/events/EventHandlerCollection";

export class PromptModal extends Modal {
  private promptContentsElement: HTMLDivElement;
  private promptMessageElement: HTMLDivElement;
  private promptInputElement: HTMLInputElement;
  private buttonsHolder: HTMLDivElement;
  private cancelButton: HTMLButtonElement;
  private okButton: HTMLButtonElement;
  private callback: (result: string | null) => void;
  private eventHandlerCollection = new EventHandlerCollection();

  constructor(promptProps: PromptProps, callback: (result: string | null) => void) {
    super();

    this.callback = callback;

    this.titleElement.textContent = "Prompt";

    this.promptContentsElement = document.createElement("div");
    this.promptMessageElement = document.createElement("div");
    this.promptMessageElement.textContent = promptProps.message || "Enter a value";
    this.promptMessageElement.style.marginBottom = "8px";
    this.promptContentsElement.appendChild(this.promptMessageElement);

    this.promptInputElement = document.createElement("input");
    this.promptInputElement.type = "text";
    this.promptInputElement.style.width = "80vw";
    this.promptInputElement.style.maxWidth = "300px";
    this.promptInputElement.setAttribute("data-test-id", "prompt-input");
    this.promptInputElement.setAttribute("placeholder", promptProps.placeholder || "");
    this.promptInputElement.setAttribute("value", promptProps.prefill || "");
    this.promptInputElement.addEventListener("change", () => {
      this.checkValue();
    });
    this.promptInputElement.addEventListener("keyup", (event) => {
      if (event.key === "Enter") {
        if (this.promptInputElement.value.length > 0) {
          this.dispose();
          this.callback(this.promptInputElement.value);
        }
      }
      this.checkValue();
    });
    this.eventHandlerCollection.add(document, "keydown", (e: KeyboardEvent) => {
      if (e.code === "Escape") {
        this.dispose();
        this.callback(null);
      }
      this.checkValue();
    });
    this.promptContentsElement.appendChild(this.promptInputElement);
    this.contentsElement.appendChild(this.promptContentsElement);

    this.buttonsHolder = document.createElement("div");
    this.buttonsHolder.style.display = "flex";
    this.buttonsHolder.style.justifyContent = "space-between";
    this.buttonsHolder.style.marginTop = "8px";

    this.cancelButton = document.createElement("button");
    this.cancelButton.setAttribute("data-test-id", "prompt-cancel-button");
    this.cancelButton.style.cursor = "pointer";
    this.cancelButton.textContent = "Cancel";
    this.cancelButton.addEventListener("click", () => {
      this.dispose();
      this.callback(null);
    });
    this.buttonsHolder.appendChild(this.cancelButton);

    this.okButton = document.createElement("button");
    this.okButton.setAttribute("data-test-id", "prompt-ok-button");
    this.okButton.style.cursor = "pointer";
    this.okButton.textContent = "OK";
    this.okButton.addEventListener("click", () => {
      this.dispose();
      this.callback(this.promptInputElement.value);
    });
    this.buttonsHolder.appendChild(this.okButton);
    this.contentsElement.appendChild(this.buttonsHolder);
  }

  public focus() {
    this.promptInputElement.focus();
    this.promptInputElement.setSelectionRange(
      this.promptInputElement.value.length,
      this.promptInputElement.value.length,
    );
    this.checkValue();
  }

  dispose() {
    this.eventHandlerCollection.clear();
    super.dispose();
  }

  private checkValue() {
    if (this.promptInputElement.value.length > 0) {
      this.okButton.disabled = false;
    } else {
      this.okButton.disabled = true;
    }
  }
}
