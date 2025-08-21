import { Animation, Model } from "@mml-io/mml-web";
import { AnimationGraphics } from "@mml-io/mml-web";
import { LoadingInstanceManager } from "@mml-io/mml-web";
import * as playcanvas from "playcanvas";

import { PlayCanvasGraphicsAdapter } from "../PlayCanvasGraphicsAdapter";

export type PlayCanvasAnimationState = {
  animationAsset: playcanvas.Asset | null;
  weight: number;
  speed: number;
  ratio: number | null;
  loop: boolean;
  startTime: number;
  pauseTime: number | null;
};

export class PlayCanvasAnimation extends AnimationGraphics<PlayCanvasGraphicsAdapter> {
  private loadingInstanceManager = new LoadingInstanceManager(`${Animation.tagName}.src`);
  private latestSrcPromise: Promise<playcanvas.Asset> | null = null;

  private animationState: PlayCanvasAnimationState;
  private parentModel: Model<PlayCanvasGraphicsAdapter> | null = null;

  constructor(private animation: Animation<PlayCanvasGraphicsAdapter>) {
    super(animation);
    if (animation.parentElement && Model.isModel(animation.parentElement)) {
      this.parentModel = animation.parentElement as Model<PlayCanvasGraphicsAdapter>;
    }
    this.animationState = {
      animationAsset: null,
      weight: animation.props.weight,
      speed: animation.props.speed,
      loop: animation.props.loop,
      ratio: animation.props.ratio,
      startTime: animation.props.startTime,
      pauseTime: animation.props.pauseTime,
    };
  }

  setSrc(src: string | null): void {
    if (this.animationState.animationAsset) {
      this.animationState.animationAsset.unload();
    }
    this.animationState.animationAsset = null;

    if (!src) {
      this.latestSrcPromise = null;
      this.loadingInstanceManager.abortIfLoading();
      return;
    }

    const contentSrc = this.animation.contentSrcToContentAddress(src);
    this.loadingInstanceManager.start(this.animation.getLoadingProgressManager(), contentSrc);
    let srcPromise: Promise<playcanvas.Asset> | null = null;
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

        this.animationState.animationAsset = asset;

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
    this.animationState.weight = weight;
    this.updateParentAnimation();
  }

  setSpeed(speed: number): void {
    this.animationState.speed = speed;
    this.updateParentAnimation();
  }

  setRatio(ratio: number | null): void {
    this.animationState.ratio = ratio;
    this.updateParentAnimation();
  }

  setLoop(loop: boolean): void {
    this.animationState.loop = loop;
    this.updateParentAnimation();
  }

  setStartTime(startTime: number): void {
    this.animationState.startTime = startTime;
    this.updateParentAnimation();
  }

  setPauseTime(pauseTime: number | null): void {
    this.animationState.pauseTime = pauseTime;
    this.updateParentAnimation();
  }

  private updateParentAnimation() {
    if (!this.parentModel || !this.animationState.animationAsset) {
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
    if (this.animationState.animationAsset) {
      this.animationState.animationAsset.unload();
      this.animationState.animationAsset = null;
    }
  }
}
