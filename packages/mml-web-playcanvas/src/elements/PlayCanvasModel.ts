import {
  Animation,
  IVect3,
  LoadingInstanceManager,
  MElement,
  MModelProps,
  Model,
  ModelGraphics,
  TransformableElement,
} from "@mml-io/mml-web";
import * as playcanvas from "playcanvas";

import { createPlayCanvasDebugBoundingBox } from "../debug-bounding-box/PlayCanvasDebugBoundingBox";
import { PlayCanvasGraphicsAdapter } from "../PlayCanvasGraphicsAdapter";
import { createDefaultPoseClip } from "./playcanvas-model-utils/create-default-pose-anim";
import { PlayCanvasAnimationState } from "./PlayCanvasAnimation";

type PlayCanvasModelLoadState = {
  renderEntity: playcanvas.Entity;
  boundingBox: playcanvas.BoundingBox;
  collisionWorldScale: IVect3;
  bones: Map<string, playcanvas.GraphNode>;
};

type PlayCanvasAnimLoadState = {
  animAsset: playcanvas.Asset;
  animComponent: playcanvas.AnimComponent | null;
};

type PlayCanvasChildAnimationState = {
  animationAsset: playcanvas.Asset;
  animClip: playcanvas.AnimClip | null;
  animationState: PlayCanvasAnimationState;
  clipName: string;
};

type AttachmentAnimState = {
  directAnimation: {
    animComponent: playcanvas.AnimComponent;
  } | null;
  childAnimations: {
    directAnimationSystem: {
      evaluator: playcanvas.AnimEvaluator;
      binder: playcanvas.DefaultAnimBinder;
      defaultPoseClip: playcanvas.AnimClip;
    } | null;
    animations: Map<
      Animation<PlayCanvasGraphicsAdapter>,
      {
        animClip: playcanvas.AnimClip | null;
        animationState: PlayCanvasAnimationState;
        animationAsset: playcanvas.Asset | null;
        clipName: string;
      }
    >;
  };
};

export class PlayCanvasModel extends ModelGraphics<PlayCanvasGraphicsAdapter> {
  private srcLoadingInstanceManager = new LoadingInstanceManager(`${Model.tagName}.src`);
  private animLoadingInstanceManager = new LoadingInstanceManager(`${Model.tagName}.anim`);
  private latestSrcModelPromise: Promise<playcanvas.Asset> | null = null;

  private debugMaterial: playcanvas.BasicMaterial | null = null;

  private latestAnimPromise: Promise<playcanvas.Asset> | null = null;
  private documentTimeTickListener: null | { remove: () => void } = null;

  private attachments = new Map<Model<PlayCanvasGraphicsAdapter>, AttachmentAnimState>();
  private registeredParentAttachment: Model<PlayCanvasGraphicsAdapter> | null = null;

  private childAnimationActions = new Map<
    Animation<PlayCanvasGraphicsAdapter>,
    PlayCanvasChildAnimationState
  >();
  private pendingAnimationUpdates = new Map<
    Animation<PlayCanvasGraphicsAdapter>,
    PlayCanvasAnimationState
  >();

  private directAnimationSystem: {
    evaluator: playcanvas.AnimEvaluator;
    binder: playcanvas.DefaultAnimBinder;
    defaultPoseClip: playcanvas.AnimClip;
  } | null = null;

  private animAttributeComponent: playcanvas.AnimComponent | null = null; // For anim attribute only
  private pendingAnim: string | null = null; // For pending anim attribute

  private socketChildrenByBone = new Map<string, Set<MElement<PlayCanvasGraphicsAdapter>>>();

  private debugBoundingBox: playcanvas.Entity | null = null;

  protected loadedState: PlayCanvasModelLoadState | null = null;
  protected animState: PlayCanvasAnimLoadState | null = null;

  constructor(
    private model: Model<PlayCanvasGraphicsAdapter>,
    private updateMeshCallback: () => void,
  ) {
    super(model, updateMeshCallback);
  }

  private getPlayCanvasApp(): playcanvas.AppBase {
    return this.model.getScene().getGraphicsAdapter().getPlayCanvasApp();
  }

  private setupDirectAnimationSystem(
    renderEntity: playcanvas.Entity,
    bones: Map<string, playcanvas.GraphNode>,
  ): void {
    const binder = new playcanvas.DefaultAnimBinder(renderEntity);
    const evaluator = new playcanvas.AnimEvaluator(binder);

    const defaultPoseClip = createDefaultPoseClip(renderEntity, bones);
    evaluator.addClip(defaultPoseClip);
    defaultPoseClip.play();

    this.directAnimationSystem = {
      binder,
      evaluator,
      defaultPoseClip,
    };
  }

  hasLoadedModel(): boolean {
    return !!this.loadedState?.renderEntity;
  }

  hasLoadedAnimation(): boolean {
    return !!this.animState?.animAsset;
  }

  disable(): void {}

  enable(): void {}

  getCollisionElement(): playcanvas.Entity {
    return this.model.getContainer();
  }

  setDebug(): void {
    this.updateDebugVisualisation();
  }

  setCastShadows(): void {
    // TODO: Implement shadow casting for PlayCanvas
  }

