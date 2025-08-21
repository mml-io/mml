import { Animation, MElement, MModelProps, Model, TransformableElement } from "@mml-io/mml-web";
import { ModelGraphics } from "@mml-io/mml-web";
import { LoadingInstanceManager } from "@mml-io/mml-web";
import { IVect3 } from "@mml-io/mml-web";
import { ModelLoader, ModelLoadResult } from "@mml-io/model-loader";
import * as THREE from "three";

import { ThreeJSGraphicsAdapter } from "../ThreeJSGraphicsAdapter";
import { ThreeJSAnimationState } from "./ThreeJSAnimation";

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

function createFilteredClip(clip: THREE.AnimationClip, bones: Map<string, THREE.Bone>): THREE.AnimationClip {
  // filter out tracks that don't have corresponding bones
  const availableBones = Array.from(bones.keys());
  const unavailableBones = [];
  const compatibleTracks = clip.tracks.filter(
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

  const filteredClip = new THREE.AnimationClip(
    clip.name,
    clip.duration,
    compatibleTracks,
  );

  return filteredClip;
}

type AttachmentAnimState = {
  directAnimation: {
    animationMixer: THREE.AnimationMixer | null;
    animationAction: THREE.AnimationAction | null;
  } | null,
  childAnimations: {
    animationMixer: THREE.AnimationMixer;
    animations: Map<Animation<ThreeJSGraphicsAdapter>, {
      action: THREE.AnimationAction | null;
      clip: THREE.AnimationClip | null;
      animationState: ThreeJSAnimationState;
    }>;
  },
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
    AttachmentAnimState
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

  private documentTimeTickListener: null | { remove: () => void; } = null;

  private childAnimationMixer: THREE.AnimationMixer | null = null;
  private childAnimations = new Map<
    Animation<ThreeJSGraphicsAdapter>,
    {
      action: THREE.AnimationAction | null;
      clip: THREE.AnimationClip | null;
      animationState: ThreeJSAnimationState;
    }
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

  disable(): void { }

  enable(): void { }

  getBoundingBox(): { centerOffset: IVect3; size: IVect3; } | null {
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
    let childAnimation = this.childAnimations.get(animation);

    if (!this.childAnimationMixer || !this.loadedState) {
      this.childAnimations.set(animation, {
        action: null,
        clip: null,
        animationState,
      });
    } else {
      if (childAnimation && childAnimation.action && childAnimation.clip !== animationState.animationClip) {
        // if the animation clip has changed, stop the old action and dispose it
        childAnimation.action.stop();
        this.childAnimationMixer.uncacheAction(childAnimation.action.getClip(), this.loadedState.group);
        childAnimation.action = null;
        childAnimation = undefined;
      }

      if (!childAnimation) {
        childAnimation = {
          action: null,
          clip: null,
          animationState,
        };
        this.childAnimations.set(animation, childAnimation);
      } else {
        childAnimation.animationState = animationState;
      }

      if (!childAnimation.action && animationState && animationState.animationClip) {
        const filteredClip = createFilteredClip(animationState.animationClip, this.loadedState.bones);
        const action = this.childAnimationMixer.clipAction(filteredClip, this.loadedState.group);
        action.enabled = true;
        this.childAnimations.set(animation, {
          action,
          clip: animationState.animationClip,
          animationState,
        });
      }
    }

    for (const [attachment, attachmentAnimState] of this.attachments) {
      this.updateAnimationForAttachment(attachment, attachmentAnimState, animation, animationState);
    }

    const documentTime = this.model.getDocumentTime();
    this.updateAnimation(documentTime);
  }

  private updateAnimationForAttachment(attachment: Model<ThreeJSGraphicsAdapter>, attachmentAnimState: AttachmentAnimState, animation: Animation<ThreeJSGraphicsAdapter>, animationState: ThreeJSAnimationState) {
    let attachmentChildAnimation = attachmentAnimState.childAnimations.animations.get(animation);
    const attachmentChildAnimationMixer = attachmentAnimState.childAnimations.animationMixer;

    const attachmentLoadedState = (attachment.modelGraphics as ThreeJSModel).loadedState;
    if (!attachmentLoadedState) {
      throw new Error("Attachment must be loaded before registering");
    }

    if (attachmentChildAnimation && attachmentChildAnimation.action && attachmentChildAnimation.clip !== animationState.animationClip) {
      // if the animation clip has changed, stop the old action and dispose it
      attachmentChildAnimation.action.stop();
      attachmentChildAnimationMixer.uncacheAction(attachmentChildAnimation.clip!, attachmentLoadedState.group);
      attachmentChildAnimation.action = null;
      attachmentChildAnimation = undefined;
    }

    if (!attachmentChildAnimation) {
      attachmentChildAnimation = {
        action: null,
        clip: null,
        animationState,
      };
      attachmentAnimState.childAnimations.animations.set(animation, attachmentChildAnimation);
    } else {
      attachmentChildAnimation.animationState = animationState;
    }

    if (!attachmentChildAnimation.action && animationState && animationState.animationClip) {
      const filteredClip = createFilteredClip(animationState.animationClip, attachmentLoadedState.bones);
      const action = attachmentChildAnimationMixer.clipAction(filteredClip, attachmentLoadedState.group);
      action.enabled = true;
      action.play();
      attachmentAnimState.childAnimations.animations.set(animation, {
        action,
        clip: animationState.animationClip,
        animationState,
      });
    }
  }

  removeChildAnimation(animation: Animation<ThreeJSGraphicsAdapter>) {
    const childAnimation = this.childAnimations.get(animation);
    if (childAnimation) {
      const action = childAnimation.action;
      if (action) {
        action.stop();
        if (this.childAnimationMixer && this.loadedState) {
          this.childAnimationMixer.uncacheAction(action.getClip(), this.loadedState.group);
        }
      }
      this.childAnimations.delete(animation);

      for (const [attachment, attachmentAnimState] of this.attachments) {
        this.removeAnimationForAttachment(attachment, attachmentAnimState, animation);
      }
    }
  }

  private removeAnimationForAttachment(attachment: Model<ThreeJSGraphicsAdapter>, attachmentAnimState: AttachmentAnimState, animation: Animation<ThreeJSGraphicsAdapter>) {
    const attachmentChildAnimation = attachmentAnimState.childAnimations.animations.get(animation);
    if (attachmentChildAnimation) {
      const action = attachmentChildAnimation.action;
      if (action) {
        action.stop();
        const attachmentLoadedState = (attachment.modelGraphics as ThreeJSModel).loadedState;
        if (attachmentLoadedState) {
          attachmentAnimState.childAnimations.animationMixer.uncacheAction(action.getClip(), attachmentLoadedState.group);
        }
        attachmentChildAnimation.action = null;
      }
    }
    attachmentAnimState.childAnimations.animations.delete(animation);
  }

  setAnim(anim: string | null, mModelProps: MModelProps): void {
    this.resetAnimationMixer();
    this.animState = null;
    for (const [attachment, attachmentAnimState] of this.attachments) {
      if (attachmentAnimState) {
        attachmentAnimState.directAnimation?.animationMixer?.stopAllAction();
        
        // Reset attachment to default pose by clearing all animations and updating mixer
        if (attachmentAnimState.directAnimation?.animationMixer) {
          attachmentAnimState.directAnimation.animationMixer.update(0);
        }
        
        // Also reset the child animation mixer to ensure clean state
        attachmentAnimState.childAnimations.animationMixer.stopAllAction();
        attachmentAnimState.childAnimations.animationMixer.update(0);
        
        attachmentAnimState.directAnimation = null;
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
      
      // Restore child animations for all attachments when anim attribute is removed
      for (const [attachment, attachmentAnimState] of this.attachments) {
        for (const [animation, childAnimation] of this.childAnimations) {
          this.updateAnimationForAttachment(attachment, attachmentAnimState, animation, childAnimation.animationState);
        }
      }
      
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
        const animationClip = result.animations[0];
        if (this.loadedState) {
          const filteredClip = createFilteredClip(animationClip, this.loadedState.bones);
          this.playAnimation(filteredClip);
        } else {
          this.playAnimation(animationClip);
        }

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

  setAnimEnabled(): void {
    if (this.model.props.animEnabled) {
      if (this.animState && !this.animState.appliedAnimation) {
        for (const [attachment] of this.attachments) {
          this.registerAttachment(attachment);
        }
        this.playAnimation(this.animState.currentAnimationClip);
      }
    } else if (!this.model.props.animEnabled) {
      for (const [attachment, attachmentAnimState] of this.attachments) {
        if (attachmentAnimState) {
          attachmentAnimState.directAnimation?.animationMixer?.stopAllAction();
          
          // Reset attachment to default pose by clearing all animations and updating mixer
          if (attachmentAnimState.directAnimation?.animationMixer) {
            attachmentAnimState.directAnimation.animationMixer.update(0);
          }
          
          // Also reset the child animation mixer to ensure clean state
          attachmentAnimState.childAnimations.animationMixer.stopAllAction();
          attachmentAnimState.childAnimations.animationMixer.update(0);
          
          attachmentAnimState.directAnimation = null;
        }
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
    if (this.childAnimationMixer) {
      this.childAnimationMixer.stopAllAction();
      this.childAnimationMixer = null;
    }
    for (const [, childAnimation] of this.childAnimations) {
      // The actions will need to be recreated when the new model is loaded
      childAnimation.action?.stop();
      childAnimation.action = null;
    }

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

        this.childAnimationMixer = new THREE.AnimationMixer(group);

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

        for (const [animation, childAnimation] of this.childAnimations) {
          this.updateChildAnimation(animation, childAnimation.animationState);
        }
      })
      .catch((err) => {
        console.error("Error loading m-model.src", err);
        this.srcLoadingInstanceManager.error(err);
      });
  }

  public registerAttachment(attachment: Model<ThreeJSGraphicsAdapter>) {
    const childAnimationGroup = new THREE.AnimationObjectGroup();
    const childAnimationMixer = new THREE.AnimationMixer(childAnimationGroup);
    let animState: AttachmentAnimState = {
      directAnimation: null,
      childAnimations: {
        animationMixer: childAnimationMixer,
        animations: new Map(),
      },
    };

    for (const [animation, childAnimation] of this.childAnimations) {
      this.updateAnimationForAttachment(attachment, animState, animation, childAnimation.animationState);
    }

    if (this.animState) {
      // There is an existing animation specified on the model itself
      const attachmentLoadedState = (attachment.modelGraphics as ThreeJSModel).loadedState;
      if (!attachmentLoadedState) {
        throw new Error("Attachment must be loaded before registering");
      }
      const animationGroup = new THREE.AnimationObjectGroup();
      const animationMixer = new THREE.AnimationMixer(animationGroup);
      const action = animationMixer.clipAction(this.animState.currentAnimationClip);
      animState.directAnimation = {
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
      if (attachmentState.directAnimation) {
        attachmentState.directAnimation.animationMixer?.stopAllAction();
      }
      attachmentState.childAnimations.animationMixer.stopAllAction();
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

        for (const [model, attachmentAnimState] of this.attachments) {
          if (attachmentAnimState.directAnimation) {
            attachmentAnimState.directAnimation.animationMixer?.setTime(animationTimeMs / 1000);
            (model.modelGraphics as ThreeJSModel).triggerSocketedChildrenTransformed();
          }
        }

        if (force) {
          this.animState.appliedAnimation?.animationMixer.setTime((animationTimeMs + 1) / 1000);
        }
        this.animState.appliedAnimation?.animationMixer.setTime(animationTimeMs / 1000);
        this.triggerSocketedChildrenTransformed();
      }
    } else if (this.childAnimationMixer) {
      // Handle child animations
      if (this.model.props.animEnabled) {
        
        // Map of animation to animationTimeMs | null
        const animationTimes = new Map<Animation<ThreeJSGraphicsAdapter>, number>();

        let hasActiveAnimations = false;

        // Update each child animation based on its individual timing properties
        for (const [animation, childAnimation] of this.childAnimations) {
          const animationState = childAnimation.animationState;
          const action = childAnimation.action;
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

            const durationMs = (animationState.animationClip?.duration ?? 1) * 1000;

            animationTimeMs = animationTimeMs * animationState.speed;

            if (animationState.ratio !== null) {
              animationTimeMs = animationState.ratio * durationMs;
            }

            // Handle loop and duration
            if (shouldBeActive && animationState.animationClip) {
              if (!animationState.loop) {
                if (animationTimeMs > durationMs) {
                  animationTimeMs = durationMs;
                  shouldBeActive = false; // Stop the animation when it reaches the end
                }
              }
            }

            // Control the action based on timing
            if (shouldBeActive) {
              animationTimes.set(animation, animationTimeMs);
              action.enabled = true;
              action.setEffectiveWeight(animationState.weight);
              if (animationState.weight > 0) {
                hasActiveAnimations = true;
                action.play();
              } else {
                action.stop();
              }
              action.time = (animationTimeMs % durationMs) / 1000;
            } else {
              action.enabled = false;
              action.stop();
            }
          }
        }

        if (!hasActiveAnimations) {
          // No active animations, stop all actions and reset to t-pose
          this.childAnimationMixer.stopAllAction();
        }
        this.childAnimationMixer.update(0);

        for (const [attachment, attachmentAnimState] of this.attachments) {
          for (const [animation, childAnimation] of attachmentAnimState.childAnimations.animations) {
            const animationTimeMs = animationTimes.get(animation);
            const action = childAnimation.action;
            if (action) {
              if (animationTimeMs !== undefined) {
                action.enabled = true;
                action.setEffectiveWeight(childAnimation.animationState.weight);
                if (childAnimation.animationState.weight > 0) {
                  action.play();
                } else {
                  action.stop();
                }
                action.time = animationTimeMs / 1000;
              } else {
                action.enabled = false;
                action.stop();
              }
            }
          }

          if (!hasActiveAnimations) {
            attachmentAnimState.childAnimations.animationMixer.stopAllAction();
          }
          attachmentAnimState.childAnimations.animationMixer.update(0.000000001);
        }


        this.triggerSocketedChildrenTransformed();
      } else {
        this.childAnimationMixer.stopAllAction();
      }
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

    if (this.childAnimationMixer) {
      this.childAnimationMixer.stopAllAction();
      this.childAnimationMixer = null;
    }
    this.childAnimations.clear();
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
