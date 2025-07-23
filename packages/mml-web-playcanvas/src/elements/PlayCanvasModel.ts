import {
  Animation,
  IVect3,
  LoadingInstanceManager,
  MElement,
  Model,
  ModelGraphics,
  TransformableElement,
} from "@mml-io/mml-web";
import * as playcanvas from "playcanvas";

import { createPlayCanvasDebugBoundingBox } from "../debug-bounding-box/PlayCanvasDebugBoundingBox";
import { PlayCanvasGraphicsAdapter } from "../PlayCanvasGraphicsAdapter";

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

export class PlayCanvasModel extends ModelGraphics<PlayCanvasGraphicsAdapter> {
  private srcLoadingInstanceManager = new LoadingInstanceManager(`${Model.tagName}.src`);
  private animLoadingInstanceManager = new LoadingInstanceManager(`${Model.tagName}.anim`);
  private latestSrcModelPromise: Promise<playcanvas.Asset> | null = null;

  private debugMaterial: playcanvas.BasicMaterial | null = null;

  private latestAnimPromise: Promise<playcanvas.Asset> | null = null;
  private documentTimeTickListener: null | { remove: () => void } = null;

  private attachments = new Map<
    Model<PlayCanvasGraphicsAdapter>,
    {
      animComponent: playcanvas.AnimComponent;
    } | null
  >();
  private registeredParentAttachment: Model<PlayCanvasGraphicsAdapter> | null = null;

