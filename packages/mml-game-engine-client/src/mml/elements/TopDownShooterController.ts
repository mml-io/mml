import {
  AttributeHandler,
  EulXYZ,
  isEditorModeScene,
  IVect3,
  Line,
  Matr4,
  MElement,
  MMLScene,
  OrientedBoundingBox,
  parseFloatAttribute,
  Quat,
  Ray,
  Vect3,
} from "@mml-io/mml-web";
import * as THREE from "three";

import { GameThreeJSAdapter } from "../GameThreeJSAdapter";
import { ThreeJSOrbitCameraControls } from "../ThreeJSOrbitCameraControls";
import { CollisionMeshState } from "./CollisionsManager";
import { ControlGraphics, MControl } from "./Control";

const defaultMovementSpeed = 1.0;
const defaultGravity = 60.0;
const defaultJumpForce = 25.0;
const defaultDoubleJumpForce = 18.0;
const defaultCoyoteJumpThreshold = 150;
const defaultCameraDistance = 7;
const defaultCameraHeight = 1.8;
const defaultUpdateInterval = 100;

// character controller constants
const cameraFov = 60;
const cameraNearPlane = 0.01;
const cameraFarPlane = 1000;
const cameraDampingFactor = 0.07;

// Movement input thresholds
const movementMagnitudeThreshold = 0.01;
const sprintingThreshold = 0.7;

// Rotation constants
// const rotationLerpFactor = 0.25;

// Animation height thresholds
const jumpHeightThresholdAscending = 0.2;
const jumpHeightThresholdDescending = 1.8;

// Collision detection constants
const capsuleRayEndIgnoreLength = 0.1;

// Surface tracking constants
const surfaceTrackingRayOffset = 0.05;
const maxSurfaceTrackingDistance = 0.8;

const downVector = new Vect3(0, -1, 0);

export type MTopDownShooterControllerProps = {
  "movement-speed": number;
  gravity: number;
  "jump-force": number;
  "double-jump-force": number;
  "camera-distance": number;
  "camera-height": number;
  "update-interval": number;
};

export class MTopDownShooterController<G extends GameThreeJSAdapter> extends MElement<G> {
  static tagName = "m-topdown-shooter-controller";

  public static isTopDownShooterController(element: MElement): boolean {
    return element.tagName?.toLowerCase() === "m-topdown-shooter-controller";
  }

  public getClientPredictedPosition(): { x: number; y: number; z: number } {
    return {
      x: this.currentPosition.x,
      y: this.currentPosition.y,
      z: this.currentPosition.z,
    };
  }

  public getClientPredictedRotation(): { ry: number } {
    return {
      ry: this.currentRotation.ry,
    };
  }

  public getClientAuthoritativeAnimationState():
    | "idle"
    | "run"
    | "air"
    | "strafe-left"
    | "strafe-right"
    | "run-backward" {
    return this.getAnimationState();
  }

  // PUBLIC API: Set rotation from external sources (mouse aim, gamepad aim, etc.)
  public setAimRotation(radiansY: number): void {
    this.playerIntendedRotationY = radiansY;
  }

  public props: MTopDownShooterControllerProps = {
    "movement-speed": defaultMovementSpeed,
    gravity: defaultGravity,
    "jump-force": defaultJumpForce,
    "double-jump-force": defaultDoubleJumpForce,
    "camera-distance": defaultCameraDistance,
    "camera-height": defaultCameraHeight,
    "update-interval": defaultUpdateInterval,
  };

  public threeJSCamera: THREE.PerspectiveCamera | null = null;
  private cameraController: ThreeJSOrbitCameraControls | null = null;

  private movementControl: MControl<G> | null = null;
  private jumpControl: MControl<G> | null = null;
  private aimControl: MControl<G> | null = null; // NEW: Separate aim control

  // Mouse aiming
  private mouseAimEnabled: boolean = false;
  private mousePosition: THREE.Vector2 = new THREE.Vector2();
  private raycaster: THREE.Raycaster = new THREE.Raycaster();
  private groundPlane: THREE.Plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private boundHandleMouseMove: ((event: MouseEvent) => void) | null = null;

  private currentPosition: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  private currentRotation = { ry: 0 };
  private playerIntendedRotationY = 0; // Set by aim input, NOT movement
  private characterVelocity = new Vect3(0, 0, 0);

  private controlState: { direction: number | null; isSprinting: boolean; jump: boolean } | null =
    null;

