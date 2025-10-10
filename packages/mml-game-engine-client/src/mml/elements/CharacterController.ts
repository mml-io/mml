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
  parseBoolAttribute,
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
// TODO - expose and/or rename this?
const defaultCoyoteJumpThreshold = 150;
const defaultCameraDistance = 7;
const defaultCameraHeight = 1.8;
const defaultUpdateInterval = 100;
const defaultRotateWithCamera = false;

// character controller constants
const cameraFov = 60;
const cameraNearPlane = 0.01;
const cameraFarPlane = 1000;
const cameraRotationSensitivity = 0.03;
const cameraDampingFactor = 0.07;

// Movement input thresholds
const movementMagnitudeThreshold = 0.01;
const sprintingThreshold = 0.7;

// Rotation constants
const rotationLerpFactor = 0.25;

// Animation height thresholds
const jumpHeightThresholdAscending = 0.2;
const jumpHeightThresholdDescending = 1.8;

// Collision detection constants
const capsuleRayEndIgnoreLength = 0.1;

// Surface tracking constants
const surfaceTrackingRayOffset = 0.05;
const maxSurfaceTrackingDistance = 0.8;

const downVector = new Vect3(0, -1, 0);

export type MCharacterControllerProps = {
  "movement-speed": number;
  gravity: number;
  "jump-force": number;
  "double-jump-force": number;
  "camera-distance": number;
  "camera-height": number;
  "update-interval": number;
  "rotate-with-camera": boolean;
};

export class MCharacterController<G extends GameThreeJSAdapter> extends MElement<G> {
  static tagName = "m-character-controller";

