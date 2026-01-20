import { CONSTANTS } from "./constants.js";
import { distance3D, Position } from "./helpers.js";

// Character controller configuration for climbing stairs
const CHARACTER_CONTROLLER_CONFIG = {
  offset: 0.01, // Small gap to prevent numerical issues
  maxStepHeight: 0.35, // Maximum height of stairs to climb
  minStepWidth: 0.2, // Minimum width on top of obstacle to step onto
  includeDynamicBodies: false, // Don't autostep over dynamic bodies
  snapToGround: 0.3, // Snap to ground when descending stairs
};

export class Player {
  public connectionId: number;

  public physicsBody: HTMLElement | null;
  public movementControl: HTMLElement | null;
  public rotationControl: HTMLElement | null;

  public characterModel: HTMLElement;
  public rifleModel: HTMLElement;

  public idleAnim: HTMLElement;
  public runAnim: HTMLElement;
  public airAnim: HTMLElement;
  public strafeLeftAnim: HTMLElement;
  public strafeRightAnim: HTMLElement;
  public runBackwardAnim: HTMLElement;

  public position: Position;
  public rotation: number;
  public rotationRadians: number;

  public debugSphere: HTMLElement;

  // Health system
  public health: number;
  public maxHealth: number;
  public isDead: boolean = false;

  private sceneGroup: HTMLElement;
  private currentInput: { x: number; y: number } | null = null;
  private updateInterval: number | null = null;
  private useCharacterController: boolean = false;
  private verticalVelocity: number = 0; // For gravity when using character controller
  private lastUpdateTime: number = 0;

  constructor(connectionId: number, sceneGroup: HTMLElement) {
    this.connectionId = connectionId;
    this.sceneGroup = sceneGroup;

    // Initialize health
    this.health = CONSTANTS.PLAYER_MAX_HEALTH;
    this.maxHealth = CONSTANTS.PLAYER_MAX_HEALTH;
    this.isDead = false;

    // Select random spawn point
    const spawnPoint =
      CONSTANTS.AVAILABLE_SPAWN_POINTS[
        Math.floor(Math.random() * CONSTANTS.AVAILABLE_SPAWN_POINTS.length)
      ];

    // Capsule dimensions: height=1.1, radius=0.6, total height = 2.3, half = 1.15
    // Adjust Y so capsule bottom sits on the floor (spawnPoint.y is floor level)
    const capsuleHalfHeight = 1.15;
    this.position = { x: spawnPoint.x, y: spawnPoint.y + capsuleHalfHeight, z: spawnPoint.z };
    this.rotation = 0;
    this.rotationRadians = 0;
    this.physicsBody = null;
    this.movementControl = null;
    this.rotationControl = null;
    this.createCharacter();
    this.createDebugSphere();
    setTimeout(() => this.startUpdateLoop(), 2000); // 2 seconds to ensure physics is ready
  }

  private createDebugSphere(): void {
    this.debugSphere = document.createElement("m-sphere");
    this.debugSphere.setAttribute("id", `muzzle-debug-${this.connectionId}`);
    this.debugSphere.setAttribute("radius", "0.05");
    this.debugSphere.setAttribute("color", "#ff0000");
    this.debugSphere.setAttribute("collide", "false");
    this.debugSphere.setAttribute("visible", "false");
    this.sceneGroup.appendChild(this.debugSphere);
  }

  public takeDamage(damage: number): boolean {
    if (this.isDead) return false;

    this.health -= damage;
    console.log(
      `[Player ${this.connectionId}] Took ${damage} damage. Health: ${this.health}/${this.maxHealth}`,
    );

    if (this.health <= 0) {
      this.health = 0;
      this.die();
      return true; // Player died
    }

    return false; // Player still alive
  }

  private die(): void {
    this.isDead = true;
    console.log(`PLAYER ${this.connectionId} DIED`);

    // Hide the player character
    if (this.characterModel) {
      this.characterModel.setAttribute("visible", "false");
    }

    // Disable movement
    this.currentInput = null;
    this.updateAnimationState();

    // Dispatch player-died event for Game.ts to handle respawn
    const playerDiedEvent = new CustomEvent("player-died", {
      detail: { connectionId: this.connectionId },
      bubbles: true,
    });
    window.dispatchEvent(playerDiedEvent);
  }

