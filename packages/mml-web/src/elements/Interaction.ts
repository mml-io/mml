import * as THREE from "three";

import { TransformableElement } from "./TransformableElement";
import { IMMLScene } from "../MMLScene";
import {
  AttributeHandler,
  parseBoolAttribute,
  parseFloatAttribute,
} from "../utils/attribute-handling";

const defaultInteractionRange = 5;
const defaultInteractionInFocus = true;
const defaultInteractionLineOfSight = false;
const defaultInteractionPriority = 1;
const defaultInteractionPrompt = null;
const defaultInteractionDebug = false;

export class Interaction extends TransformableElement {
  static tagName = "m-interaction";
  private static attributeHandler = new AttributeHandler<Interaction>({
    range: (instance, newValue) => {
      instance.props.range = parseFloatAttribute(newValue, defaultInteractionRange);
    },
    "in-focus": (instance, newValue) => {
      instance.props.inFocus = parseBoolAttribute(newValue, defaultInteractionInFocus);
    },
    "line-of-sight": (instance, newValue) => {
      instance.props.lineOfSight = parseBoolAttribute(newValue, defaultInteractionLineOfSight);
    },
    priority: (instance, newValue) => {
      instance.props.priority = parseFloatAttribute(newValue, defaultInteractionPriority);
    },
    prompt: (instance, newValue) => {
      instance.props.prompt = newValue;
    },
    debug: (instance, newValue) => {
      instance.props.debug = parseBoolAttribute(newValue, defaultInteractionDebug);
    },
  });
  static get observedAttributes(): Array<string> {
    return [
      ...TransformableElement.observedAttributes,
      ...Interaction.attributeHandler.getAttributes(),
    ];
  }

  public readonly props = {
    range: defaultInteractionRange as number,
    inFocus: defaultInteractionInFocus as boolean,
    lineOfSight: defaultInteractionLineOfSight as boolean,
    priority: defaultInteractionPriority as number,
    prompt: defaultInteractionPrompt as string | null,
    debug: defaultInteractionDebug as boolean,
  };

  private debugMesh: THREE.Mesh | null = null;
  private registeredScene: IMMLScene | null = null;

  constructor() {
    super();
  }

  public parentTransformed(): void {
    this.registeredScene?.updateInteraction(this);
  }

  public isClickable(): boolean {
    return false;
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.showDebug();
    this.registerInteraction(this);
  }

  disconnectedCallback(): void {
    this.unregisterInteraction(this);
    this.showDebug();
    super.disconnectedCallback();
  }

  public attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    super.attributeChangedCallback(name, oldValue, newValue);
    if (TransformableElement.observedAttributes.includes(name)) {
      if (this.registeredScene !== null) {
        this.registeredScene.updateInteraction(this);
      }
      this.showDebug();
    }
    if (Interaction.attributeHandler.handle(this, name, newValue)) {
      this.showDebug();
      if (this.registeredScene !== null) {
        this.registeredScene.updateInteraction(this);
      }
    }
  }

  public trigger() {
    this.dispatchEvent(new CustomEvent("interact", { detail: {} }));
  }

  private showDebug() {
    if (!this.props.debug && this.debugMesh) {
      this.debugMesh.removeFromParent();
      this.debugMesh = null;
      return;
    }

    if (this.props.debug && !this.debugMesh && this.container.parent) {
      this.debugMesh = new THREE.Mesh(
        new THREE.SphereGeometry(1, 32, 32),
        new THREE.MeshBasicMaterial({ color: 0x00aa00, wireframe: true }),
      );
      this.container.add(this.debugMesh);
    }

    if (this.debugMesh) {
      // scale the debug mesh by the inverse of the parent's scale, so that range
      // is absolute
      const scale = this.props.range;
      const parentWorldScale = new THREE.Vector3();
      this.container.getWorldScale(parentWorldScale);
      if (parentWorldScale.x !== 0 && parentWorldScale.y !== 0 && parentWorldScale.z !== 0) {
        this.debugMesh.scale.set(
          scale / parentWorldScale.x,
          scale / parentWorldScale.y,
          scale / parentWorldScale.z,
        );
      }
    }
  }

  private registerInteraction(int: Interaction) {
    const scene = this.getScene();
    this.registeredScene = scene;
    scene.addInteraction(int);
  }

  private unregisterInteraction(int: Interaction) {
    if (this.registeredScene !== null) {
      this.registeredScene.removeInteraction(int);
      this.registeredScene = null;
    }
  }
}