  public registerAttachment(attachment: Model<PlayCanvasGraphicsAdapter>) {
    const attachmentLoadedState = (attachment.modelGraphics as PlayCanvasModel).loadedState;
    if (!attachmentLoadedState) {
      throw new Error("Attachment must be loaded before registering");
    }

    // Set up child animation system for the attachment
    const attachmentRenderEntity = attachmentLoadedState.renderEntity;
    const binder = new playcanvas.DefaultAnimBinder(attachmentRenderEntity);
    const evaluator = new playcanvas.AnimEvaluator(binder);
    const defaultPoseClip = createDefaultPoseClip(
      attachmentRenderEntity,
      attachmentLoadedState.bones,
    );
    evaluator.addClip(defaultPoseClip);
    defaultPoseClip.play();

    const attachmentDirectAnimationSystem = {
      binder,
      evaluator,
      defaultPoseClip,
    };

    const animState: AttachmentAnimState = {
      directAnimation: null,
      childAnimations: {
        directAnimationSystem: attachmentDirectAnimationSystem,
        animations: new Map(),
      },
    };

    // Set up existing child animations for this attachment
    for (const [animation, childAnimation] of this.childAnimationActions) {
      this.updateAnimationForAttachment(
        attachment,
        animState,
        animation,
        childAnimation.animationState,
      );
    }

    // Handle direct animation (anim attribute) if it exists
    if (this.animState) {
      const animComponent = attachmentRenderEntity.addComponent(
        "anim",
        {},
      ) as playcanvas.AnimComponent;
      animComponent.assignAnimation("SingleAnimation", this.animState.animAsset.resource);
      animState.directAnimation = {
        animComponent,
      };
    }

    this.attachments.set(attachment, animState);
  }

  public unregisterAttachment(attachment: Model<PlayCanvasGraphicsAdapter>) {
    const attachmentState = this.attachments.get(attachment);
    if (attachmentState) {
      // Clean up direct animation
      if (attachmentState.directAnimation) {
        attachmentState.directAnimation.animComponent.reset();
        attachmentState.directAnimation.animComponent.unbind();
        attachmentState.directAnimation.animComponent.entity.removeComponent("anim");
      }

      // Clean up child animations
      if (attachmentState.childAnimations.directAnimationSystem) {
        // Stop all clips in the evaluator
        if (attachmentState.childAnimations.directAnimationSystem.evaluator.clips) {
          for (const clip of attachmentState.childAnimations.directAnimationSystem.evaluator
            .clips) {
            clip.stop();
          }
        }
      }
      attachmentState.childAnimations.animations.clear();
    }
    this.attachments.delete(attachment);
  }

  getBoundingBox(): { centerOffset: IVect3; size: IVect3 } | null {
    if (this.loadedState) {
      return {
        centerOffset: this.loadedState.boundingBox.center,
        size: this.loadedState.boundingBox.halfExtents,
      };
    }
    return null;
  }

