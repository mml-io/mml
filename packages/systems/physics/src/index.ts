import RAPIER from "@dimforge/rapier3d-compat";
import {
  clampFinite,
  computeWorldTransformFor as mathComputeWorldTransformFor,
  Quat,
  quaternionToEulerXYZ,
  Vec3,
} from "mml-game-math-system";
import { ElementSystem, initElementSystem } from "mml-game-systems-common";

export type PhysicsConfig = {
  gravity?: number;
  enableCollisions?: boolean;
  maxSubsteps?: number;
  timeStep?: number;
  debug?: boolean;
};

export type RaycastResult = {
  hit: boolean;
  distance?: number;
  point?: { x: number; y: number; z: number };
  normal?: { x: number; y: number; z: number };
  element?: Element;
};

export type CollisionEvent = {
  type: "collision_start" | "collision_end" | "sensor_enter" | "sensor_exit";
  elementA: Element;
  elementB: Element;
  point?: { x: number; y: number; z: number };
  normal?: { x: number; y: number; z: number };
};

type PhysicsElementState = {
  rigidbody: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  element: Element;
  lerpElement: Element;
}

class PhysicsSystem implements ElementSystem {
  private world: RAPIER.World | null = null;
  private elementToBody = new Map<Element, PhysicsElementState>();
  private bodyToElement = new Map<number, PhysicsElementState>();
  private colliderToElement = new Map<RAPIER.ColliderHandle, PhysicsElementState>();
  private config: Required<PhysicsConfig> = {
    gravity: 9.81,
    enableCollisions: true,
    maxSubsteps: 5,
    timeStep: 1 / 60,
    debug: false,
  };
  private lastNetworkTime = 0;
  private isRunning = false;
  private eventQueue: RAPIER.EventQueue | null = null;
  private collisionEventListeners = new Set<(event: CollisionEvent) => void>();
  private debugUpdateCallback:
    | ((buffers: { vertices: Float32Array; colors: Float32Array }) => void)
    | null = null;

  private computeWorldTransformFor(element: Element | null) {
    return mathComputeWorldTransformFor(element, {
      getBodyForElement: (el: Element) => {
        const state = this.elementToBody.get(el);
        return state?.rigidbody || null;
      },
    });
  }

  async init(config: PhysicsConfig = {}) {
    // Prevent multiple initialization
    if (this.world) {
      console.warn("Physics system already initialized");
      return;
    }

    try {
      await RAPIER.init();

      // Merge config with defaults
      this.config = { ...this.config, ...config };

      // Create physics world
      const gravity = new RAPIER.Vector3(0.0, -this.config.gravity, 0.0);
      this.world = new RAPIER.World(gravity);

      // Create event queue for collision detection
      this.eventQueue = new RAPIER.EventQueue(true);
    } catch (error) {
      console.error("Failed to initialize physics system:", error);
      throw error;
    }
  }

  updateConfig(config: Partial<PhysicsConfig>) {
    this.config = { ...this.config, ...config };

    if (this.world && config.gravity !== undefined) {
      const gravity = new RAPIER.Vector3(0.0, -config.gravity, 0.0);
      this.world.gravity = gravity;
    }
  }

  /**
   * Enable or disable physics debug rendering.
   */
  setDebugEnabled(enabled: boolean) {
    this.config.debug = enabled;
  }

  /**
   * Register a callback to receive Rapier debug render buffers every step.
   * Returns an unsubscribe function.
   */
  onDebugRenderUpdate(
    callback: (buffers: { vertices: Float32Array; colors: Float32Array }) => void,
  ) {
    this.debugUpdateCallback = callback;
    return () => {
      if (this.debugUpdateCallback === callback) {
        this.debugUpdateCallback = null;
      }
    };
  }

  /**
   * Get a snapshot of the current debug render buffers.
   */
  getDebugRenderBuffers(): {
    vertices: Float32Array;
    colors: Float32Array;
  } | null {
    if (!this.world) return null;
    const { vertices, colors } = this.world.debugRender();
    return { vertices, colors };
  }

