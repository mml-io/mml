export class Camera {
  private cameraElement: HTMLElement;
  private lerp: HTMLElement;
  constructor(connectionId: number, parent: HTMLElement, tickRate: number) {
    this.cameraElement = document.createElement("m-camera");
    this.cameraElement.setAttribute("visible-to", connectionId.toString());
    this.cameraElement.setAttribute("priority", "100");
    this.cameraElement.setAttribute("x", "0");
    this.cameraElement.setAttribute("y", "6");
    this.cameraElement.setAttribute("z", "5");
    this.cameraElement.setAttribute("ry", "0");
    this.cameraElement.setAttribute("rx", "-55");
    this.cameraElement.setAttribute("rz", "0");

    this.lerp = document.createElement("m-attr-lerp");
    this.lerp.setAttribute("attr", "all");
    this.lerp.setAttribute("duration", (tickRate * 3).toString());
    this.cameraElement.appendChild(this.lerp);

    parent.appendChild(this.cameraElement);
  }

  public setPosition(x: number, y: number, z: number): void {
    this.cameraElement.setAttribute("x", x.toString());
    this.cameraElement.setAttribute("y", (y + 6).toString());
    this.cameraElement.setAttribute("z", (z + 5).toString());
  }

  public dispose(): void {
    if (this.lerp && this.lerp.parentNode) {
      this.lerp.remove();
    }
    if (this.cameraElement && this.cameraElement.parentNode) {
      this.cameraElement.remove();
    }
  }
}
