import { StandaloneGraphicsAdapter } from "../graphics";
import { LoadingProgressBar, LoadingSpinner } from "../loading";
import { MMLScene } from "./MMLScene";

export type FullScreenMMLSceneOptions = {
  showDebugLoading?: boolean;
  loadingStyle?: "bar" | "spinner";
  allowOverlay?: boolean;
};

export class FullScreenMMLScene<G extends StandaloneGraphicsAdapter> extends MMLScene<G> {
  private loadingProgressBar: LoadingProgressBar | LoadingSpinner;
  private showDebugLoading: boolean;

  constructor(private options: FullScreenMMLSceneOptions = {}) {
    super(document.createElement("div"));
    this.element = document.createElement("div");
    this.element.style.width = "100%";
    this.element.style.height = "100%";
    this.element.style.position = "relative";

    this.showDebugLoading = options.showDebugLoading ?? true;

    this.createLoadingProgressBar();
    this.configureWindowStyling();
  }

  private createLoadingProgressBar() {
    const loadingProgressManager = this.getLoadingProgressManager();
    const loadingStyle = this.options.loadingStyle || "bar";
    if (loadingStyle === "spinner") {
      this.loadingProgressBar = new LoadingSpinner(loadingProgressManager);
    } else {
      this.loadingProgressBar = new LoadingProgressBar(
        loadingProgressManager,
        this.showDebugLoading,
      );
    }
    this.element.append(this.loadingProgressBar.element);
  }

  public resetLoadingProgressBar() {
    this.loadingProgressBar.dispose();
    this.createLoadingProgressBar();
  }

  public getOverlayElement(): HTMLElement | null {
    if (this.options.allowOverlay) {
      return this.element;
    }
    return null;
  }

  private configureWindowStyling() {
    document.documentElement.style.width = "100%";
    document.documentElement.style.height = "100%";
    document.documentElement.style.overflow = "hidden";
    document.documentElement.style.overscrollBehaviorX = "contain";
    document.documentElement.style.margin = "0";

    const onload = () => {
      document.body.style.margin = "0";
      document.body.style.height = "100%";
    };
    if (document.body) {
      onload();
    } else {
      window.addEventListener("load", () => {
        onload();
      });
    }
  }

  dispose() {
    super.dispose();
    this.element.remove();
  }
}
