import { LoadingProgressManager } from "./LoadingProgressManager";

export class LoadingProgressBar {
  public readonly element: HTMLDivElement;

  private progressBarHolder: HTMLDivElement;
  private progressBar: HTMLDivElement;
  private loadingStatusText: HTMLDivElement;

  private progressDebugView: HTMLDivElement;
  private progressDebugElement: HTMLPreElement;

  private debugLabel: HTMLLabelElement;
  private debugCheckbox: HTMLInputElement;

  private hasCompleted = false;
  private disposed = false;
  private loadingCallback: () => void;

  constructor(
    private loadingProgressManager: LoadingProgressManager,
    private showDebugLoading: boolean,
  ) {
    this.element = document.createElement("div");
    this.element.addEventListener("click", (event) => {
      event.stopPropagation();
    });
    this.element.addEventListener("mousedown", (event) => {
      event.stopPropagation();
    });
    this.element.addEventListener("mousemove", (event) => {
      event.stopPropagation();
    });
    this.element.addEventListener("mouseup", (event) => {
      event.stopPropagation();
    });

    this.progressDebugView = document.createElement("div");
    this.progressDebugView.style.position = "absolute";
    this.progressDebugView.style.backgroundColor = "rgba(128, 128, 128, 0.25)";
    this.progressDebugView.style.top = "20px";
    this.progressDebugView.style.left = "0";
    this.progressDebugView.style.border = "1px solid black";
    this.progressDebugView.style.maxHeight = "calc(100% - 20px)";
    this.progressDebugView.style.maxWidth = "100%";
    this.progressDebugView.style.overflow = "auto";
    this.element.append(this.progressDebugView);

    this.debugCheckbox = document.createElement("input");
    this.debugCheckbox.type = "checkbox";
    this.debugCheckbox.addEventListener("change", () => {
      this.progressDebugElement.style.display = this.debugCheckbox.checked ? "block" : "none";
      if (this.hasCompleted) {
        this.dispose();
      }
    });

    this.debugLabel = document.createElement("label");
    this.debugLabel.textContent = "Debug loading";
    this.debugLabel.style.fontFamily = "sans-serif";
    this.debugLabel.style.padding = "5px";
    this.debugLabel.style.display = "inline-block";
    this.debugLabel.style.userSelect = "none";
    this.debugLabel.append(this.debugCheckbox);
    if (this.showDebugLoading) {
      this.progressDebugView.append(this.debugLabel);
    }

    this.progressDebugElement = document.createElement("pre");
    this.progressDebugElement.style.margin = "0";
    this.progressDebugElement.style.display = this.debugCheckbox.checked ? "block" : "none";
    this.progressDebugView.append(this.progressDebugElement);

    this.progressBarHolder = document.createElement("div");
    this.progressBarHolder.style.position = "absolute";
    this.progressBarHolder.style.top = "0";
    this.progressBarHolder.style.left = "0";
    this.progressBarHolder.style.width = "100%";
    this.progressBarHolder.style.backgroundColor = "gray";
    this.progressBarHolder.style.height = "20px";
    this.element.append(this.progressBarHolder);

    this.progressBar = document.createElement("div");
    this.progressBar.style.position = "absolute";
    this.progressBar.style.top = "0";
    this.progressBar.style.left = "0";
    this.progressBar.style.width = "0";
    this.progressBar.style.height = "100%";
    this.progressBar.style.backgroundColor = "#0050a4";
    this.progressBarHolder.append(this.progressBar);

    this.loadingStatusText = document.createElement("div");
    this.loadingStatusText.style.position = "absolute";
    this.loadingStatusText.style.top = "0";
    this.loadingStatusText.style.left = "0";
    this.loadingStatusText.style.width = "100%";
    this.loadingStatusText.style.height = "100%";
    this.loadingStatusText.style.color = "white";
    this.loadingStatusText.style.textAlign = "center";
    this.loadingStatusText.style.verticalAlign = "middle";
    this.loadingStatusText.style.lineHeight = "20px";
    this.loadingStatusText.style.fontFamily = "sans-serif";
    this.loadingStatusText.textContent = "Loading...";
    this.progressBarHolder.append(this.loadingStatusText);

    this.loadingCallback = () => {
      const [loadingRatio, completedLoading] = this.loadingProgressManager.toRatio();
      if (completedLoading) {
        if (!this.hasCompleted) {
          this.hasCompleted = true;
          if (!this.debugCheckbox.checked) {
            this.dispose();
          }
        }
        this.loadingStatusText.textContent = "Completed";
        this.progressBar.style.width = "100%";
      } else {
        this.loadingStatusText.textContent = `Loading... ${(loadingRatio * 100).toFixed(2)}%`;
        this.progressBar.style.width = `${loadingRatio * 100}%`;
      }
      this.progressDebugElement.textContent = LoadingProgressManager.LoadingProgressSummaryToString(
        this.loadingProgressManager.toSummary(),
      );
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
