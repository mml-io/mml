import * as playcanvas from "playcanvas";

import { MModelProps, Model } from "../elements";
import { LoadingInstanceManager } from "../loading";
import { ModelGraphics } from "../MMLGraphicsInterface";

type ModelLoadedState = {
  modelComponent: playcanvas.ModelComponent;
  collisionComponent: playcanvas.CollisionComponent;
  bones: Map<string, playcanvas.Entity>;
  // boundingBox: OrientedBoundingBox;
};

export class PlayCanvasModel extends ModelGraphics {
  private srcLoadingInstanceManager = new LoadingInstanceManager(`${Model.tagName}.src`);
  private animLoadingInstanceManager = new LoadingInstanceManager(`${Model.tagName}.anim`);
  private latestSrcModelPromise: Promise<playcanvas.Asset> | null = null;
  protected loadedState: ModelLoadedState | null = null;

  constructor(private model: Model) {
    super(model);
  }

  disable(): void {}

  enable(): void {}

  setDebug(debug: boolean, mModelProps: MModelProps): void {
    this.updateDebugVisualisation();
  }

  setSrc(src: string, mModelProps: MModelProps): void {
    const playcanvasEntity = this.model.getContainer() as playcanvas.Entity;
    if (this.loadedState !== null) {
      // this.collideableHelper.removeColliders();
      playcanvasEntity.removeComponent("model");
      playcanvasEntity.removeComponent("collision");
      this.loadedState = null;
      // if (this.registeredParentAttachment) {
      //   this.registeredParentAttachment.unregisterAttachment(this);
      //   this.registeredParentAttachment = null;
      // }
      // this.applyBounds();
      this.updateDebugVisualisation();
    }
    if (!src) {
      this.srcLoadingInstanceManager.abortIfLoading();
      // this.socketChildrenByBone.forEach((children) => {
      //   children.forEach((child) => {
      //     this.getContainer().addChild(child.getContainer());
      //   });
      // });
      // this.applyBounds();
      this.updateDebugVisualisation();
      return;
    }

    const contentSrc = this.model.contentSrcToContentAddress(src);
    const srcModelPromise = this.asyncLoadSourceAsset(contentSrc, (loaded, total) => {
      this.srcLoadingInstanceManager.setProgress(loaded / total);
    });
    this.srcLoadingInstanceManager.start(this.model.getLoadingProgressManager(), contentSrc);
    this.latestSrcModelPromise = srcModelPromise;
    srcModelPromise
      .then((asset) => {
        if (this.latestSrcModelPromise !== srcModelPromise || !this.model.isConnected) {
          // If we've loaded a different model since, or we're no longer connected, dispose of this one
          // PlayCanvasModel.disposeOfGroup(result.group);
          return;
        }
        // result.group.traverse((child) => {
        //   if ((child as THREE.Mesh).isMesh) {
        //     child.castShadow = this.props.castShadows;
        //     child.receiveShadow = true;
        //   }
        // });
        this.latestSrcModelPromise = null;
        // TODO - use "render" component?
        const modelComponent = playcanvasEntity.addComponent("model", {
          type: "asset",
          asset: asset.id,
        }) as playcanvas.ModelComponent;
        const collisionComponent = playcanvasEntity.addComponent("collision", {
          type: "mesh",
          asset,
        }) as playcanvas.CollisionComponent;
        playcanvasEntity.setLocalPosition(0, 0.1, -5);
        playcanvasEntity.setLocalEulerAngles(0, 0, 0);
        const bones = new Map<string, playcanvas.Entity>();
        // group.traverse((object) => {
        //   if (object instanceof THREE.Bone) {
        //     bones.set(object.name, object);
        //   }
        // });
        const boundingBox = new playcanvas.BoundingBox();
        // boundingBox.add(asset.resource.aabb);

        // const orientedBoundingBox = OrientedBoundingBox.fromSizeMatrixWorldProviderAndCenter(
        //   boundingBox.getgetSize(new Vect3(0, 0, 0)),
        //   this.container,
        //   boundingBox.getCenter(new Vect3(0, 0, 0)),
        // );
        this.loadedState = {
          modelComponent,
          collisionComponent,
          bones,
          // boundingBox: orientedBoundingBox,
        };
        // this.applyBounds();
        // this.collideableHelper.updateCollider(group);

        // const parent = this.parentElement;
        // if (parent instanceof Model) {
        //   if (!this.latestAnimPromise && !this.currentAnimationClip) {
        //     parent.registerAttachment(this);
        //     this.registeredParentAttachment = parent;
        //   }
        // }

        // if (this.currentAnimationClip) {
        //   this.playAnimation(this.currentAnimationClip);
        // }
        this.onModelLoadComplete();
        this.srcLoadingInstanceManager.finish();

        this.updateDebugVisualisation();
      })
      .catch((err) => {
        console.error("Error loading m-model.src", err);
        this.srcLoadingInstanceManager.error(err);
      });
  }

  private updateDebugVisualisation() {
    //   if (!this.props.debug) {
    //     this.clearDebugVisualisation();
    //   } else {
    //     if (!this.isConnected) {
    //       return;
    //     }
    //     if (!this.debugBoundingBox) {
    //       this.debugBoundingBox = new THREE.Mesh(
    //         Model.DebugBoundingBoxGeometry,
    //         Model.DebugBoundingBoxMaterial,
    //       );
    //       this.getContainer().addChild(this.debugBoundingBox);
    //     }
    //     if (this.loadedState) {
    //       const boundingBox = this.loadedState.boundingBox;
    //       if (boundingBox.centerOffset) {
    //         this.debugBoundingBox.position.copy(boundingBox.centerOffset);
    //       } else {
    //         this.debugBoundingBox.position.set(0, 0, 0);
    //       }
    //       this.debugBoundingBox.scale.copy(boundingBox.size);
    //     } else {
    //       this.debugBoundingBox.scale.set(0, 0, 0);
    //     }
    //   }
  }

  private clearDebugVisualisation() {
    // if (this.debugBoundingBox) {
    //   this.debugBoundingBox.remove();
    //   this.debugBoundingBox = null;
    // }
  }

  async asyncLoadSourceAsset(
    url: string,
    onProgress: (loaded: number, total: number) => void,
  ): Promise<playcanvas.Asset> {
    return new Promise<playcanvas.Asset>((resolve, reject) => {
      const asset = new playcanvas.Asset(url, "model", { url });
      this.model.getScene().getRenderer().assets.add(asset);
      this.model.getScene().getRenderer().assets.load(asset);
      asset.ready((asset) => {
        resolve(asset);
      });
    });
  }

  private onModelLoadComplete(): void {
    // this.socketChildrenByBone.forEach((children, boneName) => {
    //   children.forEach((child) => {
    //     this.registerSocketChild(child as TransformableElement, boneName);
    //   });
    // });
  }

  dispose() {
    if (this.loadedState) {
      const playcanvasEntity = this.model.getContainer() as playcanvas.Entity;
      playcanvasEntity.removeComponent("model");
      playcanvasEntity.removeComponent("collision");
      this.loadedState = null;
    }
    this.clearDebugVisualisation();
    this.animLoadingInstanceManager.dispose();
    this.srcLoadingInstanceManager.dispose();
  }
}
