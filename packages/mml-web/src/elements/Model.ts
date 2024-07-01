import { ModelLoader, ModelLoadResult } from "@mml-io/model-loader";
import * as THREE from "three";

import { MElement } from "./MElement";
import { TransformableElement } from "./TransformableElement";
import { LoadingInstanceManager } from "../loading/LoadingInstanceManager";
import {
  AttributeHandler,
  parseBoolAttribute,
  parseFloatAttribute,
} from "../utils/attribute-handling";
import { CollideableHelper } from "../utils/CollideableHelper";
import { OrientedBoundingBox } from "../utils/OrientedBoundingBox";

const defaultModelSrc = "";
const defaultModelAnim = "";
const defaultModelAnimLoop = true;
const defaultModelAnimEnabled = true;
const defaultModelAnimStartTime = 0;
const defaultModelAnimPauseTime = null;
const defaultModelCastShadows = true;
const defaultModelDebug = false;

export class Model extends TransformableElement {
  static tagName = "m-model";

  private props = {
    src: defaultModelSrc,
    anim: defaultModelAnim,
    animStartTime: defaultModelAnimStartTime,
    animPauseTime: defaultModelAnimPauseTime as number | null,
    animLoop: defaultModelAnimLoop,
    animEnabled: defaultModelAnimEnabled,
    castShadows: defaultModelCastShadows,
    debug: defaultModelDebug,
  };

  private static DebugBoundingBoxGeometry = new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  private static DebugBoundingBoxMaterial = new THREE.MeshBasicMaterial({
    color: 0xff0000,
    wireframe: true,
    transparent: true,
    opacity: 0.3,
  });

  public isModel = true;
  private static modelLoader = new ModelLoader();

  protected loadedState: {
    group: THREE.Object3D;
    bones: Map<string, THREE.Bone>;
    boundingBox: OrientedBoundingBox;
  } | null = null;
  private animationGroup: THREE.AnimationObjectGroup = new THREE.AnimationObjectGroup();
  private animationMixer: THREE.AnimationMixer = new THREE.AnimationMixer(this.animationGroup);
  private documentTimeTickListener: null | { remove: () => void } = null;

  private attachments = new Set<Model>();
  private socketChildrenByBone = new Map<string, Set<MElement>>();

  private debugBoundingBox: THREE.Mesh | null = null;

  private currentAnimationClip: THREE.AnimationClip | null = null;
  private currentAnimationAction: THREE.AnimationAction | null = null;
  private collideableHelper = new CollideableHelper(this);
  private latestAnimPromise: Promise<ModelLoadResult> | null = null;
  private latestSrcModelPromise: Promise<ModelLoadResult> | null = null;
  private registeredParentAttachment: Model | null = null;
  private srcLoadingInstanceManager = new LoadingInstanceManager(
    `${(this.constructor as typeof Model).tagName}.src`,
  );
  private animLoadingInstanceManager = new LoadingInstanceManager(
    `${(this.constructor as typeof Model).tagName}.anim`,
  );

  private static attributeHandler = new AttributeHandler<Model>({
    src: (instance, newValue) => {
      instance.setSrc(newValue);
    },
    anim: (instance, newValue) => {
      instance.setAnim(newValue);
    },
    debug: (instance, newValue) => {
      instance.props.debug = parseBoolAttribute(newValue, defaultModelDebug);
      instance.updateDebugVisualisation();
    },
    "cast-shadows": (instance, newValue) => {
      instance.props.castShadows = parseBoolAttribute(newValue, defaultModelCastShadows);
      if (instance.loadedState) {
        instance.loadedState.group.traverse((node) => {
          if ((node as THREE.Mesh).isMesh) {
            node.castShadow = instance.props.castShadows;
          }
        });
      }
    },
    "anim-enabled": (instance, newValue) => {
      instance.props.animEnabled = parseBoolAttribute(newValue, defaultModelAnimEnabled);
    },
    "anim-loop": (instance, newValue) => {
      instance.props.animLoop = parseBoolAttribute(newValue, defaultModelAnimLoop);
    },
    "anim-start-time": (instance, newValue) => {
      instance.props.animStartTime = parseFloatAttribute(newValue, defaultModelAnimStartTime);
    },
    "anim-pause-time": (instance, newValue) => {
      instance.props.animPauseTime = parseFloatAttribute(newValue, defaultModelAnimPauseTime);
    },
  });