  // Jump mechanics
  public jumpForce: number = defaultJumpForce;
  public doubleJumpForce: number = defaultDoubleJumpForce;
  public coyoteTimeThreshold: number = defaultCoyoteJumpThreshold;
  public canJump: boolean = true;
  public canDoubleJump: boolean = true;
  public coyoteJumped = false;
  public doubleJumpUsed: boolean = false;
  public jumpCounter: number = 0;
  public jumpReleased: boolean = true;

  // Physics constants
  public movementSpeed: number = defaultMovementSpeed;
  public gravity: number = defaultGravity;
  public airResistance = 0.5;
  public groundResistance = 0.99999999;
  public airControlModifier = 0.05;
  public groundWalkControl = 0.625;
  public groundRunControl = 0.625;
  public baseControl = 200;
  public minimumSurfaceAngle = 0.7;

  public latestPosition: Vect3 = new Vect3();
  public characterOnGround: boolean = false;
  public coyoteTime: boolean = false;

  private characterWasOnGround: boolean = false;
  private characterAirborneSince: number = 0;
  private currentHeight: number = 0;
  private currentSurfaceAngle = new Vect3();

  private azimuthalAngle: number = 0;

  private documentTimeListener: { remove: () => void } | null = null;
  private lastPhysicsTime = 0;
  private lastServerSyncTime = 0;

  public scene: MMLScene<GameThreeJSAdapter>;

  private registeredParentAttachment: MElement<G> | null = null;

  public capsuleInfo = {
    radius: 0.45,
    segment: new Line(new Vect3(), new Vect3(0, 1.05, 0)),
  };

  private collisionDetectionSteps = 15;

  private tempSegment: Line = new Line();
  private tempQuat: Quat = new Quat();
  private tempEulXYZ: EulXYZ = new EulXYZ();
  private tempVector: Vect3 = new Vect3();
  private tempVector2: Vect3 = new Vect3();
  private tempVect3: Vect3 = new Vect3();
  private tempRay: Ray = new Ray();

  private vectorUp: Vect3 = new Vect3(0, 1, 0);
  private vectorDown: Vect3 = new Vect3(0, -1, 0);

  private surfaceTempQuat = new Quat();
  private surfaceTempQuat2 = new Quat();
  private surfaceTempVector1 = new Vect3();
  private surfaceTempVector2 = new Vect3();
  private surfaceTempVect3 = new Vect3();
  private surfaceTempVector4 = new Vect3();
  private surfaceTempVector5 = new Vect3();
  private surfaceTempRay = new Ray();
  private lastFrameSurfaceState:
    | [
        CollisionMeshState,
        {
          lastMatrix: Matr4;
        },
      ]
    | null = null;

  private static attributeHandler = new AttributeHandler<
    MTopDownShooterController<GameThreeJSAdapter>
  >({
    "movement-speed": (instance, newValue) => {
      instance.props["movement-speed"] = parseFloatAttribute(newValue, defaultMovementSpeed);
      instance.movementSpeed = instance.props["movement-speed"];
    },
    gravity: (instance, newValue) => {
      instance.props.gravity = parseFloatAttribute(newValue, defaultGravity);
      instance.gravity = instance.props.gravity;
    },
    "jump-force": (instance, newValue) => {
      instance.props["jump-force"] = parseFloatAttribute(newValue, defaultJumpForce);
      instance.jumpForce = instance.props["jump-force"];
    },
    "double-jump-force": (instance, newValue) => {
      instance.props["double-jump-force"] = parseFloatAttribute(newValue, defaultDoubleJumpForce);
      instance.doubleJumpForce = instance.props["double-jump-force"];
    },
    "camera-distance": (instance, newValue) => {
      instance.props["camera-distance"] = parseFloatAttribute(newValue, defaultCameraDistance);
      instance.cameraController?.setDistance(instance.props["camera-distance"]);
    },
    "camera-height": (instance, newValue) => {
      instance.props["camera-height"] = parseFloatAttribute(newValue, defaultCameraHeight);
    },
    "update-interval": (instance, newValue) => {
      instance.props["update-interval"] = parseFloatAttribute(newValue, defaultUpdateInterval);
    },
  });

  static get observedAttributes(): Array<string> {
    return [...MTopDownShooterController.attributeHandler.getAttributes()];
  }

  constructor() {
    super();
  }

  protected enable(): void {
    // no-op
  }

  protected disable(): void {
    // no-op
  }

  public didUpdateTransformation(): void {
    // no-op
  }

  public getContentBounds(): null {
    return null;
  }

  public getAppliedBounds(): Map<unknown, OrientedBoundingBox> {
    return new Map();
  }

  public parentTransformed(): void {
    this.initializePosition();
  }

