import { Modal } from "./Modal";

export class ConfirmModal extends Modal {
  private confirmContentsElement: HTMLDivElement;
  private messageElement: HTMLDivElement;
  private buttonsHolder: HTMLDivElement;
  private cancelButton: HTMLButtonElement;
  private okButton: HTMLButtonElement;

  constructor(title: string, message: string, callback: (result: boolean) => void) {
    super();

    this.titleElement.textContent = title;

    this.confirmContentsElement = document.createElement("div");
    this.messageElement = document.createElement("div");
    this.messageElement.textContent = message;
    this.messageElement.style.marginBottom = "8px";
    this.confirmContentsElement.appendChild(this.messageElement);
    this.contentsElement.appendChild(this.confirmContentsElement);

    this.buttonsHolder = document.createElement("div");
    this.buttonsHolder.style.display = "flex";
    this.buttonsHolder.style.justifyContent = "space-between";
    this.buttonsHolder.style.marginTop = "8px";

    this.cancelButton = document.createElement("button");
    this.cancelButton.setAttribute("data-test-id", "confirm-modal-cancel-button");
    this.cancelButton.style.cursor = "pointer";
    this.cancelButton.textContent = "Cancel";
    this.cancelButton.addEventListener("click", () => {
      callback(false);
      this.dispose();
    });
    this.buttonsHolder.appendChild(this.cancelButton);

    this.okButton = document.createElement("button");
    this.okButton.setAttribute("data-test-id", "confirm-modal-ok-button");
    this.okButton.style.cursor = "pointer";
    this.okButton.textContent = "OK";
    this.okButton.addEventListener("click", () => {
      callback(true);
      this.dispose();
    });
    this.buttonsHolder.appendChild(this.okButton);
    this.contentsElement.appendChild(this.buttonsHolder);
  }
}
