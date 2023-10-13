import { MElement } from "./elements";

export type CollisionData = {
  position: { x: number; y: number; z: number };
};

export type ColliderData = {
  collider: THREE.Object3D;
  mElement: MElement;
  currentlyColliding: boolean;
  lastUpdate: number;
};

const collisionIntervalMinimumMilliseconds = 100;
const collisionIntervalAttrName = "collision-interval";
export const collisionStartEventName = "collisionstart";
export const collisionMoveEventName = "collisionmove";
export const collisionEndEventName = "collisionend";

export function getCollisionInterval(mElement: MElement): null | number {
  const collisionEventsAttr = mElement.getAttribute(collisionIntervalAttrName);
  if (collisionEventsAttr === null) {
    return null;
  }
  const parsed = parseFloat(collisionEventsAttr);
  if (isNaN(parsed)) {
    return null;
  }
  return parsed;
}

/**
 * The MMLCollisionTrigger class is responsible for keeping track of which colliders the "user" (avatar) is currently
 * colliding with, and dispatches events to the elements if they are listening for collisions.
 */
export class MMLCollisionTrigger {
  private colliderToElementMap = new Map<THREE.Object3D, ColliderData>();
  private currentCollidingColliders = new Set<THREE.Object3D>();

  static init(): MMLCollisionTrigger {
    return new MMLCollisionTrigger();
  }

  public setCurrentCollisions(currentCollisions: Map<THREE.Object3D, CollisionData> | null) {
    const currentTime = performance.now();
    if (currentCollisions) {
      for (const [collider, collisionData] of currentCollisions) {
        const colliderData = this.colliderToElementMap.get(collider);
        if (colliderData) {
          let listeningInterval = getCollisionInterval(colliderData.mElement);
          if (listeningInterval === null) {
            // Not listening for collisions - if colliding then record stopping
            if (colliderData.currentlyColliding) {
              colliderData.lastUpdate = currentTime;
              colliderData.currentlyColliding = false;
            }
          } else {
            if (listeningInterval < collisionIntervalMinimumMilliseconds) {
              listeningInterval = collisionIntervalMinimumMilliseconds;
            }
            if (colliderData.lastUpdate < currentTime - listeningInterval) {
              colliderData.lastUpdate = currentTime;
              if (!colliderData.currentlyColliding) {
                colliderData.currentlyColliding = true;
                colliderData.mElement.dispatchEvent(
                  new CustomEvent(collisionStartEventName, {
                    bubbles: true,
                    detail: {
                      position: collisionData.position,
                    },
                  }),
                );
                this.currentCollidingColliders.add(collider);
              } else {
                colliderData.mElement.dispatchEvent(
                  new CustomEvent(collisionMoveEventName, {
                    bubbles: true,
                    detail: {
                      position: collisionData.position,
                    },
                  }),
                );
              }
            }
          }
        }
      }
    }
    for (const collider of this.currentCollidingColliders) {
      if (!currentCollisions?.has(collider)) {
        this.currentCollidingColliders.delete(collider);
        const colliderData = this.colliderToElementMap.get(collider);
        if (colliderData) {
          colliderData.lastUpdate = currentTime;
          colliderData.currentlyColliding = false;
          colliderData.mElement.dispatchEvent(
            new CustomEvent(collisionEndEventName, {
              bubbles: true,
              detail: {},
            }),
          );
        }
      }
    }
  }

  public addCollider(collider: THREE.Object3D, mElement: MElement) {
    this.colliderToElementMap.set(collider, {
      collider,
      currentlyColliding: false,
      mElement,
      lastUpdate: 0,
    });
  }

  public removeCollider(collider: THREE.Object3D) {
    this.colliderToElementMap.delete(collider);
    this.currentCollidingColliders.delete(collider);
  }
}