  public static isCharacterController(element: MElement): boolean {
    return element.tagName?.toLowerCase() === "m-character-controller";
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

  public getClientAuthoritativeAnimationState(): "idle" | "run" | "air" {
    return this.getAnimationState();
  }

  public props: MCharacterControllerProps = {
    "movement-speed": defaultMovementSpeed,
    gravity: defaultGravity,
    "jump-force": defaultJumpForce,
    "double-jump-force": defaultDoubleJumpForce,
    "camera-distance": defaultCameraDistance,
    "camera-height": defaultCameraHeight,
    "update-interval": defaultUpdateInterval,
    "rotate-with-camera": defaultRotateWithCamera,
  };

  public threeJSCamera: THREE.PerspectiveCamera | null = null;
  private cameraController: ThreeJSOrbitCameraControls | null = null;

  private movementControl: MControl<G> | null = null;
  private jumpControl: MControl<G> | null = null;
  private cameraControl: MControl<G> | null = null;

  private currentPosition: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  private currentRotation = { ry: 0 };
  private playerIntendedRotationY = 0; // Player's intended Y rotation from input only (angle, not quaternion)
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
  public groundResistance = 0.99999999; // 0.99999999 + 0 * 1e-7
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

  private static attributeHandler = new AttributeHandler<MCharacterController<GameThreeJSAdapter>>({
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
    "rotate-with-camera": (instance, newValue) => {
      instance.props["rotate-with-camera"] = parseBoolAttribute(newValue, defaultRotateWithCamera);
    },
  });

  static get observedAttributes(): Array<string> {
    return [...MCharacterController.attributeHandler.getAttributes()];
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

    this.cameraControl = new MControl<G>();
    this.cameraControl.props = {
      type: "axis",
      axis: "2,3",
      button: "0",
      hint: "",
      debug: false,
      "interval-ms": 10,
    };
    this.cameraControl.addEventListener("input", this.handleCameraInput.bind(this));
    this.cameraControl.scene = this.scene;
    this.initializeStandaloneControl(this.cameraControl);

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
      console.warn("Character controller: Cannot register control - no graphics adapter");
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

  private handleJumpInput(event: CustomEvent): void {
    const inputData = event.detail;
    const jumpPressed = inputData.value === 1.0;

    if (!this.controlState) {
      this.controlState = { direction: null, isSprinting: false, jump: jumpPressed };
    } else {
      this.controlState.jump = jumpPressed;
    }
  }

  private handleCameraInput(event: CustomEvent): void {
    const inputData = event.detail;
    if (inputData.value && typeof inputData.value === "object") {
      const camera = inputData.value as { x: number; y: number };
      this.applyCameraRotation(camera.x, camera.y);
    }
  }

  private applyCameraRotation(deltaX: number, deltaY: number): void {
    if (!this.cameraController) return;

    const deltaYaw = -deltaX * cameraRotationSensitivity;
    const deltaPitch = deltaY * cameraRotationSensitivity;

    this.cameraController.applyRotationDelta(deltaYaw, deltaPitch);
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

    // Use the camera's forward direction projected onto the XZ plane.
    // This avoids inversion when the camera pitches beyond the horizon.
    const worldForward = new THREE.Vector3();
    camera.getWorldDirection(worldForward);
    worldForward.y = 0;
    worldForward.normalize();

    this.azimuthalAngle = Math.atan2(worldForward.x, worldForward.z);
  }

  private computeFinalRotation(): void {
    // playerIntendedRotationY already includes surface rotation effects (applied in updatePosition)
    this.currentRotation.ry = this.playerIntendedRotationY;
  }

  private updateRotation(moveDirectionX: number, moveDirectionZ: number): void {
    const movementMagnitude = Math.sqrt(
      moveDirectionX * moveDirectionX + moveDirectionZ * moveDirectionZ,
    );

    if (movementMagnitude > movementMagnitudeThreshold) {
      const targetRotation = Math.atan2(moveDirectionX, moveDirectionZ);

      // Lerp only the player's intended Y rotation (independent of surface rotation)
      this.playerIntendedRotationY = this.lerpAngle(
        this.playerIntendedRotationY,
        targetRotation,
        rotationLerpFactor,
      );
    }
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

  private getTargetAnimation(): "idle" | "run" | "air" | "doubleJump" {
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

    if (this.controlState.isSprinting) {
      return "run";
    }

    return "run"; // walking animation (use "run" as fallback)
  }

  private getAnimationState(): "idle" | "run" | "air" {
    const target = this.getTargetAnimation();
    if (target === "doubleJump") {
      return "air"; // Map doubleJump to air for the limited animation set
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

  private updatePlayerRotationFromCamera(): void {
    if (!this.cameraController) return;
    if (!this.props["rotate-with-camera"]) return;

    const forward = this.cameraController.getForwardDirection();
    const desiredYaw = Math.atan2(forward.x, forward.z);
    this.currentRotation.ry = desiredYaw;
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

    this.dispatchEvent(
      new CustomEvent("character-move", {
        detail: {
          position: {
            x: this.currentPosition.x,
            y: this.currentPosition.y,
            z: this.currentPosition.z,
          },
          rotation: {
            ry: (this.currentRotation.ry * 180) / Math.PI,
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

    // Physics update (runs every frame)
    const physicsDeltatime = (documentTime - this.lastPhysicsTime) / 1000;
    this.lastPhysicsTime = documentTime;

    // Update current height and surface angle
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

    if (this.controlState && this.controlState.direction !== null) {
      // Calculate the movement direction for rotation
      this.updateAzimuthalAngle();
      const heading = this.controlState.direction;
      const headingVector = this.tempVect3
        .set(0, 0, 1)
        .applyAxisAngle(this.vectorUp, this.azimuthalAngle + heading);
      this.updateRotation(headingVector.x, headingVector.z);
    }

    // Run collision detection in multiple steps for accuracy
    for (let i = 0; i < this.collisionDetectionSteps; i++) {
      this.updatePosition(physicsDeltatime, physicsDeltatime / this.collisionDetectionSteps, i);
    }

    // Compute final rotation by combining player and surface rotations
    this.computeFinalRotation();

    this.updateCameraPosition(physicsDeltatime);
    this.updatePlayerRotationFromCamera();

    // Update parent element transform every frame for smooth visuals
    this.updateParentElementTransform();

    // Server sync update (runs at specified interval)
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

    // Dampen the velocity based on the resistance
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
      // convert heading to direction vector
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

        // Extract Y rotation from surface movement and apply to player intended rotation
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

    // Offset position up by capsule radius so character position represents ground position
    avatarSegment.start.y += this.capsuleInfo.radius;
    avatarSegment.end.y += this.capsuleInfo.radius;

    const positionBeforeCollisions = this.tempVector.copy(avatarSegment.start);
    const excludeElement =
      this.parentElement && MElement.isMElement(this.parentElement)
        ? (this.parentElement as MElement<GameThreeJSAdapter>)
        : undefined;
    collisionsManager.applyColliders(avatarSegment, this.capsuleInfo.radius, excludeElement);

    // Raycast from the top of the capsule to the bottom of the capsule to see if there is a surface intersecting the capsule
    const capsuleLength =
      this.capsuleInfo.segment.end.y -
      this.capsuleInfo.segment.start.y +
      this.capsuleInfo.radius * 2;
    // Set the origin of the ray to the bottom of the segment (1 radius length from the bottom point of the capsule)
    this.tempRay.set(avatarSegment.start, this.vectorDown);

    // Move the ray origin to the bottom of the capsule and then add the total length to move the ray origin to the top point of the capsule
    this.tempRay.origin.y += -this.capsuleInfo.radius + capsuleLength - capsuleRayEndIgnoreLength;
    // Find the first mesh that intersects the ray
    const withinCapsuleRayHit = collisionsManager.raycastFirst(
      this.tempRay,
      capsuleLength - capsuleRayEndIgnoreLength * 2,
      excludeElement,
    );
    if (withinCapsuleRayHit !== null) {
      // There is a mesh ray collision within the capsule. Move the character up to the point of the collision
      const rayHitPosition = withinCapsuleRayHit[3];
      avatarSegment.start.copy(rayHitPosition);
      // Account for the radius of the capsule
      avatarSegment.start.y += this.capsuleInfo.radius;
    }

    // Subtract the radius offset to get the actual character ground position
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

    // If we have a last frame state, we can calculate the movement of the mesh to apply it to the user
    if (this.lastFrameSurfaceState !== null) {
      const meshState = this.lastFrameSurfaceState[0];

      // Extract the matrix from the current frame and the last frame
      const currentFrameMatrix = meshState.matrix;
      const lastFrameMatrix = this.lastFrameSurfaceState[1].lastMatrix;

      if (!lastFrameMatrix.equals(currentFrameMatrix)) {
        // The mesh has moved since the last frame - calculate the movement

        // Get the position of the mesh in the last frame
        const lastMeshPosition = this.surfaceTempVector1;
        const lastMeshRotation = this.surfaceTempQuat;
        lastFrameMatrix.decompose(lastMeshPosition, lastMeshRotation, this.surfaceTempVect3);

        // Get the position of the mesh in the current frame
        const currentMeshPosition = this.surfaceTempVector2;
        const currentMeshRotation = this.surfaceTempQuat2;
        currentFrameMatrix.decompose(
          currentMeshPosition,
          currentMeshRotation,
          this.surfaceTempVect3,
        );

        // Calculate the difference between the new position and the old position to determine the movement due to translation of position
        const meshTranslationDelta = this.surfaceTempVector5
          .copy(currentMeshPosition)
          .sub(lastMeshPosition);

        // Calculate the relative position of the user to the mesh in the last frame
        const lastFrameRelativeUserPosition = this.surfaceTempVect3
          .copy(userPosition)
          .sub(lastMeshPosition);

        // Calculate the world-relative rotation delta from the last frame to the current frame
        const meshRotationDelta = currentMeshRotation.multiply(lastMeshRotation.invert());

        // Apply the relative quaternion to the relative user position to determine the new position of the user given just the rotation
        const translationDueToRotation = this.surfaceTempVector4
          .copy(lastFrameRelativeUserPosition)
          .applyQuat(meshRotationDelta)
          .sub(lastFrameRelativeUserPosition);

        // Combine the mesh translation delta and the rotation translation delta to determine the total movement of the user
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

    // Raycast down from the new position to see if there is a surface below the user which will be tracked in the next frame
    const ray = this.surfaceTempRay.set(newPosition, downVector);
    const excludeElement =
      this.parentElement && MElement.isMElement(this.parentElement)
        ? (this.parentElement as MElement<GameThreeJSAdapter>)
        : undefined;
    const hit = collisionsManager.raycastFirst(ray, null, excludeElement);
    if (hit && hit[0] < maxSurfaceTrackingDistance) {
      // There is a surface below the user
      const currentCollisionMeshState = hit[2];
      this.lastFrameSurfaceState = [
        currentCollisionMeshState,
        { lastMatrix: currentCollisionMeshState.matrix.clone() },
      ];
    } else {
      if (this.lastFrameSurfaceState !== null && lastMovement) {
        // Apply the last movement to the user's velocity
        this.characterVelocity.add(
          lastMovement.position.clone().multiplyScalar(1 / deltaTime), // The position delta is the result of one tick which is deltaTime seconds, so we need to divide by deltaTime to get the velocity per second
        );
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

      // Initialize player intended rotation from parent's rotation
      this.playerIntendedRotationY = ry;
    } else {
      this.currentPosition.set(0, 0, 0);
      this.currentRotation.ry = 0;

      // Initialize player intended rotation to zero
      this.playerIntendedRotationY = 0;
    }

    this.characterVelocity.set(0, 0, 0);
    this.characterOnGround = false;
    this.doubleJumpUsed = false;
    this.jumpReleased = true;
    this.jumpCounter = 0;

    // Force immediate position synchronization to ensure the character controller
    // takes control and overrides any existing position state
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
      for (const name of MCharacterController.observedAttributes) {
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

    const graphicsAdapter = this.scene.getGraphicsAdapter();
    (graphicsAdapter as any).registerCharacterController(this);

    // Register with parent element for animation control
    if (this.parentElement && MElement.isMElement(this.parentElement)) {
      this.registeredParentAttachment = this.parentElement as MElement<G>;
      this.registeredParentAttachment.addSideEffectChild(this as any);
    }

    for (const name of MCharacterController.observedAttributes) {
      const value = this.getAttribute(name);
      if (value !== null) {
        this.attributeChangedCallback(name, null, value);
      }
    }

    this.startUpdateLoop();
  }

  public disconnectedCallback(): void {
    this.stopUpdateLoop();

    // Unregister from parent element
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
    if (this.cameraControl) {
      this.cameraControl.disconnectedCallback();
      this.cameraControl = null;
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
    MCharacterController.attributeHandler.handle(this, name, newValue);
  }
}