  protected enable() {
    this.collideableHelper.enable();
  }

  protected disable() {
    this.collideableHelper.disable();
  }

  public disableSockets() {
    // Remove the socketed children from parent (so that the model doesn't contain any other bones / animatable properties)
    this.socketChildrenByBone.forEach((children) => {
      children.forEach((child) => {
        child.getContainer().removeFromParent();
      });
    });
  }

  public restoreSockets() {
    // Add the socketed children back to the parent
    if (this.loadedState) {
      this.socketChildrenByBone.forEach((children, boneName) => {
        const bone = this.loadedState!.bones.get(boneName);
        children.forEach((child) => {
          if (bone) {
            bone.add(child.getContainer());
          } else {
            this.getContainer().add(child.getContainer());
          }
        });
      });
    }
  }

  public registerSocketChild(child: TransformableElement, socketName: string): void {
    let children = this.socketChildrenByBone.get(socketName);
    if (!children) {
      children = new Set<MElement>();
      this.socketChildrenByBone.set(socketName, children);
    }
    children.add(child);

    if (this.loadedState) {
      const bone = this.loadedState.bones.get(socketName);
      if (bone) {
        bone.add(child.getContainer());
      } else {
        this.getContainer().add(child.getContainer());
      }
    }
  }

  public unregisterSocketChild(child: TransformableElement, socketName: string): void {
    const socketChildren = this.socketChildrenByBone.get(socketName);
    if (socketChildren) {
      socketChildren.delete(child);
      this.getContainer().add(child.getContainer());
      if (socketChildren.size === 0) {
        this.socketChildrenByBone.delete(socketName);
      }
    }
  }

  private onModelLoadComplete(): void {
    this.socketChildrenByBone.forEach((children, boneName) => {
      children.forEach((child) => {
        this.registerSocketChild(child as TransformableElement, boneName);
      });
    });
  }

  public registerAttachment(attachment: Model) {
    this.attachments.add(attachment);
    // Temporarily remove the sockets from the attachment so that they don't get animated
    attachment.disableSockets();
    this.animationGroup.add(attachment.loadedState!.group);
    // Restore the sockets after adding the attachment to the animation group
    attachment.restoreSockets();
    this.updateAnimation(this.getDocumentTime() || 0, true);
  }

  public unregisterAttachment(attachment: Model) {
    this.attachments.delete(attachment);
    this.animationGroup.remove(attachment.loadedState!.group);
  }

  static get observedAttributes(): Array<string> {
    return [
      ...TransformableElement.observedAttributes,
      ...Model.attributeHandler.getAttributes(),
      ...CollideableHelper.observedAttributes,
    ];
  }

  constructor() {
    super();
  }

  protected getContentBounds(): OrientedBoundingBox | null {
    if (this.loadedState) {
      return this.loadedState.boundingBox;
    }
    return null;
  }

  public parentTransformed(): void {
    this.collideableHelper.parentTransformed();
  }

  public isClickable(): boolean {
    return true;
  }