  /**
   * @description Adds physics behavior to an MML element
   * @example
   * const cube = document.querySelector('m-cube');
   * physics.addRigidbody(cube, {
   *     mass: 2.0,
   *     friction: 0.8,
   *     restitution: 0.3 // bounciness
   * });
   */
  addRigidbody(
    element: Element,
    options: {
      mass?: number;
      kinematic?: boolean;
      sensor?: boolean;
      friction?: number;
      restitution?: number;
      gravity?: number;
    } = {},
  ) {
    if (!this.world) {
      console.error("Physics world not initialized");
      return;
    }

    // Compute world transform (includes parent transforms)
    const worldTransform = this.computeWorldTransformFor(element);
    const {
      position: worldPosition,
      rotation: worldRotation,
      scale: worldScaleRaw,
    } = worldTransform;
    const worldScale = {
      x: Math.abs(worldScaleRaw.x || 1),
      y: Math.abs(worldScaleRaw.y || 1),
      z: Math.abs(worldScaleRaw.z || 1),
    };

    // Create rigidbody
    const rigidBodyDesc = options.kinematic
      ? RAPIER.RigidBodyDesc.kinematicPositionBased()
      : RAPIER.RigidBodyDesc.dynamic();

    rigidBodyDesc.setTranslation(worldPosition.x, worldPosition.y, worldPosition.z);
    rigidBodyDesc.setRotation({
      x: worldRotation.x,
      y: worldRotation.y,
      z: worldRotation.z,
      w: worldRotation.w,
    });

    if (options.mass !== undefined) {
      rigidBodyDesc.setAdditionalMass(options.mass);
    }

    // Apply custom gravity if specified
    if (options.gravity !== undefined) {
      const gravityScale = options.gravity / this.config.gravity;
      rigidBodyDesc.setGravityScale(gravityScale);
    }

    const rigidBody = this.world.createRigidBody(rigidBodyDesc);

    // Create collider based on element type using worldScale that already includes size for leaf (via math)
    let colliderDesc: RAPIER.ColliderDesc;
    const tagName = element.tagName.toLowerCase();

    switch (tagName) {
      case "m-cube": {
        colliderDesc = RAPIER.ColliderDesc.cuboid(worldScale.x / 2, worldScale.y / 2, worldScale.z / 2);
        break;
      }

      case "m-sphere": {
        // Approximate with uniform radius using max component
        const radius = Math.max(worldScale.x, worldScale.y, worldScale.z) / 2;
        colliderDesc = RAPIER.ColliderDesc.ball(radius);
        break;
      }

      case "m-cylinder": {
        const halfHeight = worldScale.y / 2;
        const radius = Math.max(worldScale.x, worldScale.z) / 2;
        colliderDesc = RAPIER.ColliderDesc.cylinder(halfHeight, radius);
        break;
      }

      case "m-plane": {
        // Use thin box per worldScale; Y is thickness
        const halfX = worldScale.x / 2;
        const halfY = worldScale.y / 2;
        const halfZ = worldScale.z / 2;
        colliderDesc = RAPIER.ColliderDesc.cuboid(halfX, Math.max(halfY, 0.005), halfZ);
        break;
      }

      default:
        colliderDesc = RAPIER.ColliderDesc.cuboid(
          0.5 * worldScale.x,
          0.5 * worldScale.y,
          0.5 * worldScale.z,
        );
    }

    // Set material properties
    if (options.friction !== undefined) {
      colliderDesc.setFriction(options.friction);
    }
    if (options.restitution !== undefined) {
      colliderDesc.setRestitution(options.restitution);
    }
    if (options.sensor) {
      colliderDesc.setSensor(true);
    }
    // Enable collision start/end events if collisions are enabled globally
    if (this.config.enableCollisions) {
      colliderDesc.setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
    }

    const collider = this.world.createCollider(colliderDesc, rigidBody);

    const lerpElement = document.createElement("m-attr-lerp");
    lerpElement.setAttribute("attr", "x,y,z,rx,ry,rz");
    lerpElement.setAttribute("duration", "100");
    element.appendChild(lerpElement);

    const state: PhysicsElementState = {
      rigidbody: rigidBody,
      collider: collider,
      element: element,
      lerpElement: lerpElement,
    };

    // Store mappings
    this.elementToBody.set(element, state);
    this.bodyToElement.set(rigidBody.handle, state);
    this.colliderToElement.set(collider.handle, state);
  }

  /**
   * @description Removes physics behavior from an MML element
   * @example
   * const cube = document.querySelector('m-cube[rigidbody]');
   * physics.removeRigidbody(cube); // Element becomes static again
   */
  removeRigidbody(element: Element) {
    if (!this.world) return;

    const physicsState = this.elementToBody.get(element);
    if (physicsState) {
      if (physicsState.collider !== undefined) {
        this.colliderToElement.delete(physicsState.collider.handle);
        this.world?.removeCollider(physicsState.collider, true);
      }
      this.bodyToElement.delete(physicsState.rigidbody.handle);
      this.elementToBody.delete(element);
      this.world.removeRigidBody(physicsState.rigidbody);
    }
  }

