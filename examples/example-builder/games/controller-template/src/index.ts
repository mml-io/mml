/**
 * This is a minimal template demonstrating how to create a physics-based
 * character controller using the MML Game Engine.
 *
 * 1- creating a physics-enabled player body (m-capsule with rigidbody)
 * 2- using m-control elements for input (WASD/Left Stick for movement)
 * 3- using m-control with mouse for rotation/aiming (Right Stick/Mouse)
 * 4- applying velocity-based movement while preserving gravity
 * 5- locking rigidbody rotations to prevent tumbling
 * 6- character model with animation states
 *
 * CONTROLS:
 * - WASD / left Stick: Move the character
 * - mouse / right Stick: Rotate/aim the character
 */

const CONSTANTS = {
  // character model assets
  CHARACTER_BODY: "/assets/models/rifle_guy.glb",
  // animation files
  ANIM_IDLE: "/assets/models/rifle_idle.glb",
  ANIM_RUN: "/assets/models/rifle_run.glb",
  ANIM_AIR: "/assets/models/rifle_air.glb",
  ANIM_STRAFE_LEFT: "/assets/models/rifle_run_strafe_left.glb",
  ANIM_STRAFE_RIGHT: "/assets/models/rifle_run_strafe_right.glb",
  ANIM_RUN_BACKWARD: "/assets/models/rifle_run_backward.glb",

  // movement settings
  PLAYER_SPEED: 5, // units per second
  // spawn position (center of map, slightly above floor)
  SPAWN_POSITION: { x: 0, y: 2, z: 0 },
};

// type definitions
interface Position {
  x: number;
  y: number;
  z: number;
}

/**
 * the camera class creates a top-down camera that follows the player
 *
 * - uses m-camera element with priority to override default camera
 * - positioned above and behind the player for top-down view
 * - smooth following via m-attr-lerp for interpolation
 * - visible-to attribute ensures each player has their own camera
 */
class Camera {
  private cameraElement: HTMLElement;
  private lerp: HTMLElement;

  constructor(connectionId: number, parent: HTMLElement) {
    // create the camera element
    this.cameraElement = document.createElement("m-camera");
    this.cameraElement.setAttribute("visible-to", connectionId.toString());
    this.cameraElement.setAttribute("priority", "100"); // high priority to override default

    // initial position (will be updated to follow player)
    this.cameraElement.setAttribute("x", "0");
    this.cameraElement.setAttribute("y", "12"); // height above player
    this.cameraElement.setAttribute("z", "8"); // distance behind player

    // camera rotation for top-down angled view
    this.cameraElement.setAttribute("rx", "-55"); // tilt down to look at player
    this.cameraElement.setAttribute("ry", "0");
    this.cameraElement.setAttribute("rz", "0");

    // add smooth interpolation for camera movement
    this.lerp = document.createElement("m-attr-lerp");
    this.lerp.setAttribute("attr", "x,y,z"); // lerp position attributes
    this.lerp.setAttribute("duration", "200"); // smooth follow speed (ms)
    this.cameraElement.appendChild(this.lerp);

    parent.appendChild(this.cameraElement);
  }

  /**
   * updates the camera position to follow a target position
   * the camera maintains its offset above and behind the target
   */
  public setPosition(x: number, y: number, z: number): void {
    this.cameraElement.setAttribute("x", x.toString());
    this.cameraElement.setAttribute("y", (y + 12).toString()); // offset above
    this.cameraElement.setAttribute("z", (z + 8).toString()); // offset behind
  }

  public dispose(): void {
    this.lerp?.remove();
    this.cameraElement?.remove();
  }
}

// stairs creation
interface StairsConfig {
  stepsCount: number; // number of steps
  stepHeight: number; // height of each step
  stepDepth: number; // depth of each step (how far it extends)
  stepWidth: number; // width of each step
  startX: number; // x position of the stairs
  startZ: number; // z position where stairs begin
  color?: string; // optional color for steps
  platformWidth?: number; // width of the platform at top
  platformDepth?: number; // depth of the platform at top
  platformColor?: string; // optional color for platform
}

/**
 * creates a staircase with an elevated platform at the top
 *
 * @param container - the parent element to append stairs to
 * @param config - configuration for the stairs
 * @returns object containing references to created elements
 */
