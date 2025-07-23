import { Animation } from "@mml-io/mml-web";
import { AnimationGraphics } from "@mml-io/mml-web";
import { LoadingInstanceManager } from "@mml-io/mml-web";
import * as playcanvas from "playcanvas";

import { PlayCanvasGraphicsAdapter } from "../PlayCanvasGraphicsAdapter";

type PlayCanvasAnimationState = {
  animationAsset: playcanvas.Asset;
  animationClip: playcanvas.Asset; // Alias for animationAsset to maintain compatibility
  weight: number;
  loop: boolean;
  startTime: number;
  pauseTime: number | null;
};

export class PlayCanvasAnimation extends AnimationGraphics<PlayCanvasGraphicsAdapter> {
  private loadingInstanceManager = new LoadingInstanceManager(`${Animation.tagName}.src`);
  private latestSrcPromise: Promise<playcanvas.Asset> | null = null;

  private animationState: PlayCanvasAnimationState | null = null;
  private parentModel: any = null;

  constructor(private animation: Animation<PlayCanvasGraphicsAdapter>) {
    super(animation);
    this.findParentModel();
  }

  private findParentModel() {
    let parent = this.animation.parentElement;
    while (parent) {
      if (parent.tagName === "M-MODEL" || parent.tagName === "M-CHARACTER") {
        this.parentModel = parent;
        break;
      }
      parent = parent.parentElement;
    }
  }

  setSrc(src: string | null): void {
    if (this.animationState) {
      this.animationState.animationAsset = null as any;
      this.animationState = null;
    }

    if (!src) {
      this.latestSrcPromise = null;
      this.loadingInstanceManager.abortIfLoading();
      return;
    }

    const contentSrc = this.animation.contentSrcToContentAddress(src);
    this.loadingInstanceManager.start(this.animation.getLoadingProgressManager(), contentSrc);
    let srcPromise: Promise<playcanvas.Asset>;
    srcPromise = this.asyncLoadSourceAsset(contentSrc, (loaded, total) => {
      if (this.latestSrcPromise !== srcPromise) {
        return;
      }
      this.loadingInstanceManager.setProgress(loaded / total);
    });
    this.latestSrcPromise = srcPromise;
    srcPromise
      .then((asset) => {
        if (this.latestSrcPromise !== srcPromise || !this.animation.isConnected) {
          return;
        }
        this.latestSrcPromise = null;

        const existingWeight = this.animationState?.weight ?? this.animation.props.weight;
        const existingLoop = this.animationState?.loop ?? this.animation.props.loop;
        const existingStartTime = this.animationState?.startTime ?? this.animation.props.startTime;
        const existingPauseTime = this.animationState?.pauseTime ?? this.animation.props.pauseTime;

        this.animationState = {
          animationAsset: asset,
          animationClip: asset, // Alias for compatibility
          weight: existingWeight,
          loop: existingLoop,
          startTime: existingStartTime,
          pauseTime: existingPauseTime,
        };

        this.updateParentAnimation();
        this.loadingInstanceManager.finish();
      })
      .catch((err) => {
        console.error("Error loading m-animation.src", err);
        this.latestSrcPromise = null;
        this.loadingInstanceManager.error(err);
      });
  }

  setWeight(weight: number): void {
    if (this.animationState) {
      this.animationState.weight = weight;
      this.updateParentAnimation();
    } else {
      // anim state doesn't exist yet create a temp to be replaced when src loaded
      this.animationState = {
        animationAsset: null as any, // set when loaded
        animationClip: null as any, // set when loaded
        weight,
        loop: this.animation.props.loop,
        startTime: this.animation.props.startTime,
        pauseTime: this.animation.props.pauseTime,
      };
      this.updateParentAnimation();
    }
  }

  setLoop(loop: boolean): void {
    if (this.animationState) {
      this.animationState.loop = loop;
      this.updateParentAnimation();
    } else {
      this.animationState = {
        animationAsset: null as any, // set when loaded
        animationClip: null as any, // set when loaded
        weight: this.animation.props.weight,
        loop,
        startTime: this.animation.props.startTime,
        pauseTime: this.animation.props.pauseTime,
      };
      this.updateParentAnimation();
    }
  }

  setStartTime(startTime: number): void {
    if (this.animationState) {
      this.animationState.startTime = startTime;
      this.updateParentAnimation();
    } else {
      this.animationState = {
        animationAsset: null as any, // set when loaded
        animationClip: null as any, // set when loaded
        weight: this.animation.props.weight,
        loop: this.animation.props.loop,
        startTime,
        pauseTime: this.animation.props.pauseTime,
      };
      this.updateParentAnimation();
    }
  }

  setPauseTime(pauseTime: number | null): void {
    if (this.animationState) {
      this.animationState.pauseTime = pauseTime;
      this.updateParentAnimation();
    } else {
      this.animationState = {
        animationAsset: null as any, // set when loaded
        animationClip: null as any, // set when loaded
        weight: this.animation.props.weight,
        loop: this.animation.props.loop,
        startTime: this.animation.props.startTime,
        pauseTime,
      };
      this.updateParentAnimation();
    }
  }

  private updateParentAnimation() {
    if (!this.parentModel || !this.animationState) {
      return;
    }

    // notify parent model that anim changed
    if (this.parentModel.modelGraphics) {
      this.parentModel.modelGraphics.updateChildAnimation?.(this.animation, this.animationState);
    } else {
      console.error("updateParentAnimation: parent model has no modelGraphics");
    }
  }

  async asyncLoadSourceAsset(
    url: string,
    onProgress: (loaded: number, total: number) => void,
  ): Promise<playcanvas.Asset> {
    void onProgress(0, 0); // suppress unused warning
    return new Promise<playcanvas.Asset>((resolve, reject) => {
      const asset = new playcanvas.Asset(url, "animation", { url });
      const app = this.animation.getScene().getGraphicsAdapter().getPlayCanvasApp();
      app.assets.add(asset);
      app.assets.load(asset);
      asset.ready((asset) => {
        resolve(asset);
      });
      asset.on("error", (err) => {
        reject(err);
      });
    });
  }

  dispose() {
    if (this.latestSrcPromise) {
      this.latestSrcPromise = null;
    }
    this.loadingInstanceManager.dispose();

    if (this.parentModel && this.parentModel.modelGraphics) {
      this.parentModel.modelGraphics.removeChildAnimation?.(this.animation);
    }

    this.animationState = null;
  }

  public getAnimationState(): PlayCanvasAnimationState | null {
    return this.animationState;
  }
}
