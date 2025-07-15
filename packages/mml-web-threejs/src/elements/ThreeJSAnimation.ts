import { Animation } from "@mml-io/mml-web";
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

        const existingWeight = this.animationState?.weight ?? this.animation.props.weight;

        this.animationState = {
          animationClip,
          animationAction: null,
          weight: existingWeight,
        };

        console.log("Animation state created with weight:", existingWeight);
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
    console.log("ThreeJSAnimation.setWeight called with weight:", weight);
    if (this.animationState) {
      this.animationState.weight = weight;
      this.updateParentAnimation();
    } else {
      // anim state doesn't exist yet create a temp to be replaced when src loaded
      console.log(
        "ThreeJSAnimation.setWeight: creating temporary animation state with weight:",
        weight,
      );
      this.animationState = {
        animationClip: null as any, // set when loaded
        animationAction: null,
        weight,
      };
      this.updateParentAnimation();
    }
  }

  private updateParentAnimation() {
    if (!this.parentModel || !this.animationState) {
      console.log("updateParentAnimation: missing parentModel or animationState", {
        hasParentModel: !!this.parentModel,
        hasAnimationState: !!this.animationState,
      });
      return;
    }

    // notify parent model that anim changed
    if (this.parentModel.modelGraphics) {
      console.log("updateParentAnimation: calling updateChildAnimation on parent model", {
        animationId: this.animation.id,
        weight: this.animationState.weight,
        hasClip: !!this.animationState.animationClip,
      });
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
      console.log("ThreeJSAnimation disposing, notifying parent model");
      this.parentModel.modelGraphics.removeChildAnimation?.(this.animation);
    }

    this.animationState = null;
  }

  public getAnimationState(): ThreeJSAnimationState | null {
    return this.animationState;
  }
}
