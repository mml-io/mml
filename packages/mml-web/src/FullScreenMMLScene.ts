import { LoadingProgressBar } from "./loading/LoadingProgressBar";
import { MMLScene } from "./MMLScene";

export class FullScreenMMLScene extends MMLScene {
  private loadingProgressBar: LoadingProgressBar;

  constructor() {
    super();

    const loadingProgressManager = this.getLoadingProgressManager();
    this.loadingProgressBar = new LoadingProgressBar(loadingProgressManager);
    this.element.append(this.loadingProgressBar.element);

    this.configureWindowStyling();
  }

  private configureWindowStyling() {
    document.documentElement.style.width = "100%";
    document.documentElement.style.height = "100%";
    document.documentElement.style.overflow = "hidden";
    document.documentElement.style.overscrollBehaviorX = "contain";
    document.documentElement.style.margin = "0";
    if (document.body) {
      document.body.style.margin = "0";
    } else {
      window.addEventListener("load", () => {
        if (document.body) {
          document.body.style.margin = "0";
        }
      });
    }
  }
}