  private setSrc(newValue: string | null) {
    this.props.src = (newValue || "").trim();
    if (this.loadedState !== null) {
      this.collideableHelper.removeColliders();
      this.loadedState.group.removeFromParent();
      Model.disposeOfGroup(this.loadedState.group);
      this.loadedState = null;
      if (this.registeredParentAttachment) {
        this.registeredParentAttachment.unregisterAttachment(this);
        this.registeredParentAttachment = null;
      }
      this.applyBounds();
      this.updateDebugVisualisation();
    }
    if (!this.props.src) {
      this.latestSrcModelPromise = null;
      this.srcLoadingInstanceManager.abortIfLoading();
      this.socketChildrenByBone.forEach((children) => {
        children.forEach((child) => {
          this.getContainer().add(child.getContainer());
        });
      });
      this.applyBounds();
      this.updateDebugVisualisation();
      return;
    }
    if (!this.isConnected) {
      // Loading will happen when connected
      return;
    }

    const contentSrc = this.contentSrcToContentAddress(this.props.src);
    const srcModelPromise = this.asyncLoadSourceAsset(contentSrc, (loaded, total) => {
      this.srcLoadingInstanceManager.setProgress(loaded / total);
    });
    this.srcLoadingInstanceManager.start(this.getLoadingProgressManager(), contentSrc);
    this.latestSrcModelPromise = srcModelPromise;
    srcModelPromise
      .then((result) => {
        if (this.latestSrcModelPromise !== srcModelPromise || !this.isConnected) {
          // If we've loaded a different model since, or we're no longer connected, dispose of this one
          Model.disposeOfGroup(result.group);
          return;
        }
        result.group.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            child.castShadow = this.props.castShadows;
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

        const orientedBoundingBox = OrientedBoundingBox.fromSizeMatrixWorldProviderAndCenter(
          boundingBox.getSize(new THREE.Vector3(0, 0, 0)),
          this.container,
          boundingBox.getCenter(new THREE.Vector3(0, 0, 0)),
        );
        this.loadedState = {
          group,
          bones,
          boundingBox: orientedBoundingBox,
        };
        this.container.add(group);
        this.applyBounds();
        this.collideableHelper.updateCollider(group);

        const parent = this.parentElement;
        if (parent instanceof Model) {
          if (!this.latestAnimPromise && !this.currentAnimationClip) {
            parent.registerAttachment(this);
            this.registeredParentAttachment = parent;
          }
        }

        if (this.currentAnimationClip) {
          this.playAnimation(this.currentAnimationClip);
        }
        this.onModelLoadComplete();
        this.srcLoadingInstanceManager.finish();

        this.updateDebugVisualisation();
      })
      .catch((err) => {
        console.error("Error loading m-model.src", err);
        this.srcLoadingInstanceManager.error(err);
      });
  }

  private resetAnimationMixer() {
    // Replace the animation group to release the old animations
    this.animationMixer.stopAllAction();
    this.animationGroup = new THREE.AnimationObjectGroup();
    this.animationMixer = new THREE.AnimationMixer(this.animationGroup);
  }

  private playAnimation(anim: THREE.AnimationClip) {
    this.currentAnimationClip = anim;
    this.resetAnimationMixer();
    if (this.loadedState) {
      this.disableSockets();
      this.animationGroup.add(this.loadedState.group);
    }
    for (const animationAttachment of this.attachments) {
      animationAttachment.disableSockets();
      this.animationGroup.add(animationAttachment.loadedState!.group);
    }
    const action = this.animationMixer.clipAction(this.currentAnimationClip);
    action.play();
    if (this.loadedState) {
      this.restoreSockets();
    }
    for (const animationAttachment of this.attachments) {
      animationAttachment.restoreSockets();
    }
    this.currentAnimationAction = action;
  }

