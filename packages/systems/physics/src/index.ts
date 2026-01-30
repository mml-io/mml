import RAPIER from "@dimforge/rapier3d-compat";
import { ModelLoader } from "@mml-io/model-loader";
import {
  clampFinite,
  computeWorldTransformFor as mathComputeWorldTransformFor,
  Quat,
  quaternionToEulerXYZ,
  Vec3,
} from "mml-game-math-system";
import {
  ElementSystem,
  extractGeometryFromModel,
  initElementSystem,
  profiler,
} from "mml-game-systems-common";

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
};

type CharacterControllerState = {
  controller: RAPIER.KinematicCharacterController;
  collider: RAPIER.Collider;
  rigidbody: RAPIER.RigidBody;
  element: Element;
  // Stuck detection tracking
  consecutiveStuckFrames: number;
  lastDesiredMagnitude: number;
  lastPosition: { x: number; y: number; z: number };
};

export type CharacterControllerConfig = {
  offset?: number;
  maxStepHeight?: number;
  minStepWidth?: number;
  includeDynamicBodies?: boolean;
  maxSlopeClimbAngle?: number;
  minSlopeSlideAngle?: number;
  applyImpulsesToDynamicBodies?: boolean;
  snapToGround?: number | null;
  /** Enable debug logging for stuck detection and collision diagnostics */
  debug?: boolean;
  /**
   * Explicit collider height for the character (cylindrical middle section).
   * When provided along with colliderRadius, the collider is created with these
   * dimensions instead of deriving from the element's size/scale.
   */
  colliderHeight?: number;
  /**
   * Explicit collider radius for the character capsule.
   * When provided along with colliderHeight, the collider is created with these
   * dimensions instead of deriving from the element's size/scale.
   */
  colliderRadius?: number;
};

/** Diagnostic info returned when stuck detection is enabled */
export type CharacterStuckDiagnostics = {
  isStuck: boolean;
  consecutiveStuckFrames: number;
  desiredMagnitude: number;
  correctedMagnitude: number;
  numCollisions: number;
  collisions: Array<{
    toi: number;
    normal: { x: number; y: number; z: number };
    normalType: "floor" | "ceiling" | "wall";
  }>;
  position: { x: number; y: number; z: number };
  grounded: boolean;
};

class PhysicsSystem implements ElementSystem {
  private world: RAPIER.World | null = null;
  private elementToBody = new Map<Element, PhysicsElementState>();
  private bodyToElement = new Map<number, PhysicsElementState>();
  private colliderToElement = new Map<RAPIER.ColliderHandle, PhysicsElementState>();
  private characterControllers = new Map<Element, CharacterControllerState>();
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
  private modelLoader = new ModelLoader();

  // Character controller debug mode - when enabled, logs detailed stuck diagnostics
  private characterControllerDebug = false;
  // Threshold for how many consecutive stuck frames before logging diagnostics
  private stuckFrameThreshold = 3;
  // Last diagnostics for external access
  private lastStuckDiagnostics: CharacterStuckDiagnostics | null = null;

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

    const initTimer = profiler.startTimer("physics", "init");