  /**
   * @description Casts a ray through the physics world to detect collisions
   * @example
   * const result = physics.raycast(
   *     { x: 0, y: 10, z: 0 }, // from
   *     { x: 0, y: -1, z: 0 }, // direction (normalized)
   *     20 // max distance
   * );
   * if (result.hit) {
   *     console.log('Hit element:', result.element);
   *     console.log('Hit point:', result.point);
   * }
   */
  raycast(
    from: { x: number; y: number; z: number },
    direction: { x: number; y: number; z: number },
    maxDistance: number = 100,
  ): RaycastResult {
    if (!this.world) {
      return { hit: false };
    }

    const ray = new RAPIER.Ray(
      new RAPIER.Vector3(from.x, from.y, from.z),
      new RAPIER.Vector3(direction.x, direction.y, direction.z),
    );

    const hit = this.world.castRay(ray, maxDistance, true);

    if (hit) {
      const hitPoint = ray.pointAt(hit.timeOfImpact);
      const physicsState = this.bodyToElement.get(hit.collider.parent()?.handle || -1);

      return {
        hit: true,
        distance: hit.timeOfImpact,
        point: { x: hitPoint.x, y: hitPoint.y, z: hitPoint.z },
        element: physicsState?.element,
      };
    }

    return { hit: false };
  }

  /**
   * @description Applies a continuous force to an element with physics
   * @example
   * const cube = document.querySelector('m-cube[rigidbody]');
   * physics.applyForce(cube, { x: 10, y: 0, z: 0 }); // Push right
   */
  applyForce(element: Element, force: { x: number; y: number; z: number }) {
    const physicsState = this.elementToBody.get(element);
    if (physicsState) {
      const forceVector = new RAPIER.Vector3(force.x, force.y, force.z);
      physicsState.rigidbody.addForce(forceVector, true);
    }
  }

  /**
   * @description Applies an instantaneous impulse to an element with physics
   * @example
   * const cube = document.querySelector('m-cube[rigidbody]');
   * physics.applyImpulse(cube, { x: 5, y: 10, z: 0 }); // Launch up and right
   */
  applyImpulse(element: Element, impulse: { x: number; y: number; z: number }) {
    const physicsState = this.elementToBody.get(element);
    if (physicsState) {
      const impulseVector = new RAPIER.Vector3(impulse.x, impulse.y, impulse.z);
      physicsState.rigidbody.applyImpulse(impulseVector, true);
    }
  }

  /**
   * @description Sets the velocity of an element with physics
   * @example
   * const cube = document.querySelector('m-cube[rigidbody]');
   * physics.setVelocity(cube, { x: 5, y: 0, z: 0 }); // Move right at 5 units/sec
   */
  setVelocity(element: Element, velocity: { x: number; y: number; z: number }) {
    const physicsState = this.elementToBody.get(element);
    if (physicsState) {
      const velocityVector = new RAPIER.Vector3(velocity.x, velocity.y, velocity.z);
      physicsState.rigidbody.setLinvel(velocityVector, true);
    }
  }

  /**
   * @description Gets the current velocity of an element with physics
   * @example
   * const cube = document.querySelector('m-cube[rigidbody]');
   * const velocity = physics.getVelocity(cube);
   * if (velocity) {
   *     console.log('Velocity:', velocity.x, velocity.y, velocity.z);
   * }
   */
  getVelocity(element: Element): { x: number; y: number; z: number } | null {
    const physicsState = this.elementToBody.get(element);
    if (physicsState) {
      const velocity = physicsState.rigidbody.linvel();
      return { x: velocity.x, y: velocity.y, z: velocity.z };
    }
    return null;
  }

  /**
   * @description Registers a callback for collision events between physics objects
   * @example
   * const removeListener = physics.onCollision((event) => {
   *     console.log('Collision between:', event.elementA, event.elementB);
   *     if (event.type === 'collision_start') {
   *         console.log('Objects started colliding');
   *     }
   * });
   * // Later: removeListener() to stop listening
   */
  onCollision(callback: (event: CollisionEvent) => void) {
    this.collisionEventListeners.add(callback);
    return () => this.collisionEventListeners.delete(callback);
  }

