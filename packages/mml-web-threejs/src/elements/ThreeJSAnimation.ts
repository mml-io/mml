import { Animation, Model } from "@mml-io/mml-web";
import { AnimationGraphics } from "@mml-io/mml-web";
import { LoadingInstanceManager } from "@mml-io/mml-web";
import { ModelLoader, ModelLoadResult } from "@mml-io/model-loader";
import * as THREE from "three";

import { ThreeJSGraphicsAdapter } from "../ThreeJSGraphicsAdapter";

export type ThreeJSAnimationState = {
  animationClip: THREE.AnimationClip;
  weight: number;
  loop: boolean;
  startTime: number;
  pauseTime: number | null;
};

export class ThreeJSAnimation extends AnimationGraphics<ThreeJSGraphicsAdapter> {
  private static modelLoader = new ModelLoader();
  private loadingInstanceManager = new LoadingInstanceManager(`${Animation.tagName}.src`);
  private latestSrcPromise: Promise<ModelLoadResult> | null = null;

  private animationState: ThreeJSAnimationState | null = null;
  private parentModel: Model<ThreeJSGraphicsAdapter> | null = null;

  constructor(private animation: Animation<ThreeJSGraphicsAdapter>) {
    super(animation);
    this.findParentModel();
  }

  private findParentModel() {
    let parent = this.animation.parentElement;
    while (parent) {
      if (parent.tagName === "M-MODEL" || parent.tagName === "M-CHARACTER") {
        this.parentModel = parent as Model<ThreeJSGraphicsAdapter>;
        break;
      }
      parent = parent.parentElement;
    }
  }

  setSrc(src: string | null): void {
    if (this.animationState) {
      this.animationState = null;
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

        const existingWeight = this.animationState?.weight ?? this.animation.props.weight;
        const existingLoop = this.animationState?.loop ?? this.animation.props.loop;
        const existingStartTime = this.animationState?.startTime ?? this.animation.props.startTime;
        const existingPauseTime = this.animationState?.pauseTime ?? this.animation.props.pauseTime;

        this.animationState = {
          animationClip,
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
    if (!this.parentModel || !this.animationState || !this.animationState.animationClip) {
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

    this.animationState = null;
  }

  public getAnimationState(): ThreeJSAnimationState | null {
    return this.animationState;
  }
}
