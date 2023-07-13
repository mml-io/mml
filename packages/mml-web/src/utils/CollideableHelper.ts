import * as THREE from "three";

import { AttributeHandler, parseBoolAttribute } from "./attribute-handling";
import { MElement } from "../elements/MElement";
import { TransformableElement } from "../elements/TransformableElement";
import { IMMLScene } from "../MMLScene";

const collideAttributeName = "collide";
const debugAttributeName = "debug";
const defaultCollideable = true;
const defaultDebug = false;

export class CollideableHelper {
  static observedAttributes = [collideAttributeName];
  private element: MElement;

  private props = {
    collide: defaultCollideable,
    debug: false,
  };

  static AttributeHandler = new AttributeHandler<CollideableHelper>({
    [collideAttributeName]: (instance, newValue) => {
      const collide = parseBoolAttribute(newValue, defaultCollideable);
      if (collide !== instance.props.collide) {
        instance.props.collide = collide;
        instance.updateCollider(instance.colliderState.collider);
      }
    },
    [debugAttributeName]: (instance, newValue) => {
      const debug = parseBoolAttribute(newValue, defaultDebug);
      instance.props.debug = debug;
      instance.colliderUpdated();
    },
  });

  constructor(element: MElement) {
    this.element = element;
  }

  private colliderState: { scene: IMMLScene | null; collider: THREE.Object3D | null } = {
    scene: null,
    collider: null,
  };

  private colliderUpdated() {
    if (this.props.collide && this.colliderState.scene && this.colliderState.collider) {
      this.colliderState.scene.updateCollider?.(this.colliderState.collider, this.element);
    }
  }

  public updateCollider(collider: THREE.Object3D | null) {
    if (!this.element.isConnected) {
      //element not connected to scene yet - keep track of the collider for when it is connected
      this.colliderState.collider = collider;
      return;
    }

    // store the scene so that colliders can be removed from it even after this node has been removed from the DOM.
    this.colliderState.scene = this.element.getScene();

    const previousCollider = this.colliderState.collider;
    const colliderChanged = previousCollider !== collider;
    this.colliderState.collider = collider;

    const collide = this.props.collide;
    if (!collide && previousCollider === null) {
      return;
    }

    if (collide) {
      if (colliderChanged && previousCollider !== null) {
        this.colliderState.scene.removeCollider?.(previousCollider, this.element);
      }
      if (collider !== null) {
        this.colliderState.scene.addCollider?.(collider, this.element);
      }
    } else {
      if (previousCollider !== null) {
        this.colliderState.scene.removeCollider?.(previousCollider, this.element);
      }
    }
  }

  public removeColliders() {
    const scene = this.colliderState.scene;
    if (!scene) {
      // colliders were never added or the scene was already torn down
      return;
    }

    if (!this.colliderState.collider) {
      // no primary object yet, so nothing to collide with
      return;
    }

    scene.removeCollider?.(this.colliderState.collider, this.element);

    this.colliderState.scene = null;
  }

  public handle(name: string, newValue: string) {
    CollideableHelper.AttributeHandler.handle(this, name, newValue);

    // if the changed attribute is in TransformableElement, then the collider may have changed its position, rotation or scale
    if (TransformableElement.observedAttributes.includes(name)) {
      this.colliderUpdated();
    }
  }

  public parentTransformed() {
    this.colliderUpdated();
  }
}
