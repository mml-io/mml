import { LoadingProgressManager } from "./LoadingProgressManager";

export class LoadingSpinner {
  public readonly element: HTMLDivElement;

  private progressBarHolder: HTMLDivElement;
  private progressBar: HTMLDivElement;

  private hasCompleted = false;
  private disposed = false;
  private loadingCallback: () => void;

  constructor(private loadingProgressManager: LoadingProgressManager) {
    this.element = document.createElement("div");

    this.progressBarHolder = document.createElement("div");
    this.progressBarHolder.style.position = "absolute";
    this.progressBarHolder.style.top = "50%";
    this.progressBarHolder.style.left = "50%";
    this.progressBarHolder.style.transform = "translate(-50%, -50%)";
    this.progressBarHolder.style.width = "60px";
    this.progressBarHolder.style.height = "60px";
    this.element.append(this.progressBarHolder);

    this.progressBar = document.createElement("div");
    this.progressBar.style.position = "absolute";
    this.progressBar.style.top = "0";
    this.progressBar.style.left = "0";
    this.progressBar.style.width = "100%";
    this.progressBar.style.height = "100%";
    this.progressBar.style.border = "6px solid #f3f3f3";
    this.progressBar.style.borderTop = "6px solid rgba(0, 0, 0, 0)";
    this.progressBar.style.borderRadius = "50%";
    this.progressBarHolder.append(this.progressBar);

    this.progressBar.animate([
      { transform: 'rotate(0deg)' },
      { transform: 'rotate(360deg)' }
    ], {
      duration: 1000,
      iterations: Infinity
    });

    this.loadingCallback = () => {
      const [loadingRatio, completedLoading] = this.loadingProgressManager.toRatio();
      if (completedLoading) {
        if (!this.hasCompleted) {
          this.hasCompleted = true;
          this.dispose();
        }
        this.progressBar.style.display = "none";
      } else {
        this.progressBar.style.display = "block";
      }
    };

    this.loadingProgressManager.addProgressCallback(this.loadingCallback);
  }

  public dispose() {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.loadingProgressManager.removeProgressCallback(this.loadingCallback);
    this.element.remove();
  }
}
