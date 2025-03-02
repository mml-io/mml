import {
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

  setAnim(anim: string): void {
    if (this.animState) {
      if (this.animState.animComponent) {
        this.animState.animComponent.reset();
        this.animState.animComponent.unbind();
        this.animState.animComponent.entity.removeComponent("anim");
      }
      this.animState = null;
      // TODO - clear up the asset?
      for (const [attachment, animState] of this.attachments) {
        if (animState) {
          animState.animComponent.reset();
          animState.animComponent.unbind();
          animState.animComponent.entity.removeComponent("anim");
        }
        this.attachments.set(attachment, null);
      }
    }
    if (!anim) {
      this.latestAnimPromise = null;
      // If the animation is removed then the model can be added to the parent attachment if the model is loaded
      if (this.loadedState && !this.registeredParentAttachment) {
        const parent = this.model.parentElement;
        if (parent && Model.isModel(parent)) {
          this.registeredParentAttachment = parent as Model<PlayCanvasGraphicsAdapter>;
          (parent.modelGraphics as PlayCanvasModel).registerAttachment(this.model);
        }
      }
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
        if (this.latestAnimPromise !== animPromise || !this.model.isConnected) {
          // TODO
          // If we've loaded a different model since, or we're no longer connected, dispose of this one
          // PlayCanvasModel.disposeOfGroup(result.group);
          return;
        }
        this.latestAnimPromise = null;
        this.animState = {
          animAsset: asset,
          animComponent: null,
        };
        // Play the animation
        this.connectAnimationToModel();

        for (const [attachment] of this.attachments) {
          const playcanvasEntity = attachment.getContainer() as playcanvas.Entity;
          const animComponent = playcanvasEntity.addComponent(
            "anim",
            {},
          ) as playcanvas.AnimComponent;
          animComponent.assignAnimation("SingleAnimation", this.animState.animAsset.resource);
          const animState = {
            animComponent,
          };
          this.attachments.set(attachment, animState);
        }

        if (!this.documentTimeTickListener) {
          this.documentTimeTickListener = this.model.addDocumentTimeTickListener(
            (documentTime: number) => {
              this.updateAnimation(documentTime);
            },
          );
        }
        this.animLoadingInstanceManager.finish();
      })
      .catch((err) => {
        console.error("Error loading m-model.anim", err);
        this.animLoadingInstanceManager.error(err);
      });
  }

  private connectAnimationToModel() {
    if (this.animState && this.loadedState) {
      const playcanvasEntity = this.loadedState.renderEntity;
      const animComponent = playcanvasEntity.addComponent("anim", {}) as playcanvas.AnimComponent;
      animComponent.assignAnimation("SingleAnimation", this.animState.animAsset.resource);
      this.animState.animComponent = animComponent;
    }
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

        this.connectAnimationToModel();
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
    let animationTimeMs = docTimeMs - this.model.props.animStartTime;
    if (docTimeMs < this.model.props.animStartTime) {
      animationTimeMs = 0;
    } else if (this.model.props.animPauseTime !== null) {
      if (docTimeMs > this.model.props.animPauseTime) {
        animationTimeMs = this.model.props.animPauseTime - this.model.props.animStartTime;
      }
    }

    const animComponent = this.animState?.animComponent;
    if (animComponent) {
      if (!this.model.props.animEnabled) {
        animComponent.playing = false;
        this.triggerSocketedChildrenTransformed();
      } else {
        animComponent.playing = true;
        // @ts-expect-error - accessing _controller private property
        const clip = animComponent.baseLayer._controller._animEvaluator.clips[0];
        if (clip) {
          clip.time = animationTimeMs / 1000;
        }
      }
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
  }
}
