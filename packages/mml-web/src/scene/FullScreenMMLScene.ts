import { StandaloneGraphicsAdapter } from "../graphics";
import { LoadingProgressBar } from "../loading";
import { MMLScene } from "./MMLScene";

export class FullScreenMMLScene<G extends StandaloneGraphicsAdapter> extends MMLScene<G> {
  private loadingProgressBar: LoadingProgressBar;
  private showDebugLoading: boolean;

  constructor(showDebugLoading = true) {
    super(document.createElement("div"));
    this.element = document.createElement("div");
    this.element.style.width = "100%";
    this.element.style.height = "100%";
    this.element.style.position = "relative";

    this.showDebugLoading = showDebugLoading;

    const loadingProgressManager = this.getLoadingProgressManager();
    this.loadingProgressBar = new LoadingProgressBar(loadingProgressManager, this.showDebugLoading);
    this.element.append(this.loadingProgressBar.element);

    this.configureWindowStyling();
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
