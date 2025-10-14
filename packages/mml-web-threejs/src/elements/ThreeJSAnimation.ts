import { Animation, Model } from "@mml-io/mml-web";
import { AnimationGraphics } from "@mml-io/mml-web";
import { LoadingInstanceManager } from "@mml-io/mml-web";
import { ModelLoadResult } from "@mml-io/model-loader";
import * as THREE from "three";

import { ThreeJSModelHandle } from "../resources/ThreeJSModelHandle";
import { ThreeJSGraphicsAdapter } from "../ThreeJSGraphicsAdapter";

export type ThreeJSAnimationState = {
  animationClip: THREE.AnimationClip | null;
  weight: number;
  speed: number;
  ratio: number | null;
  loop: boolean;
  startTime: number;
  pauseTime: number | null;
};

export class ThreeJSAnimation extends AnimationGraphics<ThreeJSGraphicsAdapter> {
  private loadingInstanceManager = new LoadingInstanceManager(`${Animation.tagName}.src`);
  private latestSrcModelHandle: ThreeJSModelHandle | null = null;

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
      speed: animation.props.speed,
      ratio: animation.props.ratio,
      loop: animation.props.loop,
      startTime: animation.props.startTime,
      pauseTime: animation.props.pauseTime,
    };
  }

  setSrc(src: string | null): void {
    if (this.latestSrcModelHandle?.url === src) {
      // already loading the same src
      return;
    }
    if (this.latestSrcModelHandle) {
      this.latestSrcModelHandle.dispose();
      this.loadingInstanceManager.abortIfLoading();
    }
    this.latestSrcModelHandle = null;

    if (this.animationState.animationClip) {
      this.animationState.animationClip = null;
    }

    if (!src) {
      this.latestSrcModelHandle = null;
      this.loadingInstanceManager.abortIfLoading();
      return;
    }

    const contentSrc = this.animation.contentSrcToContentAddress(src);
    this.loadingInstanceManager.start(this.animation.getLoadingProgressManager(), contentSrc);
    const srcModelHandle = this.animation
      .getScene()
      .getGraphicsAdapter()
      .getResourceManager()
      .loadModel(contentSrc);
    this.latestSrcModelHandle = srcModelHandle;
    srcModelHandle.onProgress((loaded, total) => {
      if (this.latestSrcModelHandle !== srcModelHandle) {
        return;
      }
      this.loadingInstanceManager.setProgress(loaded / total);
    });
    srcModelHandle.onLoad((result: ModelLoadResult | Error) => {
      if (result instanceof Error) {
        console.error("Error loading m-animation.src", result);
        this.latestSrcModelHandle = null;
        this.loadingInstanceManager.error(result);
        return;
      }
      if (this.latestSrcModelHandle !== srcModelHandle || !this.animation.isConnected) {
        return;
      }

      const animationClip = result.animations[0];

      this.animationState.animationClip = animationClip;

      this.updateParentAnimation();
      this.loadingInstanceManager.finish();
    });
  }

  parentModelUpdated(): void {
    this.updateParentAnimation();
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

  dispose() {
    if (this.latestSrcModelHandle) {
      this.latestSrcModelHandle.dispose();
    }
    this.latestSrcModelHandle = null;
    this.loadingInstanceManager.dispose();

    if (this.parentModel && this.parentModel.modelGraphics) {
      this.parentModel.modelGraphics.removeChildAnimation?.(this.animation);
    }

    this.animationState.animationClip = null;
  }
}