function createStairs(
  container: HTMLElement,
  config: StairsConfig,
): { steps: HTMLElement[]; platform: HTMLElement } {
  const {
    stepsCount,
    stepHeight,
    stepDepth,
    stepWidth,
    startX,
    startZ,
    color = "#5a5a5a",
    platformWidth = stepWidth + 2,
    platformDepth = 4,
    platformColor = "#4a4a4a",
  } = config;

  const steps: HTMLElement[] = [];

  // create each step
  for (let i = 0; i < stepsCount; i++) {
    const step = document.createElement("m-cube");

    // calculate position: y center is at (stepNumber * stepHeight) - (stepHeight / 2)
    const yCenter = (i + 1) * stepHeight - stepHeight / 2;
    const zPosition = startZ + i * stepDepth;

    step.setAttribute("id", `stair-${i + 1}`);
    step.setAttribute("x", startX.toString());
    step.setAttribute("y", yCenter.toString());
    step.setAttribute("z", zPosition.toString());
    step.setAttribute("width", stepWidth.toString());
    step.setAttribute("height", stepHeight.toString());
    step.setAttribute("depth", stepDepth.toString());
    step.setAttribute("color", color);

    // physics attributes for rapier
    step.setAttribute("rigidbody", "true");
    step.setAttribute("kinematic", "true");
    step.setAttribute("nav-mesh", "true");

    container.appendChild(step);
    steps.push(step);
  }

  // create the elevated platform at the top of stairs
  const platform = document.createElement("m-cube");
  const totalStairsDepth = stepsCount * stepDepth;
  const platformSurfaceY = stepsCount * stepHeight; // top surface of platform
  const platformYCenter = platformSurfaceY - 0.25; // center of 0.5 height platform
  const platformZ = startZ + totalStairsDepth + platformDepth / 2 - stepDepth / 2;

  platform.setAttribute("id", "elevated-platform");
  platform.setAttribute("x", startX.toString());
  platform.setAttribute("y", platformYCenter.toString());
  platform.setAttribute("z", platformZ.toString());
  platform.setAttribute("width", platformWidth.toString());
  platform.setAttribute("height", "0.5");
  platform.setAttribute("depth", platformDepth.toString());
  platform.setAttribute("color", platformColor);

  // physics attributes for rapier
  platform.setAttribute("rigidbody", "true");
  platform.setAttribute("kinematic", "true");
  platform.setAttribute("nav-mesh", "true");

  container.appendChild(platform);

  return { steps, platform };
}

/**
 * the player class handles:
 * - create the physics body (capsule collider)
 * - create the visual character model
 * - input handling via m-control elements
 * - physics-based movement with rapier velocity
 * - animation state management
 */
class Player {
  // player identification
  public connectionId: number;

  // dom elements
  public physicsBody: HTMLElement | null = null; // the capsule with rigidbody
  public characterModel: HTMLElement | null = null; // the visual m-character
  public movementControl: HTMLElement | null = null; // m-control for WASD/Left Stick
  public rotationControl: HTMLElement | null = null; // m-control for Mouse/Right Stick
  public camera: Camera | null = null; // top-down camera that follows player

  // transform state
  public position: Position;
  public rotation: number = 0; // degrees
  public rotationRadians: number = 0;

  // internal state
  private sceneGroup: HTMLElement;
  private currentInput: { x: number; y: number } | null = null;
  private updateInterval: number | null = null;

  constructor(connectionId: number, sceneGroup: HTMLElement) {
    this.connectionId = connectionId;
    this.sceneGroup = sceneGroup;
    this.position = { ...CONSTANTS.SPAWN_POSITION };

    // create the player's components
    this.createCharacter();

    // create the camera that follows this player
    this.camera = new Camera(connectionId, sceneGroup);
    this.camera.setPosition(this.position.x, this.position.y, this.position.z);

    // start the physics update loop after a delay
    // (ensures physics system is initialized)
    setTimeout(() => this.startUpdateLoop(), 1000);
  }