  // Child animation support - similar to ThreeJS implementation
  private childAnimationActions = new Map<
    Animation<PlayCanvasGraphicsAdapter>,
    playcanvas.AnimComponent
  >();
  private pendingAnimationUpdates = new Map<Animation<PlayCanvasGraphicsAdapter>, any>();
  private mainAnimComponent: playcanvas.AnimComponent | null = null;
  private currentAnimationAsset: playcanvas.Asset | null = null;
  private animEvaluator: any = null; // For multi-clip blending
  private animAttributeComponent: playcanvas.AnimComponent | null = null; // For anim attribute
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
    // TODO
  }

  public registerAttachment(attachment: Model<PlayCanvasGraphicsAdapter>) {
    let animState = null;
    if (this.animState) {
      const attachmentLoadedState = (attachment.modelGraphics as PlayCanvasModel).loadedState;
      if (!attachmentLoadedState) {
        throw new Error("Attachment must be loaded before registering");
      }
      const playcanvasEntity = attachmentLoadedState.renderEntity;
      const animComponent = playcanvasEntity.addComponent("anim", {}) as playcanvas.AnimComponent;
      animComponent.assignAnimation("SingleAnimation", this.animState.animAsset.resource);
      animState = {
        animComponent,
      };
    }
    this.attachments.set(attachment, animState);
  }

  public unregisterAttachment(attachment: Model<PlayCanvasGraphicsAdapter>) {
    const animState = this.attachments.get(attachment);
    if (animState) {
      animState.animComponent.reset();
      animState.animComponent.unbind();
      animState.animComponent.entity.removeComponent("anim");
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
    console.log("setAnim called:", {
      anim,
      hasAnimState: !!this.animState,
      hasAnimAttributeComponent: !!this.animAttributeComponent,
      hasMainAnimComponent: !!this.mainAnimComponent,
      childActionsCount: this.childAnimationActions.size,
      documentTimeTickListener: !!this.documentTimeTickListener,
    });

    // Clean up existing anim state
    if (this.animState) {
      console.log("Cleaning up existing animState");
      if (this.animState.animComponent) {
        this.animState.animComponent.reset();
        this.animState.animComponent.unbind();
        this.animState.animComponent.entity.removeComponent("anim");
      }
      this.animState = null;

      // Clean up attachments
      for (const [attachment, animState] of this.attachments) {
        if (animState) {
          animState.animComponent.reset();
          animState.animComponent.unbind();
          animState.animComponent.entity.removeComponent("anim");
        }
        this.attachments.set(attachment, null);
      }
    }

    // Clear anim attribute component when resetting (like ThreeJS resetAnimationMixer)
    if (this.animAttributeComponent) {
      console.log("Clearing animAttributeComponent");
      this.animAttributeComponent.reset();
      this.animAttributeComponent.unbind();
      this.animAttributeComponent.entity.removeComponent("anim");
      this.animAttributeComponent = null;
    }

    if (!anim) {
      console.log("Anim attribute REMOVED - restoring child animations");
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

      // restore document time tick listener for child animations if we have any
      if (this.childAnimationActions.size > 0 && !this.documentTimeTickListener) {
        console.log("Restoring document time tick listener for child animations");
        this.documentTimeTickListener = this.model.addDocumentTimeTickListener(
          (documentTime: number) => {
            this.updateAnimation(documentTime);
          },
        );
      }

      // Ensure main anim component is set up for child animations
      if (this.childAnimationActions.size > 0 && this.loadedState && !this.mainAnimComponent) {
        console.log("Creating mainAnimComponent for child animations");
        this.mainAnimComponent = this.loadedState.renderEntity.addComponent(
          "anim",
          {},
        ) as playcanvas.AnimComponent;
      }

      console.log("Before updateAnimationActions:", {
        hasAnimAttributeComponent: !!this.animAttributeComponent,
        hasMainAnimComponent: !!this.mainAnimComponent,
        childActionsCount: this.childAnimationActions.size,
      });
      // update child animation actions to restore them
      this.updateAnimationActions();
      console.log("After updateAnimationActions:", {
        hasAnimAttributeComponent: !!this.animAttributeComponent,
        hasMainAnimComponent: !!this.mainAnimComponent,
        childActionsCount: this.childAnimationActions.size,
      });
      return;
    }

    console.log("Anim attribute SET - loading animation:", anim);
    // Store the pending animation
    this.pendingAnim = anim;

    // If the model is not loaded yet, wait for it
    if (!this.loadedState) {
      console.log("Model not loaded yet, waiting...");
      return;
    }

    // Apply the pending animation
    this.applyPendingAnimation();
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

      // Check if entity already has an anim component
      let animComponent = playcanvasEntity.anim;
      if (!animComponent) {
        animComponent = playcanvasEntity.addComponent("anim", {}) as playcanvas.AnimComponent;
      }

      if (!animComponent) {
        console.error("connectAnimationToModel: Failed to create or get anim component");
        return;
      }

      animComponent.assignAnimation("SingleAnimation", this.animState.animAsset.resource);
      this.animState.animComponent = animComponent;
      this.animAttributeComponent = animComponent; // Set the dedicated anim attribute component
      console.log("connectAnimationToModel: Set animAttributeComponent");
    } catch (error) {
      console.error("Error in connectAnimationToModel:", error);
    }
  }

  private applyPendingAnimation() {
    console.log("applyPendingAnimation called:", {
      hasLoadedState: !!this.loadedState,
      hasRenderEntity: !!this.loadedState?.renderEntity,
      pendingAnim: this.pendingAnim,
    });

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
      console.log("applyPendingAnimation: Cleaning up existing animState");
      if (this.animState.animComponent) {
        this.animState.animComponent.reset();
        this.animState.animComponent.unbind();
        this.animState.animComponent.entity.removeComponent("anim");
      }
      this.animState = null;
    }

    // If anim is not set, restore child animations
    if (!anim) {
      console.log("applyPendingAnimation: Anim is null - restoring child animations");
      // Ensure main anim component is set up for child animations
      if (this.childAnimationActions.size > 0 && this.loadedState && !this.mainAnimComponent) {
        this.mainAnimComponent = this.loadedState.renderEntity.addComponent(
          "anim",
          {},
        ) as playcanvas.AnimComponent;
      }

      // Re-enable child actions
      for (const action of this.childAnimationActions.values()) {
        action.enabled = true;
      }

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

        console.log("applyPendingAnimation: Animation loaded, setting animState");
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
          const playcanvasEntity = attachment.getContainer() as playcanvas.Entity;

          // Check if entity already has an anim component
          let animComponent = playcanvasEntity.anim;
          if (!animComponent) {
            animComponent = playcanvasEntity.addComponent("anim", {}) as playcanvas.AnimComponent;
          }

          if (animComponent) {
            animComponent.assignAnimation("SingleAnimation", this.animState.animAsset.resource);
            const animState = {
              animComponent,
            };
            this.attachments.set(attachment, animState);
          } else {
            console.warn("Failed to create anim component for attachment");
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
        if (this.mainAnimComponent) {
          this.mainAnimComponent.playing = false;
        }
        for (const [, action] of this.childAnimationActions) {
          action.enabled = false;
        }

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

  public setAnimEnabled(): void {
    // no-op
  }

  public setAnimLoop(): void {
    // no-op
  }

  public setAnimStartTime(): void {
    // no-op
  }

  public setAnimPauseTime(): void {
    // no-op
  }

  public updateChildAnimation(
    animation: Animation<PlayCanvasGraphicsAdapter>,
    animationState: any,
  ) {
    // Only process if this is actually a PlayCanvas animation state
    // ThreeJS animations will have animationClip, PlayCanvas animations will have animationAsset
    if (!animationState || (!animationState.animationAsset && !animationState.animationClip)) {
      return;
    }

    // If this is a ThreeJS animation state (has animationClip), ignore it
    // This prevents PlayCanvas from interfering with ThreeJS functionality
    if (animationState.animationClip && !animationState.animationAsset) {
      return;
    }

    if (!this.loadedState) {
      // queue if model isn't loaded yet
      this.pendingAnimationUpdates.set(animation, animationState);
      return;
    }

    // For PlayCanvas, we need to create an AnimComponent for each animation
    // This is different from ThreeJS where we use a single mixer
    let animComponent = this.childAnimationActions.get(animation) as any;

    if (!animComponent && animationState && animationState.animationAsset) {
      // Create a new AnimComponent for this animation
      const playcanvasEntity = this.loadedState.renderEntity;
      animComponent = playcanvasEntity.addComponent("anim", {}) as playcanvas.AnimComponent;
      animComponent.assignAnimation("SingleAnimation", animationState.animationAsset.resource);

      this.childAnimationActions.set(animation, animComponent);
    }

    if (animComponent) {
      // Update the animation state based on timing properties
      if (animationState) {
        // Handle weight (blending)
        if (animationState.weight !== undefined) {
          // PlayCanvas doesn't have direct weight control like ThreeJS
          // We'll handle this in the updateAnimation method
        }

        // Handle timing properties (start-time, pause-time, loop)
        // These will be handled in the updateAnimation method during document time ticks
      }
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

  public removeChildAnimation(animation: Animation<PlayCanvasGraphicsAdapter>) {
    // Only process PlayCanvas animations, ignore ThreeJS animations
    // This prevents PlayCanvas from interfering with ThreeJS functionality
    if (!this.loadedState) {
      this.pendingAnimationUpdates.delete(animation);
      return;
    }

    const animComponent = this.childAnimationActions.get(animation) as any;
    if (animComponent) {
      animComponent.reset();
      animComponent.unbind();
      animComponent.entity.removeComponent("anim");
      this.childAnimationActions.delete(animation);
    }
  }

  private updateAnimationActions() {
    // anim attribute is set, only play that action and stop all child actions
    if (this.animAttributeComponent) {
      this.animAttributeComponent.enabled = true;

      // Stop all child actions
      for (const action of this.childAnimationActions.values()) {
        action.enabled = false;
      }

      // Stop main anim component for child animations
      if (this.mainAnimComponent) {
        this.mainAnimComponent.playing = false;
      }
    } else {
      // Child animations are controlled by updateAnimation method based on timing
      // This method is called when animations are added/removed, but timing control
      // is handled in updateAnimation during the document time tick
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

  setSrc(src: string): void {
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
          // If we've loaded a different model since, or we're no longer connected, dispose of this one
          // PlayCanvasModel.disposeOfGroup(result.group);
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

    if (this.mainAnimComponent) {
      this.mainAnimComponent.playing = false;
      this.mainAnimComponent = null;
    }
    if (this.animAttributeComponent) {
      this.animAttributeComponent.playing = false;
      this.animAttributeComponent = null;
    }

    this.childAnimationActions.clear();
    this.pendingAnimationUpdates.clear();
    this.pendingAnim = null;
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
        this.triggerSocketedChildrenTransformed();
      } else {
        this.animAttributeComponent.playing = true;
        // @ts-expect-error - accessing _controller private property
        const clip = this.animAttributeComponent.baseLayer._controller._animEvaluator.clips[0];
        if (clip) {
          clip.time = animationTimeMs / 1000;
        }
      }

      // Stop all child animations when anim attribute is active
      for (const [, animComponent] of this.childAnimationActions) {
        animComponent.playing = false;
      }

      for (const [model, animState] of this.attachments) {
        if (animState) {
          animState.animComponent.playing = this.model.props.animEnabled;
          // @ts-expect-error - accessing _controller private property
          const clip = animState.animComponent.baseLayer._controller._animEvaluator.clips[0];
          if (clip) {
            clip.time = animationTimeMs / 1000;
            (model.modelGraphics as PlayCanvasModel).triggerSocketedChildrenTransformed();
          }
        }
      }
      this.triggerSocketedChildrenTransformed();
    } else {
      // Handle child animations (m-animation tags)
      if (this.model.props.animEnabled) {
        for (const [animation, animComponent] of this.childAnimationActions) {
          const animationState = (animation.animationGraphics as any)?.getAnimationState();
          if (animationState) {
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

            // Handle loop and duration
            if (shouldBeActive && animationState.animationAsset) {
              const durationMs = animationState.animationAsset.resource.duration * 1000;
              if (!animationState.loop && animationTimeMs > durationMs) {
                animationTimeMs = durationMs;
                shouldBeActive = false; // Stop the animation when it reaches the end
              }
            }

            // Control the animation based on timing and weight
            if (shouldBeActive && animationState.weight > 0) {
              animComponent.playing = true;
              // @ts-expect-error - accessing _controller private property
              const clip = animComponent.baseLayer._controller._animEvaluator.clips[0];
              if (clip) {
                clip.time = animationTimeMs / 1000;
              }
            } else {
              animComponent.playing = false;
            }
          }
        }
      } else {
        // Stop all child animations when animations are disabled
        for (const [, animComponent] of this.childAnimationActions) {
          animComponent.playing = false;
        }
      }

      this.triggerSocketedChildrenTransformed();
    }
  }
}
