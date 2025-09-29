import {
  AttributeHandler,
  MElement,
  MMLScene,
  OrientedBoundingBox,
  parseFloatAttribute,
} from "@mml-io/mml-web";
import * as THREE from "three";

import { GameThreeJSAdapter } from "../GameThreeJSAdapter";
import { ThreeJSOrbitCameraControls } from "../ThreeJSOrbitCameraControls";
import { ControlGraphics, MControl } from "./Control";

// tag props
const defaultMovementSpeed = 0.12;
const defaultJumpForce = 25.0;
const defaultGravity = 60.0;
const defaultCameraDistance = 7;
const defaultCameraHeight = 1.8;
const defaultUpdateInterval = 100;

// character controller constants
const cameraFov = 60;
const cameraNearPlane = 0.01;
const cameraFarPlane = 1000;
const cameraRotationSensitivity = 0.03;
const cameraDampingFactor = 0.07;

const groundLevel = 0;
const groundDetectionThreshold = 0.1;
const movementDetectionThreshold = 0.1;
const rotationLerpFactor = 0.25;
const animationMovementThreshold = 0.1;

const cameraRight = new THREE.Vector3();
const cameraUp = new THREE.Vector3();
const cameraForward = new THREE.Vector3();

export type MCharacterControllerProps = {
  "movement-speed": number;
  "jump-force": number;
  gravity: number;
  "camera-distance": number;
  "camera-height": number;
  "update-interval": number;
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
    "jump-force": defaultJumpForce,
    gravity: defaultGravity,
    "camera-distance": defaultCameraDistance,
    "camera-height": defaultCameraHeight,
    "update-interval": defaultUpdateInterval,
  };

  public threeJSCamera: THREE.PerspectiveCamera | null = null;
  private cameraController: ThreeJSOrbitCameraControls | null = null;

  private movementControl: MControl<G> | null = null;
  private jumpControl: MControl<G> | null = null;
  private cameraControl: MControl<G> | null = null;

  private currentPosition: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  private currentRotation = { ry: 0 };
  private verticalVelocity = 0;

  private currentMovementInput = { x: 0, y: 0 };
  private isJumpRequested = false;

  private documentTimeListener: { remove: () => void } | null = null;
  private lastPhysicsTime = 0;
  private lastServerSyncTime = 0;

  public scene: MMLScene<GameThreeJSAdapter>;

  private registeredParentAttachment: MElement<G> | null = null;

  private static attributeHandler = new AttributeHandler<MCharacterController<GameThreeJSAdapter>>({
    "movement-speed": (instance, newValue) => {
      instance.props["movement-speed"] = parseFloatAttribute(newValue, defaultMovementSpeed);
    },
    "jump-force": (instance, newValue) => {
      instance.props["jump-force"] = parseFloatAttribute(newValue, defaultJumpForce);
    },
    gravity: (instance, newValue) => {
      instance.props["gravity"] = parseFloatAttribute(newValue, defaultGravity);
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

    control.startInputPolling();
  }

  private handleMovementInput(event: CustomEvent): void {
    const inputData = event.detail;
    if (inputData.value && typeof inputData.value === "object") {
      const movement = inputData.value as { x: number; y: number };
      this.currentMovementInput = { x: movement.x, y: movement.y };
      this.processMovement(movement.x, movement.y);
    } else {
      this.currentMovementInput = { x: 0, y: 0 };
    }
  }

  private handleJumpInput(event: CustomEvent): void {
    const inputData = event.detail;
    this.isJumpRequested = inputData.value === true;
    if (this.isJumpRequested && this.isGrounded()) {
      this.processJump();
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

  private processMovement(inputX: number, inputY: number): void {
    if (!this.cameraController) return;

    const camera = this.scene.getGraphicsAdapter().getCamera();
    camera.matrixWorld.extractBasis(cameraRight, cameraUp, cameraForward);
    const forward = new THREE.Vector3(-cameraUp.x, 0, -cameraUp.z).negate().normalize();
    const right = new THREE.Vector3(cameraRight.x, 0, cameraRight.z).normalize();

    const moveVector = new THREE.Vector3();
    moveVector.addScaledVector(forward, inputY * this.props["movement-speed"]);
    moveVector.addScaledVector(right, inputX * this.props["movement-speed"]);

    this.currentPosition.x += moveVector.x;
    this.currentPosition.z += moveVector.z;

    if (moveVector.length() > movementDetectionThreshold) {
      const newRotation = Math.atan2(moveVector.x, moveVector.z);
      this.currentRotation.ry = this.lerpAngle(
        this.currentRotation.ry,
        newRotation,
        rotationLerpFactor,
      );
    }

    this.updateCameraPosition();
  }

  private processJump(): void {
    if (!this.isGrounded()) return;

    this.verticalVelocity = this.props["jump-force"];
  }

  private applyGravity(deltaTime: number): void {
    this.verticalVelocity -= this.props["gravity"] * deltaTime;
    const newY = this.currentPosition.y + this.verticalVelocity * deltaTime;

    if (newY <= groundLevel) {
      this.currentPosition.y = groundLevel;
      this.verticalVelocity = 0;
    } else {
      this.currentPosition.y = newY;
    }
  }

  private isGrounded(): boolean {
    return this.currentPosition.y <= groundDetectionThreshold;
  }

  private getAnimationState(): "idle" | "run" | "air" {
    if (!this.isGrounded()) {
      return "air";
    }

    const movementMagnitude = Math.sqrt(
      this.currentMovementInput.x * this.currentMovementInput.x +
        this.currentMovementInput.y * this.currentMovementInput.y,
    );

    if (movementMagnitude > animationMovementThreshold) {
      return "run";
    }

    return "idle";
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
    this.applyGravity(physicsDeltatime);
    this.updateCameraPosition(physicsDeltatime);

    // Server sync update (runs at specified interval)
    const timeSinceLastSync = documentTime - this.lastServerSyncTime;
    if (timeSinceLastSync >= this.props["update-interval"]) {
      this.dispatchCharacterMoveEvent();
      this.lastServerSyncTime = documentTime;
    }
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
    } else {
      this.currentPosition.set(0, 0, 0);
      this.currentRotation.ry = 0;
    }

    this.verticalVelocity = 0;

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

  public attributeChangedCallback(name: string, oldValue: string | null, newValue: string): void {
    super.attributeChangedCallback(name, oldValue, newValue);
    MCharacterController.attributeHandler.handle(this, name, newValue);
  }
}
