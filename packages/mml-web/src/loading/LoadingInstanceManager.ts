import { LoadingProgressManager } from "./LoadingProgressManager";

const noManagerSymbol = Symbol("NoLoadingProgressManagerProvided");

export class LoadingInstanceManager {
  // Only set if the instance is loading / has loaded / has errored
  private currentlyLoadingProgressManager: LoadingProgressManager | typeof noManagerSymbol | null =
    null;

  constructor(private type: string) {}

  public start(loadingProgressManager: LoadingProgressManager | null, url: string) {
    if (this.currentlyLoadingProgressManager !== null) {
      if (this.currentlyLoadingProgressManager === noManagerSymbol && !loadingProgressManager) {
        // Already loading with no progress manager, and no progress manager provided - do nothing
        return;
      }
      if (this.currentlyLoadingProgressManager !== loadingProgressManager) {
        throw new Error("Already loading with a different progress manager");
      }
      // else the instance is already reported as loading with this progress manager (could be a change in content)
    } else {
      // This instance is now loading - report to the progress manager
      if (!loadingProgressManager) {
        this.currentlyLoadingProgressManager = noManagerSymbol;
      } else {
        this.currentlyLoadingProgressManager = loadingProgressManager;
        this.currentlyLoadingProgressManager.addLoadingAsset(this, url, this.type);
      }
    }
  }

  public setProgress(ratio: number) {
    if (!this.currentlyLoadingProgressManager) {
      throw new Error("Not currently loading - cannot finish");
    }
    if (this.currentlyLoadingProgressManager !== noManagerSymbol) {
      this.currentlyLoadingProgressManager.updateAssetProgress(this, ratio);
    }
  }

  // The content being loaded is no longer needed, but the instance may still request content load start again
  public abortIfLoading() {
    if (
      this.currentlyLoadingProgressManager &&
      this.currentlyLoadingProgressManager !== noManagerSymbol
    ) {
      this.currentlyLoadingProgressManager.disposeOfLoadingAsset(this);
    }
    this.currentlyLoadingProgressManager = null;
  }

  // The instance is no longer needed, and will not request content load start again (content may not be loading)
  public dispose() {
    this.abortIfLoading();
  }

  public finish() {
    if (!this.currentlyLoadingProgressManager) {
      throw new Error("Not currently loading - cannot finish");
    }
    if (this.currentlyLoadingProgressManager !== noManagerSymbol) {
      this.currentlyLoadingProgressManager.completedLoadingAsset(this);
    }
  }

  public error(err?: Error | null) {
    if (!this.currentlyLoadingProgressManager) {
      throw new Error("Not currently loading - cannot error");
    }
    if (this.currentlyLoadingProgressManager !== noManagerSymbol) {
      if (err) {
        this.currentlyLoadingProgressManager.errorLoadingAsset(this, err);
      } else {
        this.currentlyLoadingProgressManager.errorLoadingAsset(this, new Error("Unknown error"));
      }
    }
  }
}
