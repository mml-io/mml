import * as THREE from "three";

import { AnimationType } from "./AttributeAnimation";
import { MElement } from "./MElement";
import { TransformableElement } from "./TransformableElement";
import { IMMLScene } from "../MMLScene";
import { AnimatedAttributeHelper } from "../utils/AnimatedAttributeHelper";
import {
  AttributeHandler,
  parseBoolAttribute,
  parseFloatAttribute,
} from "../utils/attribute-handling";
import { OrientedBoundingBox } from "../utils/OrientedBoundingBox";
import { getRelativePositionAndRotationRelativeToObject } from "../utils/position-utils";

const defaultChatProbeRange = 10;
const defaultChatProbeDebug = false;
const chatProbeChatEventName = "chat";

export class ChatProbe extends TransformableElement {
  static tagName = "m-chat-probe";
  private registeredScene: IMMLScene | null = null;

  private chatProbeAnimatedAttributeHelper = new AnimatedAttributeHelper(this, {
    range: [
      AnimationType.Number,
      defaultChatProbeRange,
      (newValue: number) => {
        this.props.range = newValue;
        this.updateDebugVisualisation();
        this.applyBounds();
      },
    ],
  });

  private props = {
    debug: defaultChatProbeDebug,
    range: defaultChatProbeRange,
  };

  private static DebugGeometry = new THREE.SphereGeometry(1, 16, 16, 1);
  private static DebugMaterial = new THREE.MeshBasicMaterial({
    color: 0xffff00,
    wireframe: true,
    transparent: true,
    opacity: 0.3,
  });

  private static attributeHandler = new AttributeHandler<ChatProbe>({
    range: (instance, newValue) => {
      instance.chatProbeAnimatedAttributeHelper.elementSetAttribute(
        "range",
        parseFloatAttribute(newValue, defaultChatProbeRange),
      );
    },
    debug: (instance, newValue) => {
      instance.props.debug = parseBoolAttribute(newValue, defaultChatProbeDebug);
    },
  });

  static get observedAttributes(): Array<string> {
    return [
      ...TransformableElement.observedAttributes,
      ...ChatProbe.attributeHandler.getAttributes(),
    ];
  }

  private debugMesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial> | null = null;

  constructor() {
    super();
  }

  protected enable() {
    // no-op (the probe only sends events if the position is within range)
  }

  protected disable() {
    // no-op (the probe only sends events if the position is within range)
  }

  protected getContentBounds(): OrientedBoundingBox | null {
    return OrientedBoundingBox.fromSizeAndMatrixWorldProvider(
      new THREE.Vector3(this.props.range * 2, this.props.range * 2, this.props.range * 2),
      this.container,
    );
  }

  public addSideEffectChild(child: MElement): void {
    this.chatProbeAnimatedAttributeHelper.addSideEffectChild(child);

    super.addSideEffectChild(child);
  }

  public removeSideEffectChild(child: MElement): void {
    this.chatProbeAnimatedAttributeHelper.removeSideEffectChild(child);

    super.removeSideEffectChild(child);
  }

  public parentTransformed(): void {
    this.registeredScene?.updateChatProbe?.(this);
    this.updateDebugVisualisation();
  }

  public isClickable(): boolean {
    return false;
  }

  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    super.attributeChangedCallback(name, oldValue, newValue);
    ChatProbe.attributeHandler.handle(this, name, newValue);
    this.updateDebugVisualisation();
  }

  public trigger(message: string) {
    const userPositionAndRotation = this.getUserPositionAndRotation();
    const elementRelative = getRelativePositionAndRotationRelativeToObject(
      userPositionAndRotation,
      this.getContainer(),
    );

    // Check if the position is within range
    const distance = new THREE.Vector3().copy(elementRelative.position as THREE.Vector3).length();

    let withinBounds = true;
    this.getAppliedBounds().forEach((bounds) => {
      if (!bounds.containsPoint(userPositionAndRotation.position as THREE.Vector3)) {
        withinBounds = false;
      }
    });

    if (withinBounds && distance <= this.props.range) {
      this.dispatchEvent(
        new CustomEvent(chatProbeChatEventName, {
          detail: {
            message,
          },
        }),
      );
    }
  }

  connectedCallback() {
    super.connectedCallback();
    this.updateDebugVisualisation();
    this.registerChatProbe();
  }

  disconnectedCallback() {
    this.unregisterChatProbe();
    this.clearDebugVisualisation();
    super.disconnectedCallback();
  }

  private clearDebugVisualisation() {
    if (this.debugMesh) {
      this.debugMesh.removeFromParent();
      this.debugMesh = null;
    }
  }

  private updateDebugVisualisation() {
    if (!this.props.debug) {
      this.clearDebugVisualisation();
    } else {
      if (this.isConnected && !this.debugMesh) {
        const mesh = new THREE.Mesh(ChatProbe.DebugGeometry, ChatProbe.DebugMaterial);
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        this.debugMesh = mesh;
        this.container.add(this.debugMesh);
      }

      if (this.debugMesh) {
        this.debugMesh.scale.set(this.props.range, this.props.range, this.props.range);
      }
    }
  }

  private registerChatProbe() {
    const scene = this.getScene();
    this.registeredScene = scene;
    scene.addChatProbe?.(this);
  }

  private unregisterChatProbe() {
    if (this.registeredScene !== null) {
      this.registeredScene.removeChatProbe?.(this);
      this.registeredScene = null;
    }
  }
}
