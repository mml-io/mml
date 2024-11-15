export class StatusElement {
  private element: HTMLDivElement;

  constructor() {
    this.element = document.createElement("div");
    this.element.style.position = "fixed";
    this.element.style.top = "50%";
    this.element.style.left = "50%";
    this.element.style.transform = "translate(-50%, -50%)";
    this.element.style.zIndex = "1000";
    this.element.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
    this.element.style.color = "white";
    this.element.style.padding = "1em";
    this.element.style.fontFamily = "sans-serif";
    this.element.style.fontSize = "1.5em";
    this.element.style.fontWeight = "bold";
    this.element.style.pointerEvents = "none";
    this.element.style.display = "none";
    document.body.append(this.element);
  }

  public setStatus(text: string) {
    this.element.textContent = text;
    this.element.style.display = "block";
  }

  public setNoStatus() {
    this.element.textContent = "";
    this.element.style.display = "none";
  }

  dispose() {
    this.element.remove();
  }
}