  public isClickable(): boolean {
    return false;
  }

  private createInternalControls(): void {
    if (!this.isConnected) return;

    // Movement control (axis 0,1) - WASD / left stick
    this.movementControl = new MControl<G>();
    this.movementControl.props = {
      type: "axis",
      axis: "0,1",
      button: "0",
      hint: "",
      debug: false,
    };
    this.movementControl.addEventListener("input", this.handleMovementInput.bind(this));
    this.movementControl.scene = this.scene;
    this.initializeStandaloneControl(this.movementControl);

    // Jump control
    if (this.props["jump-force"] > 0) {
      this.jumpControl = new MControl<G>();
      this.jumpControl.props = {
        type: "button",
        axis: "0,1",
        button: "0",
        hint: "",
        debug: false,
      };
      this.jumpControl.addEventListener("input", this.handleJumpInput.bind(this));
      this.jumpControl.scene = this.scene;
      this.initializeStandaloneControl(this.jumpControl);
    }

    // NEW: Aim control (axis 2,3) - right stick for gamepad
    this.aimControl = new MControl<G>();
    this.aimControl.props = {
      type: "axis",
      axis: "2,3",
      button: "0",
      hint: "",
      debug: false,
    };
    this.aimControl.addEventListener("input", this.handleAimInput.bind(this));
    this.aimControl.scene = this.scene;
    this.initializeStandaloneControl(this.aimControl);

    const canvas = this.scene.getGraphicsAdapter().getCanvasElement();
    if (canvas) {
      canvas.style.pointerEvents = "auto";
      canvas.style.touchAction = "none";
      canvas.style.userSelect = "none";
    }
  }

  private initializeStandaloneControl(control: MControl<G>): void {
    const graphicsAdapter = this.scene.getGraphicsAdapter();
    if (!graphicsAdapter || !("registerControl" in graphicsAdapter)) {
      console.warn("TopDown controller: Cannot register control - no graphics adapter");
      return;
    }

    control.controlGraphics = new ControlGraphics(control);
    graphicsAdapter.registerControl(control);

    for (const name of MControl.observedAttributes) {
      const value = control.getAttribute(name);
      if (value !== null) {
        control.attributeChangedCallback(name, null, value);
      }
    }

    control.startInputPolling();
  }

  private handleMovementInput(event: CustomEvent): void {
    const inputData = event.detail;
    if (inputData.value && typeof inputData.value === "object") {
      const movement = inputData.value as { x: number; y: number };
      const magnitude = Math.sqrt(movement.x * movement.x + movement.y * movement.y);

      if (magnitude > movementMagnitudeThreshold) {
        const direction = Math.atan2(-movement.x, movement.y);
        const isSprinting = magnitude > sprintingThreshold;

        if (!this.controlState) {
          this.controlState = { direction, isSprinting, jump: false };
        } else {
          this.controlState.direction = direction;
          this.controlState.isSprinting = isSprinting;
        }
      } else {
        if (this.controlState) {
          this.controlState.direction = null;
          this.controlState.isSprinting = false;
        }
      }
    } else {
      if (this.controlState) {
        this.controlState.direction = null;
        this.controlState.isSprinting = false;
      }
    }
  }

  // NEW: Handle aim input from right stick
  private handleAimInput(event: CustomEvent): void {
    const inputData = event.detail;
    if (inputData.value && typeof inputData.value === "object") {
      const aim = inputData.value as { x: number; y: number };
      const magnitude = Math.sqrt(aim.x * aim.x + aim.y * aim.y);

      if (magnitude > movementMagnitudeThreshold) {
        // Disable mouse aim when gamepad is used
        this.mouseAimEnabled = false;

        // Convert aim stick input to rotation
        const aimAngle = Math.atan2(-aim.x, aim.y);
        this.updateAzimuthalAngle();
        const newRotation = this.azimuthalAngle + aimAngle;
        this.playerIntendedRotationY = newRotation;
      }
    }
  }

