import { Animation, MElement, Model, TransformableElement } from "@mml-io/mml-web";
import { ModelGraphics } from "@mml-io/mml-web";
import { LoadingInstanceManager } from "@mml-io/mml-web";
import { IVect3 } from "@mml-io/mml-web";
import { ModelLoader, ModelLoadResult } from "@mml-io/model-loader";
import * as THREE from "three";

import { ThreeJSGraphicsAdapter } from "../ThreeJSGraphicsAdapter";

type ThreeJSModelLoadState = {
  group: THREE.Object3D;
  bones: Map<string, THREE.Bone>;
  boundingBox: {
    size: THREE.Vector3;
    centerOffset: THREE.Vector3;
  };
};

export class ThreeJSModel extends ModelGraphics<ThreeJSGraphicsAdapter> {
  private static modelLoader = new ModelLoader();
  private srcLoadingInstanceManager = new LoadingInstanceManager(`${Model.tagName}.src`);
  private animLoadingInstanceManager = new LoadingInstanceManager(`${Model.tagName}.anim`);
  private latestSrcModelPromise: Promise<ModelLoadResult> | null = null;
  private latestAnimPromise: Promise<ModelLoadResult> | null = null;

  private socketChildrenByBone = new Map<string, Set<MElement<ThreeJSGraphicsAdapter>>>();

  private attachments = new Map<
    Model<ThreeJSGraphicsAdapter>,
    {
      animationGroup: THREE.AnimationObjectGroup;
      animationMixer: THREE.AnimationMixer;
      animationAction: THREE.AnimationAction;
    } | null
  >();
  private registeredParentAttachment: Model<ThreeJSGraphicsAdapter> | null = null;

  private static DebugBoundingBoxGeometry = new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  private static DebugBoundingBoxMaterial = new THREE.MeshBasicMaterial({
    color: 0xff0000,
    wireframe: true,
    transparent: true,
    opacity: 0.3,
  });
  private debugBoundingBox: THREE.Mesh | null = null;

  protected loadedState: ThreeJSModelLoadState | null = null;

  private documentTimeTickListener: null | { remove: () => void } = null;

  private animationMixer: THREE.AnimationMixer | null = null;
  private animAttributeAction: THREE.AnimationAction | null = null;
  private childAnimationActions = new Map<
    Animation<ThreeJSGraphicsAdapter>,
    THREE.AnimationAction
  >();

  private pendingAnim: string | null = null;
  private pendingAnimationUpdates = new Map<Animation<ThreeJSGraphicsAdapter>, any>();

  constructor(
    private model: Model<ThreeJSGraphicsAdapter>,
    private updateMeshCallback: () => void,
  ) {
    super(model, updateMeshCallback);
  }

  hasLoadedModel(): boolean {
    return !!this.loadedState?.group;
  }

  hasLoadedAnimation(): boolean {
    return !!(this.animAttributeAction || this.childAnimationActions.size > 0);
  }

  disable(): void {}

  enable(): void {}

  getBoundingBox(): { centerOffset: IVect3; size: IVect3 } | null {
    if (this.loadedState) {
      return {
        centerOffset: this.loadedState.boundingBox.centerOffset,
        size: this.loadedState.boundingBox.size,
      };
    }
    return null;
  }

  getCollisionElement(): THREE.Object3D<THREE.Object3DEventMap> {
    return this.loadedState?.group ?? new THREE.Object3D();
  }

  setDebug(): void {
    this.updateDebugVisualisation();
  }

  setCastShadows(castShadows: boolean): void {
    if (this.loadedState) {
      this.loadedState.group.traverse((object) => {
        if ((object as THREE.Mesh).isMesh) {
          const mesh = object as THREE.Mesh;
          mesh.castShadow = castShadows;
        }
      });
    }
  }

  updateChildAnimation(animation: Animation<ThreeJSGraphicsAdapter>, animationState: any) {
    if (!this.animationMixer || !this.loadedState) {
      // queue if model isn't loaded yet
      this.pendingAnimationUpdates.set(animation, animationState);
      return;
    }

    console.log("updateChildAnimation called for:", animation.id, "with state:", animationState);

    let action = this.childAnimationActions.get(animation);

    if (!action && animationState && animationState.animationClip) {
      console.log("Creating new animation action for:", animation.id);
      action = this.animationMixer.clipAction(animationState.animationClip, this.loadedState.group);
      action.enabled = true;
      this.childAnimationActions.set(animation, action);
    }

    if (action) {
      if (animationState && animationState.weight !== undefined) {
        console.log("Updating weight for:", animation.id, "to:", animationState.weight);
        action.setEffectiveWeight(animationState.weight);
        if (animationState.weight > 0) {
          action.play();
        } else {
          action.stop();
        }
      }
    }

    this.updateAnimationActions();
  }

