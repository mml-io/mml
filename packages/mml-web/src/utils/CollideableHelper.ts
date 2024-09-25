import { MElement } from "../elements/MElement";
import { GraphicsAdapter } from "../GraphicsAdapter";
import { IMMLScene } from "../MMLScene";
import { AttributeHandler, parseBoolAttribute } from "./attribute-handling";

const collideAttributeName = "collide";
const collisionIntervalAttributeName = "collision-interval";
const defaultCollideable = true;

/**
 * CollideableHelper is a helper class for MML elements that have meshes that should be able to be collided with.
 *
 * It reacts to the attribute values for the collide and collision-interval attributes and adds, updates, or removes the
 * collider from the MMLScene as appropriate.
 */
export class CollideableHelper<G extends GraphicsAdapter = GraphicsAdapter> {
  private element: MElement<G>;

  private props = {
    collide: defaultCollideable,
  };

  static AttributeHandler = new AttributeHandler<CollideableHelper<GraphicsAdapter>>({
    [collideAttributeName]: (instance, newValue) => {
      const collide = parseBoolAttribute(newValue, defaultCollideable);
      if (collide !== instance.props.collide) {
        instance.props.collide = collide;
        instance.updateCollider(instance.collider);
      }
    },
    [collisionIntervalAttributeName]: () => {
      // Collision interval is handled by the MMLCollisionTrigger, but is here for completeness of attribute handling
    },
  });
  static observedAttributes = CollideableHelper.AttributeHandler.getAttributes();

  constructor(element: MElement<G>) {
    this.element = element;
  }

  private scene: IMMLScene<G> | null = null;
  private collider: unknown | null = null;
  private added: boolean = false;
  private enabled: boolean = true;

  public enable() {
    if (this.enabled) {
      return;
    }

    this.enabled = true;
    this.updateCollider(this.collider);
  }

  public disable() {
    if (!this.enabled) {
      return;
    }

    this.enabled = false;
    this.updateCollider(this.collider);
  }

  public updateCollider(collider: unknown | null) {
    if (!this.element.isConnected) {
      //element not connected to scene yet - keep track of the collider for when it is connected
      this.collider = collider;
      return;
    }

    // store the scene so that colliders can be removed from it even after this node has been removed from the DOM.
    this.scene = this.element.getScene();

    const previousCollider = this.collider;
    const colliderChanged = previousCollider !== collider;
    if (colliderChanged) {
      this.added = false;
    }
    this.collider = collider;

    const shouldEnableCollider = this.props.collide && this.enabled;
    if (!shouldEnableCollider && previousCollider === null) {
      this.added = false;
      return;
    }

    if (shouldEnableCollider) {
      if (colliderChanged && previousCollider !== null) {
        this.scene.removeCollider?.(previousCollider, this.element);
      }
      if (collider !== null) {
        if (this.added) {
          this.scene.updateCollider?.(collider, this.element);
        } else {
          this.added = true;
          this.scene.addCollider?.(collider, this.element);
        }
      }
    } else {
      if (previousCollider !== null) {
        this.added = false;
        this.scene.removeCollider?.(previousCollider, this.element);
      }
    }
  }

  public removeColliders() {
    const scene = this.scene;
    if (!scene) {
      // colliders were never added or the scene was already torn down
      return;
    }

    if (!this.collider) {
      // no primary object yet, so nothing to collide with
      return;
    }

    scene.removeCollider?.(this.collider, this.element);

    this.scene = null;
  }

  public handle(name: string, newValue: string) {
    CollideableHelper.AttributeHandler.handle(this, name, newValue);
  }

  public parentTransformed() {
    this.updateCollider(this.collider);
  }
}