  public respawnPlayer(): void {
    // Select random spawn point
    const spawnPoint =
      CONSTANTS.AVAILABLE_SPAWN_POINTS[
        Math.floor(Math.random() * CONSTANTS.AVAILABLE_SPAWN_POINTS.length)
      ];

    // Reset health
    this.health = this.maxHealth;
    this.isDead = false;

    // Show character
    if (this.characterModel) {
      this.characterModel.setAttribute("visible", "true");
    }

    // Use existing respawn method for position
    this.respawn(spawnPoint.x, spawnPoint.y, spawnPoint.z);

    console.log(
      `[Player ${this.connectionId}] Respawned at (${spawnPoint.x}, ${spawnPoint.y}, ${spawnPoint.z})`,
    );
  }

  public updateDebugSphere(): void {
    if (!this.debugSphere) return;

    // apply rotated muzzle offset
    const rotRad = (this.rotation * Math.PI) / 180;
    const cosRot = Math.cos(rotRad);
    const sinRot = Math.sin(rotRad);

    const muzzle = CONSTANTS.GUN_MUZZLE_OFFSET;
    const muzzlePos = {
      x: this.position.x + muzzle.x * cosRot + muzzle.z * sinRot,
      y: this.position.y + muzzle.y,
      z: this.position.z - muzzle.x * sinRot + muzzle.z * cosRot,
    };

    this.debugSphere.setAttribute("x", muzzlePos.x.toString());
    this.debugSphere.setAttribute("y", muzzlePos.y.toString());
    this.debugSphere.setAttribute("z", muzzlePos.z.toString());
  }

  private createCharacter(): void {
    this.physicsBody = document.createElement("m-capsule");
    this.physicsBody.setAttribute("id", `player-body-${this.connectionId}`);
    this.physicsBody.setAttribute("x", this.position.x.toString());
    this.physicsBody.setAttribute("y", this.position.y.toString());
    this.physicsBody.setAttribute("z", this.position.z.toString());
    this.physicsBody.setAttribute("height", "1.1");
    this.physicsBody.setAttribute("radius", "0.6");
    this.physicsBody.setAttribute("color", "#00ff00");
    this.physicsBody.setAttribute("opacity", "0.0");
    this.physicsBody.setAttribute("collide", "false"); // Collision handled by character controller
    this.physicsBody.setAttribute("cast-shadows", "false");

    this.addLerp(this.physicsBody, 150, "x,y,z");

    (this.physicsBody as any).dataset.connectionId = this.connectionId.toString();
    this.sceneGroup.appendChild(this.physicsBody);

    console.log(`[Player ${this.connectionId}] Physics body created and added to DOM`);

    setTimeout(() => {
      console.log(`[Player ${this.connectionId}] Setting up character controller`);

      if ((window as any).physics && this.physicsBody) {
        const physics = (window as any).physics;

        // Check if createCharacterController method exists
        if (typeof physics.createCharacterController !== "function") {
          console.error(
            `[Player ${this.connectionId}] createCharacterController method not found!`,
          );
          this.setupFallbackRigidbody(physics);
          return;
        }

        // Try to use character controller for better stair climbing
        const success = physics.createCharacterController(
          this.physicsBody,
          CHARACTER_CONTROLLER_CONFIG,
        );

        if (success) {
          this.useCharacterController = true;
          console.log(`[Player ${this.connectionId}] Character controller created successfully`);
        } else {
          // Fallback to regular rigidbody if character controller fails
          console.log(
            `[Player ${this.connectionId}] Character controller creation failed, falling back to rigidbody`,
          );
          this.setupFallbackRigidbody(physics);
        }
      } else {
        console.error(`[Player ${this.connectionId}] Physics system or physicsBody not available`);
      }
    }, 300);

    // create character model as child of physics body
    this.characterModel = document.createElement("m-character");
    this.characterModel.setAttribute("id", `player-${this.connectionId}`);
    this.characterModel.setAttribute("collide", "false");
    this.characterModel.setAttribute("src", CONSTANTS.CHARACTER_BODY);
    this.characterModel.setAttribute("state", "idle");
    this.characterModel.setAttribute("y", "-1.1"); // Adjust model position within capsule
    this.physicsBody.appendChild(this.characterModel);

    this.rifleModel = document.createElement("m-model");
    this.rifleModel.setAttribute("socket", "mixamorigRightHand");
    this.rifleModel.setAttribute("collide", "false");
    this.rifleModel.setAttribute("x", "-5");
    this.rifleModel.setAttribute("y", "10");
    this.rifleModel.setAttribute("z", "5");
    this.rifleModel.setAttribute("rx", "180");
    this.rifleModel.setAttribute("ry", "180");
    this.rifleModel.setAttribute("rz", "90");
    this.rifleModel.setAttribute("src", CONSTANTS.RIFLE);
    this.rifleModel.setAttribute("sx", "100");
    this.rifleModel.setAttribute("sy", "100");
    this.rifleModel.setAttribute("sz", "100");
    this.rifleModel.setAttribute("visible", "true");
    this.characterModel.appendChild(this.rifleModel);

    // create movement and rotation controls
    this.movementControl = this.createMovementControl();
    this.rotationControl = this.createRotationControl();
    this.sceneGroup.appendChild(this.movementControl);
    this.sceneGroup.appendChild(this.rotationControl);

    this.idleAnim = this.createAnimation("idle");
    this.runAnim = this.createAnimation("run");
    this.airAnim = this.createAnimation("air");
    this.strafeLeftAnim = this.createAnimation("strafe-left");
    this.strafeRightAnim = this.createAnimation("strafe-right");
    this.runBackwardAnim = this.createAnimation("run-backward");
  }