  // NEW: Handle mouse movement for aiming
  private handleMouseMove(event: MouseEvent): void {
    // Get the actual active camera (respects m-camera priority)
    const activeCamera = this.scene.getGraphicsAdapter().getCamera();
    if (!activeCamera) return;

    // Enable mouse aim when mouse is moved
    this.mouseAimEnabled = true;

    const renderer = this.scene.getGraphicsAdapter().getRenderer();
    const rect = renderer.domElement.getBoundingClientRect();

    // Convert mouse position to normalized device coordinates (-1 to +1)
    this.mousePosition.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mousePosition.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    // Cast ray from the active camera (which respects m-camera priority) through mouse position
    this.raycaster.setFromCamera(this.mousePosition, activeCamera);

    // Intersect with ground plane at player's Y position
    const playerY = this.currentPosition.y;
    this.groundPlane.constant = -playerY;

    const intersectionPoint = new THREE.Vector3();
    const didIntersect = this.raycaster.ray.intersectPlane(this.groundPlane, intersectionPoint);

    if (didIntersect) {
      // Calculate rotation from player position to mouse world position
      const dx = intersectionPoint.x - this.currentPosition.x;
      const dz = intersectionPoint.z - this.currentPosition.z;

      if (Math.abs(dx) > 0.01 || Math.abs(dz) > 0.01) {
        const targetRotation = Math.atan2(dx, dz);
        this.playerIntendedRotationY = targetRotation;
      }
    }
  }

  private handleJumpInput(event: CustomEvent): void {
    const inputData = event.detail;
    const jumpPressed = inputData.value === true;

    if (!this.controlState) {
      this.controlState = { direction: null, isSprinting: false, jump: jumpPressed };
    } else {
      this.controlState.jump = jumpPressed;
    }
  }

  private setupCamera(): void {
    const renderer = this.scene.getGraphicsAdapter().getRenderer();
    const aspect = renderer.domElement.clientWidth / renderer.domElement.clientHeight;

    this.threeJSCamera = new THREE.PerspectiveCamera(
      cameraFov,
      aspect,
      cameraNearPlane,
      cameraFarPlane,
    );
    this.initializeCameraController();
  }

  private initializeCameraController(): void {
    if (!this.threeJSCamera) return;

    this.cameraController = new ThreeJSOrbitCameraControls(
      this.threeJSCamera,
      this.scene.getGraphicsAdapter().getCanvasElement(),
      this.props["camera-distance"],
    );

    this.cameraController.setDamping(cameraDampingFactor);
    this.cameraController.enable();

    this.updateCameraPosition();
  }

  private updateAzimuthalAngle(): void {
    const camera = this.scene.getGraphicsAdapter().getCamera();
    if (!camera) return;

    const worldForward = new THREE.Vector3();
    camera.getWorldDirection(worldForward);
    worldForward.y = 0;
    worldForward.normalize();

    this.azimuthalAngle = Math.atan2(worldForward.x, worldForward.z);
  }

  private computeFinalRotation(): void {
    // aim rotation - no modification from movement
    this.currentRotation.ry = this.playerIntendedRotationY;
  }

  private lerpAngle(current: number, target: number, factor: number): number {
    const normalizeAngle = (angle: number) => {
      while (angle > Math.PI) angle -= 2 * Math.PI;
      while (angle < -Math.PI) angle += 2 * Math.PI;
      return angle;
    };

    current = normalizeAngle(current);
    target = normalizeAngle(target);

    let diff = target - current;
    if (diff > Math.PI) diff -= 2 * Math.PI;
    if (diff < -Math.PI) diff += 2 * Math.PI;

    return normalizeAngle(current + diff * factor);
  }

  private getTargetAnimation():
    | "idle"
    | "run"
    | "air"
    | "doubleJump"
    | "strafe-left"
    | "strafe-right"
    | "run-backward" {
    const jumpHeight =
      this.characterVelocity.y > 0 ? jumpHeightThresholdAscending : jumpHeightThresholdDescending;
    if (this.currentHeight > jumpHeight && !this.characterOnGround) {
      if (this.doubleJumpUsed) {
        return "doubleJump";
      }
      return "air";
    }
    if (!this.controlState) {
      return "idle";
    }

    if (this.controlState.direction === null) {
      return "idle";
    }

    this.updateAzimuthalAngle();
    const movementWorldAngle = this.azimuthalAngle + this.controlState.direction;
    const facingAngle = this.currentRotation.ry;

    let angleDiff = movementWorldAngle - facingAngle;

    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

    const absAngleDiff = Math.abs(angleDiff);

    if (absAngleDiff < Math.PI / 4) {
      // forward (within 45 degrees)
      return this.controlState.isSprinting ? "run" : "run";
    } else if (angleDiff >= Math.PI / 4 && angleDiff < (3 * Math.PI) / 4) {
      // right strafe
      return "strafe-left";
    } else if (angleDiff <= -Math.PI / 4 && angleDiff > (-3 * Math.PI) / 4) {
      // left strafe
      return "strafe-right";
    } else {
      // backward (greater than 135 degrees in either direction)
      return "run-backward";
    }
  }

