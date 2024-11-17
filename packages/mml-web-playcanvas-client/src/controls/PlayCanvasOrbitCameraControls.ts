import { EventHandlerCollection, IVect3, Vect3 } from "@mml-io/mml-web";
import * as playcanvas from "playcanvas";

import { PlayCanvasControls } from "./PlayCanvasControls";

export class PlayCanvasOrbitCameraControls implements PlayCanvasControls {
  public readonly type = "orbit";

  private enabled = false;

  private degreesPerSecond = 10;
  private yaw = 0;
  private pitch = Math.PI * 0.4;

  // Set to constrain the pitch of the camera
  private minPolarAngle = -89.9999 * (Math.PI / 180);
  private maxPolarAngle = 89.9999 * (Math.PI / 180);

  private invertedMouseY = false;

  private eventHandlerCollection: EventHandlerCollection = new EventHandlerCollection();
  private mouseDown = false;
  private cameraLookAt: Vect3 = new Vect3();

  constructor(
    private camera: playcanvas.Entity,
    private domElement: HTMLElement,
    private distance = 15.0,
  ) {
    this.domElement.style.userSelect = "none";
  }

  public fitContent(boundingBox: { min: IVect3; max: IVect3 }) {
    const center = {
      x: (boundingBox.min.x + boundingBox.max.x) / 2,
      y: (boundingBox.min.y + boundingBox.max.y) / 2,
      z: (boundingBox.min.z + boundingBox.max.z) / 2,
    };
    const size = {
      x: boundingBox.max.x - boundingBox.min.x,
      y: boundingBox.max.y - boundingBox.min.y,
      z: boundingBox.max.z - boundingBox.min.z,
    };
    const fov = this.camera?.camera?.fov || 1;
    const maximumDimension = Math.max(size.x, size.y, size.z);
    this.distance = Math.abs(maximumDimension / 4 / Math.tan(fov / 2));
    this.setLookAt(center.x, center.y, center.z);
    this.update();
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

  public dispose() {
    this.disable();
  }

  private getBaseYaw(): number {
    return (-((Date.now() / 1000) * this.degreesPerSecond) % 360) * (Math.PI / 180);
  }

  public update() {
    const baseYaw = this.getBaseYaw();
    const yaw = baseYaw + this.yaw;
    const sinPhiRadius = Math.sin(this.pitch) * this.distance;
    const x = sinPhiRadius * Math.sin(yaw);
    const y = Math.cos(this.pitch) * this.distance;
    const z = sinPhiRadius * Math.cos(yaw);

    this.camera.setPosition(x, y, z);
    this.camera.translate(this.cameraLookAt.x, this.cameraLookAt.y, this.cameraLookAt.z);

    this.camera.lookAt(this.cameraLookAt.x, this.cameraLookAt.y, this.cameraLookAt.z);
  }

  private onBlur() {
    this.mouseDown = false;
  }

  private onMouseDown() {
    this.mouseDown = true;
  }

  public setDegreesPerSecond(degreesPerSecond: number) {
    this.degreesPerSecond = degreesPerSecond;
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
