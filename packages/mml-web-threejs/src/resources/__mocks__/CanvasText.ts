export class CanvasText {
  renderText(): HTMLCanvasElement {
    const canvas = document.createElement("canvas");
    // default to non-zero to avoid zero-size path unless explicitly overridden by tests
    canvas.width = 64;
    canvas.height = 32;
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
    ctx.fillStyle = "rgba(255,255,255,1)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return canvas;
  }
}
