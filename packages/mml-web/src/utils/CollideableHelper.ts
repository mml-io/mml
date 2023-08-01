import * as THREE from "three";

import { AttributeHandler, parseBoolAttribute } from "./attribute-handling";
import { MElement } from "../elements/MElement";
import { TransformableElement } from "../elements/TransformableElement";
import { IMMLScene } from "../MMLScene";

const collideAttributeName = "collide";
const collisionIntervalAttributeName = "collision-interval";
const defaultCollideable = true;

export class CollideableHelper {
  private element: MElement;

  private props = {
    collide: defaultCollideable,
  };

  static AttributeHandler = new AttributeHandler<CollideableHelper>({
    [collideAttributeName]: (instance, newValue) => {
      const collide = parseBoolAttribute(newValue, defaultCollideable);
      if (collide !== instance.props.collide) {
        instance.props.collide = collide;
        instance.updateCollider(instance.colliderState.collider);
      }
    },
    [collisionIntervalAttributeName]: () => {
      // Collision interval is handled by the MMLCollisionTrigger, but is here for completeness of attribute handling
    },
  });
  static observedAttributes = CollideableHelper.AttributeHandler.getAttributes();

  constructor(element: MElement) {
    this.element = element;
  }

  private colliderState: {
    scene: IMMLScene | null;
    collider: THREE.Object3D | null;
    added: boolean;
  } = {
    scene: null,
    collider: null,
    added: false,
  };

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
    if (colliderChanged) {
      this.colliderState.added = false;
    }
    this.colliderState.collider = collider;

    const collide = this.props.collide;
    if (!collide && previousCollider === null) {
      this.colliderState.added = false;
      return;
    }

    if (collide) {
      if (colliderChanged && previousCollider !== null) {
        this.colliderState.scene.removeCollider?.(previousCollider, this.element);
      }
      if (collider !== null) {
        if (this.colliderState.added) {
          this.colliderState.scene.updateCollider?.(collider, this.element);
        } else {
          this.colliderState.added = true;
          this.colliderState.scene.addCollider?.(collider, this.element);
        }
      }
    } else {
      if (previousCollider !== null) {
        this.colliderState.added = false;
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
      this.updateCollider(this.colliderState.collider);
    }
  }

  public parentTransformed() {
    this.updateCollider(this.colliderState.collider);
  }
}