  private createMovementControl(): HTMLElement {
    const control = document.createElement("m-control");
    control.setAttribute("type", "axis");
    control.setAttribute("axis", "0,1"); // Left stick / WASD
    control.setAttribute("visible-to", this.connectionId.toString());
    let lastLogTime = 0;
    control.addEventListener("input", (event: any) => {
      const inputData = event.detail;
      if (inputData.value && typeof inputData.value === "object") {
        const input = inputData.value as { x: number; y: number };
        const magnitude = Math.sqrt(input.x * input.x + input.y * input.y);

        // Log only once per 5 seconds max
        const now = Date.now();
        if (magnitude > 0.01 && now - lastLogTime > 5000) {
          console.log(
            `[Player ${this.connectionId}] Input: x=${input.x.toFixed(2)}, y=${input.y.toFixed(2)}`,
          );
          lastLogTime = now;
        }

        if (magnitude > 0.01) {
          this.currentInput = { x: input.x, y: input.y };
        } else {
          this.currentInput = null;
        }
        this.updateAnimationState();
      } else {
        this.currentInput = null;
        this.updateAnimationState();
      }
    });
    return control;
  }

  private createRotationControl(): HTMLElement {
    const control = document.createElement("m-control");
    control.setAttribute("type", "axis");
    control.setAttribute("axis", "2,3"); // Right stick / Arrow keys
    control.setAttribute("raycast-type", "cursor");
    control.setAttribute("input", "mousemove"); // Enable mouse aiming on desktop
    control.setAttribute("visible-to", this.connectionId.toString());
    control.addEventListener("input", (event: any) => {
      const inputData = event.detail;
      if (inputData.value && typeof inputData.value === "object") {
        const input = inputData.value as { x: number; y: number };
        const magnitude = Math.sqrt(input.x * input.x + input.y * input.y);

        if (magnitude > 0.01) {
          // Update rotation based on input (lower threshold for mouse precision)
          const angle = Math.atan2(input.x, -input.y);
          this.rotation = (angle * 180) / Math.PI;
          this.rotationRadians = angle;
          this.characterModel.setAttribute("ry", this.rotation.toString());
        }
      }
    });
    return control;
  }

  private createAnimation(state: string): HTMLElement {
    const animName = `ANIM_${state.toUpperCase().replace(/-/g, "_")}`;
    const animSrc = CONSTANTS[animName as keyof typeof CONSTANTS];
    const animation = document.createElement("m-animation");
    animation.setAttribute("src", animSrc.toString());
    animation.setAttribute("state", state);
    this.addLerp(animation, 150, "weight");
    this.characterModel.appendChild(animation);
    return animation;
  }

  private addLerp(element: HTMLElement, duration: number, attrs: string): void {
    const lerp = document.createElement("m-attr-lerp");
    lerp.setAttribute("attr", attrs);
    lerp.setAttribute("duration", duration.toString());
    element.appendChild(lerp);
  }

  public setTransform(element: HTMLElement, x: number, y: number, z: number, ry: number): void {
    element.setAttribute("x", x.toString());
    element.setAttribute("y", y.toString());
    element.setAttribute("z", z.toString());
    element.setAttribute("ry", ry.toString());
  }

  public getPosition(): Position {
    return this.position;
  }

  public getCurrentRotationDegrees(): number {
    return this.rotation;
  }

  public distanceTo(target: Position): number {
    return distance3D(this.getPosition(), target);
  }