  /**
   * create all the dom elements needed for the player:
   * 1- physics body (m-capsule with rigidbody)
   * 2- character model (m-character)
   * 3- input controls (m-control elements)
   * 4- animations
   */
  private createCharacter(): void {
    // 1: create the physics body (capsule collider)
    // we use an m-capsule because it's ideal for character physics:
    // - smooth edges prevent getting stuck on geometry
    // - good for walking up stairs and slopes
    this.physicsBody = document.createElement("m-capsule");
    this.physicsBody.setAttribute("id", `player-body-${this.connectionId}`);
    this.physicsBody.setAttribute("x", this.position.x.toString());
    this.physicsBody.setAttribute("y", this.position.y.toString());
    this.physicsBody.setAttribute("z", this.position.z.toString());
    this.physicsBody.setAttribute("height", "1.1"); // total height
    this.physicsBody.setAttribute("radius", "0.6"); // capsule radius
    this.physicsBody.setAttribute("color", "#00ff00");
    this.physicsBody.setAttribute("opacity", "0.0"); // invisible (we show the character model)
    this.physicsBody.setAttribute("collide", "true");
    this.physicsBody.setAttribute("cast-shadows", "false");
    this.sceneGroup.appendChild(this.physicsBody);

    // 2: add rigidbody physics after a short delay
    // we delay this to ensure the element is in the dom first
    setTimeout(() => {
      if (!this.physicsBody) return;

      // set rigidbody attributes
      this.physicsBody.setAttribute("rigidbody", "true");
      this.physicsBody.setAttribute("kinematic", "false"); // dynamic body (affected by forces)

      // manually add to physics system with custom settings
      const physics = (window as any).physics;
      if (physics && this.physicsBody) {
        physics.addRigidbody(this.physicsBody, {
          mass: 100,
          kinematic: false,
          friction: 0.001,
          restitution: 0.001,
          gravity: 9.81, // gravity can be set per rigidbody
        });

        // lock rotations to prevent the capsule from tumbling
        this.lockPlayerRotations();
      }
    }, 300);

    // 3: create the visual character model
    // the m-character element renders the 3d model and handles animations
    this.characterModel = document.createElement("m-character");
    this.characterModel.setAttribute("id", `player-${this.connectionId}`);
    this.characterModel.setAttribute("collide", "false"); // model doesn't collide (capsule does through rapier)
    this.characterModel.setAttribute("src", CONSTANTS.CHARACTER_BODY);
    this.characterModel.setAttribute("state", "idle");
    this.characterModel.setAttribute("y", "-1.2"); // fine-tune the mesh position to align with floor
    this.physicsBody.appendChild(this.characterModel);

    // 4: create input controls
    this.movementControl = this.createMovementControl();
    this.rotationControl = this.createRotationControl();
    this.sceneGroup.appendChild(this.movementControl);
    this.sceneGroup.appendChild(this.rotationControl);

    // 5: add animations to the character
    this.createAnimation("idle");
    this.createAnimation("run");
    this.createAnimation("air");
    this.createAnimation("strafe-left");
    this.createAnimation("strafe-right");
    this.createAnimation("run-backward");
  }

  /**
   * create the movement control (WASD / Left Stick)
   *
   * the m-control element with type="axis" and axis="0,1" captures:
   * - keyboard: WASD keys
   * - gamepad: left analog stick
   *
   * the input event provides { x, y } values from -1 to 1
   */
  private createMovementControl(): HTMLElement {
    const control = document.createElement("m-control");
    control.setAttribute("type", "axis");
    control.setAttribute("axis", "0,1"); // left stick / WASD
    control.setAttribute("visible-to", this.connectionId.toString());

    control.addEventListener("input", (event: any) => {
      const inputData = event.detail;

      if (inputData.value && typeof inputData.value === "object") {
        const input = inputData.value as { x: number; y: number };
        const magnitude = Math.sqrt(input.x * input.x + input.y * input.y);

        // only register input if it exceeds dead zone
        if (magnitude > 0.01) {
          this.currentInput = { x: input.x, y: input.y };
        } else {
          this.currentInput = null;
        }

        // update animation based on movement
        this.updateAnimationState();
      } else {
        this.currentInput = null;
        this.updateAnimationState();
      }
    });

    return control;
  }

