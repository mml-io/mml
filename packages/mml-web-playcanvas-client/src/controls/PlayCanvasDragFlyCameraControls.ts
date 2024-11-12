import { EventHandlerCollection, Matr4, Quat } from "mml-web";
import * as playcanvas from "playcanvas";

const up = { x: 0, y: 1, z: 0 };
const right = { x: 1, y: 0, z: 0 };
const quaternion = new Quat();
const qPitch = new Quat();
const qYaw = new Quat();

// Creates a set of 5DOF flight controls that requires dragging the mouse to move the rotation and position of the camera
export class PlayCanvasDragFlyCameraControls {
  public readonly type = "drag-fly";

  private enabled = false;

  private camera: playcanvas.Entity;
  private domElement: HTMLElement;

  private speed: number;
  private yaw = 0;
  private pitch = 0;

  private forward = false;
  private backward = false;
  private left = false;
  private right = false;
  private up = false;
  private down = false;

  // Set to constrain the pitch of the camera
  private minPolarAngle = 0 * (Math.PI / 180);
  private maxPolarAngle = 180 * (Math.PI / 180);

  private invertedMouseY = false;

  private eventHandlerCollection: EventHandlerCollection = new EventHandlerCollection();
  private mouseDown = false;

  constructor(camera: playcanvas.Entity, domElement: HTMLElement, speed = 15.0) {
    this.camera = camera;
    this.domElement = domElement;
    this.domElement.style.userSelect = "none";
    this.speed = speed;
  }

  public enable() {
    if (this.enabled) {
      return;
    }
    this.enabled = true;
    this.eventHandlerCollection.add(document, "keydown", this.onKeyDown.bind(this));
    this.eventHandlerCollection.add(document, "keyup", this.onKeyUp.bind(this));
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

  public setCameraPosition(x: number, y: number, z: number) {
    this.camera.setLocalPosition(x, y, z);
  }

  public setLookAt(x: number, y: number, z: number) {
    this.camera.lookAt(x, y, z);
    const q1 = new Quat().setFromEulerXYZ(this.camera.getRotation());
    const { yaw, pitch } = getYawPitchFromQuaternion(q1);
    this.yaw = yaw;
    this.pitch = pitch;
  }

  public update(dt: number) {
    if (!this.mouseDown) {
      return;
    }

    this.camera.translateLocal(
      (Number(this.right) - Number(this.left)) * dt * 30,
      (Number(this.up) - Number(this.down)) * dt * 30,
      (Number(this.backward) - Number(this.forward)) * dt * 30,
    );
  }

  private onKeyDown(event: KeyboardEvent) {
    if (!this.mouseDown) {
      return;
    }
    switch (event.code) {
      case "ArrowUp":
      case "KeyW":
        this.forward = true;
        break;
      case "ArrowLeft":
      case "KeyA":
        this.left = true;
        break;
      case "ArrowDown":
      case "KeyS":
        this.backward = true;
        break;
      case "ArrowRight":
      case "KeyD":
        this.right = true;
        break;
      case "Space":
        this.up = true;
        break;
      case "ShiftLeft":
        this.down = true;
        break;
    }
    event.preventDefault();
  }

  private onKeyUp(event: KeyboardEvent) {
    switch (event.code) {
      case "ArrowUp":
      case "KeyW":
        this.forward = false;
        break;
      case "ArrowLeft":
      case "KeyA":
        this.left = false;
        break;
      case "ArrowDown":
      case "KeyS":
        this.backward = false;
        break;
      case "ArrowRight":
      case "KeyD":
        this.right = false;
        break;
      case "Space":
        this.up = false;
        break;
      case "ShiftLeft":
        this.down = false;
        break;
    }
  }

  private onBlur() {
    this.mouseDown = false;
    this.forward = false;
    this.left = false;
    this.backward = false;
    this.right = false;
    this.up = false;
    this.down = false;
  }

  private onMouseDown() {
    this.mouseDown = true;
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

    qPitch.setFromAxisAngle(right, this.pitch);
    qYaw.setFromAxisAngle(up, this.yaw);

    quaternion.set(0, 0, 0, 1);
    quaternion.multiply(qYaw);
    quaternion.multiply(qPitch);

    this.camera.setLocalRotation(quaternion.x, quaternion.y, quaternion.z, quaternion.w);
  }

  private onMouseUp() {
    this.mouseDown = false;
  }

  private onMouseWheel(event: WheelEvent) {
    if (!this.mouseDown) {
      return;
    }
    this.speed -= event.deltaY * 0.1;

    // restrict to a reasonable min and max
    this.speed = Math.max(5, Math.min(this.speed, 1000));
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getYawPitchFromQuaternion(quaternion: Quat) {
  const matr4 = new Matr4();
  matr4.setRotationFromQuaternion(quaternion);

  const d = matr4.data;
  const m11 = d[0];
  const m13 = d[8];
  const m23 = d[9];
  const m31 = d[2];
  const m33 = d[10];

  const yaw = Math.abs(m23) < 0.9999999 ? Math.atan2(m13, m33) : Math.atan2(-m31, m11);
  const pitch = Math.asin(-clamp(m23, -1, 1));
  return { yaw, pitch };
}
