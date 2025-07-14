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

  setDebug(debug: boolean, mModelProps: any): void {
    this.updateDebugVisualisation();
  }

  setCastShadows(castShadows: boolean, mModelProps: any): void {
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
    if (!this.animationMixer || !this.loadedState) return;

    console.log("updateChildAnimation called for:", animation.id, "with state:", animationState);

    // Get existing action
    let action = this.childAnimationActions.get(animation);

    // If no action exists and we have an animation clip, create one
    if (!action && animationState && animationState.animationClip) {
      console.log("Creating new animation action for:", animation.id);
      action = this.animationMixer.clipAction(animationState.animationClip, this.loadedState.group);
      action.enabled = true;
      this.childAnimationActions.set(animation, action);
    }

    // Update the action if it exists
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

  private updateAnimationActions() {
    if (!this.animationMixer) return;

    // If anim attribute is set, only play that action and stop all child actions
    if (this.animAttributeAction) {
      this.animAttributeAction.enabled = true;
      this.animAttributeAction.setEffectiveWeight(1);
      this.animAttributeAction.play();

      // Stop all child actions
      for (const action of this.childAnimationActions.values()) {
        action.stop();
      }
    } else {
      // Blend all child actions
      for (const [animation, action] of this.childAnimationActions) {
        const weight = animation.props.weight;
        action.enabled = weight > 0;
        action.setEffectiveWeight(weight);
        if (weight > 0) {
          action.play();
        } else {
          action.stop();
        }
      }
    }
  }

  setAnim(anim: string | null, mModelProps: any): void {
    // Store the pending animation
    this.pendingAnim = anim;

    // If model isn't loaded yet, wait for it
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

  setAnimEnabled(animEnabled: boolean | null, mModelProps: any): void {
    // Animation enabling is handled in updateAnimation
  }

  setAnimLoop(animLoop: boolean | null, mModelProps: any): void {
    // no-op - property is observed in animation tick
  }

  setAnimStartTime(animStartTime: number | null, mModelProps: any): void {
    // no-op - property is observed in animation tick
  }

  setAnimPauseTime(animPauseTime: number | null, mModelProps: any): void {
    // no-op - property is observed in animation tick
  }

  transformed(): void {
    // no-op
  }

  setSrc(src: string | null, mModelProps: any): void {
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
          // If we've loaded a different model since, or we're no longer connected, dispose of this one
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

        console.log("Model bones:", Array.from(bones.keys()));
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

        // Initialize animation mixer
        this.animationMixer = new THREE.AnimationMixer(group);

        // Set up document time tick listener for animation updates
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
      })
      .catch((err) => {
        console.error("Error loading m-model.src", err);
        this.srcLoadingInstanceManager.error(err);
      });
  }

  public registerAttachment(attachment: Model<ThreeJSGraphicsAdapter>) {
    // This is for the old animation system - keeping for compatibility
    // but not using for the new unified system
  }

  public unregisterAttachment(attachment: Model<ThreeJSGraphicsAdapter>) {
    // This is for the old animation system - keeping for compatibility
    // but not using for the new unified system
  }

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

  private updateAnimation(docTimeMs: number, force: boolean = false) {
    if (!this.animationMixer) return;

    let animationTimeMs = docTimeMs - this.model.props.animStartTime;
    if (docTimeMs < this.model.props.animStartTime) {
      animationTimeMs = 0;
    } else if (this.model.props.animPauseTime !== null) {
      if (docTimeMs > this.model.props.animPauseTime) {
        animationTimeMs = this.model.props.animPauseTime - this.model.props.animStartTime;
      }
    }

    if (this.model.props.animEnabled) {
      this.animationMixer.setTime(animationTimeMs / 1000);
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
