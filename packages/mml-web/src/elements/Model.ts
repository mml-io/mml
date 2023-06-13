import * as THREE from "three";

import { TransformableElement } from "./TransformableElement";
import {
  AttributeHandler,
  parseBoolAttribute,
  parseFloatAttribute,
} from "../utils/attribute-handling";
import { CollideableHelper } from "../utils/CollideableHelper";
import { GLTFLoader, GLTFResult, loadGltfAsPromise } from "../utils/gltf";

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

  protected gltfScene: THREE.Object3D | null = null;
  private animationGroup: THREE.AnimationObjectGroup = new THREE.AnimationObjectGroup();
  private animationMixer: THREE.AnimationMixer = new THREE.AnimationMixer(this.animationGroup);

  private animationFrameHandle: number | null = null;
  private currentAnimation: THREE.AnimationClip | null = null;
  private currentAnimationAction: THREE.AnimationAction | null = null;
  private collideableHelper = new CollideableHelper(this);
  private latestAnimPromise: Promise<GLTFResult> | null = null;
  private latestSrcModelPromise: Promise<GLTFResult> | null = null;
  private registeredParentAttachment: Model | null = null;

  private static attributeHandler = new AttributeHandler<Model>({
    src: (instance, newValue) => {
      instance.props.src = (newValue || "").trim();
      if (instance.gltfScene !== null) {
        instance.collideableHelper.removeColliders();
        instance.gltfScene.removeFromParent();
        instance.gltfScene = null;
        instance.registeredParentAttachment = null;
      }

      if (!instance.props.src) {
        instance.latestSrcModelPromise = null;
        return;
      }

      const srcModelPromise = instance.asyncLoadSourceAsset(instance.props.src);
      instance.latestSrcModelPromise = srcModelPromise;
      srcModelPromise.then((result) => {
        if (instance.latestSrcModelPromise !== srcModelPromise) {
          return;
        }
        instance.latestSrcModelPromise = null;
        instance.gltfScene = result.scene;
        if (instance.gltfScene) {
          instance.container.add(instance.gltfScene);
          instance.collideableHelper.updateCollider(instance.gltfScene);

          const parent = instance.parentElement;
          if (parent instanceof Model) {
            parent.registerAttachment(instance.gltfScene);
            instance.registeredParentAttachment = parent;
          }

          if (instance.currentAnimation) {
            instance.playAnimation(instance.currentAnimation);
          }
        }
      });
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
    anim: (instance, newValue) => {
      instance.props.anim = (newValue || "").trim();
      if (!instance.props.anim) {
        if (instance.currentAnimationAction) {
          if (instance.gltfScene) {
            instance.animationMixer.uncacheRoot(instance.gltfScene);
          }
          instance.animationMixer.stopAllAction();
        }
        instance.latestAnimPromise = null;
        instance.currentAnimationAction = null;
        instance.currentAnimation = null;
        if (instance.gltfScene) {
          instance.animationGroup.remove(instance.gltfScene);
        }
        return;
      }

      if (instance.currentAnimationAction !== null) {
        instance.animationMixer.stopAllAction();
        instance.currentAnimationAction = null;
      }

      const animPromise = loadGltfAsPromise(Model.gltfLoader, instance.props.anim);
      instance.latestAnimPromise = animPromise;
      animPromise.then((result) => {
        if (instance.latestAnimPromise !== animPromise) {
          return;
        }
        instance.latestAnimPromise = null;
        instance.playAnimation(result.animations[0]);
      });
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

  private playAnimation(anim: THREE.AnimationClip) {
    this.currentAnimation = anim;
    if (this.gltfScene) {
      this.animationGroup.remove(this.gltfScene);
    }
    this.animationMixer.stopAllAction();
    const action = this.animationMixer.clipAction(this.currentAnimation);
    action.play();
    this.currentAnimationAction = action;
    if (this.gltfScene) {
      this.animationGroup.add(this.gltfScene);
    }
  }

  public registerAttachment(attachment: THREE.Object3D) {
    this.animationGroup.add(attachment);
    this.updateAnimation();
  }

  public unregisterAttachment(attachment: THREE.Object3D) {
    this.animationGroup.remove(attachment);
  }

  static get observedAttributes(): Array<string> {
    return [
      ...TransformableElement.observedAttributes,
      ...Model.attributeHandler.getAttributes(),
      ...CollideableHelper.observedAttributes,
    ];
  }

  private static gltfLoader = new GLTFLoader();

  constructor() {
    super();

    // TODO - only create this if there is an animation
    window.requestAnimationFrame(() => this.tick());
  }

  public parentTransformed(): void {
    this.collideableHelper.parentTransformed();
  }

  public isClickable(): boolean {
    return true;
  }

  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    super.attributeChangedCallback(name, oldValue, newValue);
    Model.attributeHandler.handle(this, name, newValue);
    this.collideableHelper.handle(name, newValue);
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.animationFrameHandle = window.requestAnimationFrame(() => this.tick());
    if (this.gltfScene) {
      this.collideableHelper.updateCollider(this.gltfScene);
    }
  }

  disconnectedCallback() {
    if (this.animationFrameHandle !== null) {
      window.cancelAnimationFrame(this.animationFrameHandle);
      this.animationFrameHandle = null;
    }
    this.collideableHelper.removeColliders();
    if (this.gltfScene && this.registeredParentAttachment) {
      this.registeredParentAttachment.unregisterAttachment(this.gltfScene);
      this.registeredParentAttachment = null;
    }
    super.disconnectedCallback();
  }

  private updateAnimation() {
    const docTimeMs = this.getDocumentTime() || document.timeline.currentTime || 0;

    if (this.currentAnimation) {
      if (!this.props.animEnabled) {
        this.animationMixer.stopAllAction();
        this.currentAnimationAction = null;
      } else {
        if (!this.currentAnimationAction) {
          this.currentAnimationAction = this.animationMixer.clipAction(this.currentAnimation);
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

        if (this.currentAnimation !== null) {
          if (!this.props.animLoop) {
            if (animationTimeMs > this.currentAnimation.duration * 1000) {
              animationTimeMs = this.currentAnimation.duration * 1000;
            }
          }
        }

        this.animationMixer.setTime(animationTimeMs / 1000);
      }
    }
  }

  private tick() {
    this.updateAnimation();
    this.animationFrameHandle = window.requestAnimationFrame(() => this.tick());
  }

  public getModel(): THREE.Object3D<THREE.Event> | null {
    return this.gltfScene;
  }

  public getCurrentAnimation(): THREE.AnimationClip | null {
    return this.currentAnimation;
  }

  async asyncLoadSourceAsset(url: string) {
    const gltf = await loadGltfAsPromise(Model.gltfLoader, url);
    gltf.scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = this.props.castShadows;
        child.receiveShadow = true;
      }
    });
    return gltf;
  }
}