    try {
      const rapierInitTimer = profiler.startTimer("physics", "rapier_wasm_init");
      await RAPIER.init();
      const rapierInitDuration = profiler.stopTimer(rapierInitTimer);
      console.log(`[Physics] Rapier WASM initialized in ${rapierInitDuration.toFixed(2)}ms`);

      // Merge config with defaults - check window.systemsConfig first if config is empty
      if (
        Object.keys(config).length === 0 &&
        typeof window !== "undefined" &&
        (window as any).systemsConfig
      ) {
        const savedConfig = (window as any).systemsConfig["physics"];
        if (savedConfig) {
          config = savedConfig;
        }
      }
      this.config = { ...this.config, ...config };
      console.log(`[Physics] Config applied:`, this.config);

      // Create physics world
      const gravity = new RAPIER.Vector3(0.0, -this.config.gravity, 0.0);
      this.world = new RAPIER.World(gravity);

      // Create event queue for collision detection
      this.eventQueue = new RAPIER.EventQueue(true);

      const totalDuration = profiler.stopTimer(initTimer);
      console.log(`[Physics] System initialized in ${totalDuration.toFixed(2)}ms`);
    } catch (error) {
      profiler.stopTimer(initTimer, { error: true });
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
   * @description Adds physics behavior to an MML element like m-cube, m-sphere, m-cylinder, or m-model
   * @example
   * const cube = document.querySelector('m-cube');
   * physics.addRigidbody(cube, {
   *     mass: 2.0,
   *     friction: 0.8,
   *     restitution: 0.3 // bounciness
   * });
   *
   * // For m-model with GLB collision geometry:
   * const model = document.querySelector('m-model');
   * await physics.addRigidbody(model, { kinematic: true });
   */
  async addRigidbody(
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

    // Check if element already has a rigidbody to prevent duplicates
    if (this.elementToBody.has(element)) {
      console.warn("[Physics] Element already has rigidbody, skipping duplicate add");
      return;
    }

    const tagName = element.tagName.toLowerCase();
    const timerKey = profiler.startTimer("physics", "addRigidbody", { tagName });

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

    switch (tagName) {
      case "m-cube": {
        colliderDesc = RAPIER.ColliderDesc.cuboid(
          worldScale.x / 2,
          worldScale.y / 2,
          worldScale.z / 2,
        );
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

      case "m-capsule": {
        // in rapier they use  capsule(halfHeight, radius) where halfHeight is half of the
        // cylindrical middle section. m-capsule total height = height + radius * 2
        // (height is middle section, caps add radius on each end)
        // worldScale.y already includes the full height from the element
        const capsuleRadius = Math.max(worldScale.x, worldScale.z) / 2;
        // the middle section height in world scale (halved for rapier
        const capsuleHalfHeight = Math.max(0, (worldScale.y - capsuleRadius * 2) / 2);
        colliderDesc = RAPIER.ColliderDesc.capsule(capsuleHalfHeight, capsuleRadius);
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

      case "m-model": {
        // Extract geometry from GLB and create trimesh collider
        const src = element.getAttribute("src");
        if (!src) {
          console.warn("[Physics] m-model has no src attribute, using default box collider");
          colliderDesc = RAPIER.ColliderDesc.cuboid(
            0.5 * worldScale.x,
            0.5 * worldScale.y,
            0.5 * worldScale.z,
          );
        } else {
          const geometry = await extractGeometryFromModel(src, {
            logPrefix: "[Physics]",
            modelLoader: this.modelLoader,
          });
          if (geometry) {
            // Scale vertices by worldScale to match element's visual scale
            const scaledVertices = new Float32Array(geometry.vertices.length);
            for (let i = 0; i < geometry.vertices.length; i += 3) {
              scaledVertices[i] = geometry.vertices[i] * worldScale.x;
              scaledVertices[i + 1] = geometry.vertices[i + 1] * worldScale.y;
              scaledVertices[i + 2] = geometry.vertices[i + 2] * worldScale.z;
            }

            // Create trimesh collider from scaled geometry
            colliderDesc = RAPIER.ColliderDesc.trimesh(scaledVertices, geometry.indices);
            console.log(
              `[Physics] Created trimesh collider for m-model: ${src} (scaled by ${worldScale.x}, ${worldScale.y}, ${worldScale.z})`,
            );
          } else {
            console.warn(
              `[Physics] Failed to extract geometry from ${src}, using default box collider`,
            );
            colliderDesc = RAPIER.ColliderDesc.cuboid(
              0.5 * worldScale.x,
              0.5 * worldScale.y,
              0.5 * worldScale.z,
            );
          }
        }
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
      collider,
      element,
      lerpElement,
    };

    // Store mappings
    this.elementToBody.set(element, state);
    this.bodyToElement.set(rigidBody.handle, state);
    this.colliderToElement.set(collider.handle, state);

    profiler.stopTimer(timerKey);
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
    } else {
      console.warn("Physics state not found for element:", element);
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
    } else {
      console.warn("Physics state not found for element:", element);
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
   * @description Creates a Rapier character controller for an element.
   * Character controllers handle collision detection and allow features like auto-stepping over stairs.
   * The element should be a capsule or similar shape for best results.
   * @example
   * const player = document.querySelector('m-capsule#player');
   * physics.createCharacterController(player, {
   *   offset: 0.01,
   *   maxStepHeight: 0.5,
   *   minStepWidth: 0.2,
   *   includeDynamicBodies: false
   * });
   */
  createCharacterController(element: Element, config: CharacterControllerConfig = {}): boolean {
    if (!this.world) {
      console.error("[Physics] World not initialized");
      return false;
    }

    // Check if element already has a character controller
    if (this.characterControllers.has(element)) {
      console.warn("[Physics] Element already has a character controller");
      return false;
    }

    const {
      offset = 0.01,
      maxStepHeight = 0.5,
      minStepWidth = 0.2,
      includeDynamicBodies = false,
      maxSlopeClimbAngle,
      minSlopeSlideAngle,
      applyImpulsesToDynamicBodies = true,
      snapToGround = 0.1,
    } = config;

    // Create the character controller with a slightly larger offset to prevent wall-sticking
    // at shallow angles. The Rapier docs recommend increasing this if the character
    // "gets stuck inexplicably".
    const controller = this.world.createCharacterController(offset);

    // Enable sliding along surfaces
    controller.setSlideEnabled(true);

    // Enable autostep for climbing stairs
    controller.enableAutostep(maxStepHeight, minStepWidth, includeDynamicBodies);

    // Configure slope handling if specified
    if (maxSlopeClimbAngle !== undefined) {
      controller.setMaxSlopeClimbAngle((maxSlopeClimbAngle * Math.PI) / 180);
    }
    if (minSlopeSlideAngle !== undefined) {
      controller.setMinSlopeSlideAngle((minSlopeSlideAngle * Math.PI) / 180);
    }

    // Configure snap to ground (helps with stairs and slopes)
    if (snapToGround !== null) {
      controller.enableSnapToGround(snapToGround);
    }

    // Increase normalNudgeFactor to prevent getting stuck when sliding against surfaces.
    // From Rapier source: "This is a small distance applied to the movement toward the
    // contact normals of shapes hit by the character controller. This helps shape-casting
    // not getting stuck in an always-penetrating state during the sliding calculation."
    // Default is typically very small; increasing it helps with shallow-angle wall sliding.
    controller.setNormalNudgeFactor(0.001);

    // Apply impulses to dynamic bodies we collide with
    controller.setApplyImpulsesToDynamicBodies(applyImpulsesToDynamicBodies);

    // Compute world transform for the element
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

    // Create a kinematic rigidbody for the character
    const rigidBodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(worldPosition.x, worldPosition.y, worldPosition.z)
      .setRotation({
        x: worldRotation.x,
        y: worldRotation.y,
        z: worldRotation.z,
        w: worldRotation.w,
      });

    const rigidbody = this.world.createRigidBody(rigidBodyDesc);

    // Create collider based on element type (prefer capsule for characters)
    let colliderDesc: RAPIER.ColliderDesc;

    // Check if explicit collider dimensions are provided
    if (config.colliderHeight !== undefined && config.colliderRadius !== undefined) {
      // Use explicit dimensions - colliderHeight is the cylindrical middle section
      // Total capsule height = colliderHeight + colliderRadius * 2
      const halfHeight = config.colliderHeight / 2;
      colliderDesc = RAPIER.ColliderDesc.capsule(halfHeight, config.colliderRadius);
      console.log(
        `[Physics] Created capsule collider with explicit dimensions: height=${config.colliderHeight}, radius=${config.colliderRadius}`,
      );
    } else {
      // Derive collider from element type and scale
      const tagName = element.tagName.toLowerCase();

      switch (tagName) {
        case "m-capsule": {
          const capsuleRadius = Math.max(worldScale.x, worldScale.z) / 2;
          const capsuleHalfHeight = Math.max(0, (worldScale.y - capsuleRadius * 2) / 2);
          colliderDesc = RAPIER.ColliderDesc.capsule(capsuleHalfHeight, capsuleRadius);
          break;
        }
        case "m-sphere": {
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
        default: {
          // Default to capsule shape for characters
          const defaultRadius = Math.max(worldScale.x, worldScale.z) / 2;
          const defaultHalfHeight = Math.max(0, (worldScale.y - defaultRadius * 2) / 2);
          colliderDesc = RAPIER.ColliderDesc.capsule(defaultHalfHeight, defaultRadius);
        }
      }
    }

    const collider = this.world.createCollider(colliderDesc, rigidbody);

    // Store the character controller state with stuck detection tracking
    const state: CharacterControllerState = {
      controller,
      collider,
      rigidbody,
      element,
      consecutiveStuckFrames: 0,
      lastDesiredMagnitude: 0,
      lastPosition: { x: worldPosition.x, y: worldPosition.y, z: worldPosition.z },
    };

    this.characterControllers.set(element, state);

    console.log(
      `[Physics] Created character controller for element with autostep: maxHeight=${maxStepHeight}, minWidth=${minStepWidth}`,
    );

    return true;
  }

  /**
   * Enable or disable character controller debug mode.
   * When enabled, logs detailed diagnostics when the character gets stuck.
   */
  setCharacterControllerDebug(enabled: boolean, stuckFrameThreshold: number = 3): void {
    this.characterControllerDebug = enabled;
    this.stuckFrameThreshold = stuckFrameThreshold;
    console.log(
      `[Physics] Character controller debug mode: ${enabled ? "ENABLED" : "DISABLED"}, threshold: ${stuckFrameThreshold} frames`,
    );
  }

  /**
   * Get the last stuck diagnostics (useful for external debugging UI).
   */
  getLastStuckDiagnostics(): CharacterStuckDiagnostics | null {
    return this.lastStuckDiagnostics;
  }

  /**
   * @description Computes collision-aware movement for a character controller.
   * Call this each frame with the desired movement delta.
   *
   * This method includes a post-phase manual slide detection to fix a Rapier issue
   * where grazing walls at shallow angles causes the character to get stuck. When Rapier's
   * character controller detects a TOI (time of impact) of 0 (already penetrating), it
   * enters a loop trying to resolve the penetration. After max iterations it gives up
   * and returns correctedMovement as 0. This fix detects that "stuck" state and manually
   * computes the slide movement along the wall.
   *
   * @param element The element with a character controller
   * @param desiredTranslation The desired movement vector (in world space)
   * @returns The corrected movement after collision detection, or null if no controller exists
   * @example
   * const movement = physics.computeCharacterMovement(player, { x: inputX * speed * dt, y: -gravity * dt, z: inputZ * speed * dt });
   * if (movement) {
   *   // Apply movement to element position
   * }
   */
  computeCharacterMovement(
    element: Element,
    desiredTranslation: { x: number; y: number; z: number },
  ): { x: number; y: number; z: number } | null {
    const state = this.characterControllers.get(element);
    if (!state || !this.world) {
      return null;
    }

    // Get current position for stuck detection
    const currentPos = state.rigidbody.translation();

    // Compute the movement - Rapier automatically excludes the passed collider
    state.controller.computeColliderMovement(
      state.collider,
      new RAPIER.Vector3(desiredTranslation.x, desiredTranslation.y, desiredTranslation.z),
    );

    // Get the corrected movement from Rapier
    const correctedMovement = state.controller.computedMovement();
    const grounded = state.controller.computedGrounded();
    const numCollisions = state.controller.numComputedCollisions();

    // Calculate magnitudes to detect "stuck" state
    // For horizontal stuck detection, only consider X and Z components
    const desiredHorizontalMag = Math.sqrt(
      desiredTranslation.x * desiredTranslation.x + desiredTranslation.z * desiredTranslation.z,
    );
    const correctedHorizontalMag = Math.sqrt(
      correctedMovement.x * correctedMovement.x + correctedMovement.z * correctedMovement.z,
    );
    const desiredMagnitude = Math.sqrt(
      desiredTranslation.x * desiredTranslation.x +
        desiredTranslation.y * desiredTranslation.y +
        desiredTranslation.z * desiredTranslation.z,
    );
    const correctedMagnitude = Math.sqrt(
      correctedMovement.x * correctedMovement.x +
        correctedMovement.y * correctedMovement.y +
        correctedMovement.z * correctedMovement.z,
    );

    // Detect if character is stuck (wanted to move but couldn't)
    const isHorizontallyStuck =
      desiredHorizontalMag > 0.001 && correctedHorizontalMag < desiredHorizontalMag * 0.1;
    const isFullyStuck = desiredMagnitude > 0.001 && correctedMagnitude < desiredMagnitude * 0.1;

    // Track consecutive stuck frames
    if (isHorizontallyStuck || isFullyStuck) {
      state.consecutiveStuckFrames++;
    } else {
      state.consecutiveStuckFrames = 0;
    }

    // Collect collision diagnostics
    const collisionDiagnostics: CharacterStuckDiagnostics["collisions"] = [];
    for (let i = 0; i < numCollisions; i++) {
      const collision = state.controller.computedCollision(i);
      if (collision) {
        const normal = collision.normal1;
        let normalType: "floor" | "ceiling" | "wall";
        if (normal.y > 0.5) {
          normalType = "floor";
        } else if (normal.y < -0.5) {
          normalType = "ceiling";
        } else {
          normalType = "wall";
        }
        collisionDiagnostics.push({
          toi: collision.toi,
          normal: { x: normal.x, y: normal.y, z: normal.z },
          normalType,
        });
      }
    }

    // Update diagnostics
    this.lastStuckDiagnostics = {
      isStuck: isHorizontallyStuck || isFullyStuck,
      consecutiveStuckFrames: state.consecutiveStuckFrames,
      desiredMagnitude,
      correctedMagnitude,
      numCollisions,
      collisions: collisionDiagnostics,
      position: { x: currentPos.x, y: currentPos.y, z: currentPos.z },
      grounded,
    };

    // Log diagnostics when stuck for threshold frames
    if (
      this.characterControllerDebug &&
      state.consecutiveStuckFrames === this.stuckFrameThreshold
    ) {
      console.group("[Physics] 🚨 CHARACTER STUCK DETECTED");
      console.log("Position:", {
        x: currentPos.x.toFixed(3),
        y: currentPos.y.toFixed(3),
        z: currentPos.z.toFixed(3),
      });
      console.log("Grounded:", grounded);
      console.log("Desired movement:", {
        x: desiredTranslation.x.toFixed(4),
        y: desiredTranslation.y.toFixed(4),
        z: desiredTranslation.z.toFixed(4),
        magnitude: desiredMagnitude.toFixed(4),
      });
      console.log("Corrected movement:", {
        x: correctedMovement.x.toFixed(4),
        y: correctedMovement.y.toFixed(4),
        z: correctedMovement.z.toFixed(4),
        magnitude: correctedMagnitude.toFixed(4),
      });
      console.log("Stuck type:", isHorizontallyStuck ? "horizontal" : "vertical/full");
      console.log("Number of collisions:", numCollisions);
      if (collisionDiagnostics.length > 0) {
        console.table(
          collisionDiagnostics.map((c, i) => ({
            index: i,
            toi: c.toi.toFixed(6),
            type: c.normalType,
            normalX: c.normal.x.toFixed(3),
            normalY: c.normal.y.toFixed(3),
            normalZ: c.normal.z.toFixed(3),
          })),
        );
      }
      console.groupEnd();
    }

    let finalX = correctedMovement.x;
    let finalY = correctedMovement.y;
    let finalZ = correctedMovement.z;
    let appliedFix = false;

    // POST-PHASE: If stuck, apply manual fixes based on collision type
    if (isHorizontallyStuck || isFullyStuck) {
      // Find collisions with TOI too close to 0 (penetrating)
      for (let i = 0; i < numCollisions; i++) {
        const collision = state.controller.computedCollision(i);
        if (collision && collision.toi < 0.0001) {
          const normal = collision.normal1;

          // Classify collision by normal direction
          if (Math.abs(normal.y) < 0.5) {
            // WALL COLLISION - compute slide manually (rapier should handle internally TBH)
            const dotProduct =
              desiredTranslation.x * normal.x +
              desiredTranslation.y * normal.y +
              desiredTranslation.z * normal.z;

            // Only slide if we're trying to move into the wall
            if (dotProduct < 0) {
              finalX = desiredTranslation.x - dotProduct * normal.x;
              finalY = desiredTranslation.y - dotProduct * normal.y;
              finalZ = desiredTranslation.z - dotProduct * normal.z;

              // Add a small push away from wall to escape penetration
              const pushAmount = 0.01;
              finalX += normal.x * pushAmount;
              finalZ += normal.z * pushAmount;
              appliedFix = true;

              if (this.characterControllerDebug) {
                console.log("[Physics] Applied WALL slide fix");
              }
            }
            break;
          } else if (normal.y > 0.5) {
            // FLOOR COLLISION - character stuck on floor geometry (tiny steps, seams)
            // Apply a small upward nudge to escape, then allow horizontal movement
            if (isHorizontallyStuck && desiredHorizontalMag > 0.001) {
              // Nudge upward slightly to clear the obstacle
              const upwardNudge = 0.02;
              finalY = upwardNudge;

              // Keep horizontal movement intent
              finalX = desiredTranslation.x;
              finalZ = desiredTranslation.z;
              appliedFix = true;

              if (this.characterControllerDebug) {
                console.log("[Physics] Applied FLOOR nudge fix (upward:", upwardNudge, ")");
              }
            }
            break;
          }
        }
      }

      // If still stuck after checking all TOI=0 collisions, try position-based escape
      if (!appliedFix && state.consecutiveStuckFrames >= this.stuckFrameThreshold * 2) {
        // Compare with last position - if we haven't moved at all, apply emergency escape
        const dx = currentPos.x - state.lastPosition.x;
        const dz = currentPos.z - state.lastPosition.z;
        const actualMovement = Math.sqrt(dx * dx + dz * dz);

        if (actualMovement < 0.0001 && desiredHorizontalMag > 0.001) {
          // Emergency: apply a small upward nudge to try to escape
          finalY = 0.05;
          finalX = desiredTranslation.x * 0.5;
          finalZ = desiredTranslation.z * 0.5;

          if (this.characterControllerDebug) {
            console.log("[Physics] Applied EMERGENCY escape nudge");
          }
        }
      }
    }

    /**
     * Example of programatic access to latest diagnostics
     *
     * const diagnostics = (window as any).physics.getLastStuckDiagnostics();
     * if (diagnostics?.isStuck) {
     * console.log("Stuck for", diagnostics.consecutiveStuckFrames, "frames");
     * console.log("Collisions:", diagnostics.collisions);
     * }
     *
     */

    // Update last position for next frame comparison
    state.lastPosition = { x: currentPos.x, y: currentPos.y, z: currentPos.z };
    state.lastDesiredMagnitude = desiredMagnitude;

    return { x: finalX, y: finalY, z: finalZ };
  }

  /**
   * @description Gets the current world position of a character controller
   * @param element The element with a character controller
   * @returns The current position or null if no controller exists
   */
  getCharacterPosition(element: Element): { x: number; y: number; z: number } | null {
    const state = this.characterControllers.get(element);
    if (!state) {
      return null;
    }

    const pos = state.rigidbody.translation();
    return { x: pos.x, y: pos.y, z: pos.z };
  }

  /**
   * @description Sets the world position of a character controller (teleport)
   * @param element The element with a character controller
   * @param position The new position in world space
   */
  setCharacterPosition(element: Element, position: { x: number; y: number; z: number }): boolean {
    const state = this.characterControllers.get(element);
    if (!state) {
      return false;
    }

    state.rigidbody.setTranslation(new RAPIER.Vector3(position.x, position.y, position.z), true);
    return true;
  }

  /**
   * @description Applies a computed movement to a character controller position
   * @param element The element with a character controller
   * @param movement The movement vector to apply
   */
  applyCharacterMovement(element: Element, movement: { x: number; y: number; z: number }): boolean {
    const state = this.characterControllers.get(element);
    if (!state) {
      return false;
    }

    const currentPos = state.rigidbody.translation();
    const newPos = new RAPIER.Vector3(
      currentPos.x + movement.x,
      currentPos.y + movement.y,
      currentPos.z + movement.z,
    );

    // Use setTranslation for immediate effect instead of setNextKinematicTranslation
    // which only takes effect after world.step()
    state.rigidbody.setTranslation(newPos, true);

    return true;
  }

  /**
   * @description Checks if a character controller is grounded (touching ground)
   * @param element The element with a character controller
   * @returns true if grounded, false otherwise
   */
  isCharacterGrounded(element: Element): boolean {
    const state = this.characterControllers.get(element);
    if (!state) {
      return false;
    }

    return state.controller.computedGrounded();
  }

  /**
   * @description Removes a character controller from an element
   * @param element The element to remove the character controller from
   */
  removeCharacterController(element: Element): boolean {
    const state = this.characterControllers.get(element);
    if (!state || !this.world) {
      return false;
    }

    // Remove collider and rigidbody
    this.world.removeCollider(state.collider, true);
    this.world.removeRigidBody(state.rigidbody);

    // Free the character controller
    state.controller.free();

    // Remove from map
    this.characterControllers.delete(element);

    console.log("[Physics] Removed character controller");
    return true;
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
          elementB: physicsStateB.element,
        };

        this.collisionEventListeners.forEach((callback) => callback(event));
      }
    });
  }

  // Update physics simulation
  private stepCount = 0;
  step(deltaTime?: number) {
    if (!this.world || !this.isRunning) return;

    this.stepCount++;
    if (this.stepCount % 600 === 0) {
      // Log every 600 steps (~10 seconds)
      console.log(`[Physics] Step ${this.stepCount}, bodies: ${this.elementToBody.size}`);
    }

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

      const tl = document.timeline;
      const ct = tl.currentTime;
      const currentTimeMs: number | null =
        ct == null ? null : typeof ct === "number" ? ct : ct.to("ms").value;
      if (currentTimeMs != null && currentTimeMs > this.lastNetworkTime + 100) {
        this.lastNetworkTime = currentTimeMs;
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

    // Update character controller element positions
    this.characterControllers.forEach((state, element) => {
      try {
        const pos = state.rigidbody.translation();

        // Validate translation values
        if (!isFinite(pos.x) || !isFinite(pos.y) || !isFinite(pos.z)) {
          console.warn("Invalid translation values for character element:", element);
          return;
        }

        // Compute local transform relative to parent's world transform
        const parentWorld = this.computeWorldTransformFor(element.parentElement);
        const worldPos = new Vec3(pos.x, pos.y, pos.z);
        const invParentRot = parentWorld.rotation.conjugate();
        const localPosPreScale = invParentRot.rotateVector(worldPos.sub(parentWorld.position));
        const localPos = localPosPreScale.div(parentWorld.scale);

        // Update element attributes (local space)
        element.setAttribute("x", clampFinite(localPos.x, 0).toFixed(3));
        element.setAttribute("y", clampFinite(localPos.y, 0).toFixed(3));
        element.setAttribute("z", clampFinite(localPos.z, 0).toFixed(3));
      } catch (error) {
        console.warn("Error updating character controller position:", element, error);
      }
    });

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
        // Check for character controller first
        const charState = this.characterControllers.get(el);
        if (charState) {
          try {
            if (this.world) {
              this.world.removeCollider(charState.collider, true);
              this.world.removeRigidBody(charState.rigidbody);
            }
            charState.controller.free();
            this.characterControllers.delete(el);
          } catch (e) {
            console.warn("Failed to remove character controller for element:", el, e);
          }
          continue;
        }

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
      // Clear all character controllers
      this.characterControllers.forEach((state) => {
        try {
          state.controller.free();
        } catch (_e) {
          // Ignore cleanup errors
        }
      });
      this.characterControllers.clear();

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

    // Free all character controllers
    this.characterControllers.forEach((state) => {
      try {
        state.controller.free();
      } catch (_e) {
        // Ignore cleanup errors
      }
    });
    this.characterControllers.clear();

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

    // Add rigidbody to physics system (async, but don't await to avoid blocking)
    this.addRigidbody(element, options).catch((err) => {
      console.error("[Physics] Failed to add rigidbody:", err);
    });
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