  /**
   * Move a kinematic rigidbody to a world-space translation (and optional yaw rotation).
   * Returns true if a kinematic body was found and scheduled for movement.
   */
  moveKinematic(
    element: Element,
    worldPosition: { x: number; y: number; z: number },
    options?: { yawRadians?: number },
  ): boolean {
    const physicsState = this.elementToBody.get(element);
    if (!physicsState) return false;

    const rb = physicsState.rigidbody;
    // Only drive kinematic bodies directly; dynamic bodies should be driven via forces/velocities
    if (!(rb as any).isKinematic || !(rb as any).isKinematic()) {
      return false;
    }

    // Schedule next kinematic transform in world-space
    rb.setNextKinematicTranslation(
      new (RAPIER as any).Vector3(worldPosition.x, worldPosition.y, worldPosition.z),
    );

    if (options && typeof options.yawRadians === "number") {
      const half = options.yawRadians / 2;
      const sinHalf = Math.sin(half);
      const cosHalf = Math.cos(half);
      rb.setNextKinematicRotation({ x: 0, y: sinHalf, z: 0, w: cosHalf });
    }

    return true;
  }

  private processCollisionEvents() {
    if (!this.eventQueue || !this.world) return;

    this.eventQueue.drainCollisionEvents((handle1, handle2, started) => {
      const physicsStateA = this.colliderToElement.get(handle1);
      const physicsStateB = this.colliderToElement.get(handle2);

      if (physicsStateA && physicsStateB) {
        const event: CollisionEvent = {
          type: started ? "collision_start" : "collision_end",
          elementA: physicsStateA.element,
          elementB: physicsStateB.element ,
        };

        this.collisionEventListeners.forEach((callback) => callback(event));
      }
    });
  }

  // Update physics simulation
  step(deltaTime?: number) {
    if (!this.world || !this.isRunning) return;

    const dt = deltaTime || this.config.timeStep;

    // Safety checks for deltaTime
    if (dt <= 0 || dt > 1 || !isFinite(dt)) {
      console.warn("Invalid deltaTime for physics step:", dt);
      return;
    }

    try {
      // Step the physics world with error recovery
      try {
        this.world.step(this.eventQueue || undefined);
      } catch (stepError) {
        console.error("Physics world step failed:", stepError);
        // Try to recover by stopping the system
        this.stop();
        return;
      }

      // Process collision events
      if (this.config.enableCollisions) {
        this.processCollisionEvents();
      }

      if ((document.timeline.currentTime! as number) > this.lastNetworkTime + 100) {
        this.lastNetworkTime = document.timeline.currentTime as number;
        this.updateElementPositions();
      }

      // Emit debug buffers to any registered consumer
      if (this.config.debug) {
        try {
          const { vertices, colors } = this.world.debugRender();
          window.parent.postMessage(
            {
              source: "ai-game-creator",
              type: "rapier-debug-buffers",
              vertices,
              colors,
            },
            "*",
          );
        } catch (e) {
          console.warn("Physics debug render failed:", e);
        }
      }
    } catch (error) {
      console.error("Physics step error:", error);
      // Try to recover by stopping the system
      this.stop();
    }
  }

  private updateElementPositions() {
    if (!this.world) return;

    // Create array to track invalid bodies for cleanup
    const invalidBodies: Element[] = [];

    this.elementToBody.forEach((physicsState, element) => {
      try {
        // Check if rigid body is still valid
        if (!physicsState.rigidbody.isValid()) {
          invalidBodies.push(element);
          return;
        }

        const translation = physicsState.rigidbody.translation();
        const rotation = physicsState.rigidbody.rotation();

        // Validate translation values
        if (!isFinite(translation.x) || !isFinite(translation.y) || !isFinite(translation.z)) {
          console.warn("Invalid translation values for element:", element);
          return;
        }

        // Compute local transform relative to parent's world transform
        const parentWorld = this.computeWorldTransformFor(element.parentElement);

        const worldPos = new Vec3(translation.x, translation.y, translation.z);
        const worldRot = new Quat(rotation.x, rotation.y, rotation.z, rotation.w).normalize();

        const invParentRot = parentWorld.rotation.conjugate();
        const localPosPreScale = invParentRot.rotateVector(worldPos.sub(parentWorld.position));
        const localPos = localPosPreScale.div(parentWorld.scale);
        const localRot = invParentRot.multiply(worldRot).normalize();

        // Validate translation values
        if (!isFinite(localPos.x) || !isFinite(localPos.y) || !isFinite(localPos.z)) {
          console.warn("Invalid local translation values for element:", element);
          return;
        }

        // Update element attributes (local space)
        element.setAttribute("x", clampFinite(localPos.x, 0).toFixed(3));
        element.setAttribute("y", clampFinite(localPos.y, 0).toFixed(3));
        element.setAttribute("z", clampFinite(localPos.z, 0).toFixed(3));

        // Update rotation attributes only for non-kinematic bodies to avoid stomping
        // externally-driven visual rotation (e.g., navigation facing logic)
        const isKinematic = (physicsState.rigidbody as any).isKinematic
          ? (physicsState.rigidbody as any).isKinematic()
          : false;
        if (!isKinematic) {
          // Convert quaternion to Euler angles (degrees)
          const euler = quaternionToEulerXYZ(localRot);

          // Validate rotation values
          if (!isFinite(euler.x) || !isFinite(euler.y) || !isFinite(euler.z)) {
            console.warn("Invalid local rotation values for element:", element);
            return;
          }

          element.setAttribute("rx", ((euler.x * 180) / Math.PI).toFixed(3));
          element.setAttribute("ry", ((euler.y * 180) / Math.PI).toFixed(3));
          element.setAttribute("rz", ((euler.z * 180) / Math.PI).toFixed(3));
        }
      } catch (error) {
        console.warn("Error updating element position:", element, error);
        invalidBodies.push(element);
      }
    });

    // Clean up invalid bodies
    invalidBodies.forEach((element) => {
      console.warn("Removing invalid rigid body for element:", element);
      const physicsState = this.elementToBody.get(element);
      if (physicsState) {
        this.bodyToElement.delete(physicsState.rigidbody.handle);
      }
      this.elementToBody.delete(element);
    });
  }