  setAnim(anim: string | null): void {
    // Clean up existing anim state
    if (this.animState) {
      if (this.animState.animComponent) {
        this.animState.animComponent.reset();
        this.animState.animComponent.unbind();
        this.animState.animComponent.entity.removeComponent("anim");
      }
      this.animState = null;

      // Clean up attachments - only clean up direct animation, preserve child animations
      for (const [attachment, animState] of this.attachments) {
        if (animState && animState.directAnimation) {
          // Clean up the direct animation component
          animState.directAnimation.animComponent.reset();
          animState.directAnimation.animComponent.unbind();
          animState.directAnimation.animComponent.entity.removeComponent("anim");
          animState.directAnimation = null;
        }
      }
    }

    // Clear anim attribute component when resetting
    if (this.animAttributeComponent) {
      this.animAttributeComponent.reset();
      this.animAttributeComponent.unbind();
      this.animAttributeComponent.entity.removeComponent("anim");
      this.animAttributeComponent = null;
    }

    if (!anim) {
      this.latestAnimPromise = null;
      this.animLoadingInstanceManager.abortIfLoading();
      this.pendingAnim = null;

      // if the animation is removed then the model can be added to
      // the parent attachment if the model is loaded
      if (this.loadedState && !this.registeredParentAttachment) {
        const parent = this.model.parentElement;
        if (parent && Model.isModel(parent)) {
          this.registeredParentAttachment = parent as Model<PlayCanvasGraphicsAdapter>;
          (parent.modelGraphics as PlayCanvasModel).registerAttachment(this.model);
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

    // Store the pending animation
    this.pendingAnim = anim;

    // If the model is not loaded yet, wait for it
    if (!this.loadedState) {
      return;
    }

    // Apply the pending animation
    this.applyPendingAnimation();
  }

  setAnimEnabled(): void {
    if (this.model.props.animEnabled) {
      // When re-enabling animation, restore attachments if we have an anim state
      if (this.animState && this.animAttributeComponent) {
        for (const [attachment] of this.attachments) {
          this.registerAttachment(attachment);
        }
      }
    } else if (!this.model.props.animEnabled) {
      // When disabling animation, only clean up direct animations, preserve child animations
      // Child animation enabling/disabling is handled in updateAnimation method
      for (const [attachment, animState] of this.attachments) {
        if (animState && animState.directAnimation) {
          // Clean up the direct animation component
          animState.directAnimation.animComponent.reset();
          animState.directAnimation.animComponent.unbind();
          animState.directAnimation.animComponent.entity.removeComponent("anim");
          animState.directAnimation = null;
        }
      }
    }
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

  private connectAnimationToModel() {
    if (!this.animState || !this.loadedState || !this.loadedState.renderEntity) {
      console.warn("connectAnimationToModel: Missing required state", {
        hasAnimState: !!this.animState,
        hasLoadedState: !!this.loadedState,
        hasRenderEntity: !!this.loadedState?.renderEntity,
      });
      return;
    }

    try {
      const playcanvasEntity = this.loadedState.renderEntity;

      // Clean up any existing anim component to avoid conflicts
      if (playcanvasEntity.anim) {
        playcanvasEntity.anim.reset();
        playcanvasEntity.anim.unbind();
        playcanvasEntity.removeComponent("anim");
      }

      // Create new anim component for the anim attribute
      const animComponent = playcanvasEntity.addComponent("anim", {}) as playcanvas.AnimComponent;

      if (!animComponent) {
        console.error("connectAnimationToModel: Failed to create anim component");
        return;
      }

      animComponent.assignAnimation("SingleAnimation", this.animState.animAsset.resource);
      this.animState.animComponent = animComponent;
      this.animAttributeComponent = animComponent; // Set the dedicated anim attribute component
    } catch (error) {
      console.error("Error in connectAnimationToModel:", error);
    }
  }

  private applyPendingAnimation() {
    if (!this.loadedState || !this.loadedState.renderEntity || this.pendingAnim === undefined) {
      console.warn("applyPendingAnimation: Not ready", {
        hasLoadedState: !!this.loadedState,
        hasRenderEntity: !!this.loadedState?.renderEntity,
        pendingAnim: this.pendingAnim,
      });
      return;
    }

    const anim = this.pendingAnim;
    this.pendingAnim = null;

    // Clean up existing anim state
    if (this.animState) {
      if (this.animState.animComponent) {
        this.animState.animComponent.reset();
        this.animState.animComponent.unbind();
        this.animState.animComponent.entity.removeComponent("anim");
      }
      this.animState = null;
    }

    // If anim is not set, restore child animations
    if (!anim) {
      // Ensure document time tick listener is set up for child animations
      if (this.childAnimationActions.size > 0 && !this.documentTimeTickListener) {
        this.documentTimeTickListener = this.model.addDocumentTimeTickListener(
          (documentTime: number) => {
            this.updateAnimation(documentTime);
          },
        );
      }

      this.updateAnimationActions();
      return;
    }

    // Load and apply the animation
    if (!this.model.isConnected) {
      console.warn("applyPendingAnimation: Model not connected, skipping");
      return;
    }

    const animSrc = this.model.contentSrcToContentAddress(anim);
    const animPromise = this.asyncLoadAnimAsset(animSrc, (loaded, total) => {
      this.animLoadingInstanceManager.setProgress(loaded / total);
    });
    this.animLoadingInstanceManager.start(this.model.getLoadingProgressManager(), anim);
    this.latestAnimPromise = animPromise;
    animPromise
      .then((asset) => {
        if (
          this.latestAnimPromise !== animPromise ||
          !this.model.isConnected ||
          !this.loadedState
        ) {
          console.warn("applyPendingAnimation: Promise resolved but conditions not met", {
            latestAnimPromise: this.latestAnimPromise,
            animPromise,
            isConnected: this.model.isConnected,
            hasLoadedState: !!this.loadedState,
          });
          return;
        }
        this.latestAnimPromise = null;

        // Set up the anim state
        this.animState = {
          animAsset: asset,
          animComponent: null,
        };

        // Connect the animation to the model
        if (this.animState) {
          this.connectAnimationToModel();
        }

        // Ensure updateAnimation is called AFTER animAttributeComponent is set
        if (this.documentTimeTickListener) {
          const documentTime = this.model.getDocumentTime();
          this.updateAnimation(documentTime);
        }

        // Set up attachments
        for (const [attachment] of this.attachments) {
          const attachmentState = this.attachments.get(attachment);
          if (attachmentState) {
            const playcanvasEntity = attachment.getContainer() as playcanvas.Entity;

            // Check if entity already has an anim component
            let animComponent = playcanvasEntity.anim;
            if (!animComponent) {
              animComponent = playcanvasEntity.addComponent("anim", {}) as playcanvas.AnimComponent;
            }

            if (animComponent) {
              animComponent.assignAnimation("SingleAnimation", this.animState.animAsset.resource);
              // Update the existing attachment state's directAnimation property
              attachmentState.directAnimation = {
                animComponent,
              };
            } else {
              console.warn("Failed to create anim component for attachment");
            }
          }
        }

        // Set up document time tick listener for anim attribute
        if (!this.documentTimeTickListener) {
          this.documentTimeTickListener = this.model.addDocumentTimeTickListener(
            (documentTime: number) => {
              this.updateAnimation(documentTime);
            },
          );
        }

        // Stop all child animations when anim attribute is set
        this.updateAnimationActions();

        this.animLoadingInstanceManager.finish();
      })
      .catch((err) => {
        console.error("Error loading m-model.anim", err);
        this.animLoadingInstanceManager.error(err);
      });
  }

  public registerSocketChild(
    child: TransformableElement<PlayCanvasGraphicsAdapter>,
    socketName: string,
  ): void {
    let children = this.socketChildrenByBone.get(socketName);
    if (!children) {
      children = new Set<MElement<PlayCanvasGraphicsAdapter>>();
      this.socketChildrenByBone.set(socketName, children);
    }
    children.add(child);

    if (this.loadedState) {
      const bone = this.loadedState.bones.get(socketName);
      if (bone) {
        bone.addChild(child.getContainer());
      } else {
        this.model.getContainer().addChild(child.getContainer());
      }
    }
  }

  public unregisterSocketChild(
    child: TransformableElement<PlayCanvasGraphicsAdapter>,
    socketName: string,
    addToRoot: boolean = true,
  ): void {
    const socketChildren = this.socketChildrenByBone.get(socketName);
    if (socketChildren) {
      socketChildren.delete(child);
      if (addToRoot) {
        this.model.getContainer().addChild(child.getContainer());
      }
      if (socketChildren.size === 0) {
        this.socketChildrenByBone.delete(socketName);
      }
    }
  }

  public updateChildAnimation(
    animation: Animation<PlayCanvasGraphicsAdapter>,
    animationState: PlayCanvasAnimationState,
  ) {
    // Only process if this is actually a PlayCanvas animation state
    if (!animationState || !animationState.animationAsset) {
      console.warn("updateChildAnimation: Invalid animation state", animationState);
      return;
    }

    let existingAnimationState = this.childAnimationActions.get(animation);
    if (existingAnimationState) {
      // Compare animation asset with current state
      const oldAnimationAsset = existingAnimationState.animationAsset;
      if (existingAnimationState.animClip && oldAnimationAsset !== animationState.animationAsset) {
        // Remove the old clip and recreate when asset differs
        if (this.directAnimationSystem) {
          try {
            const clipIndex = this.directAnimationSystem.evaluator.clips?.indexOf(
              existingAnimationState.animClip,
            );
            if (clipIndex !== undefined && clipIndex >= 0) {
              this.directAnimationSystem.evaluator.removeClip(clipIndex);
            }
          } catch (error) {
            console.warn(
              `Failed to remove old AnimClip for ${existingAnimationState.clipName}:`,
              error,
            );
          }
        }
        existingAnimationState.animClip = null;
        existingAnimationState = undefined;
      }
    }

    if (existingAnimationState) {
      existingAnimationState.animationState = animationState;

      // Update animations for all attachments
      for (const [attachment, attachmentAnimState] of this.attachments) {
        this.updateAnimationForAttachment(
          attachment,
          attachmentAnimState,
          animation,
          animationState,
        );
      }

      // Trigger an immediate update to apply timing logic
      if (this.documentTimeTickListener) {
        const documentTime = this.model.getDocumentTime();
        this.updateAnimation(documentTime);
      }
      return;
    }

    if (!this.loadedState) {
      // queue if model isn't loaded yet
      this.pendingAnimationUpdates.set(animation, animationState);
      return;
    }

    let animClip = null;
    const clipName = `ChildAnimation_${animation.id}`;

    if (this.directAnimationSystem && animationState.animationAsset) {
      try {
        // Get the animation track from the asset
        const animTrack = animationState.animationAsset.resource;
        if (animTrack) {
          animClip = new playcanvas.AnimClip(
            animTrack,
            0.0, // start time
            1.0, // speed - we'll use weight for influence control
            true, // playing
            animationState.loop,
          );
          animClip.name = clipName;
          animClip.blendWeight = 1;

          this.directAnimationSystem.evaluator.addClip(animClip);
          animClip.play(); // Keep playing, weight controls influence
        }
      } catch (error) {
        console.warn(`Failed to create AnimClip for ${clipName}:`, error);
      }
    } else if (!this.directAnimationSystem) {
      console.warn(
        `Direct animation system not available for ${clipName}, model may not be loaded yet`,
      );
    }

    // Store the animation state for this animation
    this.childAnimationActions.set(animation, {
      animationAsset: animationState.animationAsset,
      animClip,
      animationState,
      clipName,
    });

    // Update animations for all attachments
    for (const [attachment, attachmentAnimState] of this.attachments) {
      this.updateAnimationForAttachment(attachment, attachmentAnimState, animation, animationState);
    }

    // Ensure document time tick listener is set up for child animations
    if (this.childAnimationActions.size > 0 && !this.documentTimeTickListener) {
      this.documentTimeTickListener = this.model.addDocumentTimeTickListener(
        (documentTime: number) => {
          this.updateAnimation(documentTime);
        },
      );
    }

    // Trigger an immediate update to apply timing logic
    if (this.documentTimeTickListener) {
      const documentTime = this.model.getDocumentTime();
      this.updateAnimation(documentTime);
    }
  }

  private updateAnimationForAttachment(
    attachment: Model<PlayCanvasGraphicsAdapter>,
    attachmentAnimState: AttachmentAnimState,
    animation: Animation<PlayCanvasGraphicsAdapter>,
    animationState: PlayCanvasAnimationState,
  ) {
    let attachmentChildAnimation = attachmentAnimState.childAnimations.animations.get(animation);
    const attachmentDirectAnimationSystem =
      attachmentAnimState.childAnimations.directAnimationSystem;

    const attachmentLoadedState = (attachment.modelGraphics as PlayCanvasModel).loadedState;
    if (!attachmentLoadedState) {
      throw new Error("Attachment must be loaded before registering");
    }

    if (
      attachmentChildAnimation &&
      attachmentChildAnimation.animClip &&
      attachmentDirectAnimationSystem
    ) {
      // Remove the old clip and recreate when asset differs
      const oldAnimationAsset = attachmentChildAnimation.animationAsset;
      if (oldAnimationAsset !== animationState.animationAsset) {
        try {
          const clipIndex = attachmentDirectAnimationSystem.evaluator.clips?.indexOf(
            attachmentChildAnimation.animClip,
          );
          if (clipIndex !== undefined && clipIndex >= 0) {
            attachmentDirectAnimationSystem.evaluator.removeClip(clipIndex);
          }
        } catch (error) {
          console.warn(
            `Failed to remove old AnimClip for ${attachmentChildAnimation.clipName}:`,
            error,
          );
        }
        attachmentChildAnimation.animClip = null;
        attachmentChildAnimation = undefined;
      }
    }

    if (!attachmentChildAnimation) {
      attachmentChildAnimation = {
        animClip: null,
        animationState,
        animationAsset: animationState.animationAsset,
        clipName: `ChildAnimation_${animation.id}`,
      };
      attachmentAnimState.childAnimations.animations.set(animation, attachmentChildAnimation);
    } else {
      attachmentChildAnimation.animationState = animationState;
      attachmentChildAnimation.animationAsset = animationState.animationAsset;
    }

    if (
      !attachmentChildAnimation.animClip &&
      animationState &&
      animationState.animationAsset &&
      attachmentDirectAnimationSystem
    ) {
      try {
        const animTrack = animationState.animationAsset.resource;
        if (animTrack) {
          const animClip = new playcanvas.AnimClip(animTrack, 0.0, 1.0, true, animationState.loop);
          animClip.name = attachmentChildAnimation.clipName;
          animClip.blendWeight = 1;

          attachmentDirectAnimationSystem.evaluator.addClip(animClip);
          animClip.play();

          attachmentAnimState.childAnimations.animations.set(animation, {
            animClip,
            animationState,
            animationAsset: animationState.animationAsset,
            clipName: attachmentChildAnimation.clipName,
          });
        }
      } catch (error) {
        console.warn(
          `Failed to create AnimClip for attachment ${attachmentChildAnimation.clipName}:`,
          error,
        );
      }
    }
  }

  public removeChildAnimation(animation: Animation<PlayCanvasGraphicsAdapter>) {
    if (!this.loadedState) {
      this.pendingAnimationUpdates.delete(animation);
      return;
    }

    const animationState = this.childAnimationActions.get(animation);
    if (animationState) {
      // Remove AnimClip if it exists using our direct animation system
      if (animationState.animClip && this.directAnimationSystem) {
        try {
          if (this.directAnimationSystem.evaluator.clips) {
            const clipIndex = this.directAnimationSystem.evaluator.clips.indexOf(
              animationState.animClip,
            );
            if (clipIndex >= 0) {
              this.directAnimationSystem.evaluator.removeClip(clipIndex);
            }
          }
        } catch (error) {
          console.warn(`Failed to remove AnimClip for ${animationState.clipName}:`, error);
        }
      }

      // Remove animation from all attachments
      for (const [attachment, attachmentAnimState] of this.attachments) {
        this.removeAnimationForAttachment(attachment, attachmentAnimState, animation);
      }
    }

    this.childAnimationActions.delete(animation);
  }

  private removeAnimationForAttachment(
    attachment: Model<PlayCanvasGraphicsAdapter>,
    attachmentAnimState: AttachmentAnimState,
    animation: Animation<PlayCanvasGraphicsAdapter>,
  ) {
    const attachmentChildAnimation = attachmentAnimState.childAnimations.animations.get(animation);
    if (attachmentChildAnimation) {
      const animClip = attachmentChildAnimation.animClip;
      if (animClip && attachmentAnimState.childAnimations.directAnimationSystem) {
        try {
          const clipIndex =
            attachmentAnimState.childAnimations.directAnimationSystem.evaluator.clips?.indexOf(
              animClip,
            );
          if (clipIndex !== undefined && clipIndex >= 0) {
            attachmentAnimState.childAnimations.directAnimationSystem.evaluator.removeClip(
              clipIndex,
            );
          }
        } catch (error) {
          console.warn(
            `Failed to remove AnimClip for attachment ${attachmentChildAnimation.clipName}:`,
            error,
          );
        }
      }
    }
    attachmentAnimState.childAnimations.animations.delete(animation);
  }

  private updateAnimationActions() {
    // anim attribute is set, only play that action and stop all child actions
    if (this.animAttributeComponent) {
      this.animAttributeComponent.enabled = true;

      // Set all child animation weights to 0 when anim attribute is active
      for (const [, animationState] of this.childAnimationActions) {
        if (animationState.animClip) {
          animationState.animClip.blendWeight = 0;
          // Stop the clip to prevent conflicts with anim attribute
          animationState.animClip.stop();
        }
      }

      // Set default pose to 0 when anim attribute is active (anim attribute overrides everything)
      if (this.directAnimationSystem && this.directAnimationSystem.defaultPoseClip) {
        this.directAnimationSystem.defaultPoseClip.blendWeight = 0;
        this.directAnimationSystem.defaultPoseClip.stop();
      }
    } else {
      // Child animations are controlled by updateAnimation method based on timing
      // This method is called when animations are added/removed, but timing control
      // is handled in updateAnimation during the document time tick

      // Re-enable child animations when anim attribute is not active
      for (const [, animationState] of this.childAnimationActions) {
        if (animationState.animClip) {
          animationState.animClip.play();
        }
      }

      // Re-enable default pose when anim attribute is not active
      if (this.directAnimationSystem && this.directAnimationSystem.defaultPoseClip) {
        this.directAnimationSystem.defaultPoseClip.play();
      }
    }
  }

  public transformed(): void {
    /*
     TODO - this hack is necessary to allow scaling of collision models in
      playcanvas. The meshes are cached by id (and potentially shared between
      entities). The scale changing does not cause a cache miss, so the cached
      mesh is used with the wrong scale. This is a workaround to clear the cache.
    */
    const scale = this.loadedState?.renderEntity.getWorldTransform().getScale();
    if (scale && this.loadedState) {
      if (
        Math.abs(this.loadedState.collisionWorldScale.x - scale.x) > 0.001 ||
        Math.abs(this.loadedState.collisionWorldScale.y - scale.y) > 0.001 ||
        Math.abs(this.loadedState.collisionWorldScale.z - scale.z) > 0.001
      ) {
        this.loadedState.collisionWorldScale = { x: scale.x, y: scale.y, z: scale.z };

        const collisionComponent = this.loadedState.renderEntity.collision;
        if (collisionComponent) {
          for (const mesh of collisionComponent.data.render.meshes) {
            // @ts-expect-error - accessing _triMeshCache private property
            const triMesh = collisionComponent.system._triMeshCache[mesh.id];
            if (triMesh) {
              // @ts-expect-error - accessing untyped Ammo global
              window.Ammo.destroy(triMesh);
              // @ts-expect-error - accessing _triMeshCache private property
              delete collisionComponent.system._triMeshCache[mesh.id];
            }
          }
          // @ts-expect-error - accessing onSetModel private method
          collisionComponent.onSetModel();
        }
      }
    }
  }

  setSrc(src: string | null): void {
    const playcanvasEntity = this.model.getContainer() as playcanvas.Entity;
    if (this.loadedState !== null) {
      this.loadedState.renderEntity.remove();
      this.loadedState = null;
      if (this.animState) {
        this.animState.animComponent = null;
      }
      if (this.registeredParentAttachment) {
        (this.registeredParentAttachment.modelGraphics as PlayCanvasModel).unregisterAttachment(
          this.model,
        );
        this.registeredParentAttachment = null;
      }
      this.updateMeshCallback();
      this.updateDebugVisualisation();
    }
    if (!src) {
      this.latestSrcModelPromise = null;
      this.srcLoadingInstanceManager.abortIfLoading();

      // Clean up direct animation system when src is removed
      this.directAnimationSystem = null;
      this.childAnimationActions.clear();
      this.pendingAnimationUpdates.clear();

      this.socketChildrenByBone.forEach((children) => {
        children.forEach((child) => {
          this.model.getContainer().addChild(child.getContainer());
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
      .then((asset) => {
        if (this.latestSrcModelPromise !== srcModelPromise || !this.model.isConnected) {
          // Dispose of old model when new model loads or connection ends
          asset.unload();
          return;
        }
        this.latestSrcModelPromise = null;
        const renderEntity: playcanvas.Entity = asset.resource.instantiateRenderEntity();

        // Set up document time tick listener for child animations if we have any
        if (this.childAnimationActions.size > 0 && !this.documentTimeTickListener) {
          this.documentTimeTickListener = this.model.addDocumentTimeTickListener(
            (documentTime: number) => {
              this.updateAnimation(documentTime);
            },
          );
        }

        let boundingBox: playcanvas.BoundingBox | null = null;
        const renders = renderEntity.findComponents("render") as Array<playcanvas.RenderComponent>;
        for (const render of renders) {
          for (const meshInstance of render.meshInstances) {
            if (boundingBox) {
              boundingBox.add(meshInstance.aabb);
            } else {
              boundingBox = meshInstance.aabb.clone();
            }
          }
          render.entity.addComponent("collision", {
            type: "mesh",
            renderAsset: render.asset,
          });
        }
        if (!boundingBox) {
          boundingBox = new playcanvas.BoundingBox(
            new playcanvas.Vec3(0, 0, 0),
            new playcanvas.Vec3(0, 0, 0),
          );
        }
        boundingBox.halfExtents.mulScalar(2);

        const bones = new Map<string, playcanvas.GraphNode>();
        renderEntity.forEach((node) => {
          bones.set(node.name, node);
        });

        this.loadedState = {
          renderEntity,
          boundingBox,
          collisionWorldScale: { x: 1, y: 1, z: 1 },
          bones,
        };

        playcanvasEntity.addChild(renderEntity);

        this.setupDirectAnimationSystem(renderEntity, bones);

        this.transformed();

        for (const [boneName, children] of this.socketChildrenByBone) {
          const bone = bones.get(boneName);
          if (bone) {
            children.forEach((child) => {
              bone.addChild(child.getContainer());
            });
          }
        }

        this.updateMeshCallback();

        const parent = this.model.parentElement;
        if (parent && Model.isModel(parent)) {
          if (!this.latestAnimPromise && !this.animState) {
            this.registeredParentAttachment = parent as Model<PlayCanvasGraphicsAdapter>;
            (parent.modelGraphics as PlayCanvasModel).registerAttachment(this.model);
          }
        }

        this.srcLoadingInstanceManager.finish();

        this.updateDebugVisualisation();

        // Apply pending animation updates
        for (const [animation, animationState] of this.pendingAnimationUpdates) {
          this.updateChildAnimation(animation, animationState);
        }
        this.pendingAnimationUpdates.clear();

        // Apply pending anim attribute if set
        this.applyPendingAnimation();

        // Ensure document time tick listener is set up if we have child animations
        if (this.childAnimationActions.size > 0 && !this.documentTimeTickListener) {
          this.documentTimeTickListener = this.model.addDocumentTimeTickListener(
            (documentTime: number) => {
              this.updateAnimation(documentTime);
            },
          );
        }
      })
      .catch((err) => {
        console.error("Error loading m-model.src", err);
        this.srcLoadingInstanceManager.error(err);
      });
  }

  private updateDebugVisualisation() {
    if (!this.model.props.debug) {
      this.clearDebugVisualisation();
    } else {
      if (!this.debugBoundingBox) {
        const graphicsAdapter = this.model.getScene().getGraphicsAdapter();
        if (!this.debugMaterial) {
          this.debugMaterial = new playcanvas.BasicMaterial();
          this.debugMaterial.color = new playcanvas.Color(1, 0, 0);
        }
        this.debugBoundingBox = createPlayCanvasDebugBoundingBox(
          graphicsAdapter,
          this.debugMaterial,
        );
        this.model.getContainer().addChild(this.debugBoundingBox);
      }
      if (this.loadedState) {
        const boundingBox = this.loadedState.boundingBox;
        this.debugBoundingBox.setLocalPosition(boundingBox.center);
        this.debugBoundingBox.setLocalScale(boundingBox.halfExtents);
      } else {
        this.debugBoundingBox.setLocalScale(0, 0, 0);
      }
    }
  }

  private clearDebugVisualisation() {
    if (this.debugBoundingBox) {
      this.debugBoundingBox.remove();
      this.debugBoundingBox = null;
    }
    if (this.debugMaterial) {
      this.debugMaterial.destroy();
      this.debugMaterial = null;
    }
  }

  async asyncLoadSourceAsset(
    url: string,
    // TODO - report progress
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    onProgress: (loaded: number, total: number) => void,
  ): Promise<playcanvas.Asset> {
    return new Promise<playcanvas.Asset>((resolve, reject) => {
      /*
       Rewriting the url with an unused-for-networking fragment here causes the
        asset to be loaded uniquely across elements which allows the meshes to
        be independent and avoid a reuse of a (mis-)scaled mesh for collisions.
      */
      const rewrittenUrl = new URL(url);
      rewrittenUrl.hash = Math.random().toString(10);
      const asset = new playcanvas.Asset(url, "container", { url: rewrittenUrl.toString() });
      this.getPlayCanvasApp().assets.add(asset);
      this.getPlayCanvasApp().assets.load(asset);
      asset.ready((asset) => {
        resolve(asset);
      });
      asset.on("error", (err) => {
        reject(err);
      });
    });
  }

  async asyncLoadAnimAsset(
    url: string,
    // TODO - report progress
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    onProgress: (loaded: number, total: number) => void,
  ): Promise<playcanvas.Asset> {
    return new Promise<playcanvas.Asset>((resolve, reject) => {
      const asset = new playcanvas.Asset(url, "animation", { url });
      this.getPlayCanvasApp().assets.add(asset);
      this.getPlayCanvasApp().assets.load(asset);
      asset.ready((asset) => {
        resolve(asset);
      });
      asset.on("error", (err) => {
        reject(err);
      });
    });
  }

  dispose() {
    if (this.documentTimeTickListener) {
      this.documentTimeTickListener.remove();
      this.documentTimeTickListener = null;
    }
    if (this.registeredParentAttachment) {
      (this.registeredParentAttachment?.modelGraphics as PlayCanvasModel)?.unregisterAttachment(
        this.model,
      );
      this.registeredParentAttachment = null;
    }
    if (this.loadedState) {
      this.loadedState.renderEntity.destroy();
      this.loadedState = null;
    }
    this.clearDebugVisualisation();
    this.latestSrcModelPromise = null;
    this.latestAnimPromise = null;
    this.animLoadingInstanceManager.dispose();
    this.srcLoadingInstanceManager.dispose();

    if (this.animAttributeComponent) {
      this.animAttributeComponent.playing = false;
      this.animAttributeComponent = null;
    }

    this.childAnimationActions.clear();
    this.pendingAnimationUpdates.clear();
    this.pendingAnim = null;

    // Clean up direct animation system
    this.directAnimationSystem = null;
  }

  private triggerSocketedChildrenTransformed() {
    this.socketChildrenByBone.forEach((children) => {
      children.forEach((child) => {
        if (TransformableElement.isTransformableElement(child)) {
          child.didUpdateTransformation();
        }
      });
    });
  }

  private updateAnimation(docTimeMs: number) {
    // Handle anim attribute (main animation)
    if (this.animAttributeComponent) {
      let animationTimeMs = docTimeMs - this.model.props.animStartTime;
      if (docTimeMs < this.model.props.animStartTime) {
        animationTimeMs = 0;
      } else if (this.model.props.animPauseTime !== null) {
        if (docTimeMs > this.model.props.animPauseTime) {
          animationTimeMs = this.model.props.animPauseTime - this.model.props.animStartTime;
        }
      }

      if (!this.model.props.animEnabled) {
        this.animAttributeComponent.playing = false;

        // When anim-enabled is false, return to default pose
        if (this.directAnimationSystem && this.directAnimationSystem.defaultPoseClip) {
          this.directAnimationSystem.defaultPoseClip.blendWeight = 1.0;
          if (!this.directAnimationSystem.defaultPoseClip._playing) {
            this.directAnimationSystem.defaultPoseClip.play();
          }
        }

        this.triggerSocketedChildrenTransformed();
      } else {
        this.animAttributeComponent.playing = true;

        // When anim-enabled is true, disable default pose (anim attribute takes priority)
        if (this.directAnimationSystem && this.directAnimationSystem.defaultPoseClip) {
          this.directAnimationSystem.defaultPoseClip.blendWeight = 0;
          this.directAnimationSystem.defaultPoseClip.stop();
        }

        // @ts-expect-error - accessing _controller private property
        const clip = this.animAttributeComponent.baseLayer._controller._animEvaluator.clips[0];
        if (clip) {
          clip.time = animationTimeMs / 1000;
        }
      }

      // Update attachment animations (only when enabled, disabled case is handled in setAnimEnabled)
      for (const [model, animState] of this.attachments) {
        if (animState && animState.directAnimation && this.model.props.animEnabled) {
          animState.directAnimation.animComponent.playing = true;
          const clip =
            // @ts-expect-error - accessing _controller private property
            animState.directAnimation.animComponent.baseLayer._controller._animEvaluator.clips[0];
          if (clip) {
            clip.time = animationTimeMs / 1000;
          }
          (model.modelGraphics as PlayCanvasModel).triggerSocketedChildrenTransformed();
        }
      }
      this.triggerSocketedChildrenTransformed();
    } else {
      // Handle child animations (m-animation tags) with proper weight-based mixing
      if (
        this.model.props.animEnabled &&
        this.directAnimationSystem &&
        this.childAnimationActions.size > 0
      ) {
        const activeAnimationToWeight = new Map<PlayCanvasChildAnimationState, number>();
        let totalWeight = 0;

        // Map of animation to animationTimeMs for attachments
        const animationTimes = new Map<Animation<PlayCanvasGraphicsAdapter>, number>();

        let hasActiveAnimations = false;

        // Update each child animation based on its individual timing properties
        for (const [animation, childAnimationState] of this.childAnimationActions) {
          const animationState = childAnimationState.animationState;
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
              shouldBeActive = false;
            }
          }

          // Apply speed multiplier
          animationTimeMs = animationTimeMs * animationState.speed;

          // Handle explicit ratio override
          if (animationState.ratio !== null && animationState.animationAsset) {
            const durationMs = animationState.animationAsset.resource.duration * 1000;
            animationTimeMs = animationState.ratio * durationMs;
          }

          // Handle loop and duration
          if (shouldBeActive && animationState.animationAsset) {
            const durationMs = animationState.animationAsset.resource.duration * 1000;
            if (!animationState.loop && animationTimeMs > durationMs) {
              animationTimeMs = durationMs;
              shouldBeActive = false; // Stop the animation when it reaches the end
            }
          }

          // Control the animation state based on timing and weight
          if (childAnimationState.animClip) {
            if (shouldBeActive && animationState.weight > 0) {
              childAnimationState.animClip.time = animationTimeMs / 1000;
              activeAnimationToWeight.set(childAnimationState, animationState.weight);
              totalWeight += animationState.weight;
              animationTimes.set(animation, animationTimeMs);
              hasActiveAnimations = true;
            } else {
              // Set weight to 0 for inactive animations but keep them playing
              childAnimationState.animClip.blendWeight = 0;

              // Keep playing for proper timing - weight controls influence
              if (!childAnimationState.animClip._playing) {
                childAnimationState.animClip.play();
              }
            }
          }
        }

        if (totalWeight > 0) {
          for (const [childAnimationState, weight] of activeAnimationToWeight) {
            if (childAnimationState.animClip) {
              if (totalWeight > 1) {
                childAnimationState.animClip.blendWeight = weight / totalWeight;
              } else {
                childAnimationState.animClip.blendWeight = weight;
              }
            }
          }
        }

        // Set default pose weight to fill the remainder (for blends < 1.0)
        if (this.directAnimationSystem && this.directAnimationSystem.defaultPoseClip) {
          if (totalWeight > 1) {
            // When totalWeight > 1, normalize animations and no default pose
            this.directAnimationSystem.defaultPoseClip.blendWeight = 0;
          } else {
            // Default pose gets the remaining weight (1.0 - totalWeight)
            const defaultPoseWeight = Math.max(0, 1.0 - totalWeight);
            this.directAnimationSystem.defaultPoseClip.blendWeight = defaultPoseWeight;
            // Ensure default pose is playing
            if (!this.directAnimationSystem.defaultPoseClip._playing) {
              this.directAnimationSystem.defaultPoseClip.play();
            }
          }
        } else {
          console.warn("No animation system available - animation blending may not work correctly");
        }

        // Update attachment child animations
        for (const [model, attachmentAnimState] of this.attachments) {
          if (attachmentAnimState && attachmentAnimState.childAnimations.directAnimationSystem) {
            const attachmentActiveAnimationToWeight = new Map<
              { animClip: playcanvas.AnimClip },
              number
            >();
            let attachmentTotalWeight = 0;

            for (const [animation, childAnimation] of attachmentAnimState.childAnimations
              .animations) {
              const animationTimeMs = animationTimes.get(animation);
              const animClip = childAnimation.animClip;
              if (animClip) {
                if (animationTimeMs !== undefined) {
                  animClip.time = animationTimeMs / 1000;
                  attachmentActiveAnimationToWeight.set(
                    { animClip },
                    childAnimation.animationState.weight,
                  );
                  attachmentTotalWeight += childAnimation.animationState.weight;
                } else {
                  animClip.blendWeight = 0;
                  if (!animClip._playing) {
                    animClip.play();
                  }
                }
              }
            }

            if (attachmentTotalWeight > 0) {
              for (const [animData, weight] of attachmentActiveAnimationToWeight) {
                if (attachmentTotalWeight > 1) {
                  animData.animClip.blendWeight = weight / attachmentTotalWeight;
                } else {
                  animData.animClip.blendWeight = weight;
                }
              }
            }

            // Set default pose weight for attachment
            if (attachmentAnimState.childAnimations.directAnimationSystem.defaultPoseClip) {
              if (attachmentTotalWeight > 1) {
                attachmentAnimState.childAnimations.directAnimationSystem.defaultPoseClip.blendWeight = 0;
              } else {
                const defaultPoseWeight = Math.max(0, 1.0 - attachmentTotalWeight);
                attachmentAnimState.childAnimations.directAnimationSystem.defaultPoseClip.blendWeight =
                  defaultPoseWeight;
                if (
                  !attachmentAnimState.childAnimations.directAnimationSystem.defaultPoseClip
                    ._playing
                ) {
                  attachmentAnimState.childAnimations.directAnimationSystem.defaultPoseClip.play();
                }
              }
            }

            if (!hasActiveAnimations) {
              attachmentAnimState.childAnimations.directAnimationSystem.evaluator.update(0);
            } else {
              attachmentAnimState.childAnimations.directAnimationSystem.evaluator.update(0);
            }

            (model.modelGraphics as PlayCanvasModel).triggerSocketedChildrenTransformed();
          }
        }
      } else {
        // When animations are disabled, set all child animation weights to 0
        for (const [, childAnimationState] of this.childAnimationActions) {
          if (childAnimationState.animClip) {
            childAnimationState.animClip.blendWeight = 0;
          }
        }

        // Set default pose to full weight when animations are disabled
        if (this.directAnimationSystem && this.directAnimationSystem.defaultPoseClip) {
          this.directAnimationSystem.defaultPoseClip.blendWeight = 1.0;
          // Ensure default pose is playing
          if (!this.directAnimationSystem.defaultPoseClip._playing) {
            this.directAnimationSystem.defaultPoseClip.play();
          }
        }

        // Handle attachments when animations are disabled
        for (const [model, attachmentAnimState] of this.attachments) {
          if (attachmentAnimState && attachmentAnimState.childAnimations.directAnimationSystem) {
            // Set all child animation weights to 0
            for (const [, childAnimation] of attachmentAnimState.childAnimations.animations) {
              if (childAnimation.animClip) {
                childAnimation.animClip.blendWeight = 0;
              }
            }

            // Set default pose to full weight
            if (attachmentAnimState.childAnimations.directAnimationSystem.defaultPoseClip) {
              attachmentAnimState.childAnimations.directAnimationSystem.defaultPoseClip.blendWeight = 1.0;
              if (
                !attachmentAnimState.childAnimations.directAnimationSystem.defaultPoseClip._playing
              ) {
                attachmentAnimState.childAnimations.directAnimationSystem.defaultPoseClip.play();
              }
            }

            attachmentAnimState.childAnimations.directAnimationSystem.evaluator.update(0);
            (model.modelGraphics as PlayCanvasModel).triggerSocketedChildrenTransformed();
          }
        }
      }

      this.triggerSocketedChildrenTransformed();
    }

    // Update directAnimationSystem when:
    // 1. No anim attribute is active (normal child animation mode), OR
    // 2. Anim attribute exists but anim-enabled is false (need default pose)
    if (
      this.directAnimationSystem &&
      (!this.animAttributeComponent || !this.model.props.animEnabled)
    ) {
      this.directAnimationSystem.evaluator.update(0);

      // Trigger socketed children transform update AFTER bones have been updated to default pose
      // This is especially important when anim-enabled=false to ensure children follow the default pose
      if (this.animAttributeComponent && !this.model.props.animEnabled) {
        this.triggerSocketedChildrenTransformed();
      }
    }
  }
}
