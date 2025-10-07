import { EventHandlerCollection } from "@mml-io/mml-web";
import { PerspectiveCamera, Spherical, Vector3 } from "three";

const tempSpherical = new Spherical();

export class ThreeJSOrbitCameraControls {
  public readonly type = "orbit";

  private enabled = false;

  private yaw = 0;
  private pitch = Math.PI * 0.4;

  private minPolarAngle = -89.9999 * (Math.PI / 180);
  private maxPolarAngle = 89.9999 * (Math.PI / 180);

  private invertedMouseY = false;

  private dampingFactor = 0;
  private targetYaw = 0;
  private targetPitch = Math.PI * 0.4;

  private eventHandlerCollection: EventHandlerCollection = new EventHandlerCollection();
  private mouseDown = false;
  public cameraLookAt: Vector3 = new Vector3();

  constructor(
    public camera: PerspectiveCamera,
    private domElement: HTMLElement,
    private distance = 15.0,
  ) {
    this.domElement.style.userSelect = "none";
  }

  public enable() {
    if (this.enabled) {
      return;
    }
    this.enabled = true;
    this.eventHandlerCollection.add(window, "blur", this.onBlur.bind(this));
    this.eventHandlerCollection.add(document, "mousemove", this.onMouseMove.bind(this));
    this.eventHandlerCollection.add(this.domElement, "mousedown", this.onMouseDown.bind(this));
    this.eventHandlerCollection.add(document, "mouseup", this.onMouseUp.bind(this));
    this.eventHandlerCollection.add(document, "wheel", this.onMouseWheel.bind(this));
  }

  public disable() {
    if (!this.enabled) {
      return;
    }
    this.eventHandlerCollection.clear();
    this.enabled = false;
  }

  public setInvert(invert: boolean) {
    this.invertedMouseY = invert;
  }

  public setDamping(amount: number) {
    this.dampingFactor = Math.max(0, amount);
    this.targetYaw = this.yaw;
    this.targetPitch = this.pitch;
  }

  public applyRotationDelta(deltaYaw: number, deltaPitch: number): void {
    if (this.dampingFactor > 0) {
      this.targetYaw += deltaYaw;
      this.targetPitch += deltaPitch;

      this.targetYaw = this.targetYaw % (Math.PI * 2);
      this.targetPitch = this.targetPitch % (Math.PI * 2);
      this.targetPitch = Math.max(
        Math.PI / 2 - this.maxPolarAngle,
        Math.min(Math.PI / 2 - this.minPolarAngle, this.targetPitch),
      );
    } else {
      this.yaw += deltaYaw;
      this.pitch += deltaPitch;
      this.yaw = this.yaw % (Math.PI * 2);
      this.pitch = this.pitch % (Math.PI * 2);
      this.pitch = Math.max(
        Math.PI / 2 - this.maxPolarAngle,
        Math.min(Math.PI / 2 - this.minPolarAngle, this.pitch),
      );
    }
  }

  public dispose() {
    this.disable();
  }

  public update(dt: number = 0.016) {
    if (this.dampingFactor > 0) {
      const dampingRate = Math.max(0.01, Math.min(0.99, this.dampingFactor));
      const lerpFactor = Math.pow(1 - dampingRate, dt * 60);
      this.yaw = this.yaw * lerpFactor + this.targetYaw * (1 - lerpFactor);
      this.pitch = this.pitch * lerpFactor + this.targetPitch * (1 - lerpFactor);
    }

    tempSpherical.set(this.distance, this.pitch, this.yaw);
    this.camera.position.setFromSpherical(tempSpherical);
    this.camera.position.add(this.cameraLookAt);

    this.camera.lookAt(this.cameraLookAt);
  }

  public updateInWorldSpaceAbsolute(
    targetWorldPosition: {
      x: number;
      y: number;
      z: number;
    },
    dt: number = 0.016,
  ) {
    if (this.dampingFactor > 0) {
      const dampingRate = Math.max(0.01, Math.min(0.99, this.dampingFactor));
      const lerpFactor = Math.pow(1 - dampingRate, dt * 60);
      this.yaw = this.yaw * lerpFactor + this.targetYaw * (1 - lerpFactor);
      this.pitch = this.pitch * lerpFactor + this.targetPitch * (1 - lerpFactor);
    }

    tempSpherical.set(this.distance, this.pitch, this.yaw);
    const worldCameraPos = new Vector3();
    worldCameraPos.setFromSpherical(tempSpherical);
    worldCameraPos.add(
      new Vector3(targetWorldPosition.x, targetWorldPosition.y, targetWorldPosition.z),
    );

    this.camera.position.copy(worldCameraPos);

    this.camera.lookAt(
      new Vector3(targetWorldPosition.x, targetWorldPosition.y, targetWorldPosition.z),
    );
  }

  private onBlur() {
    this.mouseDown = false;
  }

  private onMouseDown() {
    this.mouseDown = true;
  }

  public setLookAt(x: number, y: number, z: number) {
    this.cameraLookAt.set(x, y, z);
  }

  public setDistance(distance: number) {
    this.distance = distance;
  }

  public getForwardDirection(): Vector3 {
    const forward = new Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));

    return forward.normalize();
  }

  private onMouseMove(event: MouseEvent) {
    if (!(this.mouseDown || this.isPointerLocked())) {
      return;
    }
    const movementX = event.movementX;
    let movementY = event.movementY;

    if (this.invertedMouseY) {
      movementY *= -1;
    }

    const deltaYaw = movementX * -0.005;
    const deltaPitch = movementY * -0.005;

    if (this.dampingFactor > 0) {
      this.targetYaw += deltaYaw;
      this.targetPitch += deltaPitch;

      this.targetYaw = this.targetYaw % (Math.PI * 2);
      this.targetPitch = this.targetPitch % (Math.PI * 2);
      this.targetPitch = Math.max(
        Math.PI / 2 - this.maxPolarAngle,
        Math.min(Math.PI / 2 - this.minPolarAngle, this.targetPitch),
      );
    } else {
      this.yaw += deltaYaw;
      this.pitch += deltaPitch;
      this.yaw = this.yaw % (Math.PI * 2);
      this.pitch = this.pitch % (Math.PI * 2);
      this.pitch = Math.max(
        Math.PI / 2 - this.maxPolarAngle,
        Math.min(Math.PI / 2 - this.minPolarAngle, this.pitch),
      );
    }
  }

  private onMouseUp() {
    this.mouseDown = false;
  }

  private onMouseWheel(event: WheelEvent) {
    this.distance += event.deltaY * 0.01;
    this.distance = Math.max(0.01, Math.min(this.distance, 1000));
  }

  private isPointerLocked(): boolean {
    return !!document.pointerLockElement;
  }
}
