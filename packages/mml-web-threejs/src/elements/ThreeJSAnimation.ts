import { Animation, MAnimationProps } from "@mml-io/mml-web";
import { AnimationGraphics } from "@mml-io/mml-web";
import { LoadingInstanceManager } from "@mml-io/mml-web";
import { ModelLoader, ModelLoadResult } from "@mml-io/model-loader";
import * as THREE from "three";

import { ThreeJSGraphicsAdapter } from "../ThreeJSGraphicsAdapter";

type ThreeJSAnimationState = {
  animationClip: THREE.AnimationClip;
  animationAction: THREE.AnimationAction | null;
  weight: number;
};

export class ThreeJSAnimation extends AnimationGraphics<ThreeJSGraphicsAdapter> {
  private static modelLoader = new ModelLoader();
  private loadingInstanceManager = new LoadingInstanceManager(`${Animation.tagName}.src`);
  private latestSrcPromise: Promise<ModelLoadResult> | null = null;

  private animationState: ThreeJSAnimationState | null = null;
  private parentModel: any = null;

  constructor(private animation: Animation<ThreeJSGraphicsAdapter>) {
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
      this.animationState.animationAction = null;
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
        console.log("Loaded animation clip:", {
          name: animationClip.name,
          duration: animationClip.duration,
          tracks: animationClip.tracks.map((track) => ({
            name: track.name,
            type: track.constructor.name,
          })),
        });

        this.animationState = {
          animationClip,
          animationAction: null,
          weight: this.animation.props.weight,
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

  setWeight(weight: number, mAnimationProps: any): void {
    console.log("ThreeJSAnimation.setWeight called with weight:", weight);
    if (this.animationState) {
      this.animationState.weight = weight;
      this.updateParentAnimation();
    } else {
      // If animation state doesn't exist yet, store the weight for when it's created
      this.animationState = {
        animationClip: null as any, // Will be set when src is loaded
        animationAction: null,
        weight,
      };
    }
  }

  private updateParentAnimation() {
    if (!this.parentModel || !this.animationState) {
      return;
    }

    // Notify the parent model that this animation has changed
    if (this.parentModel.modelGraphics) {
      // We'll need to add a method to the ModelGraphics interface to handle this
      // For now, we'll just store the animation state and let the model handle it
      this.parentModel.modelGraphics.updateChildAnimation?.(this.animation, this.animationState);
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
    this.animationState = null;
  }

  public getAnimationState(): ThreeJSAnimationState | null {
    return this.animationState;
  }
}