  removeChildAnimation(animation: Animation<ThreeJSGraphicsAdapter>) {
    if (!this.animationMixer || !this.loadedState) {
      this.pendingAnimationUpdates.delete(animation);
      return;
    }

    console.log("removeChildAnimation called for:", animation.id);

    const action = this.childAnimationActions.get(animation);
    if (action) {
      action.stop();
      this.animationMixer.uncacheAction(action.getClip(), this.loadedState.group);
      this.childAnimationActions.delete(animation);

      console.log("Removed animation action for:", animation.id);
    }

    this.updateAnimationActions();
  }

  private updateAnimationActions() {
    if (!this.animationMixer) return;

    // anim attribute is set, only play that action and stop all child actions
    if (this.animAttributeAction) {
      this.animAttributeAction.enabled = true;
      this.animAttributeAction.setEffectiveWeight(1);
      this.animAttributeAction.play();

      // Stop all child actions
      for (const action of this.childAnimationActions.values()) {
        action.stop();
      }
    } else {
      let hasActiveAnimations = false;
      for (const [animation, action] of this.childAnimationActions) {
        const weight = animation.props.weight;
        action.enabled = weight > 0;
        action.setEffectiveWeight(weight);
        if (weight > 0) {
          action.play();
          hasActiveAnimations = true;
        } else {
          action.stop();
        }
      }

      // no child animations active and no anim attribute is set,
      // model should get back to t-pose
      if (!hasActiveAnimations && this.childAnimationActions.size > 0) {
        console.log("No active child animations, resetting to A-pose");
        this.animationMixer.stopAllAction();
        this.animationMixer.setTime(0);
      }
    }
  }

  setAnim(anim: string | null): void {
    this.pendingAnim = anim;

    if (!this.loadedState) {
      return;
    }

    this.applyPendingAnimation();
  }

  private applyPendingAnimation() {
    if (!this.animationMixer || !this.loadedState || this.pendingAnim === undefined) return;

    const anim = this.pendingAnim;
    this.pendingAnim = null;

    // Stop and remove anim attribute action
    if (this.animAttributeAction) {
      this.animAttributeAction.stop();
      this.animationMixer.uncacheAction(this.animAttributeAction.getClip(), this.loadedState.group);
      this.animAttributeAction = null;
    }

    // If anim is set, load and play only that animation
    if (anim) {
      this.latestAnimPromise = this.asyncLoadSourceAsset(
        this.model.contentSrcToContentAddress(anim),
        () => {},
      );
      this.latestAnimPromise.then((result) => {
        if (!this.model.isConnected || !this.loadedState || !this.animationMixer) return;
        const clip = result.animations[0];
        const action = this.animationMixer.clipAction(clip, this.loadedState.group);
        action.enabled = true;
        action.setEffectiveWeight(1);
        action.play();
        this.animAttributeAction = action;

        // Stop all child actions
        for (const childAction of this.childAnimationActions.values()) {
          childAction.stop();
        }

        // Ensure document time tick listener is set up for animation updates
        if (!this.documentTimeTickListener) {
          this.documentTimeTickListener = this.model.addDocumentTimeTickListener(
            (documentTime: number) => {
              this.updateAnimation(documentTime);
            },
          );
        }
      });
    } else {
      // If anim is not set, update child actions
      this.updateAnimationActions();
    }
  }

  setAnimEnabled(): void {
    // no-op
  }

  setAnimLoop(): void {
    // no-op - property is observed in animation tick
  }

  setAnimStartTime(): void {
    // no-op - property is observed in animation tick
  }

  setAnimPauseTime(): void {
    // no-op - property is observed in animation tick
  }

  transformed(): void {
    // no-op
  }