  private getAnimationState():
    | "idle"
    | "run"
    | "air"
    | "strafe-left"
    | "strafe-right"
    | "run-backward" {
    const target = this.getTargetAnimation();
    if (target === "doubleJump") {
      return "air";
    }
    return target;
  }

  private updateCameraPosition(deltaTime?: number): void {
    if (!this.cameraController) return;

    const worldPos = {
      x: this.currentPosition.x,
      y: this.currentPosition.y + this.props["camera-height"],
      z: this.currentPosition.z,
    };

    this.cameraController.setLookAt(worldPos.x, worldPos.y, worldPos.z);
    this.cameraController.updateInWorldSpaceAbsolute(worldPos, deltaTime);
  }

  private updateParentElementTransform(): void {
    if (this.parentElement) {
      this.parentElement.setAttribute("x", String(this.currentPosition.x));
      this.parentElement.setAttribute("y", String(this.currentPosition.y));
      this.parentElement.setAttribute("z", String(this.currentPosition.z));
      this.parentElement.setAttribute("ry", String((this.currentRotation.ry * 180) / Math.PI));
    }
  }

  private dispatchCharacterMoveEvent(): void {
    if (!this.isConnected || !this.scene) {
      return;
    }

    const rotationDegrees = (this.currentRotation.ry * 180) / Math.PI;

    this.dispatchEvent(
      new CustomEvent("character-move", {
        detail: {
          position: {
            x: this.currentPosition.x,
            y: this.currentPosition.y,
            z: this.currentPosition.z,
          },
          rotation: {
            ry: rotationDegrees,
          },
          state: this.getAnimationState(),
        },
        bubbles: true,
      }),
    );
  }

  private startUpdateLoop(): void {
    if (this.documentTimeListener) {
      this.documentTimeListener.remove();
    }

    const currentTime = this.getDocumentTime();
    this.lastPhysicsTime = currentTime;
    this.lastServerSyncTime = currentTime;

    this.documentTimeListener = this.addDocumentTimeTickListener((documentTime) => {
      this.updateFromDocumentTime(documentTime);
    });
  }

  private updateFromDocumentTime(documentTime: number): void {
    if (!this.isConnected || !this.scene) {
      return;
    }

    const physicsDeltatime = (documentTime - this.lastPhysicsTime) / 1000;
    this.lastPhysicsTime = documentTime;

    const position = new Vect3(
      this.currentPosition.x,
      this.currentPosition.y,
      this.currentPosition.z,
    );
    this.tempRay.set(position, this.vectorDown);
    const graphicsAdapter = this.scene.getGraphicsAdapter() as GameThreeJSAdapter;
    const collisionsManager = graphicsAdapter.getCollisionsManager();
    const excludeElement =
      this.parentElement && MElement.isMElement(this.parentElement)
        ? (this.parentElement as MElement<GameThreeJSAdapter>)
        : undefined;
    const firstRaycastHit = collisionsManager.raycastFirst(this.tempRay, null, excludeElement);
    if (firstRaycastHit !== null) {
      this.currentHeight = firstRaycastHit[0];
      this.currentSurfaceAngle.copy(firstRaycastHit[1]);
    } else {
      this.currentHeight = Number.POSITIVE_INFINITY;
    }

    for (let i = 0; i < this.collisionDetectionSteps; i++) {
      this.updatePosition(physicsDeltatime, physicsDeltatime / this.collisionDetectionSteps, i);
    }

    this.computeFinalRotation();
    this.updateCameraPosition(physicsDeltatime);
    this.updateParentElementTransform();

    const timeSinceLastSync = documentTime - this.lastServerSyncTime;
    if (timeSinceLastSync >= this.props["update-interval"]) {
      this.dispatchCharacterMoveEvent();
      this.lastServerSyncTime = documentTime;
    }
  }

  private processJump(currentAcceleration: Vect3, deltaTime: number) {
    const jump = this.controlState?.jump;

    if (this.characterOnGround) {
      this.coyoteJumped = false;
      this.canDoubleJump = false;
      this.doubleJumpUsed = false;
      this.jumpCounter = 0;

      if (!jump) {
        this.canDoubleJump = !this.doubleJumpUsed && this.jumpReleased && this.jumpCounter === 1;
        this.canJump = true;
        this.jumpReleased = true;
      }

      if (jump && this.canJump && this.jumpReleased) {
        currentAcceleration.y += this.jumpForce / deltaTime;
        this.canJump = false;
        this.jumpReleased = false;
        this.jumpCounter++;
      } else {
        if (this.currentSurfaceAngle.y < this.minimumSurfaceAngle) {
          currentAcceleration.y += -this.gravity;
        }
      }
    } else {
      if (jump && !this.coyoteJumped && this.coyoteTime) {
        this.coyoteJumped = true;
        currentAcceleration.y += this.jumpForce / deltaTime;
        this.canJump = false;
        this.jumpReleased = false;
        this.jumpCounter++;
      } else if (jump && this.canDoubleJump) {
        currentAcceleration.y += this.doubleJumpForce / deltaTime;
        this.doubleJumpUsed = true;
        this.jumpReleased = false;
        this.jumpCounter++;
      } else {
        currentAcceleration.y += -this.gravity;
        this.canJump = false;
      }
    }

    if (!jump) {
      this.jumpReleased = true;
      if (!this.characterOnGround) {
        currentAcceleration.y += -this.gravity;
      }
    }
  }

