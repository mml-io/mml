import { EventHandlerCollection } from "mml-web";
import { Camera, Spherical, Vector3 } from "three";

import { Controls } from "./Controls";

const tempSpherical = new Spherical();

export class ThreeJSOrbitCameraControls implements Controls {
  public readonly type = "orbit";

  private enabled = false;

  private camera: Camera;
  private domElement: HTMLElement;

  private distance: number;
  private degreesPerSecond = 10;
  private yaw = 0;
  private pitch = Math.PI * 0.4;

  // Set to constrain the pitch of the camera
  private minPolarAngle = -89.9999 * (Math.PI / 180);
  private maxPolarAngle = 89.9999 * (Math.PI / 180);

  // This is an addition to the original PointerLockControls class
  private invertedMouseY = false;

  private eventHandlerCollection: EventHandlerCollection = new EventHandlerCollection();
  private mouseDown = false;
  private cameraLookAt: Vector3 = new Vector3();

  constructor(camera: Camera, domElement: HTMLElement, distance = 15.0) {
    this.camera = camera;
    this.domElement = domElement;
    this.domElement.style.userSelect = "none";
    this.distance = distance;
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

  // This is an addition to the original PointerLockControls class
  public setInvert(invert: boolean) {
    this.invertedMouseY = invert;
  }

  public dispose() {
    this.disable();
  }

  private getBaseYaw(): number {
    return (-((Date.now() / 1000) * this.degreesPerSecond) % 360) * (Math.PI / 180);
  }

  public update() {
    const baseYaw = this.getBaseYaw();
    const yaw = baseYaw + this.yaw;

    tempSpherical.set(this.distance, this.pitch, yaw);
    this.camera.position.setFromSpherical(tempSpherical);
    this.camera.position.add(this.cameraLookAt);

    this.camera.lookAt(this.cameraLookAt.x, this.cameraLookAt.y, this.cameraLookAt.z);
  }

  private onBlur() {
    this.mouseDown = false;
  }

  private onMouseDown() {
    this.mouseDown = true;
  }

  public setDegreesPerSecond(degreesPerSecond: number) {
    // const previousBaseYaw = this.getBaseYaw();
    this.degreesPerSecond = degreesPerSecond;
    // const newBaseYaw = this.getBaseYaw();
    // this.yaw += previousBaseYaw - newBaseYaw;
  }

  public setLookAt(x: number, y: number, z: number) {
    this.cameraLookAt.set(x, y, z);
  }

  public setDistance(distance: number) {
    this.distance = distance;
  }

  public setPitchDegrees(pitch: number) {
    this.pitch = pitch * (Math.PI / 180);
    this.pitch = this.pitch % (Math.PI * 2);
  }

  private onMouseMove(event: MouseEvent) {
    if (!this.mouseDown) {
      return;
    }
    const movementX = event.movementX;
    let movementY = event.movementY;

    if (this.invertedMouseY) {
      movementY *= -1;
    }

    this.yaw += movementX * -0.002;
    this.pitch += movementY * -0.002;
    this.yaw = this.yaw % (Math.PI * 2);
    this.pitch = this.pitch % (Math.PI * 2);
    this.pitch = Math.max(
      Math.PI / 2 - this.maxPolarAngle,
      Math.min(Math.PI / 2 - this.minPolarAngle, this.pitch),
    );
  }
  private onMouseUp() {
    this.mouseDown = false;
  }

  private onMouseWheel(event: WheelEvent) {
    this.distance += event.deltaY * 0.1;
    this.distance = Math.max(0.01, Math.min(this.distance, 1000));
  }
}