  setSrc(src: string | null): void {
    if (this.loadedState !== null) {
      this.loadedState.group.removeFromParent();
      if (this.registeredParentAttachment) {
        (this.registeredParentAttachment.modelGraphics as ThreeJSModel).unregisterAttachment(
          this.model,
        );
        this.registeredParentAttachment = null;
      }
      ThreeJSModel.disposeOfGroup(this.loadedState.group);
      this.loadedState = null;
      this.updateMeshCallback();
      this.updateDebugVisualisation();
    }

    // Clean up animation mixer
    if (this.animationMixer) {
      this.animationMixer.stopAllAction();
      this.animationMixer = null;
    }
    this.animAttributeAction = null;
    this.childAnimationActions.clear();
    this.pendingAnimationUpdates.clear();

    if (!src) {
      this.latestSrcModelPromise = null;
      this.srcLoadingInstanceManager.abortIfLoading();
      this.socketChildrenByBone.forEach((children) => {
        children.forEach((child) => {
          this.model.getContainer().add(child.getContainer());
        });
      });
      this.updateMeshCallback();
      this.updateDebugVisualisation();
      return;
    }

    const contentSrc = this.model.contentSrcToContentAddress(src);
    this.srcLoadingInstanceManager.start(this.model.getLoadingProgressManager(), contentSrc);
    const srcModelPromise = this.asyncLoadSourceAsset(contentSrc, (loaded, total) => {
      if (this.latestSrcModelPromise !== srcModelPromise) {
        return;
      }
      this.srcLoadingInstanceManager.setProgress(loaded / total);
    });
    this.latestSrcModelPromise = srcModelPromise;
    srcModelPromise
      .then((result) => {
        if (this.latestSrcModelPromise !== srcModelPromise || !this.model.isConnected) {
          // we've loaded a different model since, or we're no longer connected
          // dispose of this one
          ThreeJSModel.disposeOfGroup(result.group);
          return;
        }
        result.group.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            child.castShadow = this.model.props.castShadows;
            child.receiveShadow = true;
          }
        });
        this.latestSrcModelPromise = null;
        const group = result.group;
        const bones = new Map<string, THREE.Bone>();
        group.traverse((object) => {
          if (object instanceof THREE.Bone) {
            bones.set(object.name, object);
          }
        });

        const boundingBox = new THREE.Box3();
        group.updateWorldMatrix(true, true);
        boundingBox.expandByObject(group);

        this.loadedState = {
          group,
          bones,
          boundingBox: {
            size: boundingBox.getSize(new THREE.Vector3(0, 0, 0)),
            centerOffset: boundingBox.getCenter(new THREE.Vector3(0, 0, 0)),
          },
        };
        this.model.getContainer().add(group);

        this.animationMixer = new THREE.AnimationMixer(group);

        if (!this.documentTimeTickListener) {
          this.documentTimeTickListener = this.model.addDocumentTimeTickListener(
            (documentTime: number) => {
              this.updateAnimation(documentTime);
            },
          );
        }

        for (const [boneName, children] of this.socketChildrenByBone) {
          const bone = bones.get(boneName);
          if (bone) {
            children.forEach((child) => {
              bone.add(child.getContainer());
            });
          }
        }

        this.updateMeshCallback();

        const parent = this.model.parentElement;
        if (parent && Model.isModel(parent)) {
          this.registeredParentAttachment = parent as Model<ThreeJSGraphicsAdapter>;
          (parent.modelGraphics as ThreeJSModel).registerAttachment(this.model);
        }

        this.srcLoadingInstanceManager.finish();
        this.updateDebugVisualisation();

        // Apply any pending animation now that the model is loaded
        this.applyPendingAnimation();

