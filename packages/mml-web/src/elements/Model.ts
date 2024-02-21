import * as THREE from "three";
import { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

import { MElement } from "./MElement";
import { TransformableElement } from "./TransformableElement";
import { LoadingInstanceManager } from "../loading/LoadingInstanceManager";
import {
  AttributeHandler,
  parseBoolAttribute,
  parseFloatAttribute,
} from "../utils/attribute-handling";
import { CollideableHelper } from "../utils/CollideableHelper";
import { ModelLoader } from "../utils/ModelLoader";

const defaultModelSrc = "";
const defaultModelAnim = "";
const defaultModelAnimLoop = true;
const defaultModelAnimEnabled = true;
const defaultModelAnimStartTime = 0;
const defaultModelAnimPauseTime = null;
const defaultModelCastShadows = true;

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
  };

  public isModel = true;
  private static modelLoader = new ModelLoader();
  protected gltfScene: THREE.Object3D | null = null;
  protected gtlfSceneBones = new Map<string, THREE.Bone>();
  private animationGroup: THREE.AnimationObjectGroup = new THREE.AnimationObjectGroup();
  private animationMixer: THREE.AnimationMixer = new THREE.AnimationMixer(this.animationGroup);
  private documentTimeTickListener: null | { remove: () => void } = null;

  private attachments = new Set<Model>();
  private socketChildrenByBone = new Map<string, Set<MElement>>();

  private currentAnimationClip: THREE.AnimationClip | null = null;
  private currentAnimationAction: THREE.AnimationAction | null = null;
  private collideableHelper = new CollideableHelper(this);
  private latestAnimPromise: Promise<GLTF> | null = null;
  private latestSrcModelPromise: Promise<GLTF> | null = null;
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
    "cast-shadows": (instance, newValue) => {
      instance.props.castShadows = parseBoolAttribute(newValue, defaultModelCastShadows);
      if (instance.gltfScene) {
        instance.gltfScene.traverse((node) => {
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
    this.socketChildrenByBone.forEach((children, boneName) => {
      const bone = this.gtlfSceneBones.get(boneName);
      children.forEach((child) => {
        if (bone) {
          bone.add(child.getContainer());
        } else {
          this.getContainer().add(child.getContainer());
        }
      });
    });
  }

  public registerSocketChild(child: TransformableElement, socketName: string): void {
    let children = this.socketChildrenByBone.get(socketName);
    if (!children) {
      children = new Set<MElement>();
      this.socketChildrenByBone.set(socketName, children);
    }
    children.add(child);

    if (this.gltfScene) {
      const bone = this.gtlfSceneBones.get(socketName);
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
    console.trace("registerAttachment");
    this.attachments.add(attachment);
    // Temporarily remove the sockets from the attachment so that they don't get animated
    attachment.disableSockets();
    this.animationGroup.add(attachment.gltfScene);
    // Restore the sockets after adding the attachment to the animation group
    attachment.restoreSockets();
    this.updateAnimation(this.getDocumentTime() || 0, true);
  }

  public unregisterAttachment(attachment: Model) {
    console.trace("unregisterAttachment");
    this.attachments.delete(attachment);
    this.animationGroup.remove(attachment.gltfScene);
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

  public parentTransformed(): void {
    this.collideableHelper.parentTransformed();
  }

  public isClickable(): boolean {
    return true;
  }

  private setSrc(newValue: string | null) {
    this.props.src = (newValue || "").trim();
    if (this.gltfScene !== null) {
      this.collideableHelper.removeColliders();
      this.gltfScene.removeFromParent();
      Model.disposeOfGroup(this.gltfScene);
      this.gltfScene = null;
      this.gtlfSceneBones.clear();
      if (this.registeredParentAttachment) {
        this.registeredParentAttachment.unregisterAttachment(this);
        this.registeredParentAttachment = null;
      }
      this.onModelLoadComplete();
    }
    if (!this.props.src) {
      this.latestSrcModelPromise = null;
      this.srcLoadingInstanceManager.abortIfLoading();
      this.socketChildrenByBone.forEach((children) => {
        children.forEach((child) => {
          this.getContainer().add(child.getContainer());
        });
      });
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
          Model.disposeOfGroup(result.scene);
          return;
        }
        result.scene.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            child.castShadow = this.props.castShadows;
            child.receiveShadow = true;
          }
        });
        this.latestSrcModelPromise = null;
        this.gltfScene = result.scene;
        this.gtlfSceneBones = new Map<string, THREE.Bone>();
        this.gltfScene.traverse((object) => {
          if (object instanceof THREE.Bone) {
            this.gtlfSceneBones.set(object.name, object);
          }
        });
        if (this.gltfScene) {
          this.container.add(this.gltfScene);
          this.collideableHelper.updateCollider(this.gltfScene);

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
        }
        this.onModelLoadComplete();
        this.srcLoadingInstanceManager.finish();
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
    if (this.gltfScene) {
      this.disableSockets();
      this.animationGroup.add(this.gltfScene);
    }
    for (const animationAttachment of this.attachments) {
      animationAttachment.disableSockets();
      this.animationGroup.add(animationAttachment.gltfScene);
    }
    const action = this.animationMixer.clipAction(this.currentAnimationClip);
    action.play();
    if (this.gltfScene) {
      this.restoreSockets();
    }
    for (const animationAttachment of this.attachments) {
      animationAttachment.restoreSockets();
    }
    this.currentAnimationAction = action;
  }

  private setAnim(newValue: string | null) {
    console.trace("setAnim", newValue, this.registeredParentAttachment !== null);
    this.props.anim = (newValue || "").trim();

    this.resetAnimationMixer();
    this.currentAnimationAction = null;
    this.currentAnimationClip = null;

    if (!this.props.anim) {
      this.latestAnimPromise = null;
      this.animLoadingInstanceManager.abortIfLoading();

      // If the animation is removed then the model can be added to the parent attachment if the model is loaded
      if (this.gltfScene) {
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
    if (this.gltfScene) {
      throw new Error("gltfScene should be null upon connection");
    }
    this.setSrc(this.props.src);
    this.setAnim(this.props.anim);
  }

  disconnectedCallback() {
    // stop listening to document time ticking
    if (this.documentTimeTickListener) {
      this.documentTimeTickListener.remove();
      this.documentTimeTickListener = null;
    }
    this.collideableHelper.removeColliders();
    if (this.gltfScene && this.registeredParentAttachment) {
      this.registeredParentAttachment.unregisterAttachment(this);
      this.registeredParentAttachment = null;
    }
    if (this.gltfScene) {
      this.gltfScene.removeFromParent();
      Model.disposeOfGroup(this.gltfScene);
      this.gltfScene = null;
      this.gtlfSceneBones.clear();
    }
    this.srcLoadingInstanceManager.dispose();
    this.animLoadingInstanceManager.dispose();
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

  public getModel(): THREE.Object3D<THREE.Event> | null {
    return this.gltfScene;
  }

  public getCurrentAnimation(): THREE.AnimationClip | null {
    return this.currentAnimationClip;
  }

  async asyncLoadSourceAsset(
    url: string,
    onProgress: (loaded: number, total: number) => void,
  ): Promise<GLTF> {
    return await Model.modelLoader.loadGltf(url, onProgress);
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