  private applyControls(stepDeltaTime: number): void {
    const resistance = this.characterOnGround ? this.groundResistance : this.airResistance;

    const speedFactor = Math.pow(1 - resistance, stepDeltaTime);
    this.characterVelocity.multiplyScalar(speedFactor);

    const acceleration = this.tempVector.set(0, 0, 0);
    this.canDoubleJump = !this.doubleJumpUsed && this.jumpReleased && this.jumpCounter === 1;
    this.processJump(acceleration, stepDeltaTime);

    const control =
      (this.characterOnGround
        ? this.controlState?.isSprinting
          ? this.groundRunControl
          : this.groundWalkControl
        : this.airControlModifier) *
      this.baseControl *
      this.movementSpeed;

    const controlAcceleration = this.tempVector2.set(0, 0, 0);

    if (this.controlState && this.controlState.direction !== null) {
      const heading = this.controlState.direction;
      const headingVector = this.tempVect3
        .set(0, 0, 1)
        .applyAxisAngle(this.vectorUp, this.azimuthalAngle + heading);
      controlAcceleration.add(headingVector);
    }
    if (controlAcceleration.lengthSquared() > 0) {
      controlAcceleration.normalize();
      controlAcceleration.multiplyScalar(control);
    }
    acceleration.add(controlAcceleration);
    this.characterVelocity.addScaledVector(acceleration, stepDeltaTime);

    const currentPosition = this.currentPosition;
    const newPosition = new Vect3(currentPosition.x, currentPosition.y, currentPosition.z);
    newPosition.addScaledVector(this.characterVelocity, stepDeltaTime);
    this.currentPosition.set(newPosition.x, newPosition.y, newPosition.z);
  }

  private updatePosition(deltaTime: number, stepDeltaTime: number, iter: number): void {
    this.applyControls(stepDeltaTime);

    if (iter === 0) {
      const lastMovement = this.getMovementFromSurfaces(this.currentPosition, deltaTime);
      if (lastMovement) {
        const newPosition = this.tempVector.copy(this.currentPosition);
        newPosition.add(lastMovement.position);
        this.currentPosition.set(newPosition.x, newPosition.y, newPosition.z);

        const lastMovementEulXYZ = this.tempEulXYZ.setFromQuaternion(lastMovement.rotation);
        this.playerIntendedRotationY += lastMovementEulXYZ.y;
      }
    }

    this.applyCollisions();

    if (!this.controlState?.jump) {
      this.jumpReleased = true;
    }

    this.coyoteTime =
      this.characterVelocity.y < 0 &&
      !this.characterOnGround &&
      Date.now() - this.characterAirborneSince < this.coyoteTimeThreshold;

    this.latestPosition.set(this.currentPosition.x, this.currentPosition.y, this.currentPosition.z);
    this.characterWasOnGround = this.characterOnGround;
  }

