import { Animation, Model } from "@mml-io/mml-web";
import { AnimationGraphics } from "@mml-io/mml-web";
import { LoadingInstanceManager } from "@mml-io/mml-web";
import { ModelLoader, ModelLoadResult } from "@mml-io/model-loader";
import * as THREE from "three";

import { ThreeJSGraphicsAdapter } from "../ThreeJSGraphicsAdapter";

export type ThreeJSAnimationState = {
  animationClip: THREE.AnimationClip | null;
  weight: number;
  loop: boolean;
  startTime: number;
  pauseTime: number | null;
};

export class ThreeJSAnimation extends AnimationGraphics<ThreeJSGraphicsAdapter> {
  private static modelLoader = new ModelLoader();
  private loadingInstanceManager = new LoadingInstanceManager(`${Animation.tagName}.src`);
  private latestSrcPromise: Promise<ModelLoadResult> | null = null;

  private animationState: ThreeJSAnimationState;
  private parentModel: Model<ThreeJSGraphicsAdapter> | null = null;

  constructor(private animation: Animation<ThreeJSGraphicsAdapter>) {
    super(animation);
    
    if (animation.parentElement && Model.isModel(animation.parentElement)) {
      this.parentModel = animation.parentElement as Model<ThreeJSGraphicsAdapter>;
    }
    this.animationState = {
      animationClip: null,
      weight: animation.props.weight,
      loop: animation.props.loop,
      startTime: animation.props.startTime,
      pauseTime: animation.props.pauseTime,
    };
  }

  setSrc(src: string | null): void {
    if (this.animationState.animationClip) {
      this.animationState.animationClip = null;
    }

    if (!src) {
      this.latestSrcPromise = null;
      this.loadingInstanceManager.abortIfLoading();
      return;
    }

    const contentSrc = this.animation.contentSrcToContentAddress(src);
    this.loadingInstanceManager.start(this.animation.getLoadingProgressManager(), contentSrc);
    const srcPromise = this.asyncLoadSourceAsset(contentSrc, (loaded, total) => {
      if (this.latestSrcPromise !== srcPromise) {
        return;
      }
      this.loadingInstanceManager.setProgress(loaded / total);
    });
    this.latestSrcPromise = srcPromise;
    srcPromise
      .then((result) => {
        if (this.latestSrcPromise !== srcPromise || !this.animation.isConnected) {
          return;
        }
        this.latestSrcPromise = null;

        const animationClip = result.animations[0];

        this.animationState.animationClip = animationClip;

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
    if (!this.parentModel || !this.animationState.animationClip) {
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
  ): Promise<ModelLoadResult> {
    return await ThreeJSAnimation.modelLoader.load(url, onProgress);
  }

  dispose() {
    if (this.latestSrcPromise) {
      this.latestSrcPromise = null;
    }
    this.loadingInstanceManager.dispose();

    if (this.parentModel && this.parentModel.modelGraphics) {
      this.parentModel.modelGraphics.removeChildAnimation?.(this.animation);
    }

    this.animationState.animationClip = null;
  }
}
