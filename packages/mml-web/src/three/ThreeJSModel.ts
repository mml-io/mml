import { ModelLoader, ModelLoadResult } from "@mml-io/model-loader";
import * as THREE from "three";

import { MModelProps, Model } from "../elements";
import { LoadingInstanceManager } from "../loading";
import { ModelGraphics } from "../MMLGraphicsInterface";

export class ThreeJSModel extends ModelGraphics {
  private static modelLoader = new ModelLoader();
  private srcLoadingInstanceManager = new LoadingInstanceManager(`${Model.tagName}.src`);
  private animLoadingInstanceManager = new LoadingInstanceManager(`${Model.tagName}.anim`);
  private latestSrcModelPromise: Promise<ModelLoadResult> | null = null;
  protected loadedState: {
    group: THREE.Object3D;
    bones: Map<string, THREE.Bone>;
    // boundingBox: OrientedBoundingBox;
  } | null = null;

  constructor(private model: Model) {
    super(model);
  }

  disable(): void {}

  enable(): void {}

  setDebug(debug: boolean, mModelProps: MModelProps): void {
    this.updateDebugVisualisation();
  }

  setSrc(src: string, mModelProps: MModelProps): void {
    if (this.loadedState !== null) {
      // this.collideableHelper.removeColliders();
      this.loadedState.group.removeFromParent();
      ThreeJSModel.disposeOfGroup(this.loadedState.group);
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
        const boundingBox = new THREE.Box3();
        group.updateWorldMatrix(true, true);
        boundingBox.expandByObject(group);

        // const orientedBoundingBox = OrientedBoundingBox.fromSizeMatrixWorldProviderAndCenter(
        //   boundingBox.getgetSize(new Vect3(0, 0, 0)),
        //   this.container,
        //   boundingBox.getCenter(new Vect3(0, 0, 0)),
        // );
        this.loadedState = {
          group,
          bones,
          // boundingBox: orientedBoundingBox,
        };
        this.model.getContainer().add(group);
        // this.applyBounds();
        // this.collideableHelper.updateCollider(group);
        //
        // const parent = this.parentElement;
        // if (parent instanceof Model) {
        //   if (!this.latestAnimPromise && !this.currentAnimationClip) {
        //     parent.registerAttachment(this);
        //     this.registeredParentAttachment = parent;
        //   }
        // }
        //
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
  ): Promise<ModelLoadResult> {
    return await ThreeJSModel.modelLoader.load(url, onProgress);
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
      this.loadedState.group.remove();
      ThreeJSModel.disposeOfGroup(this.loadedState.group);
      this.loadedState = null;
    }
    this.clearDebugVisualisation();
    this.animLoadingInstanceManager.dispose();
    this.srcLoadingInstanceManager.dispose();
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