  private applyCollisions(): void {
    const graphicsAdapter = this.scene.getGraphicsAdapter() as GameThreeJSAdapter;
    const collisionsManager = graphicsAdapter.getCollisionsManager();

    const avatarSegment = this.tempSegment;
    avatarSegment.copy(this.capsuleInfo.segment);
    avatarSegment.start.add(this.currentPosition);
    avatarSegment.end.add(this.currentPosition);

    avatarSegment.start.y += this.capsuleInfo.radius;
    avatarSegment.end.y += this.capsuleInfo.radius;

    const positionBeforeCollisions = this.tempVector.copy(avatarSegment.start);
    const excludeElement =
      this.parentElement && MElement.isMElement(this.parentElement)
        ? (this.parentElement as MElement<GameThreeJSAdapter>)
        : undefined;
    collisionsManager.applyColliders(avatarSegment, this.capsuleInfo.radius, excludeElement);

    const capsuleLength =
      this.capsuleInfo.segment.end.y -
      this.capsuleInfo.segment.start.y +
      this.capsuleInfo.radius * 2;
    this.tempRay.set(avatarSegment.start, this.vectorDown);

    this.tempRay.origin.y += -this.capsuleInfo.radius + capsuleLength - capsuleRayEndIgnoreLength;
    const withinCapsuleRayHit = collisionsManager.raycastFirst(
      this.tempRay,
      capsuleLength - capsuleRayEndIgnoreLength * 2,
      excludeElement,
    );
    if (withinCapsuleRayHit !== null) {
      const rayHitPosition = withinCapsuleRayHit[3];
      avatarSegment.start.copy(rayHitPosition);
      avatarSegment.start.y += this.capsuleInfo.radius;
    }

    this.currentPosition.set(
      avatarSegment.start.x,
      avatarSegment.start.y - this.capsuleInfo.radius,
      avatarSegment.start.z,
    );
    const deltaCollisionPosition = avatarSegment.start.sub(positionBeforeCollisions);
    this.characterOnGround = deltaCollisionPosition.y > 0;

    if (this.characterOnGround) {
      this.doubleJumpUsed = false;
      this.jumpCounter = 0;
    }

    if (this.characterWasOnGround && !this.characterOnGround) {
      this.characterAirborneSince = Date.now();
    }
  }

  public getMovementFromSurfaces(userPosition: IVect3, deltaTime: number) {
    const graphicsAdapter = this.scene.getGraphicsAdapter() as GameThreeJSAdapter;
    const collisionsManager = graphicsAdapter.getCollisionsManager();

    let lastMovement: { rotation: Quat; position: Vect3 } | null = null;

    if (this.lastFrameSurfaceState !== null) {
      const meshState = this.lastFrameSurfaceState[0];

      const currentFrameMatrix = meshState.matrix;
      const lastFrameMatrix = this.lastFrameSurfaceState[1].lastMatrix;

      if (!lastFrameMatrix.equals(currentFrameMatrix)) {
        const lastMeshPosition = this.surfaceTempVector1;
        const lastMeshRotation = this.surfaceTempQuat;
        lastFrameMatrix.decompose(lastMeshPosition, lastMeshRotation, this.surfaceTempVect3);

        const currentMeshPosition = this.surfaceTempVector2;
        const currentMeshRotation = this.surfaceTempQuat2;
        currentFrameMatrix.decompose(
          currentMeshPosition,
          currentMeshRotation,
          this.surfaceTempVect3,
        );

        const meshTranslationDelta = this.surfaceTempVector5
          .copy(currentMeshPosition)
          .sub(lastMeshPosition);

        const lastFrameRelativeUserPosition = this.surfaceTempVect3
          .copy(userPosition)
          .sub(lastMeshPosition);

        const meshRotationDelta = currentMeshRotation.multiply(lastMeshRotation.invert());

        const translationDueToRotation = this.surfaceTempVector4
          .copy(lastFrameRelativeUserPosition)
          .applyQuat(meshRotationDelta)
          .sub(lastFrameRelativeUserPosition);

        const translationAndRotationPositionDelta = this.surfaceTempVector1
          .copy(meshTranslationDelta)
          .add(translationDueToRotation);

        lastMovement = {
          position: translationAndRotationPositionDelta,
          rotation: meshRotationDelta,
        };
        lastFrameMatrix.copy(currentFrameMatrix);
      }
    }

    const newPosition = this.surfaceTempVect3.copy(userPosition);
    if (lastMovement) {
      newPosition.add(lastMovement.position);
    }
    newPosition.y = newPosition.y + surfaceTrackingRayOffset;

    const ray = this.surfaceTempRay.set(newPosition, downVector);
    const excludeElement =
      this.parentElement && MElement.isMElement(this.parentElement)
        ? (this.parentElement as MElement<GameThreeJSAdapter>)
        : undefined;
    const hit = collisionsManager.raycastFirst(ray, null, excludeElement);
    if (hit && hit[0] < maxSurfaceTrackingDistance) {
      const currentCollisionMeshState = hit[2];
      this.lastFrameSurfaceState = [
        currentCollisionMeshState,
        { lastMatrix: currentCollisionMeshState.matrix.clone() },
      ];
    } else {
      if (this.lastFrameSurfaceState !== null && lastMovement) {
        this.characterVelocity.add(lastMovement.position.clone().multiplyScalar(1 / deltaTime));
      }
      this.lastFrameSurfaceState = null;
    }
    return lastMovement;
  }