  /**
   * creates the rotation control (mouse / right stick)
   *
   * the m-control element with type="axis" and axis="2,3" captures:
   * - keyboard: arrow keys
   * - gamepad: right analog stick
   * - mouse: when enable-mouse="true", mouse position relative to character
   *
   * the input provides a direction vector that we convert to rotation
   */
  private createRotationControl(): HTMLElement {
    const control = document.createElement("m-control");
    control.setAttribute("type", "axis");
    control.setAttribute("axis", "2,3"); // right stick / arrow keys
    control.setAttribute("enable-mouse", "true"); // enable mouse aiming
    control.setAttribute("visible-to", this.connectionId.toString());

    control.addEventListener("input", (event: any) => {
      const inputData = event.detail;

      if (inputData.value && typeof inputData.value === "object") {
        const input = inputData.value as { x: number; y: number };
        const magnitude = Math.sqrt(input.x * input.x + input.y * input.y);

        if (magnitude > 0.01) {
          // convert input vector to angle
          const angle = Math.atan2(input.x, -input.y);
          this.rotation = (angle * 180) / Math.PI;
          this.rotationRadians = angle;

          // apply rotation to character model
          if (this.characterModel) {
            this.characterModel.setAttribute("ry", this.rotation.toString());
          }
        }
      }
    });

    return control;
  }

  /**
   * create an animation element for a given state
   */
  private createAnimation(state: string): HTMLElement {
    // map state name to constant key (e.g., "strafe-left" -> "ANIM_STRAFE_LEFT")
    const animName = `ANIM_${state.toUpperCase().replace(/-/g, "_")}`;
    const animSrc = CONSTANTS[animName as keyof typeof CONSTANTS];

    const animation = document.createElement("m-animation");
    animation.setAttribute("src", animSrc as string);
    animation.setAttribute("state", state);

    // add smooth weight transitions for blending
    const lerp = document.createElement("m-attr-lerp");
    lerp.setAttribute("attr", "weight");
    lerp.setAttribute("duration", "150");
    animation.appendChild(lerp);

    this.characterModel.appendChild(animation);
    return animation;
  }

