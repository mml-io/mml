import { CONSTANTS } from "./constants.js";
import { distance3D, Position } from "./helpers.js";

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

    this.position = { x: spawnPoint.x, y: spawnPoint.y, z: spawnPoint.z };
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
    this.physicsBody = document.createElement("m-cylinder");
    this.physicsBody.setAttribute("id", `player-body-${this.connectionId}`);
    this.physicsBody.setAttribute("x", this.position.x.toString());
    this.physicsBody.setAttribute("y", this.position.y.toString());
    this.physicsBody.setAttribute("z", this.position.z.toString());
    this.physicsBody.setAttribute("height", "1.8");
    this.physicsBody.setAttribute("radius", "0.2");
    this.physicsBody.setAttribute("color", "#00ff00");
    this.physicsBody.setAttribute("opacity", "0.0");
    this.physicsBody.setAttribute("collide", "true");
    this.physicsBody.setAttribute("cast-shadows", "false");
    (this.physicsBody as any).dataset.connectionId = this.connectionId.toString();
    this.sceneGroup.appendChild(this.physicsBody);

    console.log(`[Player ${this.connectionId}] Physics body created and added to DOM`);

    setTimeout(() => {
      console.log(`[Player ${this.connectionId}] Adding rigidbody attributes`);
      this.physicsBody.setAttribute("rigidbody", "true");
      this.physicsBody.setAttribute("kinematic", "false");
      this.physicsBody.setAttribute("mass", "1");
      this.physicsBody.setAttribute("friction", "0");
      this.physicsBody.setAttribute("restitution", "0");
      this.physicsBody.setAttribute("gravity", "0");

      if ((window as any).physics && this.physicsBody) {
        console.log(`[Player ${this.connectionId}] Manually adding to physics system`);
        (window as any).physics.addRigidbody(this.physicsBody, {
          mass: 1,
          kinematic: false,
          friction: 0,
          restitution: 0,
          gravity: 0,
        });

        this.lockPlayerRotations();
      }
    }, 300);

    // create character model as child of physics body
    this.characterModel = document.createElement("m-character");
    this.characterModel.setAttribute("id", `player-${this.connectionId}`);
    this.characterModel.setAttribute("collide", "false");
    this.characterModel.setAttribute("src", CONSTANTS.CHARACTER_BODY);
    this.characterModel.setAttribute("state", "idle");
    this.characterModel.setAttribute("y", "-0.9");
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
    control.setAttribute("enable-mouse", "true"); // Enable mouse aiming on desktop
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

  private async waitForPhysics(): Promise<void> {
    const maxWait = 5000; // 5 seconds max
    const startTime = Date.now();

    while (!(window as any).physics && Date.now() - startTime < maxWait) {
      console.log(`[Player ${this.connectionId}] Waiting for physics system...`);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    if (!(window as any).physics) {
      console.error(`[Player ${this.connectionId}] Physics system never initialized!`);
      console.log(
        "Available on window:",
        Object.keys(window).filter((k) => k.includes("physics") || k.includes("system")),
      );
    } else {
      console.log(`[Player ${this.connectionId}] Physics system ready!`);
    }
  }

  private startUpdateLoop(): void {
    this.updateInterval = window.setInterval(() => {
      if (!this.physicsBody) {
        console.warn(`[Player ${this.connectionId}] No physics body in update loop`);
        return;
      }

      if (!(window as any).physics) {
        console.warn(`[Player ${this.connectionId}] No physics system in update loop`);
        return;
      }

      // Don't allow movement when dead
      if (this.isDead) {
        const physics = (window as any).physics;
        if (physics && physics.elementToBody && physics.elementToBody.has(this.physicsBody)) {
          physics.setVelocity(this.physicsBody, { x: 0, y: 0, z: 0 });
        }
        return;
      }

      try {
        // Check if rigidbody is registered in physics system
        const physics = (window as any).physics;
        if (!physics || !physics.elementToBody || !physics.elementToBody.has(this.physicsBody)) {
          // Rigidbody not ready yet, skip this update
          return;
        }

        // Apply velocity based on current input
        const speed = 5; // units per second
        if (this.currentInput) {
          // Apply velocity based on input
          const velocity = {
            x: this.currentInput.x * speed, // D = right, A = left
            y: 0,
            z: -this.currentInput.y * speed, // W = forward, S = backward
          };
          physics.setVelocity(this.physicsBody, velocity);
        } else {
          physics.setVelocity(this.physicsBody, { x: 0, y: 0, z: 0 });
        }

        const newPos = {
          x: parseFloat(this.physicsBody.getAttribute("x") || "0"),
          y: parseFloat(this.physicsBody.getAttribute("y") || "0"),
          z: parseFloat(this.physicsBody.getAttribute("z") || "0"),
        };
        this.position = newPos;
      } catch (error) {
        console.error(`[Player ${this.connectionId}] Physics update error:`, error);
      }
    }, 100);
  }

  private stopUpdateLoop(): void {
    if (this.updateInterval !== null) {
      window.clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  public respawn(x: number, y: number, z: number): void {
    console.log(`Respawning Player ID [${this.connectionId}] at (${x}, ${y}, ${z})`);

    // Adjust y position so cylinder bottom sits at floor level
    const adjustedY = y + 0.9;

    if (this.physicsBody) {
      this.physicsBody.setAttribute("x", x.toString());
      this.physicsBody.setAttribute("y", adjustedY.toString());
      this.physicsBody.setAttribute("z", z.toString());
      this.physicsBody.setAttribute("ry", "0");
    }

    this.position = { x, y: adjustedY, z };
    this.rotation = 0;
    this.rotationRadians = 0;
    this.currentInput = null;
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
      // Remove rigidbody from physics system
      if ((window as any).physics) {
        (window as any).physics.removeRigidbody(this.physicsBody);
      }
      this.physicsBody.remove();
    }
    if (this.debugSphere && this.debugSphere.parentNode) {
      this.debugSphere.remove();
    }
  }
}