  private updateAnimationState(): void {
    if (!this.currentInput) {
      this.characterModel.setAttribute("state", "idle");
      return;
    }

    // Calculate movement direction
    const movementAngle = Math.atan2(this.currentInput.x, -this.currentInput.y);

    // Calculate relative angle between movement and looking direction
    let relativeAngle = movementAngle - this.rotationRadians;

    // Normalize to -PI to PI range
    while (relativeAngle > Math.PI) relativeAngle -= 2 * Math.PI;
    while (relativeAngle < -Math.PI) relativeAngle += 2 * Math.PI;

    // Convert to degrees for easier thresholds
    const relativeDegrees = (relativeAngle * 180) / Math.PI;

    // Determine animation based on relative angle
    // Forward: -45 to 45
    // Strafe left: 45 to 135
    // Backward: 135 to -135 (or > 135 or < -135)
    // Strafe right: -135 to -45

    if (relativeDegrees >= -45 && relativeDegrees <= 45) {
      this.characterModel.setAttribute("state", "run");
    } else if (relativeDegrees > 45 && relativeDegrees <= 135) {
      this.characterModel.setAttribute("state", "strafe-left");
    } else if (relativeDegrees > 135 || relativeDegrees < -135) {
      this.characterModel.setAttribute("state", "run-backward");
    } else {
      this.characterModel.setAttribute("state", "strafe-right");
    }
  }

  private setupFallbackRigidbody(physics: any): void {
    if (!this.physicsBody) return;

    this.physicsBody.setAttribute("rigidbody", "true");
    this.physicsBody.setAttribute("kinematic", "false");
    this.physicsBody.setAttribute("mass", "1");
    this.physicsBody.setAttribute("friction", "0");
    this.physicsBody.setAttribute("restitution", "0");
    this.physicsBody.setAttribute("gravity", "9.81");

    physics.addRigidbody(this.physicsBody, {
      mass: 1,
      kinematic: false,
      friction: 0,
      restitution: 0,
      gravity: 40.0,
    });

    this.lockPlayerRotations();
  }

  private lockPlayerRotations(): void {
    // Access the physics system's internal state to lock rotations
    const physics = (window as any).physics;
    if (!physics || !this.physicsBody) return;

    // Get the rigidbody from the physics system's internal map
    const physicsState = physics.elementToBody?.get(this.physicsBody);
    if (physicsState && physicsState.rigidbody) {
      // Lock ALL rotations (X, Y, Z) to prevent rotation on collision
      // setEnabledRotations(enableX, enableY, enableZ, wakeUp)
      physicsState.rigidbody.setEnabledRotations(false, false, false, true);
      console.log(`[Player ${this.connectionId}] Locked all rotations (X, Y, Z)`);
    }
  }

  private startUpdateLoop(): void {
    this.lastUpdateTime = performance.now();

    this.updateInterval = window.setInterval(() => {
      if (!this.physicsBody) {
        console.warn(`[Player ${this.connectionId}] No physics body in update loop`);
        return;
      }

      if (!(window as any).physics) {
        console.warn(`[Player ${this.connectionId}] No physics system in update loop`);
        return;
      }

      const physics = (window as any).physics;

      // Calculate delta time
      const now = performance.now();
      const deltaTime = Math.min((now - this.lastUpdateTime) / 1000, 0.1); // Cap at 100ms
      this.lastUpdateTime = now;

      // Don't allow movement when dead
      if (this.isDead) {
        if (this.useCharacterController) {
          // Just don't move when dead
        } else if (physics.elementToBody?.has(this.physicsBody)) {
          const physicsState = physics.elementToBody.get(this.physicsBody);
          const currentVel = physicsState?.rigidbody?.linvel?.() || { x: 0, y: 0, z: 0 };
          physics.setVelocity(this.physicsBody, { x: 0, y: currentVel.y, z: 0 });
        }
        return;
      }

      try {
        if (this.useCharacterController) {
          // Use character controller for movement
          this.updateWithCharacterController(physics, deltaTime);
        } else {
          // Fallback to velocity-based movement
          this.updateWithVelocity(physics);
        }

        // Update position from element attributes
        const newPos = {
          x: parseFloat(this.physicsBody.getAttribute("x") || "0"),
          y: parseFloat(this.physicsBody.getAttribute("y") || "0"),
          z: parseFloat(this.physicsBody.getAttribute("z") || "0"),
        };
        this.position = newPos;
      } catch (error) {
        console.error(`[Player ${this.connectionId}] Physics update error:`, error);
      }
    }, CONSTANTS.TICK_RATE);
  }