  /**
   * Remove any physics bodies associated with a DOM element and its descendants.
   * Intended to be called when nodes are removed from the DOM.
   */
  onElementRemoved(element: Element) {
    try {
      // Build a list including the element and all its descendant elements
      const elementsToCheck: Element[] = [element];
      try {
        elementsToCheck.push(...(Array.from(element.querySelectorAll("*")) as Element[]));
      } catch {
        // Ignore selector errors; proceed with just the element
      }

      for (const el of elementsToCheck) {
        const physicsState = this.elementToBody.get(el);
        if (!physicsState) {
          continue;
        }

        // Remove mappings first
        this.elementToBody.delete(el);
        this.bodyToElement.delete(physicsState.rigidbody.handle);
        if (physicsState.collider !== undefined) {
          this.colliderToElement.delete(physicsState.collider.handle);
          this.world?.removeCollider(physicsState.collider, true);
        }

        // Remove from the world if still valid
        if (this.world && physicsState.rigidbody.isValid()) {
          try {
            this.world.removeRigidBody(physicsState.rigidbody);
          } catch (e) {
            console.warn("Failed to remove rigid body for element:", el, e);
          }
        }
      }
    } catch (error) {
      console.warn("Error handling element removal in physics system:", error);
    }
  }

  start() {
    this.isRunning = true;
  }

  stop() {
    this.isRunning = false;

    // Clear all physics bodies to prevent corruption
    this.clearAllBodies();
  }

  private clearAllBodies() {
    try {
      // Clear all mappings
      this.elementToBody.clear();
      this.bodyToElement.clear();
      this.colliderToElement.clear();

      // If world exists, remove all bodies
      if (this.world) {
        // Note: Bodies are automatically cleaned up when world is disposed
        console.log("Cleared all physics bodies");
      }
    } catch (error) {
      console.error("Error clearing physics bodies:", error);
    }
  }

  dispose() {
    this.stop();

    if (this.world) {
      this.world.free();
      this.world = null;
    }

    this.elementToBody.clear();
    this.bodyToElement.clear();
    this.colliderToElement.clear();
    this.collisionEventListeners.clear();
  }

  // Generic interface method for SystemsManager compatibility
  processElement(element: Element, attributes: Array<{ attributeName: string; value: any }>) {
    if (this.elementToBody.has(element)) {
      return;
    }

    // Find the main rigidbody attribute
    const rigidbodyAttr = attributes.find((attr) => attr.attributeName === "rigidbody");
    if (!rigidbodyAttr || !rigidbodyAttr.value) return;

    // Build options from all attributes
    const options: any = {};
    for (const { attributeName, value } of attributes) {
      if (attributeName !== "rigidbody") {
        options[attributeName] = value;
      }
    }

    // Add rigidbody to physics system
    this.addRigidbody(element, options);
  }
}

const physicsSystem = new PhysicsSystem();
console.log("Physics system created", physicsSystem);

initElementSystem("physics", physicsSystem, [
  "rigidbody",
  "mass",
  "gravity",
  "kinematic",
  "sensor",
  "friction",
  "restitution",
]);

export default physicsSystem;
