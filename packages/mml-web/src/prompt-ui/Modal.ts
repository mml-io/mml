export class Modal {
  public element: HTMLDivElement;
  public titleElement: HTMLDivElement;
  public contentsElement: HTMLDivElement;

  constructor() {
    this.element = document.createElement("div");
    this.element.style.display = "block";
    this.element.style.border = "1px solid #AAA";
    this.element.style.fontFamily = "sans-serif";
    this.element.style.color = "black";

    this.element.style.boxShadow = "0px 4px 4px rgba(0, 0, 0, 0.1)";
    this.element.style.backdropFilter = "blur(4px)";
    this.element.style.borderRadius = "4px";

    this.titleElement = document.createElement("div");
    this.titleElement.style.background = "rgba(255, 255, 255, 0.8)";
    this.titleElement.style.padding = "8px";
    this.titleElement.style.fontWeight = "bold";
    this.titleElement.style.borderBottom = "1px solid #AAA";

    this.contentsElement = document.createElement("div");
    this.contentsElement.style.background = "rgba(255, 255, 255, 0.6)";
    this.contentsElement.style.padding = "8px";
    this.element.append(this.titleElement, this.contentsElement);
  }

  dispose() {
    this.element.remove();
  }
}