  /**
   * update the character's animation state based on movement
   *
   * we determine the animation by comparing the movement direction
   * to the facing direction:
   * - moving in facing direction = run forward
   * - moving opposite = run backward
   * - moving perpendicular = strafe
   */
  private updateAnimationState(): void {
    if (!this.characterModel) return;

    // no input = idle
    if (!this.currentInput) {
      this.characterModel.setAttribute("state", "idle");
      return;
    }

    // calculate movement direction angle
    const movementAngle = Math.atan2(this.currentInput.x, -this.currentInput.y);

    // calculate relative angle between movement and facing direction
    let relativeAngle = movementAngle - this.rotationRadians;

    // normalize to -PI to PI
    while (relativeAngle > Math.PI) relativeAngle -= 2 * Math.PI;
    while (relativeAngle < -Math.PI) relativeAngle += 2 * Math.PI;

    const relativeDegrees = (relativeAngle * 180) / Math.PI;

    // choose animation based on relative angle
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

  /**
   * lock the rigidbody's rotations to prevent tumbling
   *
   * without this, collisions would cause the capsule to rotate,
   * making the character fall over. we lock all axes (X, Y, Z)
   * and control rotation ourselves via the character model.
   */
  private lockPlayerRotations(): void {
    const physics = (window as any).physics;
    if (!physics || !this.physicsBody) return;

    // access the internal physics state
    const physicsState = physics.elementToBody?.get(this.physicsBody);
    if (physicsState && physicsState.rigidbody) {
      // lock X, Y, Z rotations
      physicsState.rigidbody.setEnabledRotations(false, false, false, true);
    }
  }

  /**
   * main physics update loop
   *
   * this runs at regular intervals to:
   * 1- read current input
   * 2- apply horizontal velocity (X, Z) based on input
   * 3- preserve vertical velocity (Y) so gravity works correctly
   * 4- update position state from physics body
   */
  private startUpdateLoop(): void {
    this.updateInterval = window.setInterval(() => {
      if (!this.physicsBody) return;

      const physics = (window as any).physics;
      if (!physics || !physics.elementToBody) return;

      // Check if rigidbody is ready
      if (!physics.elementToBody.has(this.physicsBody)) return;

      try {
        const speed = CONSTANTS.PLAYER_SPEED;

        // ---------------------------------------------------------------------
        // important: get current Y velocity to preserve gravity
        // ---------------------------------------------------------------------
        // if we just set velocity to { x, y: 0, z }, we would cancel gravity.
        // instead, we read the current Y velocity and keep it
        const physicsState = physics.elementToBody.get(this.physicsBody);
        const currentVel = physicsState?.rigidbody?.linvel?.() || { x: 0, y: 0, z: 0 };

        if (this.currentInput) {
          // apply movement velocity, preserving Y for gravity
          const velocity = {
            x: this.currentInput.x * speed, // D = right (+X), A = left (-X)
            y: currentVel.y, // preserve gravity velocity
            z: -this.currentInput.y * speed, // W = forward (-Z), S = backward (+Z)
          };
          physics.setVelocity(this.physicsBody, velocity);
        } else {
          // no input: stop horizontal movement, keep gravity
          physics.setVelocity(this.physicsBody, {
            x: 0,
            y: currentVel.y, // preserve gravity velocity
            z: 0,
          });
        }

        // update our position state from physics body
        this.position = {
          x: parseFloat(this.physicsBody.getAttribute("x") || "0"),
          y: parseFloat(this.physicsBody.getAttribute("y") || "0"),
          z: parseFloat(this.physicsBody.getAttribute("z") || "0"),
        };

        // update camera to follow player
        if (this.camera) {
          this.camera.setPosition(this.position.x, this.position.y, this.position.z);
        }
      } catch (error) {
        console.error(`[Player ${this.connectionId}] Physics update error:`, error);
      }
    }, 32);
  }

  /**
   * cleanup when player disconnects
   */
  public dispose(): void {
    if (this.updateInterval !== null) {
      window.clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    // remove all DOM elements
    this.movementControl?.remove();
    this.rotationControl?.remove();
    this.characterModel?.remove();

    // dispose the camera
    if (this.camera) {
      this.camera.dispose();
      this.camera = null;
    }

    if (this.physicsBody) {
      const physics = (window as any).physics;
      if (physics) {
        physics.removeRigidbody(this.physicsBody);
      }
      this.physicsBody.remove();
    }
  }
}

/**
 * main game class that manages player connections
 */
class Game {
  private sceneGroup: HTMLElement;
  private players: Map<number, Player> = new Map();

  constructor() {
    // get the container element from the MML scene
    this.sceneGroup = document.getElementById("game-container") as HTMLElement;

    if (!this.sceneGroup) {
      console.error("Could not find game-container element!");
      return;
    }

    // create the stairs dynamically
    this.setupStairs();

    // listen for player connections
    window.addEventListener("connected", (event: any) => {
      const connectionId = event.detail.connectionId;
      this.addPlayer(connectionId);
    });

    // listen for player disconnections
    window.addEventListener("disconnected", (event: any) => {
      const connectionId = event.detail.connectionId;
      this.removePlayer(connectionId);
    });
  }

  /**
   * create the stairs dynamically
   */
  private setupStairs(): void {
    const stairsContainer = document.getElementById("stairs-container") as HTMLElement;

    // adjust stairs:
    createStairs(stairsContainer, {
      stepsCount: 10, // number of steps
      stepHeight: 0.15, // height of each step (loweris easier for the capsule collider to climb)
      stepDepth: 0.5, // depth of each step
      stepWidth: 3, // width of the staircase
      startX: -3, // x position
      startZ: 3.3, // z position where stairs begin
      color: "#5a5a5a", // step color
      platformWidth: 8, // platform width at top
      platformDepth: 4, // platform depth at top
      platformColor: "#4a4a4a", // platform color
    });
  }

  private addPlayer(connectionId: number): void {
    if (this.players.has(connectionId)) {
      console.warn(`Player ${connectionId} already exists`);
      return;
    }

    const player = new Player(connectionId, this.sceneGroup);
    this.players.set(connectionId, player);
  }

  private removePlayer(connectionId: number): void {
    const player = this.players.get(connectionId);
    if (player) {
      player.dispose();
      this.players.delete(connectionId);
    }
  }
}

new Game();
