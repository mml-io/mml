import { Animation, MElement, MModelProps, Model, TransformableElement } from "@mml-io/mml-web";
import { ModelGraphics } from "@mml-io/mml-web";
import { LoadingInstanceManager } from "@mml-io/mml-web";
import { IVect3 } from "@mml-io/mml-web";
import { ModelLoader, ModelLoadResult } from "@mml-io/model-loader";
import * as THREE from "three";

import { ThreeJSGraphicsAdapter } from "../ThreeJSGraphicsAdapter";
import { ThreeJSAnimation, ThreeJSAnimationState } from "./ThreeJSAnimation";

type ThreeJSModelLoadState = {
  group: THREE.Object3D;
  bones: Map<string, THREE.Bone>;
  boundingBox: {
    size: THREE.Vector3;
    centerOffset: THREE.Vector3;
  };
};

type ThreeJSModelAnimState = {
  currentAnimationClip: THREE.AnimationClip;
  appliedAnimation: {
    animationGroup: THREE.AnimationObjectGroup;
    animationMixer: THREE.AnimationMixer;
    animationAction: THREE.AnimationAction;
  } | null;
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
  protected animState: ThreeJSModelAnimState | null = null;

  private documentTimeTickListener: null | { remove: () => void } = null;

  private animationMixer: THREE.AnimationMixer | null = null;
  private animAttributeAction: THREE.AnimationAction | null = null;
  private childAnimationActions = new Map<
    Animation<ThreeJSGraphicsAdapter>,
    THREE.AnimationAction
  >();

  private pendingAnim: string | null = null;
  private pendingAnimationUpdates = new Map<
    Animation<ThreeJSGraphicsAdapter>,
    ThreeJSAnimationState
  >();

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
    return !!this.animState?.appliedAnimation;
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

  setDebug(debug: boolean, mModelProps: MModelProps): void {
    this.updateDebugVisualisation();
  }

  setCastShadows(castShadows: boolean, mModelProps: MModelProps): void {
    if (this.loadedState) {
      this.loadedState.group.traverse((object) => {
        if ((object as THREE.Mesh).isMesh) {
          const mesh = object as THREE.Mesh;
          mesh.castShadow = castShadows;
        }
      });
    }
  }

  updateChildAnimation(
    animation: Animation<ThreeJSGraphicsAdapter>,
    animationState: ThreeJSAnimationState,
  ) {
    if (!this.animationMixer || !this.loadedState) {
      // queue if model isn't loaded yet
      this.pendingAnimationUpdates.set(animation, animationState);
      return;
    }
    let action = this.childAnimationActions.get(animation);

    if (!action && animationState && animationState.animationClip) {
      // filter out tracks that don't have corresponding bones
      const availableBones = Array.from(this.loadedState.bones.keys());
      const unavailableBones = [];
      const compatibleTracks = animationState.animationClip.tracks.filter(
        (track: THREE.KeyframeTrack) => {
          const trackName = track.name;
          const boneName = trackName.split(".")[0];
          const canBindTrack = availableBones.includes(boneName);
          if (!canBindTrack) {
            unavailableBones.push(boneName);
          }
          return canBindTrack;
        },
      );

      if (compatibleTracks.length === 0) {
        console.warn(
          `Animation "${animation.id}" has no tracks that can bind to the current model's bones. Skipping animation.`,
        );
        return;
      }

      const filteredClip = new THREE.AnimationClip(
        animationState.animationClip.name,
        animationState.animationClip.duration,
        compatibleTracks,
      );

      action = this.animationMixer.clipAction(filteredClip, this.loadedState.group);
      action.enabled = true;
      this.childAnimationActions.set(animation, action);
    }

    if (action) {
      if (animationState && animationState.weight !== undefined) {
        // Don't automatically start the action - timing control is handled in updateAnimation
        action.setEffectiveWeight(animationState.weight);
        // The action will be started/stopped based on timing in updateAnimation
      }
    }

    this.updateAnimationActions();

    // Trigger an immediate update to apply timing logic
    if (this.documentTimeTickListener) {
      const documentTime = this.model.getDocumentTime();
      this.updateAnimation(documentTime);
    }
  }

  removeChildAnimation(animation: Animation<ThreeJSGraphicsAdapter>) {
    if (!this.animationMixer || !this.loadedState) {
      this.pendingAnimationUpdates.delete(animation);
      return;
    }

    const action = this.childAnimationActions.get(animation);
    if (action) {
      action.stop();
      this.animationMixer.uncacheAction(action.getClip(), this.loadedState.group);
      this.childAnimationActions.delete(animation);
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
      // Child animations are controlled by updateAnimation method based on timing
      // This method is called when animations are added/removed, but timing control
      // is handled in updateAnimation during the document time tick
    }
  }

  setAnim(anim: string | null, mModelProps: MModelProps): void {
    this.resetAnimationMixer();
    this.animState = null;
    for (const [attachment, animState] of this.attachments) {
      if (animState) {
        animState.animationMixer.stopAllAction();
        this.attachments.set(attachment, null);
      }
    }

    if (!anim) {
      this.latestAnimPromise = null;
      this.animLoadingInstanceManager.abortIfLoading();

      // if the animation is removed then the model can be added to
      // the parent attachment if the model is loaded
      if (this.loadedState && !this.registeredParentAttachment) {
        const parent = this.model.parentElement;
        if (parent && Model.isModel(parent)) {
          this.registeredParentAttachment = parent as Model<ThreeJSGraphicsAdapter>;
          (parent.modelGraphics as ThreeJSModel).registerAttachment(this.model);
        }
      }

      // restore document time tick listener if model is loaded (for future child animations)
      if (this.loadedState && !this.documentTimeTickListener) {
        this.documentTimeTickListener = this.model.addDocumentTimeTickListener(
          (documentTime: number) => {
            this.updateAnimation(documentTime);
          },
        );
      }

      // update child animation actions to restore them
      this.updateAnimationActions();
      return;
    }

    if (this.registeredParentAttachment) {
      (this.registeredParentAttachment.modelGraphics as ThreeJSModel).unregisterAttachment(
        this.model,
      );
      this.registeredParentAttachment = null;
    }

    const animSrc = this.model.contentSrcToContentAddress(anim);
    this.animLoadingInstanceManager.start(this.model.getLoadingProgressManager(), animSrc);
    const animPromise = this.asyncLoadSourceAsset(animSrc, (loaded, total) => {
      if (this.latestAnimPromise !== animPromise) {
        return;
      }
      this.animLoadingInstanceManager.setProgress(loaded / total);
    });
    this.latestAnimPromise = animPromise;
    animPromise
      .then((result) => {
        if (this.latestAnimPromise !== animPromise || !this.model.isConnected) {
          return;
        }
        this.latestAnimPromise = null;
        this.playAnimation(result.animations[0]);

        for (const [model] of this.attachments) {
          this.registerAttachment(model);
        }

        this.animLoadingInstanceManager.finish();
      })
      .catch((err) => {
        console.error("Error loading m-model.anim", err);
        this.latestAnimPromise = null;
        this.animLoadingInstanceManager.error(err);
      });
  }

  setAnimEnabled(animEnabled: boolean | null, mModelProps: MModelProps): void {
    if (this.model.props.animEnabled) {
      if (this.animState && !this.animState.appliedAnimation) {
        for (const [attachment] of this.attachments) {
          this.registerAttachment(attachment);
        }
        this.playAnimation(this.animState.currentAnimationClip);
      }
    } else if (!this.model.props.animEnabled) {
      for (const [attachment, animState] of this.attachments) {
        if (animState) {
          animState.animationMixer.stopAllAction();
        }
        this.attachments.set(attachment, null);
        this.model.getContainer().add(attachment.getContainer());
      }
    }
  }

  setAnimLoop(animLoop: boolean | null, mModelProps: MModelProps): void {
    // no-op - property is observed in animation tick
  }

  setAnimStartTime(animStartTime: number | null, mModelProps: MModelProps): void {
    // no-op - property is observed in animation tick
  }

  setAnimPauseTime(animPauseTime: number | null, mModelProps: MModelProps): void {
    // no-op - property is observed in animation tick
  }

  transformed(): void {
    // no-op
  }

  setSrc(src: string | null, mModelProps: MModelProps): void {
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
          if (!this.latestAnimPromise && !this.animState) {
            this.registeredParentAttachment = parent as Model<ThreeJSGraphicsAdapter>;
            (parent.modelGraphics as ThreeJSModel).registerAttachment(this.model);
          }
        }

        if (this.animState) {
          this.playAnimation(this.animState.currentAnimationClip);
        }
        this.srcLoadingInstanceManager.finish();
        this.updateDebugVisualisation();

        this.applyPendingAnimation();

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

  public registerAttachment(attachment: Model<ThreeJSGraphicsAdapter>) {
    let animState = null;
    if (this.animState) {
      const attachmentLoadedState = (attachment.modelGraphics as ThreeJSModel).loadedState;
      if (!attachmentLoadedState) {
        throw new Error("Attachment must be loaded before registering");
      }
      const animationGroup = new THREE.AnimationObjectGroup();
      const animationMixer = new THREE.AnimationMixer(animationGroup);
      const action = animationMixer.clipAction(this.animState.currentAnimationClip);
      animState = {
        animationGroup,
        animationMixer,
        animationAction: action,
      };
      animationGroup.add(attachmentLoadedState.group);
      action.play();
    }
    this.attachments.set(attachment, animState);
  }

  public unregisterAttachment(attachment: Model<ThreeJSGraphicsAdapter>) {
    const attachmentState = this.attachments.get(attachment);
    if (attachmentState) {
      attachmentState.animationMixer.stopAllAction();
    }
    this.attachments.delete(attachment);
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

  private resetAnimationMixer() {
    if (this.documentTimeTickListener) {
      this.documentTimeTickListener.remove();
      this.documentTimeTickListener = null;
    }
    if (this.animState) {
      const appliedAnimation = this.animState.appliedAnimation;
      if (appliedAnimation) {
        appliedAnimation.animationMixer.stopAllAction();
      }
      this.animState.appliedAnimation = null;
    }
    // Clear anim attribute action when resetting
    if (this.animAttributeAction) {
      this.animAttributeAction.stop();
      if (this.loadedState && this.animationMixer) {
        this.animationMixer.uncacheAction(
          this.animAttributeAction.getClip(),
          this.loadedState.group,
        );
      }
      this.animAttributeAction = null;
    }
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

  private playAnimation(anim: THREE.AnimationClip) {
    this.resetAnimationMixer();
    this.animState = {
      currentAnimationClip: anim,
      appliedAnimation: null,
    };
    const animationGroup = new THREE.AnimationObjectGroup();
    const animationMixer = new THREE.AnimationMixer(animationGroup);
    const action = animationMixer.clipAction(anim);
    this.animState.appliedAnimation = {
      animationGroup,
      animationMixer,
      animationAction: action,
    };
    if (this.loadedState) {
      animationGroup.add(this.loadedState.group);
    }
    action.play();
    if (!this.documentTimeTickListener) {
      this.documentTimeTickListener = this.model.addDocumentTimeTickListener(
        (documentTime: number) => {
          this.updateAnimation(documentTime);
        },
      );
    }
  }

  private updateAnimation(docTimeMs: number, force: boolean = false) {
    if (this.animState) {
      if (!this.model.props.animEnabled && this.animState.appliedAnimation) {
        this.resetAnimationMixer();
        this.triggerSocketedChildrenTransformed();
      } else {
        if (!this.animState.appliedAnimation) {
          this.playAnimation(this.animState.currentAnimationClip);
        }
        let animationTimeMs = docTimeMs - this.model.props.animStartTime;
        if (docTimeMs < this.model.props.animStartTime) {
          animationTimeMs = 0;
        } else if (this.model.props.animPauseTime !== null) {
          if (docTimeMs > this.model.props.animPauseTime) {
            animationTimeMs = this.model.props.animPauseTime - this.model.props.animStartTime;
          }
        }

        const clip = this.animState.currentAnimationClip;
        if (clip !== null) {
          if (!this.model.props.animLoop) {
            if (animationTimeMs > clip.duration * 1000) {
              animationTimeMs = clip.duration * 1000;
            }
          }
        }

        for (const [model, attachmentState] of this.attachments) {
          if (attachmentState) {
            attachmentState.animationMixer.setTime(animationTimeMs / 1000);
            (model.modelGraphics as ThreeJSModel).triggerSocketedChildrenTransformed();
          }
        }

        if (force) {
          this.animState.appliedAnimation?.animationMixer.setTime((animationTimeMs + 1) / 1000);
        }
        this.animState.appliedAnimation?.animationMixer.setTime(animationTimeMs / 1000);
        this.triggerSocketedChildrenTransformed();
      }
    } else if (this.animationMixer) {
      // Handle child animations
      if (this.model.props.animEnabled) {
        // Update each child animation based on its individual timing properties
        for (const [animation, action] of this.childAnimationActions) {
          const animationState = (animation.animationGraphics as ThreeJSAnimation)?.getAnimationState();
          if (animationState && action) {
            // Check if this animation should be active based on timing
            let shouldBeActive = true;
            let animationTimeMs = 0;

            // Handle start time - animation doesn't start until start time
            if (docTimeMs < animationState.startTime) {
              shouldBeActive = false;
            } else {
              animationTimeMs = docTimeMs - animationState.startTime;
            }

            // Handle pause time - animation stops at pause time
            if (shouldBeActive && animationState.pauseTime !== null) {
              if (docTimeMs > animationState.pauseTime) {
                shouldBeActive = false; // Stop the animation when pause time is reached
              }
            }

            // Handle loop and duration
            if (shouldBeActive && animationState.animationClip) {
              if (!animationState.loop) {
                if (animationTimeMs > animationState.animationClip.duration * 1000) {
                  animationTimeMs = animationState.animationClip.duration * 1000;
                  shouldBeActive = false; // Stop the animation when it reaches the end
                }
              }
            }

            // Control the action based on timing
            if (shouldBeActive) {
              action.enabled = true;
              action.setEffectiveWeight(animationState.weight);
              if (animationState.weight > 0) {
                action.play();
              } else {
                action.stop();
              }
            } else {
              action.enabled = false;
              action.stop();
            }
          }
        }

        // Check if any animations are active
        let hasActiveAnimations = false;
        for (const [, action] of this.childAnimationActions) {
          if (action.enabled) {
            hasActiveAnimations = true;
            break;
          }
        }

        if (hasActiveAnimations) {
          // Set the mixer time to the current document time for proper blending
          const documentTime = this.model.getDocumentTime();
          const animationTime = documentTime / 1000;
          this.animationMixer.setTime(animationTime);
        } else {
          // No active animations, stop all actions and reset to t-pose
          this.animationMixer.stopAllAction();
          this.animationMixer.setTime(0);
        }

        this.triggerSocketedChildrenTransformed();
      } else {
        this.animationMixer.stopAllAction();
      }
    }
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
