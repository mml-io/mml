import * as playcanvas from "playcanvas";

import { EventHandlerCollection } from "../../utils/events/EventHandlerCollection";

// Creates a set of 5DOF flight controls that requires dragging the mouse to move the rotation and position of the camera
export class PlayCanvasDragFlyCameraControls {
  private enabled = false;

  private camera: playcanvas.Entity;
  private domElement: HTMLElement;

  private speed: number;
  private vForward = new playcanvas.Vec3();
  private vUp = new playcanvas.Vec3();
  private vRight = new playcanvas.Vec3();
  private vMovement = new playcanvas.Vec3();

  private forward = false;
  private backward = false;
  private left = false;
  private right = false;
  private up = false;
  private down = false;

  // Set to constrain the pitch of the camera
  // Range is 0 to Math.PI radians
  private minPolarAngle = -90; // radians
  private maxPolarAngle = 90; // radians

  // This is an addition to the original PointerLockControls class
  private invertedMouseY = false;

  private eventHandlerCollection: EventHandlerCollection = new EventHandlerCollection();
  private mouseDown = false;

  constructor(camera: playcanvas.Entity, domElement: HTMLElement, speed = 15.0) {
    this.camera = camera;
    this.domElement = domElement;
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

  // This is an addition to the original PointerLockControls class
  public setInvert(invert: boolean) {
    this.invertedMouseY = invert;
  }

  public dispose() {
    this.disable();
  }

  public update(dt: number) {
    if (!this.mouseDown) {
      return;
    }

    this.vForward = this.camera.getLocalEulerAngles();
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

  private onMouseDown(event: MouseEvent) {
    this.mouseDown = true;
    event.preventDefault();
  }

  private onMouseMove(event: MouseEvent) {
    if (!this.mouseDown) {
      return;
    }
    const movementX = event.movementX;
    let movementY = event.movementY;

    // This is an addition to the original PointerLockControls class
    if (this.invertedMouseY) {
      movementY *= -1;
    }

    let euler = new playcanvas.Vec3();
    euler.y = -movementX * 0.2;
    euler.x = -movementY * 0.2;
    euler.z = 0;
    this.camera.rotateLocal(euler);

    euler = this.camera.getLocalEulerAngles();
    euler.z = 0;
    this.camera.setLocalEulerAngles(euler);
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