  private setAnim(newValue: string | null) {
    this.props.anim = (newValue || "").trim();

    this.resetAnimationMixer();
    this.currentAnimationAction = null;
    this.currentAnimationClip = null;

    if (!this.props.anim) {
      this.latestAnimPromise = null;
      this.animLoadingInstanceManager.abortIfLoading();

      // If the animation is removed then the model can be added to the parent attachment if the model is loaded
      if (this.loadedState) {
        const parent = this.parentElement;
        if (parent instanceof Model) {
          parent.registerAttachment(this);
          this.registeredParentAttachment = parent;
        }
      }
      return;
    }

    if (this.registeredParentAttachment) {
      this.registeredParentAttachment.unregisterAttachment(this);
      this.registeredParentAttachment = null;
    }

    if (!this.isConnected) {
      // Loading will happen when connected
      return;
    }

    const contentSrc = this.contentSrcToContentAddress(this.props.anim);
    const animPromise = this.asyncLoadSourceAsset(contentSrc, (loaded, total) => {
      this.animLoadingInstanceManager.setProgress(loaded / total);
    });
    this.animLoadingInstanceManager.start(this.getLoadingProgressManager(), contentSrc);
    this.latestAnimPromise = animPromise;
    animPromise
      .then((result) => {
        if (this.latestAnimPromise !== animPromise || !this.isConnected) {
          return;
        }
        this.latestAnimPromise = null;
        this.playAnimation(result.animations[0]);
        this.animLoadingInstanceManager.finish();
      })
      .catch((err) => {
        console.error("Error loading m-model.anim", err);
        this.animLoadingInstanceManager.error(err);
      });
  }

  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    super.attributeChangedCallback(name, oldValue, newValue);
    Model.attributeHandler.handle(this, name, newValue);
    this.collideableHelper.handle(name, newValue);
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.documentTimeTickListener = this.addDocumentTimeTickListener((documentTime) => {
      this.updateAnimation(documentTime);
    });
    if (this.loadedState) {
      throw new Error("loadedState should be null upon connection");
    }
    this.setSrc(this.props.src);
    this.setAnim(this.props.anim);
    this.updateDebugVisualisation();
  }

  disconnectedCallback() {
    // stop listening to document time ticking
    if (this.documentTimeTickListener) {
      this.documentTimeTickListener.remove();
      this.documentTimeTickListener = null;
    }
    this.collideableHelper.removeColliders();
    if (this.loadedState && this.registeredParentAttachment) {
      this.registeredParentAttachment.unregisterAttachment(this);
      this.registeredParentAttachment = null;
    }
    if (this.loadedState) {
      this.loadedState.group.removeFromParent();
      Model.disposeOfGroup(this.loadedState.group);
      this.loadedState = null;
    }
    this.latestSrcModelPromise = null;
    this.srcLoadingInstanceManager.dispose();
    this.animLoadingInstanceManager.dispose();
    this.clearDebugVisualisation();
    super.disconnectedCallback();
  }

  private triggerSocketedChildrenTransformed() {
    // Socketed children need to be updated when the animation is updated as their position may have updated
    this.socketChildrenByBone.forEach((children) => {
      children.forEach((child) => {
        if (child instanceof TransformableElement) {
          child.parentTransformed();
        }
      });
    });
  }

  private updateAnimation(docTimeMs: number, force: boolean = false) {
    if (this.currentAnimationClip) {
      if (!this.props.animEnabled && this.currentAnimationAction) {
        this.resetAnimationMixer();
        this.currentAnimationAction = null;
        this.triggerSocketedChildrenTransformed();
      } else {
        if (!this.currentAnimationAction) {
          this.currentAnimationAction = this.animationMixer.clipAction(this.currentAnimationClip);
          this.currentAnimationAction.play();
        }
        let animationTimeMs = docTimeMs - this.props.animStartTime;
        if (docTimeMs < this.props.animStartTime) {
          animationTimeMs = 0;
        } else if (this.props.animPauseTime !== null) {
          if (docTimeMs > this.props.animPauseTime) {
            animationTimeMs = this.props.animPauseTime - this.props.animStartTime;
          }
        }

        if (this.currentAnimationClip !== null) {
          if (!this.props.animLoop) {
            if (animationTimeMs > this.currentAnimationClip.duration * 1000) {
              animationTimeMs = this.currentAnimationClip.duration * 1000;
            }
          }
        }

        if (force) {
          this.animationMixer.setTime((animationTimeMs + 1) / 1000);
        }
        this.animationMixer.setTime(animationTimeMs / 1000);
        this.triggerSocketedChildrenTransformed();
      }
    }
  }

  private updateDebugVisualisation() {
    if (!this.props.debug) {
      this.clearDebugVisualisation();
    } else {
      if (!this.isConnected) {
        return;
      }
      if (!this.debugBoundingBox) {
        this.debugBoundingBox = new THREE.Mesh(
          Model.DebugBoundingBoxGeometry,
          Model.DebugBoundingBoxMaterial,
        );
        this.container.add(this.debugBoundingBox);
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

  public getModel(): THREE.Object3D | null {
    return this.loadedState?.group || null;
  }

  public getCurrentAnimation(): THREE.AnimationClip | null {
    return this.currentAnimationClip;
  }

  async asyncLoadSourceAsset(
    url: string,
    onProgress: (loaded: number, total: number) => void,
  ): Promise<ModelLoadResult> {
    return await Model.modelLoader.load(url, onProgress);
  }

  private static disposeOfGroup(group: THREE.Object3D) {
    group.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.geometry.dispose();
        if (Array.isArray(mesh.material)) {
          for (const material of mesh.material) {
            Model.disposeOfMaterial(material);
          }
        } else if (mesh.material) {
          Model.disposeOfMaterial(mesh.material);
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