  private stopUpdateLoop(): void {
    if (this.documentTimeListener) {
      this.documentTimeListener.remove();
      this.documentTimeListener = null;
    }
  }

  private initializePosition(): void {
    const parent = this.parentElement;

    if (parent) {
      const x = parseFloat(parent.getAttribute("x") || "0");
      const y = parseFloat(parent.getAttribute("y") || "0");
      const z = parseFloat(parent.getAttribute("z") || "0");
      const ry = (parseFloat(parent.getAttribute("ry") || "0") * Math.PI) / 180;

      this.currentPosition.set(x, y, z);
      this.currentRotation.ry = ry;
      this.playerIntendedRotationY = ry;
    } else {
      this.currentPosition.set(0, 0, 0);
      this.currentRotation.ry = 0;
      this.playerIntendedRotationY = 0;
    }

    this.characterVelocity.set(0, 0, 0);
    this.characterOnGround = false;
    this.doubleJumpUsed = false;
    this.jumpReleased = true;
    this.jumpCounter = 0;

    this.dispatchCharacterMoveEvent();
  }

  public getCamera(): THREE.PerspectiveCamera | null {
    return this.threeJSCamera;
  }

  public getCameraController(): ThreeJSOrbitCameraControls | null {
    return this.cameraController;
  }

  public updateAspectRatio(): void {
    if (!this.threeJSCamera) return;

    const renderer = this.scene.getGraphicsAdapter().getRenderer();
    const aspect = renderer.domElement.clientWidth / renderer.domElement.clientHeight;
    this.threeJSCamera.aspect = aspect;
    this.threeJSCamera.updateProjectionMatrix();
  }

  public setFOV(fov: number): void {
    if (!this.threeJSCamera) return;
    this.threeJSCamera.fov = fov;
    this.threeJSCamera.updateProjectionMatrix();
  }

  public connectedCallback(): void {
    super.connectedCallback();

    this.scene = this.getScene() as unknown as MMLScene<GameThreeJSAdapter>;

    // In editor mode we don't want controllers consuming input or driving camera motion.
    // Keep the element present for scene structure/selection, but skip all runtime behavior.
    if (isEditorModeScene(this.scene)) {
      for (const name of MTopDownShooterController.observedAttributes) {
        const value = this.getAttribute(name);
        if (value !== null) {
          this.attributeChangedCallback(name, null, value);
        }
      }
      return;
    }

    this.initializePosition();
    this.createInternalControls();
    this.setupCamera();

    const renderer = this.scene.getGraphicsAdapter().getRenderer();
    this.boundHandleMouseMove = this.handleMouseMove.bind(this);
    renderer.domElement.addEventListener("mousemove", this.boundHandleMouseMove);

    const graphicsAdapter = this.scene.getGraphicsAdapter();
    (graphicsAdapter as any).registerCharacterController(this);

    if (this.parentElement && MElement.isMElement(this.parentElement)) {
      this.registeredParentAttachment = this.parentElement as MElement<G>;
      this.registeredParentAttachment.addSideEffectChild(this as any);
    }

    for (const name of MTopDownShooterController.observedAttributes) {
      const value = this.getAttribute(name);
      if (value !== null) {
        this.attributeChangedCallback(name, null, value);
      }
    }

    this.startUpdateLoop();
  }

  public disconnectedCallback(): void {
    this.stopUpdateLoop();

    if (this.boundHandleMouseMove) {
      const renderer = this.scene.getGraphicsAdapter().getRenderer();
      renderer.domElement.removeEventListener("mousemove", this.boundHandleMouseMove);
      this.boundHandleMouseMove = null;
    }

    if (this.registeredParentAttachment) {
      this.registeredParentAttachment.removeSideEffectChild(this as any);
      this.registeredParentAttachment = null;
    }

    if (this.movementControl) {
      this.movementControl.disconnectedCallback();
      this.movementControl = null;
    }
    if (this.jumpControl) {
      this.jumpControl.disconnectedCallback();
      this.jumpControl = null;
    }
    if (this.aimControl) {
      this.aimControl.disconnectedCallback();
      this.aimControl = null;
    }

    this.cameraController?.disable();
    this.cameraController = null;

    if (this.threeJSCamera) {
      this.scene.getGraphicsAdapter().unregisterCharacterController(this as any);
      this.threeJSCamera = null;
    }

    super.disconnectedCallback();
  }

  public attributeChangedCallback(name: string, oldValue: string | null, newValue: string): void {
    super.attributeChangedCallback(name, oldValue, newValue);
    MTopDownShooterController.attributeHandler.handle(this, name, newValue);
  }
}