        // apply any pending animation updates that arrived before the model finished loading
        for (const [animation, animationState] of this.pendingAnimationUpdates) {
          this.updateChildAnimation(animation, animationState);
        }
        this.pendingAnimationUpdates.clear();
      })
      .catch((err) => {
        console.error("Error loading m-model.src", err);
        this.srcLoadingInstanceManager.error(err);
      });
  }

  public registerAttachment(attachment: Model<ThreeJSGraphicsAdapter>) {}

  public unregisterAttachment(attachment: Model<ThreeJSGraphicsAdapter>) {}

  private updateDebugVisualisation() {
    if (!this.model.props.debug) {
      this.clearDebugVisualisation();
    } else {
      if (!this.debugBoundingBox) {
        this.debugBoundingBox = new THREE.Mesh(
          ThreeJSModel.DebugBoundingBoxGeometry,
          ThreeJSModel.DebugBoundingBoxMaterial,
        );
        this.model.getContainer().add(this.debugBoundingBox);
      }
      if (this.loadedState) {
        const boundingBox = this.loadedState.boundingBox;
        if (boundingBox.centerOffset) {
          this.debugBoundingBox.position.copy(boundingBox.centerOffset);
        } else {
          this.debugBoundingBox.position.set(0, 0, 0);
        }
        this.debugBoundingBox.scale.copy(boundingBox.size);
      } else {
        this.debugBoundingBox.scale.set(0, 0, 0);
      }
    }
  }

  private clearDebugVisualisation() {
    if (this.debugBoundingBox) {
      this.debugBoundingBox.removeFromParent();
      this.debugBoundingBox = null;
    }
  }

  async asyncLoadSourceAsset(
    url: string,
    onProgress: (loaded: number, total: number) => void,
  ): Promise<ModelLoadResult> {
    return await ThreeJSModel.modelLoader.load(url, onProgress);
  }

  public registerSocketChild(
    child: TransformableElement<ThreeJSGraphicsAdapter>,
    socketName: string,
  ): void {
    let children = this.socketChildrenByBone.get(socketName);
    if (!children) {
      children = new Set<MElement<ThreeJSGraphicsAdapter>>();
      this.socketChildrenByBone.set(socketName, children);
    }
    children.add(child);

    if (this.loadedState) {
      const bone = this.loadedState.bones.get(socketName);
      if (bone) {
        bone.add(child.getContainer());
      } else {
        this.model.getContainer().add(child.getContainer());
      }
    }
  }

  public unregisterSocketChild(
    child: TransformableElement<ThreeJSGraphicsAdapter>,
    socketName: string,
    addToRoot: boolean = true,
  ): void {
    const socketChildren = this.socketChildrenByBone.get(socketName);
    if (socketChildren) {
      socketChildren.delete(child);
      if (addToRoot) {
        this.model.getContainer().add(child.getContainer());
      }
      if (socketChildren.size === 0) {
        this.socketChildrenByBone.delete(socketName);
      }
    }
  }

  private triggerSocketedChildrenTransformed() {
    // Socketed children need to be updated when the animation is updated as their position may have updated
    this.socketChildrenByBone.forEach((children) => {
      children.forEach((child) => {
        if (TransformableElement.isTransformableElement(child)) {
          child.didUpdateTransformation();
        }
      });
    });
  }

  private updateAnimation(docTimeMs: number) {
    if (!this.animationMixer) return;

    if (this.model.props.animEnabled) {
      const documentTime = this.model.getDocumentTime();
      const animationTime = documentTime / 1000;
      this.animationMixer.setTime(animationTime);
      this.triggerSocketedChildrenTransformed();
    } else {
      this.animationMixer.stopAllAction();
    }
  }

  dispose() {
    if (this.documentTimeTickListener) {
      this.documentTimeTickListener.remove();
      this.documentTimeTickListener = null;
    }
    if (this.registeredParentAttachment) {
      (this.registeredParentAttachment?.modelGraphics as ThreeJSModel)?.unregisterAttachment(
        this.model,
      );
      this.registeredParentAttachment = null;
    }
    if (this.loadedState) {
      this.loadedState.group.removeFromParent();
      ThreeJSModel.disposeOfGroup(this.loadedState.group);
      this.loadedState = null;
    }
    this.clearDebugVisualisation();
    this.latestSrcModelPromise = null;
    this.latestAnimPromise = null;
    this.animLoadingInstanceManager.dispose();
    this.srcLoadingInstanceManager.dispose();

    if (this.animationMixer) {
      this.animationMixer.stopAllAction();
      this.animationMixer = null;
    }
    this.animAttributeAction = null;
    this.childAnimationActions.clear();
    this.pendingAnimationUpdates.clear();
  }

  private static disposeOfGroup(group: THREE.Object3D) {
    group.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.geometry.dispose();
        if (Array.isArray(mesh.material)) {
          for (const material of mesh.material) {
            ThreeJSModel.disposeOfMaterial(material);
          }
        } else if (mesh.material) {
          ThreeJSModel.disposeOfMaterial(mesh.material);
        }
      }
    });
  }

  private static disposeOfMaterial(material: THREE.Material) {
    material.dispose();
    for (const key of Object.keys(material)) {
      const value = (material as any)[key];
      if (value && typeof value === "object" && "minFilter" in value) {
        value.dispose();
      }
    }
  }
}