  private updateWithCharacterController(physics: any, deltaTime: number): void {
    const speed = 4; // units per second
    const gravity = 20; // gravity acceleration

    // Check if grounded
    const isGrounded = physics.isCharacterGrounded(this.physicsBody);

    // Apply gravity only when not grounded
    if (isGrounded) {
      this.verticalVelocity = 0; // No vertical movement when grounded
    } else {
      this.verticalVelocity -= gravity * deltaTime;
      // Cap falling speed
      this.verticalVelocity = Math.max(this.verticalVelocity, -20);
    }

    // Calculate desired movement
    let desiredX = 0;
    let desiredZ = 0;

    if (this.currentInput) {
      desiredX = this.currentInput.x * speed * deltaTime;
      desiredZ = -this.currentInput.y * speed * deltaTime;
    }

    const desiredY = this.verticalVelocity * deltaTime;

    // Compute collision-aware movement
    const movement = physics.computeCharacterMovement(this.physicsBody, {
      x: desiredX,
      y: desiredY,
      z: desiredZ,
    });

    if (movement) {
      // Apply the movement directly to the rigidbody position
      const applied = physics.applyCharacterMovement(this.physicsBody, movement);

      // Also update element attributes immediately for visual feedback
      if (applied) {
        const newPos = physics.getCharacterPosition(this.physicsBody);
        if (newPos && this.physicsBody) {
          this.physicsBody.setAttribute("x", newPos.x.toFixed(3));
          this.physicsBody.setAttribute("y", newPos.y.toFixed(3));
          this.physicsBody.setAttribute("z", newPos.z.toFixed(3));
        }
      }
    }
  }

  private updateWithVelocity(physics: any): void {
    if (!physics.elementToBody?.has(this.physicsBody)) {
      return;
    }

    const speed = 5; // units per second
    const physicsState = physics.elementToBody.get(this.physicsBody);
    const currentVel = physicsState?.rigidbody?.linvel?.() || { x: 0, y: 0, z: 0 };

    if (this.currentInput) {
      const velocity = {
        x: this.currentInput.x * speed,
        y: currentVel.y,
        z: -this.currentInput.y * speed,
      };
      physics.setVelocity(this.physicsBody, velocity);
    } else {
      physics.setVelocity(this.physicsBody, { x: 0, y: currentVel.y, z: 0 });
    }
  }

  private stopUpdateLoop(): void {
    if (this.updateInterval !== null) {
      window.clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  public respawn(x: number, y: number, z: number): void {
    console.log(`Respawning Player ID [${this.connectionId}] at (${x}, ${y}, ${z})`);

    // Capsule dimensions: height=1.1, radius=0.6, total height = 2.3, half = 1.15
    // Adjust Y so capsule bottom sits on the floor
    const adjustedY = y + 1.15;

    if (this.physicsBody) {
      const physics = (window as any).physics;

      if (this.useCharacterController && physics) {
        // Teleport character controller to new position
        physics.setCharacterPosition(this.physicsBody, { x, y: adjustedY, z });
      }

      // Also update element attributes for consistency
      this.physicsBody.setAttribute("x", x.toString());
      this.physicsBody.setAttribute("y", adjustedY.toString());
      this.physicsBody.setAttribute("z", z.toString());
      this.physicsBody.setAttribute("ry", "0");
    }

    this.position = { x, y: adjustedY, z };
    this.rotation = 0;
    this.rotationRadians = 0;
    this.currentInput = null;
    this.verticalVelocity = 0; // Reset vertical velocity on respawn
  }

  public dispose(): void {
    this.stopUpdateLoop();

    if (this.movementControl && this.movementControl.parentNode) {
      this.movementControl.remove();
    }
    if (this.rotationControl && this.rotationControl.parentNode) {
      this.rotationControl.remove();
    }
    if (this.rifleModel && this.rifleModel.parentNode) {
      this.rifleModel.remove();
    }
    if (this.characterModel && this.characterModel.parentNode) {
      this.characterModel.remove();
    }
    if (this.physicsBody && this.physicsBody.parentNode) {
      // Remove from physics system
      const physics = (window as any).physics;
      if (physics) {
        if (this.useCharacterController) {
          physics.removeCharacterController(this.physicsBody);
        } else {
          physics.removeRigidbody(this.physicsBody);
        }
      }
      this.physicsBody.remove();
    }
    if (this.debugSphere && this.debugSphere.parentNode) {
      this.debugSphere.remove();
    }
  }
}
